'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Seed emails from emails-data.js if the emails table is empty
 */
async function seedEmails(client) {
  const { rows } = await client.query('SELECT COUNT(*) FROM emails');
  if (parseInt(rows[0].count, 10) > 0) {
    console.log('[migrate] Emails already seeded, skipping.');
    return;
  }

  const emails = require('./emails-data');
  console.log(`[migrate] Seeding ${emails.length} emails…`);

  for (const email of emails) {
    const res = await client.query(
      `INSERT INTO emails (original_id, sender, real_sender, subject, body, type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [email.id, email.sender, email.realSender, email.subject, email.body, email.type]
    );
    const emailDbId = res.rows[0].id;

    if (Array.isArray(email.clues)) {
      for (let i = 0; i < email.clues.length; i++) {
        await client.query(
          `INSERT INTO email_clues (email_id, clue_text, display_order) VALUES ($1, $2, $3)`,
          [emailDbId, email.clues[i], i]
        );
      }
    }
  }
  console.log('[migrate] Emails seeded successfully.');
}

/**
 * Seed achievements from achievements-data.js (upsert by key)
 */
async function seedAchievements(client) {
  // Check if achievements table exists (migration 002 may not have run yet)
  const tableCheck = await client.query(
    "SELECT to_regclass('public.achievements') AS t"
  );
  if (!tableCheck.rows[0].t) return;

  const achievements = require('./achievements-data');
  console.log(`[migrate] Seeding/updating ${achievements.length} achievements…`);

  for (const a of achievements) {
    await client.query(
      `INSERT INTO achievements (key, name, description, emoji, category, difficulty, tier, threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         emoji = EXCLUDED.emoji,
         category = EXCLUDED.category,
         difficulty = EXCLUDED.difficulty,
         tier = EXCLUDED.tier,
         threshold = EXCLUDED.threshold`,
      [a.key, a.name, a.description, a.emoji, a.category, a.difficulty, a.tier, a.threshold]
    );
  }
  console.log('[migrate] Achievements seeded successfully.');
}

/**
 * Main migration entry point — called once at API startup
 */
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.filename));

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`[migrate] Applied ${file}`);
    }

    await seedEmails(client);
    await seedAchievements(client);
    await client.query('COMMIT');
    console.log('[migrate] All migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { migrate };
