'use strict';

const rateLimit = require('express-rate-limit');

/** General API rate limiter */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,             // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessaie dans une minute.' },
});

/**
 * Dedicated limiter for /answer endpoint.
 * Prevents scripted auto-answers (max 10 answers per 5s per IP).
 */
const answerLimiter = rateLimit({
  windowMs: 5 * 1000,  // 5 seconds
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Réponses trop rapides. Ralentis un peu, champion.' },
});

module.exports = { apiLimiter, answerLimiter };
