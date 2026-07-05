const express = require("express");
const multer = require("multer");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const storage = require("../utils/storage");

const router = express.Router();
router.use(requireAuth);

// Accept up to 20MB; type/size are the only checks performed, matching the
// documented known limitation (no content inspection beyond type/size).
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE_BYTES } });

router.get("/:ownerType/:ownerId", async (req, res, next) => {
  try {
    const { ownerType, ownerId } = req.params;
    const rows = await query(
      `SELECT a.*, u.name AS uploaded_by_name FROM attachments a
       JOIN users u ON u.id = a.uploaded_by
       WHERE a.owner_type = $1 AND a.owner_id = $2 ORDER BY a.created_at DESC`,
      [ownerType, ownerId]
    );
    res.json({ attachments: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/:ownerType/:ownerId", upload.single("file"), async (req, res, next) => {
  try {
    const { ownerType, ownerId } = req.params;
    if (!["task", "rca"].includes(ownerType)) return res.status(400).json({ error: "Invalid ownerType" });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const key = storage.put(req.file.buffer, req.file.originalname);
    const rows = await query(
      `INSERT INTO attachments (owner_type, owner_id, uploaded_by, storage_key, file_name, size_bytes, content_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ownerType, ownerId, req.user.id, key, req.file.originalname, req.file.size, req.file.mimetype]
    );
    res.status(201).json({ attachment: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get("/download/:attachmentId", async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM attachments WHERE id = $1`, [req.params.attachmentId]);
    if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" });
    const attachment = rows[0];
    res.download(storage.getPath(attachment.storage_key), attachment.file_name);
  } catch (err) {
    next(err);
  }
});

router.delete("/:attachmentId", async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM attachments WHERE id = $1`, [req.params.attachmentId]);
    if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" });
    storage.remove(rows[0].storage_key);
    await query(`DELETE FROM attachments WHERE id = $1`, [req.params.attachmentId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
