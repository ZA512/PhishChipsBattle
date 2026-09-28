"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { requireUser } = require("../services/auth");
const { integer, transaction } = require("../lib/http");
const { suggestTeam, assignTeam } = require("../services/teams");
router.use(requireUser);
router.get("/me", async (req, res) => {
  const [suggestion, teams, history] = await Promise.all([
    suggestTeam(pool, req.user),
    pool.query(
      "SELECT id,name,code FROM services WHERE archived_at IS NULL ORDER BY name",
    ),
    pool.query(
      "SELECT service_name,source,reason,assigned_at FROM team_membership_history WHERE player_id=$1 ORDER BY assigned_at DESC LIMIT 20",
      [req.user.id],
    ),
  ]);
  res.json({
    currentTeamId: req.user.service_id,
    suggestion,
    teams: teams.rows,
    history: history.rows,
    selectionRequired: !req.user.service_id,
  });
});
router.post("/choose", async (req, res) => {
  const team = await transaction((client) =>
    assignTeam(client, {
      playerId: req.user.id,
      teamId: integer(req.body.teamId, "Équipe"),
      actorId: req.user.id,
    }),
  );
  res.json({ team });
});
module.exports = router;
