"use strict";
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { HttpError, integer, transaction } = require("../lib/http");
const { requireUser } = require("../services/auth");
const { answerLimiter } = require("../middleware/rateLimiter");
const { evaluateAchievements } = require("../services/achievements");
const { shuffled, openBattle } = require("../services/battles");
const { CATALOG_LOCK } = require("../services/mailCatalog");
const {
  availableSources,
  selectSource,
} = require("../services/timeAttackCatalog");
const {
  NEW_RULES,
  classicSeconds,
  timeAttackScore,
} = require("../services/gameRules");
router.use(requireUser);
function tokenCheck(req, id) {
  let p;
  try {
    p = jwt.verify(req.get("X-Session-Token"), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "game",
      issuer: "phishchips",
    });
  } catch {
    throw new HttpError(401, "Token de partie invalide");
  }
  if (p.sessionId !== id || p.playerId !== req.user.id)
    throw new HttpError(403, "Cette partie ne vous appartient pas");
}
async function lockedSession(client, id, playerId, allowClosed = false) {
  const hint = (
    await client.query(
      "SELECT battle_id FROM game_sessions WHERE id=$1 AND player_id=$2",
      [id, playerId],
    )
  ).rows[0];
  if (!hint) throw new HttpError(404, "Partie introuvable");
  let battle = null;
  if (hint.battle_id)
    battle = allowClosed
      ? (
          await client.query("SELECT * FROM battles WHERE id=$1 FOR SHARE", [
            hint.battle_id,
          ])
        ).rows[0]
      : await openBattle(client, hint.battle_id);
  const s = (
    await client.query(
      "SELECT *,clock_timestamp() AS server_now FROM game_sessions WHERE id=$1 AND player_id=$2 FOR UPDATE",
      [id, playerId],
    )
  ).rows[0];
  // Read the clock after acquiring the row lock, not before waiting for it.
  s.server_now = (
    await client.query("SELECT clock_timestamp() AS now")
  ).rows[0].now;
  if (![1, 2].includes(s.rules_version) && (!allowClosed || !s.completed))
    throw new HttpError(410, "Ancienne partie : démarrez une nouvelle partie");
  if (
    !allowClosed &&
    battle?.ends_at &&
    s.server_now >= new Date(battle.ends_at)
  )
    throw new HttpError(409, "La battle n’est plus ouverte");
  await expireOne(client, s);
  return { session: s, battle };
}
async function expireOne(client, s) {
  if (
    s.game_format === "time_attack" &&
    !s.completed &&
    s.global_deadline_at &&
    s.server_now >= new Date(s.global_deadline_at)
  ) {
    Object.assign(
      s,
      (
        await client.query(
          "UPDATE game_sessions SET completed=TRUE,ended_at=global_deadline_at,finish_reason='time_up',email_started_at=NULL,email_deadline_at=NULL WHERE id=$1 RETURNING *",
          [s.id],
        )
      ).rows[0],
    );
  }
}
async function stats(client, id) {
  return (
    await client.query(
      `SELECT COUNT(*)::int AS answers,
    COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing'))::int AS human_answers,
    COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing') AND is_correct)::int AS human_correct,
    COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing') AND NOT is_correct)::int AS human_errors,
    COUNT(*) FILTER(WHERE user_choice='joker')::int AS assisted,
    COUNT(*) FILTER(WHERE user_choice='timeout')::int AS timeouts,
    COUNT(*) FILTER(WHERE user_choice='safe' AND is_correct)::int AS safe_found,
    COUNT(*) FILTER(WHERE user_choice='phishing' AND is_correct)::int AS phishing_found,
    COALESCE(SUM(decision_time) FILTER(WHERE user_choice IN ('safe','phishing')),0)::int AS decision_seconds
    FROM email_answers WHERE session_id=$1`,
      [id],
    )
  ).rows[0];
}
async function state(client, s, jokerLimit) {
  const deadline =
    s.game_format === "time_attack"
      ? s.global_deadline_at
      : s.email_deadline_at;
  return {
    sessionId: s.id,
    format: s.game_format,
    battleId: s.battle_id,
    difficulty: s.difficulty,
    rulesVersion: s.rules_version,
    timerRules: s.timer_rules,
    durationSeconds: s.duration_seconds,
    setId: s.mail_set_id,
    setName: s.mail_set_name,
    deadlineAt: deadline,
    serverNow: s.server_now,
    remainingMs: deadline
      ? Math.max(0, new Date(deadline) - new Date(s.server_now))
      : null,
    completed: s.completed,
    finishReason: s.finish_reason,
    score: s.game_format === "discovery" ? null : s.score,
    errors: s.errors,
    jokersUsed: s.jokers_used,
    jokerLimit: s.game_format === "classic" ? jokerLimit : 0,
    totalEmails: s.total_emails,
    emailIndex: s.current_email_index,
    viewedEmails: s.viewed_emails,
    stats: await stats(client, s.id),
  };
}
async function sessionPayload(client, s, jokerLimit, resumed = false) {
  if (!s.server_now)
    s.server_now = (
      await client.query("SELECT clock_timestamp() AS now")
    ).rows[0].now;
  return {
    ...(await state(client, s, jokerLimit)),
    sessionToken: jwt.sign(
      { sessionId: s.id, playerId: s.player_id },
      process.env.JWT_SECRET,
      { expiresIn: "4h", audience: "game", issuer: "phishchips" },
    ),
    resumed,
  };
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
router.get("/mail-sets", async (_req, res) =>
  res.json(await availableSources(pool)),
);
router.post("/", async (req, res) => {
  if (
    req.body.playerId !== undefined &&
    integer(req.body.playerId, "Joueur") !== req.user.id
  )
    throw new HttpError(403, "Vous ne pouvez jouer que pour votre compte");
  const battleId = integer(req.body.battleId, "Battle", { optional: true });
  if (battleId && req.body.format === "discovery")
    throw new HttpError(400, "La découverte ne constitue pas une compétition");
  if (
    req.body.format !== undefined &&
    !["classic", "discovery", "time_attack"].includes(req.body.format)
  )
    throw new HttpError(400, "Format de jeu invalide pour ce contexte");
  const setId = integer(req.body.setId, "Set", { optional: true });
  const result = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock_shared($1)", [
      CATALOG_LOCK,
    ]);
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
          "Vous ne faites pas partie du public de cette compétition",
        );
    }
    const format = battle?.game_format || req.body.format || "classic";
    const duration =
      format === "time_attack"
        ? battle?.duration_seconds || integer(req.body.durationSeconds, "Durée")
        : null;
    if (
      (format === "time_attack" && ![300, 600].includes(duration)) ||
      (battle && req.body.format !== undefined && req.body.format !== format) ||
      (req.body.durationSeconds !== undefined &&
        (format !== "time_attack" ||
          Number(req.body.durationSeconds) !== duration)) ||
      (setId && (battle || format !== "time_attack"))
    )
      throw new HttpError(
        400,
        "Configuration incompatible avec cette compétition ou ce format",
      );
    const difficulty =
      format === "discovery"
        ? "easy"
        : battle?.difficulty || req.body.difficulty;
    if (
      !(
        format === "time_attack"
          ? ["normal", "hardcore"]
          : ["easy", "normal", "hardcore"]
      ).includes(difficulty)
    )
      throw new HttpError(400, "Difficulté invalide");
    const player = (
      await client.query(
        `SELECT p.service_id,s.name AS service_name FROM players p LEFT JOIN services s ON s.id=p.service_id AND s.archived_at IS NULL WHERE p.id=$1`,
        [req.user.id],
      )
    ).rows[0];
    if (!player.service_id || !player.service_name)
      throw new HttpError(409, "Choisissez votre équipe avant de jouer");
    if (!battleId)
      await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
    const ongoing = (
      await client.query(
        `SELECT * FROM game_sessions WHERE player_id=$1 AND battle_id IS NOT DISTINCT FROM $2::integer
      AND difficulty=$3 AND game_format=$4 AND duration_seconds IS NOT DISTINCT FROM $5::integer
      AND mail_set_id IS NOT DISTINCT FROM $6::integer
      AND rules_version IN (1,2) AND NOT completed ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.user.id, battleId, difficulty, format, duration, setId],
      )
    ).rows[0];
    if (ongoing) {
      ongoing.server_now = (
        await client.query("SELECT clock_timestamp() AS now")
      ).rows[0].now;
      await expireOne(client, ongoing);
      return sessionPayload(client, ongoing, battle?.joker_limit ?? 3, true);
    }
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
    const source =
      format === "time_attack" && !battle
        ? await selectSource(client, setId)
        : null;
    let order = source
      ? shuffled(source.ids)
      : battle?.email_order ||
        shuffled(
          (
            await client.query(`SELECT e.id FROM emails e WHERE archived_at IS NULL AND usage IN ('training','both')
      AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets st ON st.id=m.set_id WHERE m.email_id=e.id AND st.status='ready') ORDER BY e.id`)
          ).rows.map((e) => e.id),
        );
    if (format === "classic") order = order.slice(0, 162);
    if (!order.length)
      throw new HttpError(
        503,
        "Le buffet est vide : l’administrateur doit importer des mails d’entraînement.",
      );
    const rules = battle?.timer_rules || NEW_RULES;
    const s = (
      await client.query(
        `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,service_id,service_name,battle_id,rules_version,game_format,duration_seconds,timer_rules,mail_set_id,mail_set_name)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          req.user.id,
          difficulty,
          JSON.stringify(order),
          order.length,
          roster ? roster.service_id : player.service_id,
          roster ? roster.service_name : player.service_name,
          battleId,
          rules.version,
          format,
          duration,
          JSON.stringify(rules),
          source?.set?.id ?? null,
          source?.set?.name ?? null,
        ],
      )
    ).rows[0];
    return sessionPayload(client, s, battle?.joker_limit ?? 3);
  });
  res.status(201).json(result);
});
router.get("/:id/state", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  res.json(
    await transaction(async (c) => {
      const { session: s, battle } = await lockedSession(
        c,
        id,
        req.user.id,
        true,
      );
      return sessionPayload(c, s, battle?.joker_limit ?? 3, true);
    }),
  );
});
router.get("/:id/next-email", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  tokenCheck(req, id);
  res.json(
    await transaction(async (client) => {
      const { session: s, battle } = await lockedSession(
        client,
        id,
        req.user.id,
      );
      if (s.completed && s.game_format === "time_attack")
        return {
          ...(await state(client, s, 0)),
          timeUp: s.finish_reason === "time_up",
        };
      if (s.completed || s.current_email_index >= s.email_order.length)
        throw new HttpError(410, "Partie terminée");
      const email = (
        await client.query(
          "SELECT id,sender,real_sender,subject,body FROM emails WHERE id=$1",
          [s.email_order[s.current_email_index]],
        )
      ).rows[0];
      if (!email) throw new HttpError(503, "Email indisponible");
      if (!s.email_started_at) {
        const limit =
          s.game_format === "classic" ? classicSeconds(s, email.body) : null;
        Object.assign(
          s,
          (
            await client.query(
              `WITH clock AS (SELECT clock_timestamp() AS now)
        UPDATE game_sessions SET email_started_at=clock.now,
        email_deadline_at=CASE WHEN $1::integer IS NULL THEN NULL ELSE LEAST(clock.now+($1::integer*INTERVAL '1 second'),COALESCE($2::timestamptz,'infinity'::timestamptz)) END,
        global_started_at=CASE WHEN game_format='time_attack' THEN COALESCE(global_started_at,clock.now) ELSE global_started_at END,
        global_deadline_at=CASE WHEN game_format='time_attack' THEN COALESCE(global_deadline_at,LEAST(clock.now+(duration_seconds*INTERVAL '1 second'),COALESCE($2::timestamptz,'infinity'::timestamptz))) ELSE global_deadline_at END,
        viewed_emails=GREATEST(viewed_emails,current_email_index+1)
        FROM clock WHERE id=$3 RETURNING *,clock.now AS server_now`,
              [limit, battle?.ends_at || null, id],
            )
          ).rows[0],
        );
      }
      return {
        ...(await state(client, s, battle?.joker_limit ?? 3)),
        emailId: email.id,
        sender: email.sender,
        realSender: email.real_sender,
        subject: email.subject,
        body: email.body,
        emailIndex: s.current_email_index + 1,
      };
    }),
  );
});
router.post("/:id/answer", answerLimiter, async (req, res) => {
  const id = integer(req.params.id, "Partie"),
    emailId = integer(req.body.emailId, "Email");
  tokenCheck(req, id);
  if (!["safe", "phishing", "joker", "timeout"].includes(req.body.choice))
    throw new HttpError(400, "Choix invalide");
  const cached = (
    await pool.query(
      `SELECT ea.response,gs.game_format FROM email_answers ea JOIN game_sessions gs ON gs.id=ea.session_id
    WHERE ea.session_id=$1 AND ea.email_id=$2 AND gs.player_id=$3`,
      [id, emailId, req.user.id],
    )
  ).rows[0];
  if (
    cached?.game_format !== "classic" &&
    cached &&
    ["joker", "timeout"].includes(req.body.choice)
  )
    throw new HttpError(400, "Aucun SOS ni expiration par mail dans ce format");
  if (cached?.response) return res.json(cached.response);
  const result = await transaction(async (client) => {
    const { session: s, battle } = await lockedSession(client, id, req.user.id);
    if (
      s.game_format !== "classic" &&
      ["joker", "timeout"].includes(req.body.choice)
    )
      throw new HttpError(
        400,
        "Aucun SOS ni expiration par mail dans ce format",
      );
    const repeat = (
      await client.query(
        "SELECT response FROM email_answers WHERE session_id=$1 AND email_id=$2",
        [id, emailId],
      )
    ).rows[0];
    if (repeat?.response) return repeat.response;
    if (s.completed) {
      if (s.finish_reason === "time_up")
        return {
          ...(await state(client, s, 0)),
          timeUp: true,
          newAchievements: [],
        };
      throw new HttpError(410, "Partie terminée");
    }
    if (s.email_order[s.current_email_index] !== emailId || !s.email_started_at)
      throw new HttpError(
        409,
        "Cet email n’est pas l’email courant. Rechargez la partie.",
      );
    const expired =
      s.game_format === "classic" &&
      new Date(s.server_now) >= new Date(s.email_deadline_at);
    const choice = expired ? "timeout" : req.body.choice;
    if (choice === "joker" && s.jokers_used >= (battle?.joker_limit ?? 3))
      throw new HttpError(409, "Tous les jokers ont été utilisés");
    const email = (
      await client.query("SELECT type FROM emails WHERE id=$1", [emailId])
    ).rows[0];
    const correct = choice === "joker" || choice === email.type;
    const humanCorrect =
      s.human_correct +
      (correct && ["safe", "phishing"].includes(choice) ? 1 : 0);
    const errors = s.errors + (correct ? 0 : 1),
      jokers = s.jokers_used + (choice === "joker" ? 1 : 0),
      index = s.current_email_index + 1;
    const score =
      s.game_format === "discovery"
        ? 0
        : s.game_format === "time_attack"
          ? timeAttackScore(humanCorrect, errors, s.difficulty)
          : s.score + (correct ? 1 : 0);
    const gameOver = s.game_format === "classic" && errors >= 3,
      completed = gameOver || index >= s.email_order.length;
    const deadline =
      s.game_format === "classic" ? s.email_deadline_at : s.global_deadline_at;
    const decisionTime = Math.max(
      0,
      Math.ceil(
        (Math.min(
          new Date(s.server_now).getTime(),
          deadline ? new Date(deadline).getTime() : Infinity,
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
    Object.assign(
      s,
      (
        await client.query(
          `UPDATE game_sessions SET score=$1,errors=$2,jokers_used=$3,current_email_index=$4,completed=$5,human_correct=$6,
      ended_at=CASE WHEN $5 THEN clock_timestamp() ELSE NULL END,finish_reason=CASE WHEN $5 THEN $7 ELSE NULL END,
      email_started_at=NULL,email_deadline_at=NULL WHERE id=$8 RETURNING *`,
          [
            score,
            errors,
            jokers,
            index,
            completed,
            humanCorrect,
            gameOver ? "errors" : "all_emails",
            id,
          ],
        )
      ).rows[0],
    );
    const response = {
      isCorrect: correct,
      correctType: email.type,
      clues,
      ...(await state(client, s, battle?.joker_limit ?? 3)),
      gameOver,
      allDone: index >= s.email_order.length,
      isTimeout: choice === "timeout",
      decisionTime,
      scoreDelta:
        s.game_format === "discovery"
          ? null
          : correct
            ? 1
            : s.game_format === "classic"
              ? 0
              : -(s.difficulty === "hardcore" ? errors : 1),
      newAchievements: [],
    };
    await client.query(
      "INSERT INTO email_answers(session_id,email_id,user_choice,is_correct,decision_time,response) VALUES($1,$2,$3,$4,$5,$6)",
      [id, emailId, choice, correct, decisionTime, JSON.stringify(response)],
    );
    response.stats = await stats(client, id);
    await client.query(
      "UPDATE email_answers SET response=$1 WHERE session_id=$2 AND email_id=$3",
      [JSON.stringify(response), id, emailId],
    );
    return response;
  });
  if (result.completed && result.format === "classic") {
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
  const result = await transaction(async (c) => {
    const { session: s, battle } = await lockedSession(
      c,
      id,
      req.user.id,
      true,
    );
    let newlyEnded = false;
    if (!s.completed) {
      Object.assign(
        s,
        (
          await c.query(
            "UPDATE game_sessions SET completed=TRUE,ended_at=clock_timestamp(),finish_reason='abandoned' WHERE id=$1 RETURNING *",
            [id],
          )
        ).rows[0],
      );
      newlyEnded = true;
    }
    return { ...(await state(c, s, battle?.joker_limit ?? 3)), newlyEnded };
  });
  res.json({
    ...result,
    ok: true,
    newAchievements:
      result.newlyEnded && result.format === "classic"
        ? await earned(req.user.id, id)
        : [],
  });
});
router.get("/:id/recap", async (req, res) => {
  const id = integer(req.params.id, "Partie");
  const result = await transaction(async (c) => {
    const { session: s } = await lockedSession(c, id, req.user.id, true);
    if (!s.completed)
      throw new HttpError(409, "Terminez la partie avant le récapitulatif");
    const answers = (
      await c.query(
        `SELECT e.subject,e.sender,e.type,ea.user_choice,ea.is_correct,ea.decision_time,
      COALESCE((SELECT jsonb_agg(clue_text ORDER BY display_order) FROM email_clues WHERE email_id=e.id),'[]'::jsonb) AS clues
      FROM email_answers ea JOIN emails e ON e.id=ea.email_id WHERE ea.session_id=$1 ORDER BY ea.id`,
        [id],
      )
    ).rows;
    return {
      session: {
        id: s.id,
        completed: s.completed,
        score: s.game_format === "discovery" ? null : s.score,
        errors: s.errors,
        finish_reason: s.finish_reason,
        service_name: s.service_name,
        battle_id: s.battle_id,
        game_format: s.game_format,
        duration_seconds: s.duration_seconds,
        mail_set_id: s.mail_set_id,
        mail_set_name: s.mail_set_name,
        difficulty: s.difficulty,
        timer_rules: s.timer_rules,
      },
      answers,
    };
  });
  res.json(result);
});
module.exports = router;
