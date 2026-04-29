'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * GET /api/services
 * List all services (for the player registration form).
 */
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, code FROM services ORDER BY name ASC'
  );
  return res.json({ services: rows });
});

module.exports = router;
