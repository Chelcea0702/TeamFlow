const test = require("node:test");
const assert = require("node:assert/strict");

const { canTransition } = require("../src/utils/taskRules");
const { toCsv } = require("../src/utils/csv");
const { extractMentions } = require("../src/utils/mentions");

// ---- Task status transitions (Section 3.1) ----
test("allows backlog -> in_progress", () => {
  assert.equal(canTransition("backlog", "in_progress"), true);
});

test("disallows backlog -> done (skipping the workflow)", () => {
  assert.equal(canTransition("backlog", "done"), false);
});

test("allows in_review -> done", () => {
  assert.equal(canTransition("in_review", "done"), true);
});

test("allows reopening a done task back to in_progress", () => {
  assert.equal(canTransition("done", "in_progress"), true);
});

test("disallows an unknown status as the source", () => {
  assert.equal(canTransition("archived", "done"), false);
});

// ---- CSV export helper ----
test("toCsv produces a header row plus one row per record", () => {
  const csv = toCsv([{ id: 1, title: "Fix bug" }], ["id", "title"]);
  assert.equal(csv, "id,title\n1,Fix bug");
});

test("toCsv quotes values containing commas", () => {
  const csv = toCsv([{ id: 1, title: "Fix bug, urgently" }], ["id", "title"]);
  assert.equal(csv, 'id,title\n1,"Fix bug, urgently"');
});

test("toCsv escapes embedded quotes", () => {
  const csv = toCsv([{ id: 1, title: 'Say "hi"' }], ["id", "title"]);
  assert.equal(csv, 'id,title\n1,"Say ""hi"""');
});

test("toCsv renders null/undefined as an empty field", () => {
  const csv = toCsv([{ id: 1, title: null }], ["id", "title"]);
  assert.equal(csv, "id,title\n1,");
});

// ---- @mention parsing ----
test("extractMentions finds a single email mention", () => {
  assert.deepEqual(extractMentions("cc @bob@teamflow.dev please review"), ["bob@teamflow.dev"]);
});

test("extractMentions finds multiple mentions", () => {
  assert.deepEqual(
    extractMentions("@alice@teamflow.dev and @bob@teamflow.dev, take a look"),
    ["alice@teamflow.dev", "bob@teamflow.dev"]
  );
});

test("extractMentions returns an empty array when there are none", () => {
  assert.deepEqual(extractMentions("no mentions here"), []);
});
