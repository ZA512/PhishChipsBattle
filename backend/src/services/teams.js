"use strict";
const { HttpError } = require("../lib/http");

async function assignTeam(
  client,
  {
    playerId,
    teamId,
    actorId = null,
    source = "self",
    reason = "Choix du joueur",
  },
) {
  await client.query("SELECT pg_advisory_xact_lock(817413)");
  const player = (
    await client.query(
      "SELECT id,directory_id,service_id FROM players WHERE id=$1 FOR UPDATE",
      [playerId],
    )
  ).rows[0];
  if (!player) throw new HttpError(404, "Joueur introuvable");
  const team = (
    await client.query(
      "SELECT id,name FROM services WHERE id=$1 AND archived_at IS NULL",
      [teamId],
    )
  ).rows[0];
  if (!team) throw new HttpError(404, "Équipe introuvable ou supprimée");
  if (player.service_id === team.id) return team;
  if (player.directory_id)
    await client.query(
      `INSERT INTO directory_team_members(employee_id,service_id,source) VALUES($1,$2,$3)
    ON CONFLICT(employee_id) DO UPDATE SET service_id=EXCLUDED.service_id,source=EXCLUDED.source,assigned_at=NOW()`,
      [player.directory_id, team.id, source],
    );
  await client.query("UPDATE players SET service_id=$1 WHERE id=$2", [
    team.id,
    player.id,
  ]);
  await client.query(
    `INSERT INTO team_membership_history(player_id,employee_id,service_id,service_name,actor_id,source,reason)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      player.id,
      player.directory_id,
      team.id,
      team.name,
      actorId,
      source,
      reason,
    ],
  );
  return team;
}

async function suggestTeam(client, player) {
  if (!player.directory_id)
    return {
      teamId: null,
      source: "none",
      reason: "Choisissez votre équipe dans la liste.",
    };
  const employee = (
    await client.query(
      "SELECT id,manager_id,tenant_id FROM directory_employees WHERE id=$1 AND active",
      [player.directory_id],
    )
  ).rows[0];
  if (!employee?.manager_id)
    return {
      teamId: null,
      source: "none",
      reason: "Manager non renseigné. Vous pouvez choisir librement.",
    };
  const { rows } = await client.query(
    `SELECT s.id,COUNT(*) AS members FROM directory_employees d
    JOIN players p ON p.directory_id=d.id JOIN services s ON s.id=p.service_id
    WHERE d.manager_id=$1 AND d.id<>$2 AND d.tenant_id=$3 AND d.active AND s.archived_at IS NULL
    GROUP BY s.id ORDER BY members DESC,s.id`,
    [employee.manager_id, employee.id, employee.tenant_id],
  );
  if (
    rows.length &&
    (rows.length === 1 || Number(rows[0].members) > Number(rows[1].members))
  ) {
    return {
      teamId: rows[0].id,
      source: "peers",
      reason:
        "Équipe la plus fréquente parmi vos collègues du même manager. Vous restez libre de choisir.",
    };
  }
  const manager = (
    await client.query(
      `SELECT s.id FROM players p JOIN services s ON s.id=p.service_id
    JOIN directory_employees d ON d.id=p.directory_id
    WHERE p.directory_id=$1 AND d.active AND s.archived_at IS NULL`,
      [employee.manager_id],
    )
  ).rows[0];
  return manager
    ? {
        teamId: manager.id,
        source: "manager",
        reason:
          "Proposition basée sur votre manager. Vous pouvez choisir une autre équipe.",
      }
    : {
        teamId: null,
        source: "none",
        reason:
          "Aucune proposition suffisamment claire. Choisissez votre équipe.",
      };
}
module.exports = { assignTeam, suggestTeam };
