"use strict";
const { HttpError, integer } = require("../lib/http");
const { expireTimeAttacks } = require("./gameRules");
function statisticsFilter(query = {}) {
  const family = query.family || null,
    duration =
      query.duration === undefined || query.duration === ""
        ? null
        : integer(query.duration, "Durée"),
    difficulty = query.difficulty || null;
  if (
    family &&
    ![
      "classic_training",
      "battle",
      "time_attack",
      "time_attack_battle",
      "discovery",
    ].includes(family)
  )
    throw new HttpError(400, "Format de statistiques invalide");
  if (duration !== null && ![300, 600].includes(duration))
    throw new HttpError(400, "Durée invalide");
  if (difficulty && !["easy", "normal", "hardcore"].includes(difficulty))
    throw new HttpError(400, "Difficulté invalide");
  return { family, duration, difficulty };
}
const familySql =
  "CASE WHEN gs.battle_id IS NOT NULL THEN CASE WHEN gs.game_format='time_attack' THEN 'time_attack_battle' ELSE 'battle' END WHEN gs.game_format='classic' THEN 'classic_training' ELSE gs.game_format END";
async function groupedStats(pool, playerId = null, filter = {}) {
  await expireTimeAttacks(pool);
  const rows = (
    await pool.query(
      `WITH answers AS (
 SELECT session_id,COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing'))::int AS decisions,
 COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing') AND is_correct)::int AS correct,
 COUNT(*) FILTER(WHERE user_choice IN ('safe','phishing') AND NOT is_correct)::int AS human_errors,
 COUNT(*) FILTER(WHERE user_choice='joker')::int AS assisted,COUNT(*) FILTER(WHERE user_choice='timeout')::int AS timeouts,
 COALESCE(SUM(decision_time) FILTER(WHERE user_choice IN ('safe','phishing')),0) AS decision_seconds
 FROM email_answers GROUP BY session_id)
 SELECT ${familySql} AS family,gs.duration_seconds AS duration,gs.difficulty,
 COUNT(*)::int AS attempts,COUNT(*) FILTER(WHERE gs.completed AND gs.finish_reason<>'abandoned')::int AS completed,
 COUNT(*) FILTER(WHERE gs.finish_reason='abandoned')::int AS abandoned,
 MAX(gs.score) FILTER(WHERE gs.completed AND gs.finish_reason<>'abandoned' AND gs.current_email_index>0 AND gs.game_format<>'discovery') AS best_score,
 ROUND(AVG(gs.score) FILTER(WHERE gs.completed AND gs.finish_reason<>'abandoned' AND gs.current_email_index>0 AND gs.game_format<>'discovery'),2) AS avg_score,
 COALESCE(SUM(gs.viewed_emails),0)::int AS viewed,COALESCE(SUM(gs.current_email_index),0)::int AS treated,
 COALESCE(SUM(a.decisions),0)::int AS decisions,COALESCE(SUM(a.correct),0)::int AS correct,
 COALESCE(SUM(a.human_errors),0)::int AS errors,COALESCE(SUM(a.assisted),0)::int AS assisted,
 COALESCE(SUM(a.timeouts),0)::int AS timeouts,COALESCE(SUM(a.decision_seconds),0)::float AS decision_seconds
 FROM game_sessions gs LEFT JOIN answers a ON a.session_id=gs.id
 WHERE gs.rules_version IN (1,2) AND NOT gs.disqualified AND ($1::int IS NULL OR gs.player_id=$1)
 AND ($2::text IS NULL OR ${familySql}=$2) AND ($3::int IS NULL OR gs.duration_seconds=$3) AND ($4::text IS NULL OR gs.difficulty=$4)
 GROUP BY ${familySql},gs.duration_seconds,gs.difficulty ORDER BY family,duration,gs.difficulty`,
      [
        playerId,
        filter.family || null,
        filter.duration || null,
        filter.difficulty || null,
      ],
    )
  ).rows;
  return rows.map((r) => ({
    ...r,
    best_score: r.best_score === null ? null : Number(r.best_score),
    avg_score: r.avg_score === null ? null : Number(r.avg_score),
    success_rate: r.decisions
      ? Math.round((r.correct / r.decisions) * 1000) / 10
      : 0,
    avg_decision_time: r.decisions
      ? Math.round((r.decision_seconds / r.decisions) * 10) / 10
      : 0,
  }));
}
module.exports = { statisticsFilter, groupedStats, familySql };
