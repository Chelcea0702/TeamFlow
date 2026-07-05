require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL || "postgres://teamflow:teamflow@localhost:5432/teamflow",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  notificationDedupeWindowSeconds: Number(process.env.NOTIFICATION_DEDUPE_WINDOW_SECONDS || 60),
  emailTransport: process.env.EMAIL_TRANSPORT || "console",
};

