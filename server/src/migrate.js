// Applies db/schema.sql against DATABASE_URL. Idempotent (uses IF NOT EXISTS
// throughout), so it is safe to run repeatedly.
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function main() {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  console.log("Applying schema.sql ...");
  await pool.query(sql);
  console.log("Schema applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

