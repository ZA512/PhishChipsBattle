ALTER TABLE battles ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE battles ADD COLUMN game_format VARCHAR(12) NOT NULL DEFAULT 'classic' CHECK(game_format IN ('classic','time_attack'));
ALTER TABLE battles ADD COLUMN duration_seconds INTEGER;
ALTER TABLE battles ADD COLUMN audience_mode VARCHAR(12) NOT NULL DEFAULT 'snapshot' CHECK(audience_mode IN ('snapshot','all','teams'));
ALTER TABLE battles ADD COLUMN audience_team_ids INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE battles ADD CONSTRAINT battle_format_rules CHECK(
 (game_format='classic' AND duration_seconds IS NULL) OR
 (game_format='time_attack' AND difficulty IN ('normal','hardcore') AND duration_seconds IN (300,600) AND joker_limit=0));
ALTER TABLE game_sessions DROP CONSTRAINT session_format_rules;
ALTER TABLE game_sessions ADD CONSTRAINT session_format_rules CHECK(
 (game_format='time_attack' AND difficulty IN ('normal','hardcore') AND duration_seconds IN (300,600)) OR
 (game_format='classic' AND duration_seconds IS NULL) OR
 (game_format='discovery' AND battle_id IS NULL AND duration_seconds IS NULL AND score=0));
