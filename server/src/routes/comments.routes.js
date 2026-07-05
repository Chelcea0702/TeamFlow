const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { extractMentions } = require("../utils/mentions");

const router = express.Router();
router.use(requireAuth);

// Comments are polymorphic on (ownerType, ownerId): "task" or "rca".
// See Section 1.3 "Attachments and comments as polymorphic children".

router.get("/:ownerType/:ownerId", async (req, res, next) => {
  try {
    const { ownerType, ownerId } = req.params;
    if (!["task", "rca"].includes(ownerType)) return res.status(400).json({ error: "Invalid ownerType" });

    const rows = await query(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.owner_type = $1 AND c.owner_id = $2
       ORDER BY c.created_at ASC`,
      [ownerType, ownerId]
    );
    res.json({ comments: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/:ownerType/:ownerId", async (req, res, next) => {
  try {
    const { ownerType, ownerId } = req.params;
    const { body } = req.body;
    if (!["task", "rca"].includes(ownerType)) return res.status(400).json({ error: "Invalid ownerType" });
    if (!body) return res.status(400).json({ error: "body is required" });

    const mentionEmails = extractMentions(body);
    let mentionIds = [];
    if (mentionEmails.length > 0) {
      const rows = await query(`SELECT id FROM users WHERE email = ANY($1::text[])`, [mentionEmails]);
      mentionIds = rows.map((r) => r.id);
    }

    const rows = await query(
      `INSERT INTO comments (owner_type, owner_id, author_id, body, mentions)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [ownerType, ownerId, req.user.id, body, mentionIds]
    );
    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
