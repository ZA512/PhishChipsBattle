'use strict';

const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Middleware: verify X-Admin-Password header.
 * Compares using constant-time-like approach to avoid timing attacks.
 */
function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD non configuré sur le serveur' });
  }
  const provided = req.headers['x-admin-password'];
  if (!provided) {
    return res.status(401).json({ error: 'Mot de passe admin requis (header X-Admin-Password)' });
  }
  // Constant-time string comparison to mitigate timing attacks
  if (!constantTimeEqual(provided, ADMIN_PASSWORD)) {
    return res.status(403).json({ error: 'Mot de passe admin incorrect' });
  }
  next();
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare quand même pour éviter le timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { adminAuth };
