'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { adminAuth } = require('../middleware/adminAuth');

// All admin routes require authentication
router.use(adminAuth);

/**
 * GET /api/admin/services
 * List all services.
 */
router.get('/services', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, code, created_at FROM services ORDER BY name ASC'
  );
  return res.json({ services: rows });
});

/**
 * POST /api/admin/services
 * Create a new service.
 * Body: { name, code }
 */
router.post('/services', async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'name et code sont requis' });
  }
  const normalizedCode = String(code).toUpperCase().trim().replace(/\s+/g, '_');
  if (normalizedCode.length > 20) {
    return res.status(400).json({ error: 'code trop long (max 20 caractères)' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO services (name, code) VALUES ($1, $2) RETURNING id, name, code, created_at',
      [String(name).trim(), normalizedCode]
    );
    return res.status(201).json({ service: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce code de service existe déjà' });
    }
    throw err;
  }
});

/**
 * PUT /api/admin/services/:id
 * Update a service.
 * Body: { name?, code? }
 */
router.put('/services/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const { name, code } = req.body;
  if (!name && !code) {
    return res.status(400).json({ error: 'Au moins name ou code requis' });
  }

  const normalizedName = name ? String(name).trim() : null;
  const normalizedCode = code
    ? String(code).toUpperCase().trim().replace(/\s+/g, '_')
    : null;

  if (normalizedCode && normalizedCode.length > 20) {
    return res.status(400).json({ error: 'code trop long (max 20 caractères)' });
  }

  let query;
  let params;
  if (normalizedName && normalizedCode) {
    query = 'UPDATE services SET name = $1, code = $2 WHERE id = $3 RETURNING id, name, code, created_at';
    params = [normalizedName, normalizedCode, id];
  } else if (normalizedName) {
    query = 'UPDATE services SET name = $1 WHERE id = $2 RETURNING id, name, code, created_at';
    params = [normalizedName, id];
  } else {
    query = 'UPDATE services SET code = $1 WHERE id = $2 RETURNING id, name, code, created_at';
    params = [normalizedCode, id];
  }

  try {
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Service introuvable' });
    return res.json({ service: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce code de service existe déjà' });
    }
    throw err;
  }
});

/**
 * DELETE /api/admin/services/:id
 * Delete a service. Players linked to it will have service_id set to NULL (FK ON DELETE SET NULL).
 */
router.delete('/services/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const { rowCount } = await pool.query('DELETE FROM services WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Service introuvable' });
  return res.json({ ok: true });
});

// ============================================================
// Stats endpoints
// ============================================================

/**
 * GET /api/admin/stats/overview
 * Global stats: success rate, player count, game count, avg score by difficulty.
 */
router.get('/stats/overview', async (_req, res) => {
  const [totals, byDiff, players] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_answers,
        COUNT(*) FILTER (WHERE is_correct) AS correct_answers
      FROM email_answers
    `),
    pool.query(`
      SELECT
        gs.difficulty,
        COUNT(DISTINCT gs.id) AS games,
        ROUND(AVG(gs.score), 1) AS avg_score
      FROM game_sessions gs
      WHERE gs.completed = TRUE
      GROUP BY gs.difficulty
      ORDER BY gs.difficulty
    `),
    pool.query('SELECT COUNT(*) AS count FROM players'),
  ]);

  const t = totals.rows[0];
  const successRate = t.total_answers > 0
    ? ((parseInt(t.correct_answers) / parseInt(t.total_answers)) * 100).toFixed(1)
    : 0;

  return res.json({
    totalPlayers: parseInt(players.rows[0].count),
    totalAnswers: parseInt(t.total_answers),
    successRate: parseFloat(successRate),
    byDifficulty: byDiff.rows.map((r) => ({
      difficulty: r.difficulty,
      games: parseInt(r.games),
      avgScore: parseFloat(r.avg_score),
    })),
  });
});

/**
 * GET /api/admin/stats/hardest-emails
 * Top 10 emails with highest error rate (min 5 attempts).
 */
router.get('/stats/hardest-emails', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      e.id,
      e.subject,
      e.type,
      COUNT(*) AS attempts,
      COUNT(*) FILTER (WHERE NOT ea.is_correct) AS errors,
      ROUND(COUNT(*) FILTER (WHERE NOT ea.is_correct)::numeric / COUNT(*) * 100, 1) AS error_rate
    FROM email_answers ea
    JOIN emails e ON e.id = ea.email_id
    WHERE ea.user_choice IN ('phishing', 'safe')
    GROUP BY e.id, e.subject, e.type
    HAVING COUNT(*) >= 5
    ORDER BY error_rate DESC
    LIMIT 10
  `);

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
router.get('/stats/activity', async (req, res) => {
  const period = req.query.period === 'month' ? 30 : 7;

  const { rows } = await pool.query(`
    SELECT
      DATE(started_at) AS day,
      COUNT(*) AS games,
      COUNT(DISTINCT player_id) AS players
    FROM game_sessions
    WHERE started_at >= NOW() - ($1 || ' days')::interval
    GROUP BY DATE(started_at)
    ORDER BY day
  `, [period]);

  return res.json({
    period: req.query.period === 'month' ? 'month' : 'week',
    days: rows.map((r) => ({
      day: r.day,
      games: parseInt(r.games),
      players: parseInt(r.players),
    })),
  });
});

module.exports = router;
