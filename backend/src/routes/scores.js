'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * Build a WHERE clause for optional month filtering.
 * @param {string|undefined} month - "YYYY-MM" format
 * @returns { clause: string, params: any[] }
 */
function monthFilter(month, alias = 'gs') {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { clause: '', params: [] };
  return {
    clause: `AND DATE_TRUNC('month', ${alias}.ended_at) = DATE_TRUNC('month', $1::date)`,
    params: [`${month}-01`],
  };
}

/**
 * GET /api/scores/players?month=YYYY-MM
 * Top 10 players by best score (all time or for a given month).
 */
router.get('/players', async (req, res) => {
  const { month } = req.query;
  const { clause, params } = monthFilter(month);
  const nextParam = params.length + 1;

  const sql = `
    SELECT
      p.id,
      p.name,
      s.name AS service_name,
      gs.difficulty,
      MAX(gs.score) AS best_score,
      COUNT(gs.id) AS games_played
    FROM players p
    JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE ${clause}
    LEFT JOIN services s ON s.id = p.service_id
    GROUP BY p.id, p.name, s.name, gs.difficulty
    ORDER BY best_score DESC, games_played ASC
    LIMIT $${nextParam}
  `;

  const { rows } = await pool.query(sql, [...params, 10]);
  return res.json({ scores: rows, month: month || null });
});

/**
 * GET /api/scores/services?month=YYYY-MM
 * Top 10 services by average of each player's best score.
 * Formula: for each player → take their best score → average across the service.
 */
router.get('/services', async (req, res) => {
  const { month } = req.query;
  const { clause, params } = monthFilter(month);
  const nextParam = params.length + 1;

  const sql = `
    SELECT
      s.id,
      s.name,
      s.code,
      ROUND(AVG(best_per_player.top_score)::numeric, 2) AS avg_best_score,
      COUNT(best_per_player.player_id) AS player_count
    FROM services s
    JOIN (
      SELECT
        p.id AS player_id,
        p.service_id,
        MAX(gs.score) AS top_score
      FROM players p
      JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE ${clause}
      WHERE p.service_id IS NOT NULL
      GROUP BY p.id, p.service_id
    ) best_per_player ON best_per_player.service_id = s.id
    GROUP BY s.id, s.name, s.code
    ORDER BY avg_best_score DESC
    LIMIT $${nextParam}
  `;

  const { rows } = await pool.query(sql, [...params, 10]);
  return res.json({ scores: rows, month: month || null });
});

/**
 * GET /api/scores/services/:id?month=YYYY-MM
 * Detail of one service: top-10 contributing players + all others.
 */
router.get('/services/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) return res.status(400).json({ error: 'ID invalide' });

  const { month } = req.query;
  const { clause, params } = monthFilter(month);
  const nextParam = params.length + 1;

  // Service info
  const svcRes = await pool.query('SELECT id, name, code FROM services WHERE id = $1', [serviceId]);
  if (svcRes.rows.length === 0) return res.status(404).json({ error: 'Service introuvable' });

  // All players of the service with their best score
  const sql = `
    SELECT
      p.id,
      p.name,
      MAX(gs.score) AS best_score,
      COUNT(gs.id) AS games_played
    FROM players p
    JOIN game_sessions gs ON gs.player_id = p.id AND gs.completed = TRUE ${clause}
    WHERE p.service_id = $${nextParam}
    GROUP BY p.id, p.name
    ORDER BY best_score DESC
  `;

  const { rows } = await pool.query(sql, [...params, serviceId]);

  const top10 = rows.slice(0, 10);
  const others = rows.slice(10);

  const avgScore = rows.length > 0
    ? Math.round((rows.reduce((sum, r) => sum + Number(r.best_score), 0) / rows.length) * 100) / 100
    : 0;

  return res.json({
    service: svcRes.rows[0],
    avgBestScore: avgScore,
    playerCount: rows.length,
    top10,
    others,
    month: month || null,
  });
});

module.exports = router;
