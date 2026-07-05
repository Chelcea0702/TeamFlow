// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === "23505") {
    return res.status(409).json({ error: "Conflict: duplicate value violates a unique constraint" });
  }
  if (err.code === "23503") {
    return res.status(400).json({ error: "Invalid reference: related record does not exist" });
  }
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
}

module.exports = errorHandler;
