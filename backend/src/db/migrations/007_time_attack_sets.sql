ALTER TABLE emails DROP CONSTRAINT emails_usage_check;
ALTER TABLE emails ADD CONSTRAINT emails_usage_check CHECK (usage IN ('training','battle','both','express'));
ALTER TABLE mail_sets DROP CONSTRAINT mail_sets_default_usage_check;
ALTER TABLE mail_sets ADD CONSTRAINT mail_sets_default_usage_check CHECK (default_usage IN ('training','battle','both','express'));
ALTER TABLE game_sessions ADD COLUMN mail_set_id INTEGER REFERENCES mail_sets(id);
ALTER TABLE game_sessions ADD COLUMN mail_set_name VARCHAR(100);
ALTER TABLE game_sessions ADD CONSTRAINT session_mail_set_format CHECK (mail_set_id IS NULL OR game_format='time_attack');
CREATE INDEX time_attack_set_idx ON game_sessions(mail_set_id,duration_seconds,difficulty) WHERE game_format='time_attack';
