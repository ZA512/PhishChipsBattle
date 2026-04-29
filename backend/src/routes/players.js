'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * POST /api/players
 * Identifies or creates a player.
 *
 * Body: { name: string (3-4 chars), email: string, serviceId?: number }
 *
 * Rules:
 *   - Same email + same name    → return existing player (reconnexion)
 *   - Same email + diff name    → error "cet email est déjà lié au pseudo {name}"
 *   - Same name + diff email    → error "ce pseudo est déjà pris"
 *   - New pair                  → create player
 */
router.post('/', async (req, res) => {
  const { name, email, serviceId } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name et email sont requis' });
  }

  const normalizedName = String(name).toUpperCase().trim().slice(0, 4);
  if (normalizedName.length < 2) {
    return res.status(400).json({ error: 'Le pseudo doit contenir au moins 2 caractères' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Format d\'email invalide' });
  }

  const svcId = serviceId ? parseInt(serviceId, 10) : null;
  if (serviceId && isNaN(svcId)) {
    return res.status(400).json({ error: 'serviceId invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const byEmail = await client.query(
      'SELECT id, name, email, service_id FROM players WHERE email = $1',
      [normalizedEmail]
    );

    if (byEmail.rows.length > 0) {
      const existing = byEmail.rows[0];
      if (existing.name !== normalizedName) {
        return res.status(409).json({
          error: `Cet email est déjà lié au pseudo "${existing.name}". Utilise le même pseudo pour te reconnecter.`,
          existingName: existing.name,
        });
      }
      // Same email + same name → reconnect, optionally update service
      if (serviceId !== undefined) {
        await client.query(
          'UPDATE players SET service_id = $1 WHERE id = $2',
          [svcId, existing.id]
        );
        existing.service_id = svcId;
      }
      await client.query('COMMIT');
      return res.json({ player: { id: existing.id, name: existing.name, email: existing.email, serviceId: existing.service_id }, created: false });
    }

    // Check if name already taken by a different email
    const byName = await client.query(
      'SELECT id, email FROM players WHERE name = $1',
      [normalizedName]
    );
    if (byName.rows.length > 0) {
      return res.status(409).json({
        error: `Le pseudo "${normalizedName}" est déjà pris par un autre joueur. Choisis un autre pseudo.`,
      });
    }

    // Create new player
    const insert = await client.query(
      'INSERT INTO players (name, email, service_id) VALUES ($1, $2, $3) RETURNING id, name, email, service_id',
      [normalizedName, normalizedEmail, svcId]
    );
    const player = insert.rows[0];
    await client.query('COMMIT');
    return res.status(201).json({ player: { id: player.id, name: player.name, email: player.email, serviceId: player.service_id }, created: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Conflit : ce pseudo ou cet email existe déjà.' });
    }
    throw err;
  } finally {
    client.release();
  }
});

/**
 * GET /api/players/:id/profile
 * Returns player stats (no email exposed).
 */
router.get('/:id/profile', async (req, res) => {
  const playerId = parseInt(req.params.id, 10);
  if (isNaN(playerId)) return res.status(400).json({ error: 'ID invalide' });

  const playerRes = await pool.query(
    'SELECT id, name, service_id, created_at FROM players WHERE id = $1',
    [playerId]
  );
  if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Joueur introuvable' });
  const player = playerRes.rows[0];

  const statsRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE completed) AS games_played,
       COALESCE(MAX(score), 0) AS best_score,
       COALESCE(SUM(score), 0) AS total_score,
       COALESCE(SUM(CASE WHEN completed THEN score ELSE 0 END), 0) AS total_correct,
       COALESCE(SUM(errors), 0) AS total_errors
     FROM game_sessions WHERE player_id = $1`,
    [playerId]
  );
  const stats = statsRes.rows[0];

  return res.json({
    player: { id: player.id, name: player.name, serviceId: player.service_id, createdAt: player.created_at },
    stats: {
      gamesPlayed: parseInt(stats.games_played) || 0,
      bestScore: parseInt(stats.best_score) || 0,
      totalScore: parseInt(stats.total_score) || 0,
      totalCorrect: parseInt(stats.total_correct) || 0,
      totalErrors: parseInt(stats.total_errors) || 0,
    },
  });
});

/**
 * GET /api/players/:id/achievements
 * Returns all achievements with unlock status for a player.
 */
router.get('/:id/achievements', async (req, res) => {
  const playerId = parseInt(req.params.id, 10);
  if (isNaN(playerId)) return res.status(400).json({ error: 'ID invalide' });

  const result = await pool.query(
    `SELECT a.*, pa.unlocked_at, pa.session_id AS unlock_session_id
     FROM achievements a
     LEFT JOIN player_achievements pa ON pa.achievement_id = a.id AND pa.player_id = $1
     ORDER BY a.category, a.difficulty, a.tier`,
    [playerId]
  );

  const achievements = result.rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    emoji: r.emoji,
    category: r.category,
    difficulty: r.difficulty,
    tier: r.tier,
    threshold: r.threshold,
    unlocked: !!r.unlocked_at,
    unlockedAt: r.unlocked_at || null,
  }));

  return res.json({ achievements });
});

module.exports = router;
