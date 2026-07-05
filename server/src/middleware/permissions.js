// Permission checks are done at the service layer against project_members.role
// (or the admin flag), never inferred from which UI view triggered the
// request -- see Section 3.5 "User Permissions" of the design decisions
// document. Every route that touches a project should use requireProjectRole
// so the same rule applies regardless of caller (Kanban, calendar, list, or
// a future integration).

const { query } = require("../db");

function requireProjectRole(allowedRoles) {
  return async function (req, res, next) {
    if (req.user.isAdmin) return next(); // Admins bypass project-level role checks.

    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    const rows = await query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: "Not a member of this project" });

    if (!allowedRoles.includes(rows[0].role)) {
      return res.status(403).json({ error: `Requires one of roles: ${allowedRoles.join(", ")}` });
    }
    req.projectRole = rows[0].role;
    next();
  };
}

module.exports = { requireProjectRole };
