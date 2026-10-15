"use strict";
const pool = require("../db/pool");
const NEW_RULES = Object.freeze({ version: 2 });
function visibleWords(body) {
  // Link attributes contain inspection URLs; only their visible labels count.
  return (
    String(body || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, " ")
      .match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu)?.length || 0
  );
}
function classicSeconds(s, body) {
  if (s.timer_rules.version === 1)
    return s.difficulty === "easy"
      ? 30
      : Math.max(s.difficulty === "normal" ? 15 : 5, 30 - s.score);
  const start = s.difficulty === "hardcore" ? 45 : 60,
    floor =
      s.difficulty === "hardcore" ? 25 : s.difficulty === "normal" ? 35 : 60;
  const base = Math.max(
    floor,
    start - (s.difficulty === "easy" ? 0 : 2 * s.human_correct),
  );
  const words = visibleWords(body);
  return base + (words > 70 ? 20 : words > 50 ? 10 : 0);
}
function timeAttackScore(correct, errors, difficulty) {
  return (
    correct - (difficulty === "hardcore" ? (errors * (errors + 1)) / 2 : errors)
  );
}
async function expireTimeAttacks(client = pool) {
  // Row locks serialize this sweeper with answers and abandon requests.
  return client.query(`WITH expired AS (SELECT id FROM game_sessions WHERE game_format='time_attack' AND NOT completed
    AND global_deadline_at<=clock_timestamp() FOR UPDATE SKIP LOCKED)
    UPDATE game_sessions s SET completed=TRUE,ended_at=global_deadline_at,finish_reason='time_up',email_started_at=NULL,email_deadline_at=NULL
    FROM expired WHERE s.id=expired.id RETURNING s.id`);
}
function startExpiryWorker() {
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    expireTimeAttacks()
      .catch((error) =>
        console.error(
          JSON.stringify({
            event: "game_expiry_error",
            message: error.message,
          }),
        ),
      )
      .finally(() => (busy = false));
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
module.exports = {
  NEW_RULES,
  visibleWords,
  classicSeconds,
  timeAttackScore,
  expireTimeAttacks,
  startExpiryWorker,
};
