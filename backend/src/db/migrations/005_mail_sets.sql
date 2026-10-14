CREATE TABLE mail_sets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  default_usage VARCHAR(10) NOT NULL DEFAULT 'training'
    CHECK (default_usage IN ('training','battle','both')),
  status VARCHAR(10) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX mail_sets_active_name ON mail_sets(LOWER(name)) WHERE status<>'archived';
CREATE TABLE mail_set_emails (
  set_id INTEGER NOT NULL REFERENCES mail_sets(id),
  email_id INTEGER NOT NULL REFERENCES emails(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(set_id,email_id)
);
CREATE INDEX mail_set_emails_email_idx ON mail_set_emails(email_id);
CREATE INDEX IF NOT EXISTS mail_clues_lookup_idx ON email_clues(email_id,display_order);

-- Existing questions keep their IDs, availability and historical references.
INSERT INTO mail_sets(name,description,default_usage,status)
  SELECT 'Catalogue général','Catalogue conservé lors de la migration vers les sets.','training','ready'
  WHERE EXISTS(SELECT 1 FROM emails WHERE archived_at IS NULL);
INSERT INTO mail_set_emails(set_id,email_id)
  SELECT s.id,e.id FROM mail_sets s CROSS JOIN emails e
  WHERE s.name='Catalogue général' AND e.archived_at IS NULL;
ALTER TABLE mail_catalog_events ADD COLUMN set_id INTEGER REFERENCES mail_sets(id);
ALTER TABLE mail_catalog_events ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
ALTER TABLE mail_catalog_events DROP CONSTRAINT mail_catalog_events_operation_check;
ALTER TABLE mail_catalog_events ADD CHECK(operation IN ('import','replace','delete','attach','detach','usage','set'));
ALTER TABLE battles ADD COLUMN mail_selection JSONB;
