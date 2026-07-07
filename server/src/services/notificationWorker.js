// Consumes domain events off the event bus and turns them into Notification
// records, one per (user, channel). See Section 3.3 of the design decisions
// document for the rationale behind writing the record *before* dispatch.
//
// Duplicate suppression: the notifications table has a UNIQUE(user_id,
// channel, dedupe_key) constraint. We compute a dedupe_key that identifies
// "this event, for this entity" and rely on ON CONFLICT DO NOTHING so that a
// re-processed event (e.g. from at-least-once delivery in a real broker)
// never produces a second row, and therefore never dispatches a second email.

const { query } = require("../db");
const bus = require("../utils/eventBus");
const mailer = require("../utils/mailer");

async function getProjectMembers(projectId, excludeUserId) {
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.email_opt_out
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 AND u.id != $2`,
    [projectId, excludeUserId]
  );
  return rows;
}

async function getUser(userId) {
  const rows = await query(`SELECT id, name, email, email_opt_out FROM users WHERE id = $1`, [userId]);
  return rows[0] || null;
}

// Writes one notification row per channel for a single recipient. Returns
// the number of rows actually inserted (0 or 1 per channel) so callers can
// tell whether this was a genuine new delivery or a suppressed duplicate.
async function deliver({ userId, eventType, entityType, entityId, dedupeKey, title, body, wantsEmail }) {
  const user = await getUser(userId);
  if (!user) return;

  const channels = ["in_app"];
  if (wantsEmail && !user.email_opt_out) channels.push("email");

  for (const channel of channels) {
    const inserted = await query(
      `INSERT INTO notifications (user_id, event_type, entity_type, entity_id, channel, title, body, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, channel, dedupe_key) DO NOTHING
       RETURNING id`,
      [userId, eventType, entityType, entityId, channel, title, body, dedupeKey]
    );

    if (inserted.length === 0) {
      // Already delivered for this (user, channel, event+entity) combo --
      // suppressed duplicate, exactly the behaviour the product spec requires.
      continue;
    }

    const notificationId = inserted[0].id;

    if (channel === "email") {
      try {
        await mailer.sendEmail({ to: user.email, subject: title, body });
        await query(`UPDATE notifications SET sent_at = now() WHERE id = $1`, [notificationId]);
      } catch (err) {
        // Per design decisions: email failures surface rather than retry
        // silently. We log it; a real UI would surface a delivery-failed
        // badge by checking sent_at IS NULL on email-channel notifications.
        // eslint-disable-next-line no-console
        console.error("Email dispatch failed for notification", notificationId, err.message);
      }
    } else {
      await query(`UPDATE notifications SET sent_at = now() WHERE id = $1`, [notificationId]);
    }
  }
}

bus.subscribe("task.assigned", async ({ taskId, projectId, assigneeId, actorId, taskTitle }) => {
  if (!assigneeId || assigneeId === actorId) return;
  await deliver({
    userId: assigneeId,
    eventType: "task.assigned",
    entityType: "task",
    entityId: taskId,
    dedupeKey: `task.assigned:${taskId}:${assigneeId}`,
    title: "You were assigned a task",
    body: `You were assigned "${taskTitle}".`,
    wantsEmail: true,
  });
});

bus.subscribe("task.status_changed", async ({ taskId, projectId, actorId, taskTitle, fromStatus, toStatus, assigneeId }) => {
  if (!assigneeId || assigneeId === actorId) return;
  await deliver({
    userId: assigneeId,
    eventType: "task.status_changed",
    entityType: "task",
    entityId: taskId,
    dedupeKey: `task.status_changed:${taskId}:${toStatus}:${assigneeId}`,
    title: "Task status changed",
    body: `"${taskTitle}" moved from ${fromStatus} to ${toStatus}.`,
    wantsEmail: false,
  });
});

bus.subscribe("rca.submitted", async ({ rcaId, projectId, rcaTitle, actorId, reviewerIds }) => {
  for (const reviewerId of reviewerIds) {
    if (reviewerId === actorId) continue;
    await deliver({
      userId: reviewerId,
      eventType: "rca.submitted",
      entityType: "rca",
      entityId: rcaId,
      dedupeKey: `rca.submitted:${rcaId}:${reviewerId}`,
      title: "RCA submitted for your review",
      body: `"${rcaTitle}" needs your review decision.`,
      wantsEmail: true,
    });
  }
});

// A comment is how a user reports progress/questions to a manager, and how
// a manager gives direction back to a user. Notify whoever "owns" the task
// (its creator -- always a manager, since only managers create tasks) plus
// its assignee, skipping the commenter themselves, plus anyone @mentioned.
bus.subscribe("comment.added", async ({ ownerType, ownerId, commentId, authorId, bodyPreview, mentionIds }) => {
  const recipients = new Set();

  if (ownerType === "task") {
    const rows = await query(`SELECT title, created_by, assignee_id FROM tasks WHERE id = $1`, [ownerId]);
    if (rows.length > 0) {
      const task = rows[0];
      if (task.created_by) recipients.add(task.created_by);
      if (task.assignee_id) recipients.add(task.assignee_id);

      for (const userId of mentionIds || []) recipients.add(userId);
      recipients.delete(authorId);

      for (const userId of recipients) {
        await deliver({
          userId,
          eventType: "comment.added",
          entityType: "task",
          entityId: ownerId,
          dedupeKey: `comment.added:${commentId}:${userId}`,
          title: "New comment on a task",
          body: `"${task.title}": ${bodyPreview}`,
          wantsEmail: false,
        });
      }
    }
  } else if (ownerType === "rca") {
    const rows = await query(`SELECT title, created_by FROM rcas WHERE id = $1`, [ownerId]);
    if (rows.length > 0) {
      const rca = rows[0];
      if (rca.created_by) recipients.add(rca.created_by);
      for (const userId of mentionIds || []) recipients.add(userId);
      recipients.delete(authorId);

      for (const userId of recipients) {
        await deliver({
          userId,
          eventType: "comment.added",
          entityType: "rca",
          entityId: ownerId,
          dedupeKey: `comment.added:${commentId}:${userId}`,
          title: "New comment on an RCA",
          body: `"${rca.title}": ${bodyPreview}`,
          wantsEmail: false,
        });
      }
    }
  }
});

// A manager adding someone to a project is effectively assigning them to
// it, so the new member should hear about it right away.
bus.subscribe("project.member_added", async ({ projectId, projectName, memberId, actorId }) => {
  if (!memberId || memberId === actorId) return;
  await deliver({
    userId: memberId,
    eventType: "project.member_added",
    entityType: "project",
    entityId: projectId,
    dedupeKey: `project.member_added:${projectId}:${memberId}`,
    title: "You were added to a project",
    body: `You were added to "${projectName}".`,
    wantsEmail: true,
  });
});

bus.subscribe("review.decided", async ({ rcaId, rcaTitle, projectId, reviewerId, decision, ownerIds }) => {
  for (const ownerId of ownerIds) {
    if (ownerId === reviewerId) continue;
    await deliver({
      userId: ownerId,
      eventType: "review.decided",
      entityType: "rca",
      entityId: rcaId,
      dedupeKey: `review.decided:${rcaId}:${reviewerId}:${decision}`,
      title: "A reviewer decided on your RCA",
      body: `"${rcaTitle}" was ${decision} by a reviewer.`,
      wantsEmail: true,
    });
  }
});

module.exports = { deliver, getProjectMembers };

