"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { requireUser } = require("../services/auth");
const { organizerAuth } = require("../middleware/adminAuth");
const { HttpError, integer, transaction } = require("../lib/http");
const {
  createBattle,
  computeResults,
  closeBattle,
} = require("../services/battles");
router.use(requireUser);
router.get("/participants", organizerAuth, async (_req, res) =>
  res.json({
    players: (
      await pool.query(
        `SELECT p.id,COALESCE(d.display_name,p.name) AS display_name,p.service_id FROM players p LEFT JOIN directory_employees d ON d.id=p.directory_id WHERE d.id IS NULL OR d.active ORDER BY display_name`,
      )
    ).rows,
    teams: (
      await pool.query(
        "SELECT id,name FROM services WHERE archived_at IS NULL ORDER BY name",
      )
    ).rows,
  }),
);
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id,b.name,b.mode,b.difficulty,b.starts_at,b.ends_at,b.max_attempts,b.joker_limit,b.status,
    jsonb_array_length(b.email_order) AS email_count,bp.service_name AS roster_team,
    (SELECT COUNT(*) FROM game_sessions gs WHERE gs.battle_id=b.id AND gs.player_id=$1) AS attempts_used,
    EXISTS(SELECT 1 FROM game_sessions gs WHERE gs.battle_id=b.id AND gs.player_id=$1 AND NOT gs.completed AND gs.rules_version=1) AS ongoing,
    (bp.id IS NOT NULL) AS participating
    FROM battles b LEFT JOIN battle_participants bp ON bp.battle_id=b.id AND bp.player_id=$1
    WHERE bp.id IS NOT NULL OR $2::boolean ORDER BY b.starts_at DESC LIMIT 100`,
    [req.user.id, ["admin", "organizer"].includes(req.user.role)],
  );
  res.json({
    battles: rows,
    canOrganize: ["admin", "organizer"].includes(req.user.role),
  });
});
router.post("/", organizerAuth, async (req, res) =>
  res
    .status(201)
    .json(
      await transaction((client) =>
        createBattle(client, req.body, req.user.id),
      ),
    ),
);
router.get("/:id/results", async (req, res) => {
  const id = integer(req.params.id);
  const results = await transaction(async (client) => {
    const battle = (
      await client.query(
        "SELECT *,NOW() AS server_now FROM battles WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!battle) throw new HttpError(404, "Battle introuvable");
    if (
      !["admin", "organizer"].includes(req.user.role) &&
      !(
        await client.query(
          "SELECT 1 FROM battle_participants WHERE battle_id=$1 AND player_id=$2",
          [id, req.user.id],
        )
      ).rows.length
    )
      throw new HttpError(403, "Vous ne participez pas à cette battle");
    if (battle.status === "closed")
      return {
        battle: { id, name: battle.name, mode: battle.mode, status: "closed" },
        results: battle.results,
      };
    const closed = battle.server_now >= new Date(battle.ends_at);
    return {
      battle: {
        id,
        name: battle.name,
        mode: battle.mode,
        status: closed ? "closed" : "published",
      },
      results: closed
        ? await closeBattle(client, id)
        : await computeResults(client, id),
    };
  });
  res.json(results);
});
router.post("/:id/close", organizerAuth, async (req, res) =>
  res.json({
    results: await transaction((client) =>
      closeBattle(client, integer(req.params.id)),
    ),
  }),
);
module.exports = router;
