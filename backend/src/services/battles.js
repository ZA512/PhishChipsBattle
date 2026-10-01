"use strict";
const crypto = require("node:crypto");
const { HttpError, integer, text } = require("../lib/http");
const { CATALOG_LOCK } = require("./mailCatalog");
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function date(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new HttpError(400, `${label} invalide (date ISO avec fuseau)`);
  return new Date(value);
}
async function createBattle(client, body, actorId) {
  await client.query("SELECT pg_advisory_xact_lock(817413)");
  const name = text(body.name, "Nom de battle", 100),
    mode = body.mode,
    difficulty = body.difficulty;
  if (
    !["individual", "internal", "teams"].includes(mode) ||
    !["easy", "normal", "hardcore"].includes(difficulty)
  )
    throw new HttpError(400, "Mode ou difficulté invalide");
  const start = date(body.startsAt, "Début"),
    end = date(body.endsAt, "Fin");
  if (end <= start || end <= new Date() || end - start > 90 * 86400000)
    throw new HttpError(400, "Période invalide (90 jours maximum)");
  const maxAttempts = integer(body.maxAttempts ?? 1, "Tentatives", { max: 5 }),
    jokerLimit = integer(body.jokerLimit ?? 3, "Jokers", { min: 0, max: 3 });
  const count = integer(body.emailCount ?? 20, "Nombre d’emails", { max: 162 });
  await client.query("SELECT pg_advisory_xact_lock_shared($1)", [CATALOG_LOCK]);
  const available = (
    await client.query(
      "SELECT id FROM emails WHERE archived_at IS NULL AND usage IN ('battle','both') ORDER BY id",
    )
  ).rows.map((e) => e.id);
  if (count > available.length)
    throw new HttpError(
      400,
      "Pas assez de mails disponibles pour les battles. Demandez à l’administrateur d’en importer.",
    );
  let participants;
  if (mode === "individual") {
    if (!Array.isArray(body.playerIds) || body.playerIds.length > 5000)
      throw new HttpError(400, "Liste de participants requise");
    const ids = [
      ...new Set(body.playerIds.map((id) => integer(id, "Participant"))),
    ];
    const { rows } = await client.query(
      `SELECT p.id,p.directory_id,COALESCE(d.display_name,p.name) AS name,s.id AS service_id,s.name AS service_name
      FROM players p LEFT JOIN directory_employees d ON d.id=p.directory_id LEFT JOIN services s ON s.id=p.service_id
      WHERE (d.id IS NULL OR d.active) AND p.id=ANY($1::integer[]) ORDER BY p.id`,
      [ids],
    );
    if (rows.length !== ids.length)
      throw new HttpError(400, "Un participant est absent ou désactivé");
    participants = rows;
  } else {
    if (!Array.isArray(body.teamIds))
      throw new HttpError(400, "Liste d’équipes requise");
    const ids = [...new Set(body.teamIds.map((id) => integer(id, "Équipe")))];
    if (
      (mode === "internal" && ids.length !== 1) ||
      (mode === "teams" && (ids.length < 2 || ids.length > 32))
    )
      throw new HttpError(
        400,
        "Choisissez une équipe pour une battle interne, au moins deux pour une battle inter-équipes",
      );
    if (
      (
        await client.query(
          "SELECT id FROM services WHERE id=ANY($1::integer[]) AND archived_at IS NULL",
          [ids],
        )
      ).rows.length !== ids.length
    )
      throw new HttpError(400, "Équipe supprimée ou inconnue");
    participants = (
      await client.query(
        `SELECT p.id,p.directory_id,COALESCE(d.display_name,p.name) AS name,s.id AS service_id,s.name AS service_name
      FROM players p JOIN services s ON s.id=p.service_id LEFT JOIN directory_employees d ON d.id=p.directory_id
      WHERE p.service_id=ANY($1::integer[]) AND (d.id IS NULL OR d.active) ORDER BY p.id`,
        [ids],
      )
    ).rows;
    if (ids.some((id) => !participants.some((p) => p.service_id === id)))
      throw new HttpError(
        400,
        "Chaque équipe doit avoir au moins un joueur inscrit",
      );
  }
  if (!participants.length)
    throw new HttpError(400, "Choisissez au moins un participant");
  const battle = (
    await client.query(
      `INSERT INTO battles(name,mode,difficulty,starts_at,ends_at,max_attempts,joker_limit,email_order,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        name,
        mode,
        difficulty,
        start,
        end,
        maxAttempts,
        jokerLimit,
        JSON.stringify(shuffled(available).slice(0, count)),
        actorId,
      ],
    )
  ).rows[0];
  for (const p of participants)
    await client.query(
      `INSERT INTO battle_participants(battle_id,player_id,employee_id,name,service_id,service_name) VALUES($1,$2,$3,$4,$5,$6)`,
      [battle.id, p.id, p.directory_id, p.name, p.service_id, p.service_name],
    );
  return { id: battle.id, participants: participants.length };
}
async function computeResults(client, battleId) {
  const { rows } = await client.query(
    `SELECT bp.id,bp.player_id,bp.name,bp.service_id,bp.service_name,
    COALESCE(best.score,0) AS score,best.id AS session_id,COALESCE(best.decision_seconds,0)::integer AS decision_seconds,
    (best.id IS NOT NULL) AS played
    FROM battle_participants bp LEFT JOIN LATERAL (
      SELECT gs.id,gs.score,gs.ended_at,COALESCE((SELECT SUM(ea.decision_time) FROM email_answers ea WHERE ea.session_id=gs.id),0) AS decision_seconds
      FROM game_sessions gs WHERE gs.battle_id=bp.battle_id AND gs.player_id=bp.player_id
      AND gs.completed AND NOT gs.disqualified AND gs.rules_version=1
      ORDER BY gs.score DESC,decision_seconds ASC,gs.ended_at ASC,gs.id ASC LIMIT 1
    ) best ON TRUE WHERE bp.battle_id=$1
    ORDER BY score DESC,played DESC,decision_seconds ASC,bp.id ASC`,
    [battleId],
  );
  const teams = new Map();
  for (const p of rows)
    if (p.service_id) {
      const team = teams.get(p.service_id) || {
        id: p.service_id,
        name: p.service_name,
        participants: 0,
        played: 0,
        totalScore: 0,
      };
      team.participants++;
      team.totalScore += p.score;
      if (p.played) team.played++;
      teams.set(p.service_id, team);
    }
  const rankedTeams = [...teams.values()]
    .map((t) => ({
      ...t,
      score: Math.round((t.totalScore / t.participants) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score || b.played - a.played || a.id - b.id);
  return {
    players: rows,
    teams: rankedTeams,
    teamFormula:
      "Moyenne du meilleur score de chaque inscrit ; les absents comptent pour zéro.",
  };
}
async function closeBattle(client, battleId) {
  const battle = (
    await client.query("SELECT * FROM battles WHERE id=$1 FOR UPDATE", [
      battleId,
    ])
  ).rows[0];
  if (!battle) throw new HttpError(404, "Battle introuvable");
  if (battle.status === "closed") return battle.results;
  await client.query(
    "UPDATE game_sessions SET completed=TRUE,ended_at=NOW(),finish_reason='battle_closed' WHERE battle_id=$1 AND NOT completed",
    [battleId],
  );
  const results = await computeResults(client, battleId);
  await client.query(
    "UPDATE battles SET status='closed',closed_at=NOW(),results=$1 WHERE id=$2",
    [JSON.stringify(results), battleId],
  );
  return results;
}
async function openBattle(client, battleId) {
  const battle = (
    await client.query(
      "SELECT *,NOW() AS server_now FROM battles WHERE id=$1 FOR SHARE",
      [battleId],
    )
  ).rows[0];
  if (!battle) throw new HttpError(404, "Battle introuvable");
  if (
    battle.status !== "published" ||
    battle.server_now < new Date(battle.starts_at) ||
    battle.server_now >= new Date(battle.ends_at)
  )
    throw new HttpError(409, "La battle n’est pas ouverte");
  return battle;
}
module.exports = {
  shuffled,
  createBattle,
  computeResults,
  closeBattle,
  openBattle,
};
