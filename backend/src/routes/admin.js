"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const { HttpError, integer, text, transaction } = require("../lib/http");

// All admin routes require authentication
router.use(adminAuth);

/**
 * GET /api/admin/services
 * List all services.
 */
router.get("/services", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, code, created_at FROM services WHERE archived_at IS NULL ORDER BY name ASC",
  );
  return res.json({ services: rows });
});

/**
 * POST /api/admin/services
 * Create a new service.
 * Body: { name, code }
 */
router.post("/services", async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: "name et code sont requis" });
  }
  const normalizedCode = text(code, "Code", 20)
    .toUpperCase()
    .replace(/\s+/g, "_");
  const normalizedName = text(name, "Nom", 100);
  if (!/^[A-Z0-9_]+$/.test(normalizedCode))
    throw new HttpError(400, "Code invalide : lettres, chiffres et underscore");
  if (normalizedCode.length > 20) {
    return res
      .status(400)
      .json({ error: "code trop long (max 20 caractères)" });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO services (name, code) VALUES ($1, $2) RETURNING id, name, code, created_at",
      [normalizedName, normalizedCode],
    );
    return res.status(201).json({ service: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ce code de service existe déjà" });
    }
    throw err;
  }
});

/**
 * PUT /api/admin/services/:id
 * Update a service.
 * Body: { name?, code? }
 */
router.put("/services/:id", async (req, res) => {
  const id = integer(req.params.id);

  const { name, code } = req.body;
  if (!name && !code) {
    return res.status(400).json({ error: "Au moins name ou code requis" });
  }

  const normalizedName = name !== undefined ? text(name, "Nom", 100) : null;
  const normalizedCode = code
    ? text(code, "Code", 20).toUpperCase().replace(/\s+/g, "_")
    : null;

  if (normalizedCode && normalizedCode.length > 20) {
    return res
      .status(400)
      .json({ error: "code trop long (max 20 caractères)" });
  }
  if (normalizedCode && !/^[A-Z0-9_]+$/.test(normalizedCode))
    throw new HttpError(400, "Code invalide");

  let query;
  let params;
  if (normalizedName && normalizedCode) {
    query =
      "UPDATE services SET name = $1, code = $2 WHERE id = $3 AND archived_at IS NULL RETURNING id, name, code, created_at";
    params = [normalizedName, normalizedCode, id];
  } else if (normalizedName) {
    query =
      "UPDATE services SET name = $1 WHERE id = $2 AND archived_at IS NULL RETURNING id, name, code, created_at";
    params = [normalizedName, id];
  } else {
    query =
      "UPDATE services SET code = $1 WHERE id = $2 AND archived_at IS NULL RETURNING id, name, code, created_at";
    params = [normalizedCode, id];
  }

  try {
    const { rows } = await pool.query(query, params);
    if (rows.length === 0)
      return res.status(404).json({ error: "Service introuvable" });
    return res.json({ service: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ce code de service existe déjà" });
    }
    throw err;
  }
});

/**
 * DELETE /api/admin/services/:id
 * Delete a service. Players linked to it will have service_id set to NULL (FK ON DELETE SET NULL).
 */
router.delete("/services/:id", async (req, res) => {
  const id = integer(req.params.id);
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(817413)");
    const team = (
      await client.query(
        "SELECT id,name FROM services WHERE id=$1 AND archived_at IS NULL FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!team) throw new HttpError(404, "Équipe inconnue ou déjà supprimée");
    await client.query(
      `INSERT INTO team_membership_history(player_id,employee_id,service_id,service_name,actor_id,source,reason)
      SELECT id,directory_id,$1,$2,$3,'team_deleted','Équipe supprimée : nouveau choix requis' FROM players WHERE service_id=$1`,
      [id, team.name, req.user?.id || null],
    );
    await client.query(
      "UPDATE players SET service_id=NULL WHERE service_id=$1",
      [id],
    );
    await client.query(
      "DELETE FROM directory_team_members WHERE service_id=$1",
      [id],
    );
    await client.query("UPDATE services SET archived_at=NOW() WHERE id=$1", [
      id,
    ]);
  });
  res.json({ ok: true });
});

// ============================================================
// Stats endpoints
// ============================================================

/**
 * GET /api/admin/stats/overview
 * Global stats: success rate, player count, game count, avg score by difficulty.
 */
router.get("/stats/overview", async (req, res) => {
  const filter = require("../services/gameStats").statisticsFilter(req.query);
  const rows = await require("../services/gameStats").groupedStats(
    pool,
    null,
    filter,
  );
  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  const decisions = sum("decisions"),
    correct = sum("correct");
  res.json({
    totalPlayers: Number(
      (await pool.query("SELECT COUNT(*) AS n FROM players")).rows[0].n,
    ),
    totalAnswers: sum("treated"),
    viewedEmails: sum("viewed"),
    evaluatedAnswers: decisions,
    correctAnswers: correct,
    wrongAnswers: sum("errors"),
    assistedAnswers: sum("assisted"),
    timeouts: sum("timeouts"),
    successRate: decisions ? Math.round((correct / decisions) * 1000) / 10 : 0,
    byDifficulty: rows.map((r) => ({
      ...r,
      games: r.completed,
      avgScore: r.avg_score,
      avgDecisionTime: r.avg_decision_time,
    })),
    formats: rows,
  });
});

/**
 * GET /api/admin/stats/hardest-emails
 * Top 10 emails with highest error rate (min 5 attempts).
 */
router.get("/stats/hardest-emails", async (req, res) => {
  const { family, duration, difficulty } =
    require("../services/gameStats").statisticsFilter(req.query);
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.subject,
      e.type,
      COUNT(*) AS attempts,
      COUNT(*) FILTER (WHERE NOT ea.is_correct) AS errors,
      ROUND(COUNT(*) FILTER (WHERE NOT ea.is_correct)::numeric / COUNT(*) * 100, 1) AS error_rate
    FROM email_answers ea
    JOIN emails e ON e.id = ea.email_id
    JOIN game_sessions gs ON gs.id=ea.session_id
    WHERE gs.rules_version IN (1,2) AND NOT gs.disqualified AND ea.user_choice IN ('phishing', 'safe')
 AND ($1::text IS NULL OR CASE WHEN gs.battle_id IS NOT NULL THEN CASE WHEN gs.game_format='time_attack' THEN 'time_attack_battle' ELSE 'battle' END WHEN gs.game_format='classic' THEN 'classic_training' ELSE gs.game_format END=$1)
 AND ($2::int IS NULL OR gs.duration_seconds=$2) AND ($3::text IS NULL OR gs.difficulty=$3)
    GROUP BY e.id, e.subject, e.type
    HAVING COUNT(*) >= 5
    ORDER BY error_rate DESC
    LIMIT 10
  `,
    [family, duration, difficulty],
  );

  return res.json({
    emails: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      type: r.type,
      attempts: parseInt(r.attempts),
      errors: parseInt(r.errors),
      errorRate: parseFloat(r.error_rate),
    })),
  });
});

/**
 * GET /api/admin/stats/activity?period=week|month
 * Games and players per day for the given period.
 */
router.get("/stats/activity", async (req, res) => {
  const period = req.query.period === "month" ? 30 : 7;
  const { family, duration, difficulty } =
    require("../services/gameStats").statisticsFilter(req.query);

  const { rows } = await pool.query(
    `
    SELECT
      DATE(started_at) AS day,
      COUNT(*) AS games,
      COUNT(DISTINCT player_id) AS players
    FROM game_sessions
    WHERE rules_version IN (1,2) AND NOT disqualified AND started_at >= NOW() - ($1 || ' days')::interval
 AND ($2::text IS NULL OR CASE WHEN battle_id IS NOT NULL THEN CASE WHEN game_format='time_attack' THEN 'time_attack_battle' ELSE 'battle' END WHEN game_format='classic' THEN 'classic_training' ELSE game_format END=$2)
 AND ($3::int IS NULL OR duration_seconds=$3) AND ($4::text IS NULL OR difficulty=$4)
    GROUP BY DATE(started_at)
    ORDER BY day
  `,
    [period, family, duration, difficulty],
  );

  return res.json({
    period: req.query.period === "month" ? "month" : "week",
    days: rows.map((r) => ({
      day: r.day,
      games: parseInt(r.games),
      players: parseInt(r.players),
    })),
  });
});

module.exports = router;
