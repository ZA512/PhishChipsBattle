"use strict";
const { HttpError, integer } = require("../lib/http");
function configuration(query) {
  const duration = integer(query.duration ?? 300, "Durée");
  const difficulty = query.difficulty ?? "normal",
    month = query.month ?? null;
  if (
    ![300, 600].includes(duration) ||
    !["normal", "hardcore"].includes(difficulty) ||
    (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
  )
    throw new HttpError(400, "Configuration de classement invalide");
  return { duration, difficulty, month };
}
function ranking(config, team = false) {
  const params = [
    config.duration,
    config.difficulty,
    config.month ? config.month + "-01" : null,
  ];
  const sql = `WITH eligible AS (
 SELECT gs.*,COUNT(*) OVER(PARTITION BY player_id${team ? ",service_id" : ""})::int AS games_played,
 ROW_NUMBER() OVER(PARTITION BY player_id${team ? ",service_id" : ""} ORDER BY score DESC,human_correct DESC,errors ASC,ended_at ASC,id ASC) AS best
 FROM game_sessions gs WHERE game_format='time_attack' AND duration_seconds=$1 AND difficulty=$2
 AND rules_version IN (1,2) AND completed AND NOT disqualified AND finish_reason IN ('time_up','all_emails') AND current_email_index>0
 AND ($3::date IS NULL OR DATE_TRUNC('month',ended_at)=DATE_TRUNC('month',$3::date))),
 best AS (SELECT gs.player_id AS id,COALESCE(d.display_name,p.name) AS name,gs.service_id,gs.service_name,
 gs.score AS best_score,gs.human_correct AS good_answers,gs.errors,gs.games_played,gs.ended_at,gs.id AS session_id
 FROM eligible gs JOIN players p ON p.id=gs.player_id LEFT JOIN directory_employees d ON d.id=p.directory_id WHERE gs.best=1)`;
  return { sql, params };
}
function install(router, pool) {
  router.get("/time-attack/players", async (req, res) => {
    const config = configuration(req.query),
      { sql, params } = ranking(config);
    const rows = (
      await pool.query(
        sql +
          " SELECT * FROM best ORDER BY best_score DESC,good_answers DESC,errors ASC,ended_at ASC,session_id ASC",
        params,
      )
    ).rows;
    res.json({ scores: rows, ...config });
  });
  router.get("/time-attack/services", async (req, res) => {
    const config = configuration(req.query),
      { sql, params } = ranking(config, true);
    const rows = (
      await pool.query(
        sql +
          `, team_players AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY service_id ORDER BY best_score DESC,good_answers DESC,errors ASC,ended_at ASC,session_id ASC) AS team_rank FROM best WHERE service_id IS NOT NULL)
 SELECT s.id,s.name,s.code,ROUND(AVG(b.best_score) FILTER(WHERE b.team_rank<=10),2) AS avg_best_score,COUNT(*)::int AS player_count
 FROM team_players b JOIN services s ON s.id=b.service_id GROUP BY s.id ORDER BY avg_best_score DESC,player_count DESC,s.id`,
        params,
      )
    ).rows;
    res.json({
      scores: rows.map((r) => ({
        ...r,
        avg_best_score: Number(r.avg_best_score),
      })),
      topN: 10,
      ...config,
    });
  });
  router.get("/time-attack/services/:id/detail", async (req, res) => {
    const id = integer(req.params.id, "Équipe"),
      config = configuration(req.query),
      { sql, params } = ranking(config, true);
    const rows = (
      await pool.query(
        sql +
          ` SELECT * FROM best WHERE service_id=$4 ORDER BY best_score DESC,good_answers DESC,errors ASC,ended_at ASC,session_id ASC`,
        [...params, id],
      )
    ).rows;
    const team = (
      await pool.query("SELECT id,name,code FROM services WHERE id=$1", [id])
    ).rows[0];
    if (!team) throw new HttpError(404, "Équipe introuvable");
    const top10 = rows.slice(0, 10);
    res.json({
      service: team,
      top10,
      others: rows.slice(10),
      topN: 10,
      playerCount: rows.length,
      avgBestScore: top10.length
        ? Math.round(
            (top10.reduce((n, r) => n + r.best_score, 0) / top10.length) * 100,
          ) / 100
        : 0,
      ...config,
    });
  });
}
module.exports = { configuration, install };
