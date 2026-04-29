-- Migration 001 : Schéma initial PhishChipsBattle Enterprise

-- Services de l'entreprise
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Joueurs (pseudo arcade + email pro = identité unique)
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(4) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emails du jeu
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    original_id INTEGER,  -- id originel depuis emails.js, pour référence
    sender TEXT NOT NULL,
    real_sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('phishing', 'safe')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices associés à chaque email
CREATE TABLE IF NOT EXISTS email_clues (
    id SERIAL PRIMARY KEY,
    email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    clue_text TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0
);

-- Sessions de jeu
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hardcore')),
    score INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    total_emails INTEGER NOT NULL DEFAULT 0,
    jokers_used INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    -- Ordre de passage des emails (tableau d'IDs sérialisé en JSON)
    email_order JSONB,
    current_email_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Réponses individuelles (une ligne par email joué dans une session)
CREATE TABLE IF NOT EXISTS email_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    email_id INTEGER NOT NULL REFERENCES emails(id),
    user_choice VARCHAR(10) NOT NULL CHECK (user_choice IN ('phishing', 'safe', 'joker', 'timeout')),
    is_correct BOOLEAN NOT NULL,
    decision_time INTEGER NOT NULL DEFAULT 0,  -- secondes
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON game_sessions(completed);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON game_sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_sessions_player_completed ON game_sessions(player_id, completed);
CREATE INDEX IF NOT EXISTS idx_answers_session ON email_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_clues_email ON email_clues(email_id);
