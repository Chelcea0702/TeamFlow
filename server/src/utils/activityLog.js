// Append-only activity log. There is deliberately no update/delete export
// from this module -- see Section 1.3 "ActivityLog as append-only" in the
// design decisions document. Every significant state change should call
// record() in the same transaction as the change it describes.

async function record(dbClient, { entityType, entityId, actorId, action, details = {} }) {
  await dbClient.query(
    `INSERT INTO activity_log (entity_type, entity_id, actor_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, actorId || null, action, JSON.stringify(details)]
  );
}

module.exports = { record };
