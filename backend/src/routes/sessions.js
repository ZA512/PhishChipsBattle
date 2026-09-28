"use strict";
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { HttpError, integer, transaction } = require("../lib/http");
const { requireUser } = require("../services/auth");
const { answerLimiter } = require("../middleware/rateLimiter");
const { evaluateAchievements } = require("../services/achievements");
const { shuffled, openBattle } = require("../services/battles");
router.use(requireUser);

function tokenCheck(req, id) {
  let payload;
  try {
    payload = jwt.verify(req.get("X-Session-Token"), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "game",
      issuer: "phishchips",
    });
  } catch {
    throw new HttpError(401, "Token de partie invalide");
  }
  if (payload.sessionId !== id || payload.playerId !== req.user.id)
    throw new HttpError(403, "Cette partie ne vous appartient pas");
}
async function lockedSession(client, id, playerId) {
  const hint = (
    await client.query(
      "SELECT battle_id FROM game_sessions WHERE id=$1 AND player_id=$2",
      [id, playerId],
    )
  ).rows[0];
  if (!hint) throw new HttpError(404, "Partie introuvable");
  const battle = hint.battle_id
    ? await openBattle(client, hint.battle_id)
    : null;
  const session = (
    await client.query(
      "SELECT * FROM game_sessions WHERE id=$1 AND player_id=$2 FOR UPDATE",
      [id, playerId],
    )
  ).rows[0];
  if (session.rules_version !== 1)
    throw new HttpError(410, "Ancienne partie : démarrez une nouvelle partie");
  session.server_now = (
    await client.query("SELECT clock_timestamp() AS now")
  ).rows[0].now;
  if (battle && session.server_now >= new Date(battle.ends_at))
    throw new HttpError(409, "La battle n’est plus ouverte");
  return { session, battle };
}
function seconds(score, difficulty) {
  return difficulty === "easy"
    ? 30
    : Math.max(difficulty === "normal" ? 15 : 5, 30 - score);
}
async function earned(playerId, id) {
  try {
    return await evaluateAchievements(playerId, id);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "achievement_error",
        sessionId: id,
        message: err.message,
      }),
    );
    return [];
  }
}
async function sessionPayload(client, s, jokerLimit, resumed = false) {
  const stats = (
    await client.query(
      `SELECT COUNT(*)::int AS answers,COUNT(*) FILTER(WHERE user_choice<>'joker')::int AS human_answers,
    COUNT(*) FILTER(WHERE user_choice='safe' AND is_correct)::int AS safe_found,
    COUNT(*) FILTER(WHERE user_choice='phishing' AND is_correct)::int AS phishing_found,
    COALESCE(SUM(decision_time) FILTER(WHERE user_choice<>'joker'),0)::int AS decision_seconds FROM email_answers WHERE session_id=$1`,
      [s.id],
    )
  ).rows[0];
  return {
    sessionId: s.id,
    sessionToken: jwt.sign(
      { sessionId: s.id, playerId: s.player_id },
      process.env.JWT_SECRET,
      { expiresIn: "4h", audience: "game", issuer: "phishchips" },
    ),
    totalEmails: s.total_emails,
    difficulty: s.difficulty,
    jokerLimit,
    resumed,
    stats,
  };
}
router.post("/", async (req, res) => {
  if (
    req.body.playerId !== undefined &&
    integer(req.body.playerId, "Joueur") !== req.user.id
  )
    throw new HttpError(403, "Vous ne pouvez jouer que pour votre compte");
  const battleId = integer(req.body.battleId, "Battle", { optional: true });
  const result = await transaction(async (client) => {
    let battle = null,
      roster = null;
    if (battleId) {
      battle = await openBattle(client, battleId);
      roster = (
        await client.query(
          "SELECT * FROM battle_participants WHERE battle_id=$1 AND player_id=$2 FOR UPDATE",
          [battleId, req.user.id],
        )
      ).rows[0];
      if (!roster)
        throw new HttpError(
          403,
          "Vous n’étiez pas inscrit à cette battle lors de sa création",
        );
    }
    const difficulty = battle?.difficulty || req.body.difficulty;
    if (!["easy", "normal", "hardcore"].includes(difficulty))
      throw new HttpError(400, "Difficulté invalide");
    const player = (
      await client.query(
        `SELECT p.service_id,s.name AS service_name FROM players p LEFT JOIN services s ON s.id=p.service_id AND s.archived_at IS NULL WHERE p.id=$1`,
        [req.user.id],
      )
    ).rows[0];
    if (!player.service_id || !player.service_name)
      throw new HttpError(409, "Choisissez votre équipe avant de jouer");
    // Serialize training starts too, so a double click creates one ongoing game.
    if (!battleId)
      await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
    const ongoing = (
      await client.query(
        `SELECT * FROM game_sessions WHERE player_id=$1 AND battle_id IS NOT DISTINCT FROM $2::integer
      AND difficulty=$3 AND rules_version=1 AND NOT completed ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.user.id, battleId, difficulty],
      )
    ).rows[0];
    if (ongoing)
      return sessionPayload(client, ongoing, battle?.joker_limit ?? 3, true);
    if (battle) {
      const attempts = (
        await client.query(
          "SELECT COUNT(*) AS n FROM game_sessions WHERE battle_id=$1 AND player_id=$2",
          [battleId, req.user.id],
        )
      ).rows[0];
      if (Number(attempts.n) >= battle.max_attempts)
        throw new HttpError(409, "Toutes vos tentatives ont été utilisées");
    }
    const order =
      battle?.email_order ||
      shuffled(
        (await client.query("SELECT id FROM emails ORDER BY id")).rows.map(
          (e) => e.id,
        ),
      );
    if (!order.length) throw new HttpError(503, "Aucun email disponible");
    const { rows } = await client.query(
      `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,service_id,service_name,battle_id,rules_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,1) RETURNING *`,
      [
        req.user.id,
        difficulty,
        JSON.stringify(order),
        order.length,
        roster ? roster.service_id : player.service_id,
        roster ? roster.service_name : player.service_name,
        battleId,
      ],
    );
    return sessionPayload(client, rows[0], battle?.joker_limit ?? 3);
  });
  res.status(201).json(result);
});
router.get("/:id/next-email", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  tokenCheck(req, id);
  const result = await transaction(async (client) => {
    const { session: s, battle } = await lockedSession(client, id, req.user.id);
    if (s.completed || s.current_email_index >= s.email_order.length)
      throw new HttpError(410, "Partie terminée");
    if (!s.email_started_at) {
      const { rows } = await client.query(
        `WITH clock AS (SELECT clock_timestamp() AS now)
        UPDATE game_sessions SET email_started_at=clock.now,email_deadline_at=LEAST(clock.now+($1::integer*INTERVAL '1 second'),COALESCE($2::timestamptz,'infinity'::timestamptz))
        FROM clock WHERE id=$3 RETURNING email_started_at,email_deadline_at,clock.now AS server_now`,
        [seconds(s.score, s.difficulty), battle?.ends_at || null, id],
      );
      Object.assign(s, rows[0]);
    }
    const email = (
      await client.query(
        "SELECT id,sender,real_sender,subject,body FROM emails WHERE id=$1",
        [s.email_order[s.current_email_index]],
      )
    ).rows[0];
    if (!email) throw new HttpError(503, "Email indisponible");
    return {
      emailId: email.id,
      sender: email.sender,
      realSender: email.real_sender,
      subject: email.subject,
      body: email.body,
      emailIndex: s.current_email_index + 1,
      totalEmails: s.email_order.length,
      score: s.score,
      errors: s.errors,
      jokersUsed: s.jokers_used,
      jokerLimit: battle?.joker_limit ?? 3,
      remainingMs: Math.max(
        0,
        new Date(s.email_deadline_at) - new Date(s.server_now),
      ),
      deadlineAt: s.email_deadline_at,
    };
  });
  res.json(result);
});
router.post("/:id/answer", answerLimiter, async (req, res) => {
  const id = integer(req.params.id, "Partie"),
    emailId = integer(req.body.emailId, "Email");
  tokenCheck(req, id);
  if (!["safe", "phishing", "joker", "timeout"].includes(req.body.choice))
    throw new HttpError(400, "Choix invalide");
  // Retrying the same email returns its stored response, including after a game/battle ends.
  const cached = (
    await pool.query(
      `SELECT ea.response FROM email_answers ea JOIN game_sessions gs ON gs.id=ea.session_id WHERE ea.session_id=$1 AND ea.email_id=$2 AND gs.player_id=$3`,
      [id, emailId, req.user.id],
    )
  ).rows[0];
  if (cached?.response) return res.json(cached.response);
  const result = await transaction(async (client) => {
    const { session: s, battle } = await lockedSession(client, id, req.user.id);
    const repeat = (
      await client.query(
        "SELECT response FROM email_answers WHERE session_id=$1 AND email_id=$2",
        [id, emailId],
      )
    ).rows[0];
    if (repeat?.response) return repeat.response;
    if (s.completed) throw new HttpError(410, "Partie terminée");
    if (s.email_order[s.current_email_index] !== emailId || !s.email_started_at)
      throw new HttpError(
        409,
        "Cet email n’est pas l’email courant. Rechargez la partie.",
      );
    const expired = new Date(s.server_now) >= new Date(s.email_deadline_at);
    const choice = expired ? "timeout" : req.body.choice;
    if (choice === "joker" && s.jokers_used >= (battle?.joker_limit ?? 3))
      throw new HttpError(409, "Tous les jokers ont été utilisés");
    const email = (
      await client.query("SELECT type FROM emails WHERE id=$1", [emailId])
    ).rows[0];
    const correct = choice === "joker" || choice === email.type;
    const score = s.score + (correct ? 1 : 0),
      errors = s.errors + (correct ? 0 : 1),
      jokers = s.jokers_used + (choice === "joker" ? 1 : 0),
      index = s.current_email_index + 1;
    const completed = errors >= 3 || index >= s.email_order.length;
    const decisionTime = Math.max(
      0,
      Math.ceil(
        (Math.min(
          new Date(s.server_now).getTime(),
          new Date(s.email_deadline_at).getTime(),
        ) -
          new Date(s.email_started_at).getTime()) /
          1000,
      ),
    );
    const clues = (
      await client.query(
        "SELECT clue_text FROM email_clues WHERE email_id=$1 ORDER BY display_order",
        [emailId],
      )
    ).rows.map((c) => c.clue_text);
    const response = {
      isCorrect: correct,
      correctType: email.type,
      clues,
      score,
      errors,
      jokersUsed: jokers,
      completed,
      gameOver: errors >= 3,
      allDone: index >= s.email_order.length,
      isTimeout: choice === "timeout",
      decisionTime,
      newAchievements: [],
    };
    await client.query(
      `UPDATE game_sessions SET score=$1,errors=$2,jokers_used=$3,current_email_index=$4,completed=$5,
      ended_at=CASE WHEN $5 THEN NOW() ELSE NULL END,finish_reason=CASE WHEN $5 THEN $6 ELSE NULL END,email_started_at=NULL,email_deadline_at=NULL WHERE id=$7`,
      [
        score,
        errors,
        jokers,
        index,
        completed,
        errors >= 3 ? "errors" : "all_emails",
        id,
      ],
    );
    await client.query(
      "INSERT INTO email_answers(session_id,email_id,user_choice,is_correct,decision_time,response) VALUES($1,$2,$3,$4,$5,$6)",
      [id, emailId, choice, correct, decisionTime, JSON.stringify(response)],
    );
    return response;
  });
  if (result.completed) {
    result.newAchievements = await earned(req.user.id, id);
    await pool.query(
      "UPDATE email_answers SET response=$1 WHERE session_id=$2 AND email_id=$3",
      [JSON.stringify(result), id, emailId],
    );
  }
  res.json(result);
});
router.post("/:id/end", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  tokenCheck(req, id);
  // Abandonment remains available after the deadline. It cannot increase or shift the battle score.
  const result = await transaction(async (client) => {
    const hint = (
      await client.query(
        "SELECT battle_id FROM game_sessions WHERE id=$1 AND player_id=$2",
        [id, req.user.id],
      )
    ).rows[0];
    if (!hint) throw new HttpError(404, "Partie introuvable");
    if (hint.battle_id)
      await client.query("SELECT id FROM battles WHERE id=$1 FOR SHARE", [
        hint.battle_id,
      ]);
    const row = (
      await client.query(
        "UPDATE game_sessions SET completed=TRUE,ended_at=NOW(),finish_reason='abandoned' WHERE id=$1 AND player_id=$2 AND NOT completed RETURNING id",
        [id, req.user.id],
      )
    ).rows[0];
    return !!row;
  });
  res.json({
    ok: true,
    newAchievements: result ? await earned(req.user.id, id) : [],
  });
});
router.get("/:id/recap", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  const session = (
    await pool.query(
      "SELECT id,completed,score,errors,finish_reason,service_name,battle_id FROM game_sessions WHERE id=$1 AND player_id=$2",
      [id, req.user.id],
    )
  ).rows[0];
  if (!session) throw new HttpError(404, "Partie introuvable");
  if (!session.completed)
    throw new HttpError(409, "Terminez la partie avant le récapitulatif");
  const answers = (
    await pool.query(
      `SELECT e.subject,e.sender,e.type,ea.user_choice,ea.is_correct,ea.decision_time,
    COALESCE((SELECT jsonb_agg(clue_text ORDER BY display_order) FROM email_clues WHERE email_id=e.id),'[]'::jsonb) AS clues
    FROM email_answers ea JOIN emails e ON e.id=ea.email_id WHERE ea.session_id=$1 ORDER BY ea.id`,
      [id],
    )
  ).rows;
  res.json({ session, answers });
});
module.exports = router;
