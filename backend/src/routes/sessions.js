'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { answerLimiter } = require('../middleware/rateLimiter');
const { evaluateAchievements } = require('../services/achievements');

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ERRORS = 3;

/** Shuffle array using Fisher-Yates (server-side, non-predictable) */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Verify session token from header */
function verifySessionToken(req, sessionId) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.sessionId !== sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * POST /api/sessions
 * Create a new game session for a player.
 * Body: { playerId, difficulty }
 */
router.post('/', async (req, res) => {
  const { playerId, difficulty } = req.body;
  if (!playerId || !difficulty) {
    return res.status(400).json({ error: 'playerId et difficulty sont requis' });
  }
  if (!['easy', 'normal', 'hardcore'].includes(difficulty)) {
    return res.status(400).json({ error: 'difficulty invalide' });
  }

  const client = await pool.connect();
  try {
    // Verify player exists
    const playerRes = await client.query('SELECT id FROM players WHERE id = $1', [playerId]);
    if (playerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    // Get all available email IDs
    const emailsRes = await client.query('SELECT id FROM emails');
    if (emailsRes.rows.length === 0) {
      return res.status(500).json({ error: 'Aucun email disponible dans la base' });
    }

    // Shuffle all emails — game continues until MAX_ERRORS or all emails played
    const allIds = emailsRes.rows.map((r) => r.id);
    const shuffled = shuffleArray(allIds);

    const sessionRes = await client.query(
      `INSERT INTO game_sessions (player_id, difficulty, email_order, total_emails)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [playerId, difficulty, JSON.stringify(shuffled), shuffled.length]
    );
    const sessionId = sessionRes.rows[0].id;

    // Sign a short-lived session token (4 hours — enough for one game)
    const token = jwt.sign({ sessionId, playerId }, JWT_SECRET, { expiresIn: '4h' });

    return res.status(201).json({ sessionId, sessionToken: token, totalEmails: shuffled.length });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sessions/:id/next-email
 * Return the current email for the session — WITHOUT type or clues.
 */
router.get('/:id/next-email', async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) return res.status(400).json({ error: 'ID de session invalide' });
  if (!verifySessionToken(req, sessionId)) {
    return res.status(401).json({ error: 'Token de session invalide' });
  }

  const client = await pool.connect();
  try {
    const sessionRes = await client.query(
      'SELECT * FROM game_sessions WHERE id = $1',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session introuvable' });
    }
    const session = sessionRes.rows[0];

    if (session.completed) {
      return res.status(410).json({ error: 'Session terminée' });
    }

    if (session.errors >= MAX_ERRORS) {
      return res.status(410).json({ error: 'Session terminée (trop d\'erreurs)' });
    }

    const emailOrder = session.email_order;
    const idx = session.current_email_index;

    if (idx >= emailOrder.length) {
      return res.status(410).json({ error: 'Tous les emails ont été joués' });
    }

    const emailId = emailOrder[idx];
    const emailRes = await client.query(
      'SELECT id, sender, real_sender, subject, body FROM emails WHERE id = $1',
      [emailId]
    );
    if (emailRes.rows.length === 0) {
      return res.status(500).json({ error: 'Email introuvable' });
    }

    const email = emailRes.rows[0];
    return res.json({
      emailId: email.id,
      sender: email.sender,
      realSender: email.real_sender,
      subject: email.subject,
      body: email.body,
      emailIndex: idx + 1,
      totalEmails: emailOrder.length,
      score: session.score,
      errors: session.errors,
      jokersUsed: session.jokers_used,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/sessions/:id/answer
 * Submit an answer for the current email.
 * Body: { emailId, choice: 'phishing' | 'safe' | 'joker', decisionTime }
 */
router.post('/:id/answer', answerLimiter, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) return res.status(400).json({ error: 'ID de session invalide' });
  if (!verifySessionToken(req, sessionId)) {
    return res.status(401).json({ error: 'Token de session invalide' });
  }

  const { emailId, choice, decisionTime } = req.body;
  if (!emailId || !choice) {
    return res.status(400).json({ error: 'emailId et choice sont requis' });
  }
  if (!['phishing', 'safe', 'joker', 'timeout'].includes(choice)) {
    return res.status(400).json({ error: 'choice invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      'SELECT * FROM game_sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session introuvable' });
    }
    const session = sessionRes.rows[0];

    if (session.completed || session.errors >= MAX_ERRORS) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Session déjà terminée' });
    }

    const emailOrder = session.email_order;
    const idx = session.current_email_index;
    if (idx >= emailOrder.length || emailOrder[idx] !== emailId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'emailId ne correspond pas à l\'email courant' });
    }

    // Get the correct answer
    const emailRes = await client.query(
      'SELECT id, type FROM emails WHERE id = $1',
      [emailId]
    );
    const correctType = emailRes.rows[0].type;
    // timeout always counts as incorrect; joker always correct
    const isCorrect = choice === 'joker' ? true : (choice === 'timeout' ? false : choice === correctType);

    // Compute new score/errors
    let newScore = session.score;
    let newErrors = session.errors;
    let newJokersUsed = session.jokers_used;

    if (choice === 'joker') {
      newJokersUsed++;
      newScore++;
    } else if (isCorrect) {
      newScore++;
    } else {
      newErrors++;
    }

    const newIdx = idx + 1;
    const gameOver = newErrors >= MAX_ERRORS;
    const allDone = newIdx >= emailOrder.length;
    const completed = gameOver || allDone;

    // Update session
    await client.query(
      `UPDATE game_sessions
       SET score = $1, errors = $2, jokers_used = $3,
           current_email_index = $4, completed = $5,
           ended_at = CASE WHEN $5 THEN NOW() ELSE NULL END
       WHERE id = $6`,
      [newScore, newErrors, newJokersUsed, newIdx, completed, sessionId]
    );

    // Record the answer
    await client.query(
      `INSERT INTO email_answers (session_id, email_id, user_choice, is_correct, decision_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, emailId, choice, isCorrect, Math.max(0, Math.round(decisionTime || 0))]
    );

    // Fetch clues to return to the player
    const cluesRes = await client.query(
      'SELECT clue_text FROM email_clues WHERE email_id = $1 ORDER BY display_order',
      [emailId]
    );
    const clues = cluesRes.rows.map((r) => r.clue_text);

    await client.query('COMMIT');

    // Evaluate achievements if game completed
    let newAchievements = [];
    if (completed) {
      try {
        newAchievements = await evaluateAchievements(session.player_id, sessionId);
      } catch (achErr) {
        console.error('[achievements] Evaluation error (non-blocking):', achErr.message);
      }
    }

    return res.json({
      isCorrect,
      correctType,
      clues,
      score: newScore,
      errors: newErrors,
      jokersUsed: newJokersUsed,
      completed,
      gameOver,
      allDone,
      newAchievements,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/sessions/:id/end
 * Forcefully end a session (e.g., player quits).
 */
router.post('/:id/end', async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) return res.status(400).json({ error: 'ID de session invalide' });
  if (!verifySessionToken(req, sessionId)) {
    return res.status(401).json({ error: 'Token de session invalide' });
  }

  await pool.query(
    `UPDATE game_sessions SET completed = TRUE, ended_at = NOW()
     WHERE id = $1 AND completed = FALSE`,
    [sessionId]
  );
  return res.json({ ok: true });
});

module.exports = router;
