"use strict";
const crypto = require("node:crypto");
const { HttpError, integer, text } = require("../lib/http");
const { selectBattleEmails } = require("./battleCatalog");
const { enrollEligible } = require("./battleAudience");
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
    end =
      body.endsAt === null || body.endsAt === undefined
        ? null
        : date(body.endsAt, "Fin");
  if (end && (end <= start || end <= new Date()))
    throw new HttpError(
      400,
      "La fin doit suivre le début et être dans le futur",
    );
  const gameFormat = body.gameFormat ?? "classic";
  if (!["classic", "time_attack"].includes(gameFormat))
    throw new HttpError(400, "Format de compétition invalide");
  const duration =
    gameFormat === "time_attack"
      ? integer(body.durationSeconds, "Durée")
      : null;
  if (
    (gameFormat === "time_attack" &&
      (![300, 600].includes(duration) || difficulty === "easy")) ||
    (gameFormat === "classic" && body.durationSeconds !== undefined)
  )
    throw new HttpError(400, "Durée ou difficulté invalide pour ce format");
  const audience = body.audience ?? { type: "snapshot" };
  if (!audience || !["snapshot", "all", "teams"].includes(audience.type))
    throw new HttpError(400, "Public invalide");
  if (audience.type === "all" && mode !== "individual")
    throw new HttpError(
      400,
      "Toute l’entreprise utilise le classement individuel",
    );
  if (audience.type === "teams" && !Array.isArray(body.teamIds))
    throw new HttpError(400, "Choisissez les équipes ciblées");
  const maxAttempts = integer(body.maxAttempts ?? 1, "Tentatives", { max: 5 }),
    jokerLimit = integer(
      body.jokerLimit ?? (gameFormat === "time_attack" ? 0 : 3),
      "Jokers",
      { min: 0, max: 3 },
    );
  if (gameFormat === "time_attack" && jokerLimit !== 0)
    throw new HttpError(400, "Aucun SOS en contre-la-montre");
  const selection = await selectBattleEmails(client, body);
  let participants;
  if (audience.type === "all") {
    participants = (
      await client.query(`SELECT p.id,p.directory_id,COALESCE(d.display_name,p.name) AS name,s.id AS service_id,s.name AS service_name
      FROM players p JOIN services s ON s.id=p.service_id AND s.archived_at IS NULL LEFT JOIN directory_employees d ON d.id=p.directory_id WHERE d.id IS NULL OR d.active ORDER BY p.id`)
    ).rows;
  } else if (mode === "individual" && audience.type !== "teams") {
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
      !ids.length ||
      ids.length > 5000 ||
      (mode === "internal" && ids.length !== 1) ||
      (mode === "teams" && ids.length < 2)
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
    if (
      audience.type === "snapshot" &&
      ids.some((id) => !participants.some((p) => p.service_id === id))
    )
      throw new HttpError(
        400,
        "Chaque équipe doit avoir au moins un joueur inscrit",
      );
  }
  if (!participants.length && audience.type === "snapshot")
    throw new HttpError(400, "Choisissez au moins un participant");
  const battle = (
    await client.query(
      `INSERT INTO battles(name,mode,difficulty,starts_at,ends_at,max_attempts,joker_limit,email_order,created_by,mail_selection,timer_rules,game_format,duration_seconds,audience_mode,audience_team_ids)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        name,
        mode,
        difficulty,
        start,
        end,
        maxAttempts,
        jokerLimit,
        JSON.stringify(selection.order),
        actorId,
        selection.composition ? JSON.stringify(selection.composition) : null,
        JSON.stringify(require("./gameRules").NEW_RULES),
        gameFormat,
        duration,
        audience.type,
        audience.type === "teams"
          ? [...new Set(body.teamIds.map((id) => integer(id, "Équipe")))]
          : [],
      ],
    )
  ).rows[0];
  await client.query(
    `INSERT INTO battle_participants(battle_id,player_id,employee_id,name,service_id,service_name)
    SELECT $1,p.id,p.directory_id,p.name,p.service_id,p.service_name FROM jsonb_to_recordset($2::jsonb)
    AS p(id integer,directory_id uuid,name text,service_id integer,service_name text)`,
    [battle.id, JSON.stringify(participants)],
  );
  return {
    id: battle.id,
    participants: participants.length,
    composition: selection.composition,
  };
}
async function computeResults(client, battleId) {
  const format =
    (
      await client.query("SELECT game_format FROM battles WHERE id=$1", [
        battleId,
      ])
    ).rows[0]?.game_format || "classic";
  const { rows } = await client.query(
    `SELECT bp.id,bp.player_id,bp.name,bp.service_id,bp.service_name,
    COALESCE(best.score,0) AS score,best.id AS session_id,COALESCE(best.decision_seconds,0)::integer AS decision_seconds,
    (best.id IS NOT NULL) AS played,best.human_correct AS good_answers,best.errors
    FROM battle_participants bp LEFT JOIN LATERAL (
      SELECT gs.id,gs.score,gs.human_correct,gs.errors,gs.ended_at,COALESCE((SELECT SUM(ea.decision_time) FROM email_answers ea WHERE ea.session_id=gs.id),0) AS decision_seconds
      FROM game_sessions gs WHERE gs.battle_id=bp.battle_id AND gs.player_id=bp.player_id
      AND gs.completed AND NOT gs.disqualified AND gs.rules_version IN (1,2) AND gs.game_format=$2
      AND (($2='classic' AND (gs.rules_version=1 OR gs.finish_reason IS DISTINCT FROM 'abandoned')) OR
           ($2='time_attack' AND gs.current_email_index>0 AND gs.finish_reason IN ('time_up','all_emails','battle_closed')))
      ORDER BY gs.score DESC,CASE WHEN $2='time_attack' THEN gs.human_correct END DESC,CASE WHEN $2='time_attack' THEN gs.errors END ASC,
        CASE WHEN $2='classic' THEN COALESCE((SELECT SUM(ea.decision_time) FROM email_answers ea WHERE ea.session_id=gs.id),0) END ASC,gs.ended_at ASC,gs.id ASC LIMIT 1
    ) best ON TRUE WHERE bp.battle_id=$1
    ORDER BY CASE WHEN $2='time_attack' THEN (best.id IS NOT NULL) END DESC,score DESC,played DESC,
      CASE WHEN $2='time_attack' THEN best.human_correct END DESC,CASE WHEN $2='time_attack' THEN best.errors END ASC,
      CASE WHEN $2='classic' THEN COALESCE(best.decision_seconds,0)::integer END ASC,
      CASE WHEN $2='time_attack' THEN best.ended_at END ASC,CASE WHEN $2='time_attack' THEN best.id END ASC,bp.id ASC`,
    [battleId, format],
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
        scores: [],
      };
      team.participants++;
      team.totalScore += p.score;
      if (p.played) team.played++;
      if (p.played) team.scores.push(p.score);
      teams.set(p.service_id, team);
    }
  const rankedTeams = [...teams.values()]
    .map((t) => ({
      ...t,
      score:
        format === "time_attack"
          ? t.scores.length
            ? Math.round(
                (t.scores
                  .sort((a, b) => b - a)
                  .slice(0, 10)
                  .reduce((n, s) => n + s, 0) /
                  Math.min(10, t.scores.length)) *
                  100,
              ) / 100
            : null
          : Math.round((t.totalScore / t.participants) * 100) / 100,
    }))
    .sort(
      (a, b) =>
        Number(b.score !== null) - Number(a.score !== null) ||
        b.score - a.score ||
        b.played - a.played ||
        a.id - b.id,
    );
  return {
    players: rows.map((p) =>
      format === "time_attack" && !p.played ? { ...p, score: null } : p,
    ),
    teams: rankedTeams,
    teamFormula:
      format === "time_attack"
        ? "Moyenne des dix meilleurs joueurs ayant terminé une tentative valide ; les absents ne sont pas classés."
        : "Moyenne du meilleur score de chaque inscrit ; les absents comptent pour zéro.",
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
  await enrollEligible(client, battle);
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
    (battle.ends_at && battle.server_now >= new Date(battle.ends_at))
  )
    throw new HttpError(409, "La battle n’est pas ouverte");
  await enrollEligible(client, battle);
  return battle;
}
module.exports = {
  shuffled,
  createBattle,
  computeResults,
  closeBattle,
  openBattle,
};
