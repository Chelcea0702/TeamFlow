const express = require("express");
const { query, withTransaction } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireProjectRole } = require("../middleware/permissions");
const activityLog = require("../utils/activityLog");

const router = express.Router();
router.use(requireAuth);

// List projects the current user is a member of (or all, if admin).
router.get("/", async (req, res, next) => {
  try {
    const rows = req.user.isAdmin
      ? await query(`SELECT * FROM projects ORDER BY created_at DESC`)
      : await query(
          `SELECT p.*, pm.role, pm.view_pref
           FROM projects p JOIN project_members pm ON pm.project_id = p.id
           WHERE pm.user_id = $1 ORDER BY p.created_at DESC`,
          [req.user.id]
        );
    res.json({ projects: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const project = await withTransaction(async (tx) => {
      const rows = await tx.query(
        `INSERT INTO projects (name, description, created_by) VALUES ($1,$2,$3) RETURNING *`,
        [name, description || null, req.user.id]
      );
      const project = rows[0];
      await tx.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner')`,
        [project.id, req.user.id]
      );
      await activityLog.record(tx, {
        entityType: "project",
        entityId: project.id,
        actorId: req.user.id,
        action: "created",
      });
      return project;
    });

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get("/:projectId", requireProjectRole(["owner", "contributor", "viewer"]), async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.projectId]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ project: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Members
router.get("/:projectId/members", requireProjectRole(["owner", "contributor", "viewer"]), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT u.id, u.name, u.email, pm.role, pm.view_pref
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 ORDER BY u.name`,
      [req.params.projectId]
    );
    res.json({ members: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/:projectId/members", requireProjectRole(["owner"]), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    if (!["owner", "contributor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "role must be owner, contributor, or viewer" });
    }
    const userRows = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (userRows.length === 0) return res.status(404).json({ error: "No user with that email" });

    await query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.projectId, userRows[0].id, role]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Per-user, per-project view preference (Kanban / calendar / list), persists across sessions.
router.patch("/:projectId/view-preference", requireProjectRole(["owner", "contributor", "viewer"]), async (req, res, next) => {
  try {
    const { viewPref } = req.body;
    if (!["kanban", "calendar", "list"].includes(viewPref)) {
      return res.status(400).json({ error: "viewPref must be kanban, calendar, or list" });
    }
    await query(
      `UPDATE project_members SET view_pref = $1 WHERE project_id = $2 AND user_id = $3`,
      [viewPref, req.params.projectId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
