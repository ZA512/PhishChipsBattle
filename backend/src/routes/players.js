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

module.exports = router;
