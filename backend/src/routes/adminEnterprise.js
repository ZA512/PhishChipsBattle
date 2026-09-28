"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const { HttpError, integer, text, transaction } = require("../lib/http");
const {
  createBattle,
  closeBattle,
  computeResults,
} = require("../services/battles");
router.use(adminAuth);
router.get("/battles", async (_req, res) =>
  res.json({
    battles: (
      await pool.query(
        "SELECT id,name,mode,difficulty,starts_at,ends_at,status FROM battles ORDER BY id DESC LIMIT 100",
      )
    ).rows,
  }),
);
router.post("/battles", async (req, res) =>
  res
    .status(201)
    .json(
      await transaction((client) =>
        createBattle(client, req.body, req.user?.id || null),
      ),
    ),
);
router.post("/battles/:id/close", async (req, res) =>
  res.json({
    results: await transaction((client) =>
      closeBattle(client, integer(req.params.id)),
    ),
  }),
);
router.get("/sessions", async (req, res) => {
  const playerId = integer(req.query.playerId, "Joueur", { optional: true });
  res.json({
    sessions: (
      await pool.query(
        `SELECT gs.id,gs.player_id,COALESCE(d.display_name,p.name) AS player_name,gs.difficulty,gs.score,gs.errors,gs.completed,gs.service_name,gs.battle_id,gs.disqualified,gs.score_revision,gs.ended_at,gs.rules_version
    FROM game_sessions gs JOIN players p ON p.id=gs.player_id LEFT JOIN directory_employees d ON d.id=p.directory_id
    WHERE ($1::integer IS NULL OR gs.player_id=$1) ORDER BY gs.id DESC LIMIT 100`,
        [playerId],
      )
    ).rows,
  });
});
router.get("/score-adjustments", async (_req, res) =>
  res.json({
    adjustments: (
      await pool.query(
        "SELECT * FROM score_adjustments ORDER BY id DESC LIMIT 100",
      )
    ).rows,
  }),
);
router.post("/sessions/:id/correction", async (req, res) => {
  const id = integer(req.params.id),
    score = integer(req.body.score, "Score", { min: 0, max: 162 }),
    revision = integer(req.body.revision, "Version", { min: 0 }),
    reason = text(req.body.reason, "Motif", 1000);
  if (typeof req.body.disqualified !== "boolean")
    throw new HttpError(400, "État de disqualification requis");
  await transaction(async (client) => {
    const hint = (
      await client.query("SELECT battle_id FROM game_sessions WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!hint) throw new HttpError(404, "Partie introuvable");
    if (hint.battle_id)
      await client.query("SELECT id FROM battles WHERE id=$1 FOR UPDATE", [
        hint.battle_id,
      ]);
    const session = (
      await client.query("SELECT * FROM game_sessions WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (!session.completed)
      throw new HttpError(409, "Terminez la partie avant de corriger le score");
    if (session.score_revision !== revision)
      throw new HttpError(409, "Le score a déjà changé. Rechargez la liste.");
    if (score > session.current_email_index)
      throw new HttpError(
        400,
        "Le score ne peut pas dépasser le nombre d’emails joués",
      );
    await client.query(
      "INSERT INTO score_adjustments(session_id,actor_id,reason,old_score,new_score,old_disqualified,new_disqualified) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        req.user?.id || null,
        reason,
        session.score,
        score,
        session.disqualified,
        req.body.disqualified,
      ],
    );
    await client.query(
      "UPDATE game_sessions SET score=$1,disqualified=$2,score_revision=score_revision+1 WHERE id=$3",
      [score, req.body.disqualified, id],
    );
    if (hint.battle_id) {
      const results = await computeResults(client, hint.battle_id);
      await client.query(
        "UPDATE battles SET results=$1 WHERE id=$2 AND status='closed'",
        [JSON.stringify(results), hint.battle_id],
      );
    }
  });
  res.json({ ok: true });
});
module.exports = router;
