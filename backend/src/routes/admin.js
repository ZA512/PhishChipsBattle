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

  const updates = [];
  const params = [];

  if (name) {
    params.push(String(name).trim());
    updates.push(`name = $${params.length}`);
  }
  if (code) {
    const normalizedCode = String(code).toUpperCase().trim().replace(/\s+/g, '_');
    if (normalizedCode.length > 20) {
      return res.status(400).json({ error: 'code trop long (max 20 caractères)' });
    }
    params.push(normalizedCode);
    updates.push(`code = $${params.length}`);
  }

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE services SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name, code, created_at`,
      params
    );
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

module.exports = router;
