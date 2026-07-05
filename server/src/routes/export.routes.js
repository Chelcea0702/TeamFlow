const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireProjectRole } = require("../middleware/permissions");
const { toCsv } = require("../utils/csv");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// Exports respect the same filter query params as GET /tasks, so the
// exported file always matches what the user was looking at -- Section 2
// "Reporting" requirement: CSV export scoped to the active filter state.
router.get("/tasks", requireProjectRole(["owner", "contributor", "viewer"]), async (req, res, next) => {
  try {
    const { status, assignee, q } = req.query;
    const clauses = ["t.project_id = $1"];
    const params = [req.params.projectId];

    if (status) {
      params.push(status);
      clauses.push(`t.status = $${params.length}`);
    }
    if (assignee) {
      params.push(assignee);
      clauses.push(`t.assignee_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      clauses.push(`t.title ILIKE $${params.length}`);
    }

    const rows = await query(
      `SELECT t.id, t.title, t.status, t.priority, u.name AS assignee, t.due_date, t.created_at
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE ${clauses.join(" AND ")} ORDER BY t.created_at`,
      params
    );

    const csv = toCsv(rows, ["id", "title", "status", "priority", "assignee", "due_date", "created_at"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="tasks-export.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
