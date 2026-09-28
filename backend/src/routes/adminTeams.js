"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const { HttpError, integer, text, transaction } = require("../lib/http");
const { assignTeam } = require("../services/teams");
const { importDirectory, syncGraph } = require("../services/directory");
router.use(adminAuth);
router.get("/directory", async (req, res) => {
  const search =
    typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
  const { rows } = await pool.query(
    `SELECT d.*,p.service_id,s.name AS team_name FROM directory_employees d
    LEFT JOIN players p ON p.directory_id=d.id LEFT JOIN services s ON s.id=p.service_id
    WHERE d.display_name ILIKE $1 OR d.email ILIKE $1 ORDER BY d.display_name LIMIT 200`,
    [`%${search}%`],
  );
  res.json({ employees: rows });
});
router.post("/directory/import", async (req, res) => {
  if (req.body.fullSnapshot !== true)
    throw new HttpError(
      400,
      "Confirmez fullSnapshot : les personnes absentes seront désactivées",
    );
  res.json(await importDirectory(req.body.employees, req.user?.id || null));
});
router.post("/directory/sync", async (req, res) =>
  res.json(await syncGraph(req.user?.id || null)),
);
router.get("/players", async (_req, res) =>
  res.json({
    players: (
      await pool.query(`SELECT p.id,p.name,p.email,p.role,p.service_id,p.directory_id,COALESCE(d.display_name,p.name) AS display_name
  FROM players p LEFT JOIN directory_employees d ON d.id=p.directory_id ORDER BY display_name`)
    ).rows,
  }),
);
router.post("/teams/assign", async (req, res) => {
  const team = await transaction((client) =>
    assignTeam(client, {
      playerId: integer(req.body.playerId, "Joueur"),
      teamId: integer(req.body.teamId, "Équipe"),
      actorId: req.user?.id || null,
      source: "manual",
      reason: text(req.body.reason, "Motif", 500),
    }),
  );
  res.json({ team });
});
module.exports = router;
