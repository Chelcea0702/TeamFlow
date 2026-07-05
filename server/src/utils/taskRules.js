// Pure business rule, extracted so it can be unit-tested without a database.
// See Section 3.1 of the design decisions document.
const ALLOWED_TRANSITIONS = {
  backlog: ["in_progress"],
  in_progress: ["in_review", "backlog"],
  in_review: ["done", "in_progress"],
  done: ["in_progress"],
};

function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

module.exports = { ALLOWED_TRANSITIONS, canTransition };
