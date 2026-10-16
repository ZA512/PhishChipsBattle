-- Only future rows use the slower progression; existing rule snapshots stay intact.
ALTER TABLE battles ALTER COLUMN timer_rules SET DEFAULT '{"version":2,"decrementSeconds":1}';
ALTER TABLE game_sessions ALTER COLUMN timer_rules SET DEFAULT '{"version":2,"decrementSeconds":1}';
