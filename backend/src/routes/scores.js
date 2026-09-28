"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { HttpError, integer } = require("../lib/http");

/** Nombre de meilleurs joueurs pris en compte dans le score d'un service */
const SERVICE_TOP_N = 10;
const VALID_DIFFICULTIES = ["easy", "normal", "hardcore"];

function getSingleQueryParam(value) {
  return typeof value === "string" ? value : null;
}

/**
 * Construit les fragments SQL AND pour le filtrage optionnel par mois et difficulté.
 * Array.push() renvoie le nouvel index (1-based) — utilisé directement comme $N.
 * @returns { clauses: string, params: any[] }
 */
function buildFilters(month, difficulty, alias = "gs") {
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new HttpError(400, "Mois invalide");
  if (difficulty && !VALID_DIFFICULTIES.includes(difficulty))
    throw new HttpError(400, "Difficulté invalide");
  const parts = [];
  const params = [];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const idx = params.push(`${month}-01`);
    parts.push(
      `AND DATE_TRUNC('month', ${alias}.ended_at) = DATE_TRUNC('month', $${idx}::date)`,
    );
  }
  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) {
    const idx = params.push(difficulty);
    parts.push(`AND ${alias}.difficulty = $${idx}`);
  }
  return { clauses: parts.join(" "), params };
}

function prevMonthStr(yyyymm) {
  const [y, mo] = yyyymm.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

/**
 * Calcule les séquences consécutives (streak) pour des joueurs dans le top 10 mensuel.
 * @returns { [player_id]: streak_count }
 */
async function computePlayerStreaks(currentIds, refMonth, difficulty) {
  if (!refMonth || currentIds.length === 0) return {};

  const diffClause =
    difficulty && VALID_DIFFICULTIES.includes(difficulty)
      ? "AND gs.difficulty = $1"
      : "";
  const diffParam = diffClause ? [difficulty] : [];
  const mIdx = diffParam.length + 1;

  const { rows } = await pool.query(
    `
    SELECT to_char(month_start,'YYYY-MM') AS month_start, player_id
    FROM (
      SELECT
        DATE_TRUNC('month', gs.ended_at)::date AS month_start,
        p.id AS player_id,
        ROW_NUMBER() OVER (
          PARTITION BY DATE_TRUNC('month', gs.ended_at)
          ORDER BY MAX(gs.score) DESC, COUNT(gs.id) ASC, p.id ASC
        ) AS rnk
      FROM players p
      JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE AND gs.rules_version = 1 AND gs.disqualified = FALSE AND gs.battle_id IS NULL ${diffClause}
      WHERE DATE_TRUNC('month', gs.ended_at) <= DATE_TRUNC('month', $${mIdx}::date)
        AND DATE_TRUNC('month', gs.ended_at) >= DATE_TRUNC('month', $${mIdx}::date) - INTERVAL '23 months'
      GROUP BY p.id, DATE_TRUNC('month', gs.ended_at)
    ) sub
    WHERE rnk <= 10
  `,
    [...diffParam, `${refMonth}-01`],
  );

  const byMonth = new Map();
  rows.forEach((r) => {
    const m = String(r.month_start).slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m).add(Number(r.player_id));
  });

  const streaks = {};
  for (const id of currentIds) {
    let streak = 1;
    let m = refMonth;
    for (let i = 0; i < 23; i++) {
      m = prevMonthStr(m);
      if (byMonth.has(m) && byMonth.get(m).has(Number(id))) streak++;
      else break;
    }
    streaks[id] = streak;
  }
  return streaks;
}

/**
 * Calcule les streaks pour des services dans le top 10 mensuel.
 * Utilise la même formule top-N que l'endpoint /services.
 */
async function computeServiceStreaks(currentIds, refMonth, difficulty) {
  if (!refMonth || currentIds.length === 0) return {};

  const diffClause =
    difficulty && VALID_DIFFICULTIES.includes(difficulty)
      ? "AND gs.difficulty = $1"
      : "";
  const diffParam = diffClause ? [difficulty] : [];
  const mIdx = diffParam.length + 1;

  const { rows } = await pool.query(
    `
    SELECT to_char(month_start,'YYYY-MM') AS month_start, service_id
    FROM (
      SELECT
        month_start,
        service_id,
        ROW_NUMBER() OVER (PARTITION BY month_start ORDER BY avg_score DESC, service_id ASC) AS rnk
      FROM (
        SELECT
          month_start,
          service_id,
          AVG(top_score) AS avg_score
        FROM (
          SELECT
            DATE_TRUNC('month', gs.ended_at)::date AS month_start,
            gs.service_id,
            p.id AS player_id,
            MAX(gs.score) AS top_score,
            ROW_NUMBER() OVER (
              PARTITION BY gs.service_id, DATE_TRUNC('month', gs.ended_at)
              ORDER BY MAX(gs.score) DESC, COUNT(gs.id) ASC, p.id ASC
            ) AS svc_rnk
          FROM players p
          JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE AND gs.rules_version = 1 AND gs.disqualified = FALSE AND gs.battle_id IS NULL ${diffClause}
          WHERE gs.service_id IS NOT NULL
            AND DATE_TRUNC('month', gs.ended_at) <= DATE_TRUNC('month', $${mIdx}::date)
            AND DATE_TRUNC('month', gs.ended_at) >= DATE_TRUNC('month', $${mIdx}::date) - INTERVAL '23 months'
          GROUP BY p.id, gs.service_id, DATE_TRUNC('month', gs.ended_at)
        ) per_player
        WHERE svc_rnk <= ${SERVICE_TOP_N}
        GROUP BY month_start, service_id
      ) monthly_scores
    ) ranked
    WHERE rnk <= 10
  `,
    [...diffParam, `${refMonth}-01`],
  );

  const byMonth = new Map();
  rows.forEach((r) => {
    const m = String(r.month_start).slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, new Set());
    byMonth.get(m).add(Number(r.service_id));
  });

  const streaks = {};
  for (const id of currentIds) {
    let streak = 1;
    let m = refMonth;
    for (let i = 0; i < 23; i++) {
      m = prevMonthStr(m);
      if (byMonth.has(m) && byMonth.get(m).has(Number(id))) streak++;
      else break;
    }
    streaks[id] = streak;
  }
  return streaks;
}

/**
 * GET /api/scores/players?month=YYYY-MM&difficulty=easy|normal|hardcore
 * Top 10 joueurs par meilleur score.
 * Streak ajouté si month est fourni.
 */
router.get("/players", async (req, res) => {
  try {
    const month = getSingleQueryParam(req.query.month);
    const difficulty = getSingleQueryParam(req.query.difficulty);
    const { clauses, params } = buildFilters(month, difficulty);

    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        COALESCE(d.display_name,p.name) AS name,
        s.name AS service_name,
        MAX(gs.score) AS best_score,
        COUNT(gs.id) AS games_played
      FROM players p
      JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE AND gs.rules_version = 1 AND gs.disqualified = FALSE AND gs.battle_id IS NULL ${clauses}
      LEFT JOIN services s ON s.id = p.service_id
      LEFT JOIN directory_employees d ON d.id=p.directory_id
      GROUP BY p.id, p.name, d.display_name, s.name
      ORDER BY best_score DESC, games_played ASC, p.id ASC
      LIMIT 10
    `,
      params,
    );

    let scores = rows;
    if (month) {
      const ids = rows.map((r) => r.id);
      const streaks = await computePlayerStreaks(ids, month, difficulty);
      scores = rows.map((r) => ({ ...r, streak: streaks[r.id] || 1 }));
    }

    return res.json({
      scores,
      month: month || null,
      difficulty: difficulty || null,
    });
  } catch (err) {
    if (!err.status || err.status >= 500)
      console.error(
        JSON.stringify({ event: "scores_error", message: err.message }),
      );
    return res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : "Erreur serveur" });
  }
});

/**
 * GET /api/scores/services?month=YYYY-MM&difficulty=easy|normal|hardcore
 * Top 10 services.
 * Score = moyenne des meilleurs scores des SERVICE_TOP_N meilleurs joueurs du service.
 * Streak ajouté si month est fourni.
 */
router.get("/services", async (req, res) => {
  try {
    const month = getSingleQueryParam(req.query.month);
    const difficulty = getSingleQueryParam(req.query.difficulty);
    const { clauses, params } = buildFilters(month, difficulty);

    const { rows } = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.code,
        ROUND(AVG(top_n.top_score)::numeric, 2) AS avg_best_score,
        COUNT(top_n.player_id) AS player_count
      FROM services s
      JOIN (
        SELECT player_id, service_id, top_score
        FROM (
          SELECT
            p.id AS player_id,
            gs.service_id,
            MAX(gs.score) AS top_score,
            ROW_NUMBER() OVER (PARTITION BY gs.service_id ORDER BY MAX(gs.score) DESC, COUNT(gs.id) ASC, p.id ASC) AS rnk
          FROM players p
          JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE AND gs.rules_version = 1 AND gs.disqualified = FALSE AND gs.battle_id IS NULL ${clauses}
          WHERE gs.service_id IS NOT NULL
          GROUP BY p.id, gs.service_id
        ) ranked
        WHERE ranked.rnk <= ${SERVICE_TOP_N}
      ) top_n ON top_n.service_id = s.id
      GROUP BY s.id, s.name, s.code
      ORDER BY avg_best_score DESC, s.id ASC
      LIMIT 10
    `,
      params,
    );

    let scores = rows;
    if (month) {
      const ids = rows.map((r) => r.id);
      const streaks = await computeServiceStreaks(ids, month, difficulty);
      scores = rows.map((r) => ({ ...r, streak: streaks[r.id] || 1 }));
    }

    return res.json({
      scores,
      month: month || null,
      difficulty: difficulty || null,
    });
  } catch (err) {
    if (!err.status || err.status >= 500)
      console.error(
        JSON.stringify({ event: "scores_error", message: err.message }),
      );
    return res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : "Erreur serveur" });
  }
});

/**
 * GET /api/scores/services/:id?month=YYYY-MM&difficulty=easy|normal|hardcore
 * Détail d'un service : top SERVICE_TOP_N participants (ceux qui comptent dans le score) + les autres.
 */
router.get("/services/:id", async (req, res) => {
  try {
    const serviceId = integer(req.params.id, "Équipe");

    const month = getSingleQueryParam(req.query.month);
    const difficulty = getSingleQueryParam(req.query.difficulty);
    const { clauses, params } = buildFilters(month, difficulty);
    const nextParam = params.length + 1;

    const svcRes = await pool.query(
      "SELECT id, name, code FROM services WHERE id = $1",
      [serviceId],
    );
    if (svcRes.rows.length === 0)
      return res.status(404).json({ error: "Service introuvable" });

    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        COALESCE(d.display_name,p.name) AS name,
        MAX(gs.score) AS best_score,
        COUNT(gs.id) AS games_played
      FROM players p
      JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE AND gs.rules_version = 1 AND gs.disqualified = FALSE AND gs.battle_id IS NULL ${clauses}
      LEFT JOIN directory_employees d ON d.id=p.directory_id
      WHERE gs.service_id = $${nextParam}
      GROUP BY p.id, p.name, d.display_name
      ORDER BY best_score DESC, games_played ASC, p.id ASC
    `,
      [...params, serviceId],
    );

    const top10 = rows.slice(0, SERVICE_TOP_N);
    const others = rows.slice(SERVICE_TOP_N);

    // avgBestScore = moyenne des top-N uniquement (même formule que le classement services)
    const avgScore =
      top10.length > 0
        ? Math.round(
            (top10.reduce((sum, r) => sum + Number(r.best_score), 0) /
              top10.length) *
              100,
          ) / 100
        : 0;

    // Streaks pour les top-N dans le cas d'une vue mensuelle
    let top10WithStreaks = top10;
    if (month) {
      const ids = top10.map((r) => r.id);
      const streaks = await computePlayerStreaks(ids, month, difficulty);
      top10WithStreaks = top10.map((r) => ({
        ...r,
        streak: streaks[r.id] || 1,
      }));
    }

    return res.json({
      service: svcRes.rows[0],
      avgBestScore: avgScore,
      playerCount: rows.length,
      topN: SERVICE_TOP_N,
      top10: top10WithStreaks,
      others,
      month: month || null,
      difficulty: difficulty || null,
    });
  } catch (err) {
    if (!err.status || err.status >= 500)
      console.error(
        JSON.stringify({ event: "scores_error", message: err.message }),
      );
    return res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : "Erreur serveur" });
  }
});

module.exports = router;
