const express = require("express");
const cors = require("cors");
const config = require("./config");
const errorHandler = require("./middleware/errorHandler");

// Registers event-bus subscribers as a side effect of require()-ing it.
require("./services/notificationWorker");

const authRoutes = require("./routes/auth.routes");
const projectsRoutes = require("./routes/projects.routes");
const tasksRoutes = require("./routes/tasks.routes");
const commentsRoutes = require("./routes/comments.routes");
const attachmentsRoutes = require("./routes/attachments.routes");
const rcaRoutes = require("./routes/rca.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const reportsRoutes = require("./routes/reports.routes");
const exportRoutes = require("./routes/export.routes");

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/projects/:projectId/tasks", tasksRoutes);
app.use("/api/projects/:projectId/rca", rcaRoutes);
app.use("/api/projects/:projectId/reports", reportsRoutes);
app.use("/api/projects/:projectId/export", exportRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/attachments", attachmentsRoutes);
app.use("/api/notifications", notificationsRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`TeamFlow API listening on port ${config.port}`);
});
