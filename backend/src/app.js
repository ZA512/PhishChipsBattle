"use strict";
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { migrate } = require("./db/migrate");
const pool = require("./db/pool");
const { config, validateConfig } = require("./config");
const { loadUser, requireUser, mutationOrigin } = require("./services/auth");
const { apiLimiter } = require("./middleware/rateLimiter");

function createApp() {
  const app = express();
  // Only the private reverse proxy network is trusted; forwarded addresses are ignored from other peers.
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY || "loopback,linklocal,uniquelocal",
  );
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || false,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "X-Session-Token", "X-Admin-Password"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.use("/api", mutationOrigin, loadUser, apiLimiter, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/players", require("./routes/players"));
  app.use("/api/sessions", require("./routes/sessions"));
  app.use("/api/teams", require("./routes/teams"));
  app.use("/api/battles", require("./routes/battles"));
  app.use("/api/scores", requireUser, require("./routes/scores"));
  app.use("/api/services", requireUser, require("./routes/services"));
  app.use("/api/admin", require("./routes/adminTeams"));
  app.use("/api/admin", require("./routes/adminEnterprise"));
  app.use("/api/admin", require("./routes/admin"));
  app.get("/api/achievements", requireUser, async (_req, res) =>
    res.json({
      achievements: (
        await pool.query(
          "SELECT id,key,name,description,emoji,category,difficulty,tier,threshold FROM achievements WHERE active ORDER BY category,difficulty,tier",
        )
      ).rows,
    }),
  );
  app.use((_req, res) => res.status(404).json({ error: "Route introuvable" }));
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return _next(err);
    const status =
      err.status ||
      { 23505: 409, 23503: 400, 23514: 400, 22001: 400, "22P02": 400 }[
        err.code
      ] ||
      500;
    const message = err.status
      ? err.message
      : status === 409
        ? "Ce pseudo ou cet email est déjà utilisé"
        : status === 400
          ? "Données invalides"
          : "Erreur serveur";
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: "request_error",
          code: err.code,
          message: err.message,
        }),
      );
    res.status(status).json({ error: message });
  });
  return app;
}
async function start() {
  validateConfig();
  await migrate();
  const server = createApp().listen(process.env.PORT || 3000, () =>
    console.log(
      JSON.stringify({
        event: "listening",
        authMode: config().authMode,
        port: process.env.PORT || 3000,
      }),
    ),
  );
  const shutdown = () =>
    server.close(() => pool.end().then(() => process.exit(0)));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}
if (require.main === module)
  start().catch((err) => {
    console.error(
      JSON.stringify({ event: "startup_error", message: err.message }),
    );
    process.exit(1);
  });
module.exports = { createApp, start };
