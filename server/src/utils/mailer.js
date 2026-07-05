// Minimal email "provider". Defaults to logging to the console so the
// assignment runs with zero external configuration. Set EMAIL_TRANSPORT to
// anything else and wire up a real provider (SES, Postmark, SMTP via
// nodemailer, etc.) in the sendConsole branch's place -- the call site
// (notificationWorker.js) does not need to change.
//
// Per Section 2.4 of the design decisions: email failures surface to the
// user rather than being silently retried, so this function throws on
// failure instead of swallowing errors.

const config = require("../config");

async function sendEmail({ to, subject, body }) {
  if (config.emailTransport === "console") {
    // eslint-disable-next-line no-console
    console.log(`\n--- EMAIL (console transport) ---\nTo: ${to}\nSubject: ${subject}\n\n${body}\n----------------------------------\n`);
    return { delivered: true, transport: "console" };
  }
  throw new Error(`Unsupported EMAIL_TRANSPORT: ${config.emailTransport}`);
}

module.exports = { sendEmail };
