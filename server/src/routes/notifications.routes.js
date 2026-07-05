const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id = $1 AND channel = 'in_app'
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unreadCount = rows.filter((n) => !n.read_at).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    await query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
