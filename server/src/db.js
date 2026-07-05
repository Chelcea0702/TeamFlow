const { Pool } = require("pg");
const config = require("./config");

const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txClient = {
      query: async (text, params) => (await client.query(text, params)).rows,
    };
    const result = await callback(txClient);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };

