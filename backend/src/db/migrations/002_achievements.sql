-- ============================================================
-- 002_achievements.sql — Achievements / Badges system
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(10),
    category VARCHAR(30) NOT NULL,
    difficulty VARCHAR(10) DEFAULT NULL, -- NULL = universal, 'easy'|'normal'|'hardcore'
    tier INTEGER DEFAULT 1,
    threshold INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_achievements (
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE SET NULL,
    PRIMARY KEY (player_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
