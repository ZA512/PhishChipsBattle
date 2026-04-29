'use strict';

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
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

module.exports = { adminAuth };
