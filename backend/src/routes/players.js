"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { requireUser } = require("../services/auth");
const { HttpError, integer, text, transaction } = require("../lib/http");
const { assignTeam } = require("../services/teams");
router.use(requireUser);
router.post("/", async (req, res) => {
  const player = await transaction(async (client) => {
    if (req.body.serviceId !== undefined)
      await client.query("SELECT pg_advisory_xact_lock(817413)");
    if (req.body.name !== undefined)
      await client.query("UPDATE players SET name=$1 WHERE id=$2", [
        text(req.body.name, "Pseudo", 40, 2).toUpperCase(),
        req.user.id,
      ]);
    if (req.body.serviceId !== undefined)
      await assignTeam(client, {
        playerId: req.user.id,
        teamId: integer(req.body.serviceId, "Équipe"),
        actorId: req.user.id,
      });
    return (
      await client.query(
        "SELECT id,name,email,service_id FROM players WHERE id=$1",
        [req.user.id],
      )
    ).rows[0];
  });
  res.json({
    player: { ...player, serviceId: player.service_id },
    created: false,
  });
});
router.get("/:id/profile", async (req, res) => {
  const id = integer(req.params.id);
  const player = (
    await pool.query(
      `SELECT p.id,COALESCE(d.display_name,p.name) AS name,p.service_id,p.created_at FROM players p LEFT JOIN directory_employees d ON d.id=p.directory_id WHERE p.id=$1`,
      [id],
    )
  ).rows[0];
  if (!player) throw new HttpError(404, "Joueur introuvable");
  const stats = (
    await pool.query(
      `SELECT COUNT(*) AS games_played,COALESCE(MAX(score),0) AS best_score,COALESCE(SUM(score),0) AS total_score,
    COALESCE(SUM(errors),0) AS total_errors FROM game_sessions WHERE player_id=$1 AND completed AND NOT disqualified AND rules_version=1`,
      [id],
    )
  ).rows[0];
  const correct = (
    await pool.query(
      `SELECT COUNT(*) AS n FROM email_answers ea JOIN game_sessions gs ON gs.id=ea.session_id
    WHERE gs.player_id=$1 AND gs.completed AND NOT gs.disqualified AND gs.rules_version=1 AND ea.is_correct AND ea.user_choice<>'joker'`,
      [id],
    )
  ).rows[0];
  res.json({
    player: {
      id: player.id,
      name: player.name,
      serviceId: player.service_id,
      createdAt: player.created_at,
    },
    stats: {
      gamesPlayed: Number(stats.games_played),
      bestScore: Number(stats.best_score),
      totalScore: Number(stats.total_score),
      totalErrors: Number(stats.total_errors),
      totalCorrect: Number(correct.n),
    },
  });
});
router.get("/:id/achievements", async (req, res) => {
  const id = integer(req.params.id);
  if (
    !(await pool.query("SELECT 1 FROM players WHERE id=$1", [id])).rows.length
  )
    throw new HttpError(404, "Joueur introuvable");
  const result = await pool.query(
    `SELECT a.*,pa.unlocked_at FROM achievements a LEFT JOIN player_achievements pa ON pa.achievement_id=a.id AND pa.player_id=$1
    WHERE a.active ORDER BY a.category,a.difficulty,a.tier`,
    [id],
  );
  res.json({
    achievements: result.rows.map((r) => ({
      ...r,
      unlocked: !!r.unlocked_at,
      unlockedAt: r.unlocked_at || null,
    })),
  });
});
module.exports = router;
