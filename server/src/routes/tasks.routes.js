const express = require("express");
const { query, withTransaction } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireProjectRole } = require("../middleware/permissions");
const activityLog = require("../utils/activityLog");
const bus = require("../utils/eventBus");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// Section 3.1: a fixed set of statuses with an explicit allowed-transitions
// table, rather than free-form updates, so project history stays trustworthy.
// Extracted to utils/taskRules.js so it can be unit-tested without a database.
const { canTransition } = require("../utils/taskRules");

async function assertProjectMember(projectId, userId, isAdmin) {
  if (isAdmin) return "owner";
  const rows = await query(`SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2`, [projectId, userId]);
  if (rows.length === 0) {
    const err = new Error("Not a member of this project");
    err.status = 403;
    throw err;
  }
  return rows[0].role;
}

// GET /api/projects/:projectId/tasks?status=&assignee=&sort=&q=
router.get("/", async (req, res, next) => {
  try {
    await assertProjectMember(req.params.projectId, req.user.id, req.user.isAdmin);
    const { status, assignee, q, sort } = req.query;
    const clauses = ["project_id = $1"];
    const params = [req.params.projectId];

    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    if (assignee) {
      params.push(assignee);
      clauses.push(`assignee_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }

    const sortColumn = { due_date: "due_date", priority: "priority", title: "title", created_at: "created_at" }[sort] || "created_at";
    const rows = await query(
      `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY ${sortColumn} ASC NULLS LAST`,
      params
    );
    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    const { title, description, priority, assigneeId, dueDate, parentTaskId } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const task = await withTransaction(async (tx) => {
      const rows = await tx.query(
        `INSERT INTO tasks (project_id, title, description, priority, assignee_id, due_date, parent_task_id, created_by)
         VALUES ($1,$2,$3,COALESCE($4,'medium'),$5,$6,$7,$8) RETURNING *`,
        [req.params.projectId, title, description || null, priority, assigneeId || null, dueDate || null, parentTaskId || null, req.user.id]
      );
      const task = rows[0];
      await activityLog.record(tx, { entityType: "task", entityId: task.id, actorId: req.user.id, action: "created", details: { title } });
      return task;
    });

    if (task.assignee_id) {
      bus.publish("task.assigned", {
        taskId: task.id, projectId: task.project_id, assigneeId: task.assignee_id,
        actorId: req.user.id, taskTitle: task.title,
      });
    }
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

router.get("/:taskId", async (req, res, next) => {
  try {
    await assertProjectMember(req.params.projectId, req.user.id, req.user.isAdmin);
    const rows = await query(`SELECT * FROM tasks WHERE id = $1 AND project_id = $2`, [req.params.taskId, req.params.projectId]);
    if (rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const relations = await query(
      `SELECT tr.*, t.title AS related_title, t.status AS related_status
       FROM task_relations tr JOIN tasks t ON t.id = tr.related_task_id
       WHERE tr.task_id = $1`,
      [req.params.taskId]
    );
    const subtasks = await query(`SELECT id, title, status FROM tasks WHERE parent_task_id = $1`, [req.params.taskId]);

    res.json({ task: rows[0], relations, subtasks });
  } catch (err) {
    next(err);
  }
});

router.patch("/:taskId", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    const existingRows = await query(`SELECT * FROM tasks WHERE id = $1 AND project_id = $2`, [req.params.taskId, req.params.projectId]);
    if (existingRows.length === 0) return res.status(404).json({ error: "Task not found" });
    const existing = existingRows[0];

    const { title, description, priority, assigneeId, dueDate, status } = req.body;
    let dependencyWarning = null;

    if (status && status !== existing.status) {
      if (!canTransition(existing.status, status)) {
        return res.status(400).json({ error: `Cannot move task from ${existing.status} to ${status}` });
      }

      // Section 3.2: dependency conflicts are surfaced as warnings, not
      // blocking failures. Moving to "done" while a blocking task is not
      // done itself is flagged but still allowed to save.
      if (status === "done") {
        const blockers = await query(
          `SELECT t.id, t.title, t.status FROM task_relations tr
           JOIN tasks t ON t.id = tr.related_task_id
           WHERE tr.task_id = $1 AND tr.type = 'blocked_by' AND t.status != 'done'`,
          [req.params.taskId]
        );
        if (blockers.length > 0) {
          dependencyWarning = {
            message: "This task is being marked done while it is still blocked by an incomplete task.",
            blockers,
          };
        }
      }
    }

    const updated = await withTransaction(async (tx) => {
      const rows = await tx.query(
        `UPDATE tasks SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           priority = COALESCE($3, priority),
           assignee_id = COALESCE($4, assignee_id),
           due_date = COALESCE($5, due_date),
           status = COALESCE($6, status),
           updated_at = now()
         WHERE id = $7 RETURNING *`,
        [title, description, priority, assigneeId, dueDate, status, req.params.taskId]
      );
      const task = rows[0];

      if (status && status !== existing.status) {
        await activityLog.record(tx, {
          entityType: "task", entityId: task.id, actorId: req.user.id, action: "status_changed",
          details: { from: existing.status, to: status, dependencyWarning: !!dependencyWarning },
        });
      }
      if (assigneeId && assigneeId !== existing.assignee_id) {
        await activityLog.record(tx, {
          entityType: "task", entityId: task.id, actorId: req.user.id, action: "reassigned",
          details: { from: existing.assignee_id, to: assigneeId },
        });
      }
      return task;
    });

    if (status && status !== existing.status && updated.assignee_id) {
      bus.publish("task.status_changed", {
        taskId: updated.id, projectId: updated.project_id, actorId: req.user.id,
        taskTitle: updated.title, fromStatus: existing.status, toStatus: status, assigneeId: updated.assignee_id,
      });
    }
    if (assigneeId && assigneeId !== existing.assignee_id) {
      bus.publish("task.assigned", {
        taskId: updated.id, projectId: updated.project_id, assigneeId, actorId: req.user.id, taskTitle: updated.title,
      });
    }

    res.json({ task: updated, dependencyWarning });
  } catch (err) {
    next(err);
  }
});

router.delete("/:taskId", requireProjectRole(["owner"]), async (req, res, next) => {
  try {
    await withTransaction(async (tx) => {
      await tx.query(`DELETE FROM tasks WHERE id = $1 AND project_id = $2`, [req.params.taskId, req.params.projectId]);
      await activityLog.record(tx, { entityType: "task", entityId: req.params.taskId, actorId: req.user.id, action: "deleted" });
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Dependencies
router.post("/:taskId/relations", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    const { relatedTaskId, type } = req.body;
    if (!["blocks", "blocked_by"].includes(type)) {
      return res.status(400).json({ error: "type must be blocks or blocked_by" });
    }
    if (relatedTaskId === req.params.taskId) {
      return res.status(400).json({ error: "A task cannot depend on itself" });
    }
    await query(
      `INSERT INTO task_relations (task_id, related_task_id, type) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [req.params.taskId, relatedTaskId, type]
    );
    // Also record the mirror relation so the graph is queryable from either side.
    const mirrorType = type === "blocks" ? "blocked_by" : "blocks";
    await query(
      `INSERT INTO task_relations (task_id, related_task_id, type) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [relatedTaskId, req.params.taskId, mirrorType]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:taskId/relations/:relationId", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    await query(`DELETE FROM task_relations WHERE id = $1`, [req.params.relationId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
