-- Existing games remain accessible in profiles but do not enter the new verified rankings.
ALTER TABLE players ALTER COLUMN name TYPE VARCHAR(40);
DO $$
DECLARE duplicate RECORD; candidate TEXT; suffix INTEGER;
BEGIN
  FOR duplicate IN SELECT id,name FROM (
    SELECT id,name,ROW_NUMBER() OVER(PARTITION BY lower(name) ORDER BY id) AS n FROM players
  ) ranked WHERE n>1 ORDER BY id LOOP
    suffix:=0; candidate:=left(duplicate.name,16)||'#'||duplicate.id;
    WHILE EXISTS(SELECT 1 FROM players WHERE lower(name)=lower(candidate) AND id<>duplicate.id) LOOP
      suffix:=suffix+1; candidate:=left(duplicate.name,16)||'#'||duplicate.id||'-'||suffix;
    END LOOP;
    UPDATE players SET name=candidate WHERE id=duplicate.id;
  END LOOP;
END $$;
CREATE UNIQUE INDEX players_name_unique ON players(lower(name));
ALTER TABLE players ADD COLUMN password_hash TEXT;
ALTER TABLE players ADD COLUMN role VARCHAR(12) NOT NULL DEFAULT 'player' CHECK (role IN ('player','organizer','admin'));

CREATE TABLE directory_employees (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  manager_id UUID,
  job_title VARCHAR(200),
  department VARCHAR(200),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX directory_manager_idx ON directory_employees(manager_id);
ALTER TABLE players ADD COLUMN directory_id UUID UNIQUE REFERENCES directory_employees(id);
ALTER TABLE services ADD COLUMN archived_at TIMESTAMPTZ;

CREATE TABLE directory_team_members (
  employee_id UUID PRIMARY KEY REFERENCES directory_employees(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  source VARCHAR(20) NOT NULL CHECK (source IN ('snapshot','peer','manual','self')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE team_membership_history (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  employee_id UUID REFERENCES directory_employees(id),
  service_id INTEGER REFERENCES services(id),
  service_name VARCHAR(100),
  actor_id INTEGER REFERENCES players(id),
  source VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO team_membership_history(player_id,service_id,service_name,source,reason)
SELECT p.id,s.id,s.name,'migration','Affectation historique avant la reprise' FROM players p JOIN services s ON s.id=p.service_id;

CREATE TABLE auth_sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE oauth_states (
  state_hash VARCHAR(64) PRIMARY KEY,
  browser_hash VARCHAR(64) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  verifier VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE battles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mode VARCHAR(12) NOT NULL CHECK(mode IN ('individual','internal','teams')),
  difficulty VARCHAR(10) NOT NULL CHECK(difficulty IN ('easy','normal','hardcore')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 5),
  joker_limit INTEGER NOT NULL DEFAULT 3 CHECK(joker_limit BETWEEN 0 AND 3),
  email_order JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'published' CHECK(status IN ('published','closed')),
  created_by INTEGER REFERENCES players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  results JSONB,
  CHECK (ends_at > starts_at)
);
CREATE TABLE battle_participants (
  id SERIAL PRIMARY KEY,
  battle_id INTEGER NOT NULL REFERENCES battles(id),
  player_id INTEGER REFERENCES players(id),
  employee_id UUID REFERENCES directory_employees(id),
  name VARCHAR(200) NOT NULL,
  service_id INTEGER REFERENCES services(id),
  service_name VARCHAR(100),
  CHECK(player_id IS NOT NULL OR employee_id IS NOT NULL),
  UNIQUE (battle_id,player_id),
  UNIQUE (battle_id,employee_id)
);
CREATE INDEX battle_roster_idx ON battle_participants(battle_id);
ALTER TABLE game_sessions ADD COLUMN service_id INTEGER REFERENCES services(id);
ALTER TABLE game_sessions ADD COLUMN service_name VARCHAR(100);
ALTER TABLE game_sessions ADD COLUMN battle_id INTEGER REFERENCES battles(id);
ALTER TABLE game_sessions ADD COLUMN rules_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN email_started_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN email_deadline_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN finish_reason VARCHAR(20);
ALTER TABLE game_sessions ADD COLUMN disqualified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE game_sessions ADD COLUMN score_revision INTEGER NOT NULL DEFAULT 0;
UPDATE game_sessions gs SET service_id=p.service_id,service_name=s.name FROM players p LEFT JOIN services s ON s.id=p.service_id WHERE p.id=gs.player_id;
UPDATE game_sessions SET finish_reason='legacy' WHERE completed;
CREATE INDEX sessions_battle_idx ON game_sessions(battle_id,player_id);
ALTER TABLE email_answers ADD COLUMN response JSONB;
CREATE UNIQUE INDEX answers_email_unique ON email_answers(session_id,email_id);
ALTER TABLE achievements ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE directory_sync_runs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES players(id),
  source VARCHAR(12) NOT NULL,
  imported INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE score_adjustments (
 id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES game_sessions(id),
 actor_id INTEGER REFERENCES players(id), reason TEXT NOT NULL,
 old_score INTEGER NOT NULL, new_score INTEGER NOT NULL,
 old_disqualified BOOLEAN NOT NULL,new_disqualified BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
