"use strict";
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const userKey = (req) =>
  req.user ? `player:${req.user.id}` : ipKeyGenerator(req.ip);
const options = { standardHeaders: true, legacyHeaders: false };
const apiLimiter = rateLimit({
  ...options,
  windowMs: 60000,
  limit: 240,
  keyGenerator: userKey,
  message: { error: "Trop de requêtes, réessayez dans une minute." },
});
const answerLimiter = rateLimit({
  ...options,
  windowMs: 5000,
  limit: 10,
  keyGenerator: userKey,
  message: {
    error: "Réponses trop rapides. Réessayez dans quelques secondes.",
  },
});
const authLimiter = rateLimit({
  ...options,
  windowMs: 60000,
  limit: 15,
  message: {
    error: "Trop de tentatives de connexion. Réessayez dans une minute.",
  },
});
module.exports = { apiLimiter, answerLimiter, authLimiter };
