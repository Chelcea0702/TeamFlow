const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const rows = await query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)
       RETURNING id, name, email, is_admin, email_opt_out`,
      [name, email, passwordHash]
    );
    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const rows = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, email, is_admin, email_opt_out FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch("/me/settings", requireAuth, async (req, res, next) => {
  try {
    const { emailOptOut } = req.body;
    const rows = await query(
      `UPDATE users SET email_opt_out = $1 WHERE id = $2 RETURNING id, name, email, is_admin, email_opt_out`,
      [!!emailOptOut, req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
