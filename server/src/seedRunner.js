const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function main() {
  const seedPath = path.join(__dirname, "..", "db", "seed.sql");
  const sql = fs.readFileSync(seedPath, "utf8");
  console.log("Applying seed.sql ...");
  await pool.query(sql);
  console.log("Seed data applied. Demo users (password: password123):");
  console.log("  alice@teamflow.dev (admin) / bob@teamflow.dev / cara@teamflow.dev");
  await pool.end();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

