'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { migrate } = require('./db/migrate');

const playersRouter = require('./routes/players');
const sessionsRouter = require('./routes/sessions');
const scoresRouter = require('./routes/scores');
const servicesRouter = require('./routes/services');
const adminRouter = require('./routes/admin');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// CORS — allow requests from the Nginx frontend (same origin via proxy in prod)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Admin-Password'],
}));

// Body parsing
app.use(express.json({ limit: '50kb' }));

// Global rate limiter
app.use('/api', apiLimiter);

// Routes
app.use('/api/players', playersRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/services', servicesRouter);
app.use('/api/admin', adminRouter);

// Health check (no rate limit)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 for unknown routes
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await migrate();
    app.listen(PORT, () => {
      console.log(`[api] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[api] Failed to start:', err);
    process.exit(1);
  }
}

start();
