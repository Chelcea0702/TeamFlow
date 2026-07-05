const express = require("express");
const { query, withTransaction } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireProjectRole } = require("../middleware/permissions");
const activityLog = require("../utils/activityLog");
const bus = require("../utils/eventBus");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const SECTION_TYPES = ["timeline", "contributing_factors", "corrective_actions", "preventive_measures"];

router.get("/", async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM rcas WHERE project_id = $1 ORDER BY created_at DESC`, [req.params.projectId]);
    res.json({ rcas: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    const { title, severity, reviewerIds } = req.body;
    if (!title || !severity) return res.status(400).json({ error: "title and severity are required" });
    if (!Array.isArray(reviewerIds) || reviewerIds.length === 0) {
      return res.status(400).json({ error: "At least one reviewer must be assigned" });
    }

    const rca = await withTransaction(async (tx) => {
      const rows = await tx.query(
        `INSERT INTO rcas (project_id, title, severity, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.params.projectId, title, severity, req.user.id]
      );
      const rca = rows[0];

      for (const type of SECTION_TYPES) {
        await tx.query(`INSERT INTO rca_sections (rca_id, type, content) VALUES ($1,$2,'')`, [rca.id, type]);
      }
      for (const reviewerId of reviewerIds) {
        await tx.query(`INSERT INTO rca_reviewers (rca_id, reviewer_id) VALUES ($1,$2)`, [rca.id, reviewerId]);
      }
      await activityLog.record(tx, { entityType: "rca", entityId: rca.id, actorId: req.user.id, action: "created", details: { title, severity, reviewerIds } });
      return rca;
    });

    res.status(201).json({ rca });
  } catch (err) {
    next(err);
  }
});

router.get("/:rcaId", async (req, res, next) => {
  try {
    const rcaRows = await query(`SELECT * FROM rcas WHERE id = $1 AND project_id = $2`, [req.params.rcaId, req.params.projectId]);
    if (rcaRows.length === 0) return res.status(404).json({ error: "RCA not found" });

    const sections = await query(`SELECT * FROM rca_sections WHERE rca_id = $1 ORDER BY type`, [req.params.rcaId]);
    const reviewers = await query(
      `SELECT rr.*, u.name, u.email FROM rca_reviewers rr JOIN users u ON u.id = rr.reviewer_id WHERE rr.rca_id = $1`,
      [req.params.rcaId]
    );
    const reviews = await query(
      `SELECT rv.*, u.name FROM reviews rv JOIN users u ON u.id = rv.reviewer_id WHERE rv.rca_id = $1 ORDER BY rv.created_at`,
      [req.params.rcaId]
    );

    res.json({ rca: rcaRows[0], sections, reviewers, reviews });
  } catch (err) {
    next(err);
  }
});

// Submit for review: moves draft -> in_review and notifies reviewers.
router.post("/:rcaId/submit", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    const rcaRows = await query(`SELECT * FROM rcas WHERE id = $1 AND project_id = $2`, [req.params.rcaId, req.params.projectId]);
    if (rcaRows.length === 0) return res.status(404).json({ error: "RCA not found" });
    if (rcaRows[0].status !== "draft") return res.status(400).json({ error: "Only a draft RCA can be submitted" });

    const reviewerRows = await query(`SELECT reviewer_id FROM rca_reviewers WHERE rca_id = $1 AND status = 'pending'`, [req.params.rcaId]);

    const rca = await withTransaction(async (tx) => {
      const rows = await tx.query(`UPDATE rcas SET status = 'in_review', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.rcaId]);
      await activityLog.record(tx, { entityType: "rca", entityId: req.params.rcaId, actorId: req.user.id, action: "submitted" });
      return rows[0];
    });

    bus.publish("rca.submitted", {
      rcaId: rca.id, projectId: rca.project_id, rcaTitle: rca.title, actorId: req.user.id,
      reviewerIds: reviewerRows.map((r) => r.reviewer_id),
    });

    res.json({ rca });
  } catch (err) {
    next(err);
  }
});

// Update section content (only while draft or in_review).
router.patch("/:rcaId/sections/:type", requireProjectRole(["owner", "contributor"]), async (req, res, next) => {
  try {
    if (!SECTION_TYPES.includes(req.params.type)) return res.status(400).json({ error: "Invalid section type" });
    const { content } = req.body;
    const rows = await query(
      `UPDATE rca_sections SET content = $1, updated_at = now()
       WHERE rca_id = $2 AND type = $3 RETURNING *`,
      [content || "", req.params.rcaId, req.params.type]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Section not found" });
    res.json({ section: rows[0] });
  } catch (err) {
    next(err);
  }
});

// A reviewer records a decision. Section 3.4: this never auto-closes the RCA
// -- closing is a separate, explicit action once every reviewer has decided.
router.post("/:rcaId/reviews", async (req, res, next) => {
  try {
    const { decision, comment } = req.body;
    if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "decision must be approved or rejected" });
    if (!comment) return res.status(400).json({ error: "A comment is mandatory with every review decision" });

    const reviewerRows = await query(
      `SELECT * FROM rca_reviewers WHERE rca_id = $1 AND reviewer_id = $2`,
      [req.params.rcaId, req.user.id]
    );
    if (reviewerRows.length === 0) return res.status(403).json({ error: "You are not an assigned reviewer for this RCA" });

    const rcaRows = await query(`SELECT * FROM rcas WHERE id = $1`, [req.params.rcaId]);
    if (rcaRows.length === 0) return res.status(404).json({ error: "RCA not found" });
    if (rcaRows[0].status !== "in_review") return res.status(400).json({ error: "RCA is not currently in review" });

    await withTransaction(async (tx) => {
      await tx.query(`INSERT INTO reviews (rca_id, reviewer_id, decision, comment) VALUES ($1,$2,$3,$4)`, [
        req.params.rcaId, req.user.id, decision, comment,
      ]);
      await tx.query(`UPDATE rca_reviewers SET status = $1 WHERE rca_id = $2 AND reviewer_id = $3`, [
        decision, req.params.rcaId, req.user.id,
      ]);
      await activityLog.record(tx, {
        entityType: "rca", entityId: req.params.rcaId, actorId: req.user.id, action: "review_decided",
        details: { decision, comment },
      });
    });

    const ownerRows = await query(
      `SELECT user_id FROM project_members WHERE project_id = $1 AND role = 'owner'`,
      [rcaRows[0].project_id]
    );
    bus.publish("review.decided", {
      rcaId: req.params.rcaId, rcaTitle: rcaRows[0].title, projectId: rcaRows[0].project_id,
      reviewerId: req.user.id, decision, ownerIds: ownerRows.map((r) => r.user_id),
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Owner/admin closes the RCA once every reviewer has decided. This is the
// only path that changes status to approved/rejected -- see Section 3.4.
router.post("/:rcaId/close", requireProjectRole(["owner"]), async (req, res, next) => {
  try {
    const { finalStatus } = req.body; // 'approved' | 'rejected'
    if (!["approved", "rejected"].includes(finalStatus)) {
      return res.status(400).json({ error: "finalStatus must be approved or rejected" });
    }

    const reviewers = await query(`SELECT * FROM rca_reviewers WHERE rca_id = $1`, [req.params.rcaId]);
    const undecided = reviewers.filter((r) => r.status === "pending");
    if (undecided.length > 0) {
      return res.status(400).json({
        error: "Cannot close: not every assigned reviewer has recorded a decision",
        pendingReviewers: undecided.map((r) => r.reviewer_id),
      });
    }

    const rca = await withTransaction(async (tx) => {
      const rows = await tx.query(`UPDATE rcas SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`, [finalStatus, req.params.rcaId]);
      await activityLog.record(tx, { entityType: "rca", entityId: req.params.rcaId, actorId: req.user.id, action: "closed", details: { finalStatus } });
      return rows[0];
    });

    res.json({ rca });
  } catch (err) {
    next(err);
  }
});

// Reviewer unavailable -> substitution, per Section 3.4. Only an owner/admin
// may reassign a reviewer slot; the RCA stays open until the substitute decides.
router.post("/:rcaId/reviewers/:reviewerId/substitute", requireProjectRole(["owner"]), async (req, res, next) => {
  try {
    const { newReviewerId } = req.body;
    if (!newReviewerId) return res.status(400).json({ error: "newReviewerId is required" });

    const existing = await query(
      `SELECT * FROM rca_reviewers WHERE rca_id = $1 AND reviewer_id = $2`,
      [req.params.rcaId, req.params.reviewerId]
    );
    if (existing.length === 0) return res.status(404).json({ error: "Reviewer not assigned to this RCA" });
    if (existing[0].status !== "pending") {
      return res.status(400).json({ error: "Only a pending (undecided) reviewer slot can be substituted" });
    }

    await withTransaction(async (tx) => {
      await tx.query(`UPDATE rca_reviewers SET status = 'substituted' WHERE rca_id = $1 AND reviewer_id = $2`, [
        req.params.rcaId, req.params.reviewerId,
      ]);
      await tx.query(
        `INSERT INTO rca_reviewers (rca_id, reviewer_id, status) VALUES ($1,$2,'pending')
         ON CONFLICT (rca_id, reviewer_id) DO UPDATE SET status = 'pending'`,
        [req.params.rcaId, newReviewerId]
      );
      await activityLog.record(tx, {
        entityType: "rca", entityId: req.params.rcaId, actorId: req.user.id, action: "reviewer_substituted",
        details: { from: req.params.reviewerId, to: newReviewerId },
      });
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Withdraw: used when review cannot be completed as expected (superseded,
// abandoned, etc). Requires a mandatory comment and preserves history --
// never deletes the RCA. See Section 3.4.
router.post("/:rcaId/withdraw", requireProjectRole(["owner"]), async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ error: "A comment explaining the withdrawal is required" });

    const rca = await withTransaction(async (tx) => {
      const rows = await tx.query(`UPDATE rcas SET status = 'withdrawn', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.rcaId]);
      await tx.query(`INSERT INTO comments (owner_type, owner_id, author_id, body) VALUES ('rca', $1, $2, $3)`, [
        req.params.rcaId, req.user.id, `[Withdrawal reason] ${comment}`,
      ]);
      await activityLog.record(tx, { entityType: "rca", entityId: req.params.rcaId, actorId: req.user.id, action: "withdrawn", details: { comment } });
      return rows[0];
    });

    res.json({ rca });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
