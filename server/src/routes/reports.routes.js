const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireProjectRole } = require("../middleware/permissions");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// Section 2.3 / 3: dashboard figures reflect live data at request time --
// no precomputed/materialised aggregates, so every call here queries
// current state directly.
router.get("/summary", requireProjectRole(["owner", "contributor", "viewer"]), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const [completion] = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'done')::int AS done,
         COUNT(*)::int AS total
       FROM tasks WHERE project_id = $1`,
      [projectId]
    );

    const workload = await query(
      `SELECT u.id, u.name, COUNT(t.id)::int AS open_tasks
       FROM users u
       JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = $1
       LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = $1 AND t.status != 'done'
       GROUP BY u.id, u.name ORDER BY open_tasks DESC`,
      [projectId]
    );

    const velocity = await query(
      `SELECT date_trunc('week', updated_at)::date AS week, COUNT(*)::int AS completed
       FROM tasks WHERE project_id = $1 AND status = 'done'
       GROUP BY week ORDER BY week DESC LIMIT 8`,
      [projectId]
    );

    const rcaVolume = await query(
      `SELECT status, COUNT(*)::int AS count FROM rcas WHERE project_id = $1 GROUP BY status`,
      [projectId]
    );

    const overdue = await query(
      `SELECT COUNT(*)::int AS overdue FROM tasks
       WHERE project_id = $1 AND status != 'done' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
      [projectId]
    );

    const completionRate = completion.total > 0 ? Math.round((completion.done / completion.total) * 100) : 0;
    // Simple project-health heuristic: completion rate minus a penalty for overdue tasks.
    const healthScore = Math.max(0, Math.min(100, completionRate - overdue[0].overdue * 5));

    res.json({
      completionRate,
      totalTasks: completion.total,
      doneTasks: completion.done,
      overdueTasks: overdue[0].overdue,
      workloadPerAssignee: workload,
      velocityTrend: velocity.reverse(),
      rcaVolume,
      projectHealthScore: healthScore,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
