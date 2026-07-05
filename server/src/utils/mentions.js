// @mentions are matched by email address in the comment body, e.g.
// "cc @bob@teamflow.dev". See README "Assumptions" for why this is a regex
// match rather than a live autocomplete UI.
function extractMentions(body) {
  const matches = body.match(/@([\w.]+@[\w.]+)/g) || [];
  return matches.map((m) => m.slice(1));
}

module.exports = { extractMentions };
