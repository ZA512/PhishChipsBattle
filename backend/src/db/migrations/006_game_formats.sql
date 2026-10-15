-- Old sessions and published battles retain their immutable timing rules.
ALTER TABLE battles ADD COLUMN timer_rules JSONB NOT NULL DEFAULT '{"version":1}';
ALTER TABLE battles ALTER COLUMN timer_rules SET DEFAULT '{"version":2}';
ALTER TABLE game_sessions ADD COLUMN game_format VARCHAR(12) NOT NULL DEFAULT 'classic'
  CHECK(game_format IN ('classic','discovery','time_attack'));
ALTER TABLE game_sessions ADD COLUMN timer_rules JSONB NOT NULL DEFAULT '{"version":1}';
ALTER TABLE game_sessions ALTER COLUMN timer_rules SET DEFAULT '{"version":2}';
ALTER TABLE game_sessions ADD COLUMN duration_seconds INTEGER;
ALTER TABLE game_sessions ADD COLUMN global_started_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN global_deadline_at TIMESTAMPTZ;
ALTER TABLE game_sessions ADD COLUMN human_correct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN viewed_emails INTEGER NOT NULL DEFAULT 0;
UPDATE game_sessions s SET human_correct=(SELECT COUNT(*) FROM email_answers a WHERE a.session_id=s.id AND a.is_correct AND a.user_choice IN ('safe','phishing')),
  viewed_emails=GREATEST(current_email_index,current_email_index+CASE WHEN email_started_at IS NULL THEN 0 ELSE 1 END);
ALTER TABLE game_sessions ADD CONSTRAINT session_format_rules CHECK(
  (game_format='time_attack' AND battle_id IS NULL AND difficulty IN ('normal','hardcore') AND duration_seconds IN (300,600)) OR
  (game_format='classic' AND duration_seconds IS NULL) OR
  (game_format='discovery' AND battle_id IS NULL AND duration_seconds IS NULL AND score=0)
);
ALTER TABLE game_sessions ADD CONSTRAINT session_score_format CHECK(game_format='time_attack' OR score>=0);
CREATE INDEX time_attack_expiry_idx ON game_sessions(global_deadline_at) WHERE game_format='time_attack' AND NOT completed;
CREATE INDEX session_format_idx ON game_sessions(player_id,game_format,duration_seconds,difficulty);
