'use strict';

const pool = require('../db/pool');

/**
 * Evaluate achievements for a player after a session ends.
 * Returns array of newly unlocked achievements.
 */
async function evaluateAchievements(playerId, sessionId) {
  const client = await pool.connect();
  try {
    // Load session data
    const sessionRes = await client.query(
      'SELECT * FROM game_sessions WHERE id = $1 AND player_id = $2',
      [sessionId, playerId]
    );
    if (sessionRes.rows.length === 0) return [];
    const session = sessionRes.rows[0];
    if (!session.completed) return [];

    // Load answers for this session (ordered)
    const answersRes = await client.query(
      `SELECT ea.*, e.type AS email_type
       FROM email_answers ea
       JOIN emails e ON e.id = ea.email_id
       WHERE ea.session_id = $1
       ORDER BY ea.answered_at ASC`,
      [sessionId]
    );
    const answers = answersRes.rows;

    // Load all achievements
    const achievementsRes = await client.query('SELECT * FROM achievements');
    const allAchievements = achievementsRes.rows;

    // Load already-unlocked achievements for this player
    const unlockedRes = await client.query(
      'SELECT achievement_id FROM player_achievements WHERE player_id = $1',
      [playerId]
    );
    const unlockedSet = new Set(unlockedRes.rows.map((r) => r.achievement_id));

    // Load player stats (all sessions)
    const statsRes = await client.query(
      `SELECT COUNT(*) AS total_games,
              COUNT(DISTINCT difficulty) AS diff_count,
              COUNT(DISTINCT service_id) AS service_count
       FROM game_sessions gs
       JOIN players p ON p.id = gs.player_id
       WHERE gs.player_id = $1 AND gs.completed = TRUE`,
      [playerId]
    );
    const stats = statsRes.rows[0];

    // Count services played
    const svcRes = await client.query(
      `SELECT COUNT(DISTINCT p.service_id) AS svc_count
       FROM game_sessions gs
       JOIN players p ON p.id = gs.player_id
       WHERE gs.player_id = $1 AND gs.completed = TRUE AND p.service_id IS NOT NULL`,
      [playerId]
    );
    const svcCount = parseInt(svcRes.rows[0].svc_count) || 0;

    // Count games today
    const todayRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM game_sessions
       WHERE player_id = $1 AND completed = TRUE AND DATE(started_at) = CURRENT_DATE`,
      [playerId]
    );
    const gamesToday = parseInt(todayRes.rows[0].cnt) || 0;

    // Compute session metrics
    const difficulty = session.difficulty;
    const score = session.score;
    const errors = session.errors;
    const jokersUsed = session.jokers_used;

    // Consecutive correct streak (longest in session)
    let maxCorrectStreak = 0;
    let currentStreak = 0;
    for (const a of answers) {
      if (a.is_correct && a.user_choice !== 'joker') {
        currentStreak++;
        maxCorrectStreak = Math.max(maxCorrectStreak, currentStreak);
      } else if (!a.is_correct) {
        currentStreak = 0;
      }
    }

    // Fast correct streak (consecutive correct < 5s)
    let maxFastStreak = 0;
    let fastStreak = 0;
    for (const a of answers) {
      if (a.is_correct && a.user_choice !== 'joker' && a.decision_time < 5) {
        fastStreak++;
        maxFastStreak = Math.max(maxFastStreak, fastStreak);
      } else {
        fastStreak = 0;
      }
    }

    // No-joker correct streak
    let maxShieldStreak = 0;
    let shieldStreak = 0;
    for (const a of answers) {
      if (a.is_correct && a.user_choice !== 'joker') {
        shieldStreak++;
        maxShieldStreak = Math.max(maxShieldStreak, shieldStreak);
      } else {
        shieldStreak = 0;
      }
    }

    // Average decision time
    const correctAnswers = answers.filter((a) => a.is_correct && a.user_choice !== 'joker');
    const avgDecisionTime = correctAnswers.length > 0
      ? correctAnswers.reduce((s, a) => s + a.decision_time, 0) / correctAnswers.length
      : 999;

    // First 3 emails wrong?
    const first3Wrong = answers.length >= 3 &&
      !answers[0].is_correct && !answers[1].is_correct && !answers[2].is_correct;

    // First 10 emails correct < 3s
    const first10Fast = answers.length >= 10 &&
      answers.slice(0, 10).every((a) => a.is_correct && a.decision_time < 3);

    // Error types analysis
    const errorAnswers = answers.filter((a) => !a.is_correct && a.user_choice !== 'timeout' && a.user_choice !== 'joker');
    const onlySafeErrors = errorAnswers.length >= 2 && errorAnswers.every((a) => a.email_type === 'safe');
    const onlyPhishingErrors = errorAnswers.length >= 2 && errorAnswers.every((a) => a.email_type === 'phishing');

    // Session hour (for insomniaque)
    const sessionHour = session.started_at ? new Date(session.started_at).getHours() : 12;
    const isNightOwl = sessionHour >= 0 && sessionHour < 5;

    // Is first ever game?
    const totalGames = parseInt(stats.total_games) || 0;

    // Now evaluate each achievement
    const newlyUnlocked = [];

    for (const ach of allAchievements) {
      if (unlockedSet.has(ach.id)) continue;

      // Difficulty filter: if achievement has difficulty, must match session
      if (ach.difficulty && ach.difficulty !== difficulty) continue;

      let earned = false;

      switch (ach.category) {
        case 'streak':
          earned = maxCorrectStreak >= ach.threshold;
          break;
        case 'speed':
          earned = maxFastStreak >= ach.threshold;
          break;
        case 'shield':
          earned = maxShieldStreak >= ach.threshold;
          break;
        case 'endurance':
          earned = score >= ach.threshold;
          break;
        case 'loyalty':
          if (ach.key === 'veteran') earned = totalGames >= 10;
          else if (ach.key === 'general') earned = totalGames >= 50;
          else if (ach.key === 'tentaculaire') earned = parseInt(stats.diff_count) >= 3;
          else if (ach.key === 'touriste') earned = svcCount >= 3;
          break;
        case 'ranking':
          // Ranking achievements are evaluated separately (monthly cron or on scores page load)
          // Skip here — will be handled by a dedicated function
          break;
        case 'fun':
          if (ach.key === 'pile_ou_face') {
            const total = answers.length;
            earned = total >= 10 && score === Math.round(total / 2);
          } else if (ach.key === 'tortue') {
            earned = answers.length >= 10 && errors === 0 && avgDecisionTime > 25;
          } else if (ach.key === 'debut_carriere') {
            earned = first3Wrong;
          } else if (ach.key === 'devin') {
            earned = first10Fast;
          } else if (ach.key === 'stagiaire') {
            earned = session.completed && score === 0;
          } else if (ach.key === 'aimant_phishing') {
            earned = onlySafeErrors;
          } else if (ach.key === 'trop_confiant') {
            earned = onlyPhishingErrors;
          } else if (ach.key === 'chanceux') {
            earned = totalGames === 1 && score >= 30;
          } else if (ach.key === 'insomniaque') {
            earned = isNightOwl;
          } else if (ach.key === 'bourreau_travail') {
            earned = gamesToday >= 5;
          } else if (ach.key === 'perfectionniste') {
            earned = score >= 50 && errors === 0 && jokersUsed === 0;
          } else if (ach.key === 'survivant') {
            earned = errors === 2 && score > 50;
          }
          break;
      }

      if (earned) {
        await client.query(
          'INSERT INTO player_achievements (player_id, achievement_id, session_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [playerId, ach.id, sessionId]
        );
        newlyUnlocked.push({
          key: ach.key,
          name: ach.name,
          emoji: ach.emoji,
          description: ach.description,
        });
        unlockedSet.add(ach.id);
      }
    }

    return newlyUnlocked;
  } finally {
    client.release();
  }
}

module.exports = { evaluateAchievements };
