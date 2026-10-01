-- Questions are immutable once imported. Removing a question from the catalog
-- must not change the series of a published battle or an existing session.
ALTER TABLE emails ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN usage VARCHAR(10) NOT NULL DEFAULT 'both'
  CHECK (usage IN ('training','battle','both'));
ALTER TABLE emails ADD COLUMN fingerprint TEXT;
CREATE UNIQUE INDEX emails_active_fingerprint ON emails(fingerprint)
  WHERE archived_at IS NULL AND fingerprint IS NOT NULL;
CREATE INDEX emails_catalog_idx ON emails(usage,id) WHERE archived_at IS NULL;
CREATE TABLE mail_catalog_events (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES players(id),
  operation VARCHAR(10) NOT NULL CHECK(operation IN ('import','replace','delete')),
  added INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
