const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
test("Migration de données historiques : doublons, affectation et résultats préservés", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Base _test dédiée requise");
  const client = new Client({ connectionString: url });
  await client.connect();
  const schema = `migration_${crypto.randomBytes(6).toString("hex")}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    for (const name of ["001_schema.sql", "002_achievements.sql"])
      await client.query(
        fs.readFileSync(
          path.join(__dirname, "../src/db/migrations", name),
          "utf8",
        ),
      );
    const team = (
      await client.query(
        "INSERT INTO services(name,code) VALUES('Ancienne équipe','OLD') RETURNING id",
      )
    ).rows[0];
    const oldEmail = (
      await client.query(
        "INSERT INTO emails(sender,real_sender,subject,body,type) VALUES('Historique','historique@example.test','Ancien scénario','Contenu historique','safe') RETURNING id",
      )
    ).rows[0];
    const players = (
      await client.query(
        "INSERT INTO players(name,email,service_id) VALUES('AB','old1@example.test',$1),('ab','old2@example.test',$1),('AB#2','old3@example.test',$1) RETURNING id",
        [team.id],
      )
    ).rows;
    const game = (
      await client.query(
        "INSERT INTO game_sessions(player_id,difficulty,score,email_order,completed) VALUES($1,'easy',99,'[]',TRUE) RETURNING id",
        [players[0].id],
      )
    ).rows[0];
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/003_enterprise.sql"),
        "utf8",
      ),
    );
    const names = (
      await client.query("SELECT name FROM players ORDER BY id")
    ).rows.map((p) => p.name.toLowerCase());
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/004_mail_catalog.sql"),
        "utf8",
      ),
    );
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/005_mail_sets.sql"),
        "utf8",
      ),
    );
    assert.equal(
      (
        await client.query(
          "SELECT COUNT(*)::int AS n FROM mail_set_emails WHERE email_id=$1",
          [oldEmail.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await client.query("SELECT status FROM mail_sets")).rows[0].status,
      "ready",
    );
    const oldBattle = (
      await client.query(`INSERT INTO battles(name,mode,difficulty,starts_at,ends_at,email_order)
      VALUES('Battle avant refonte','individual','normal',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour','[]') RETURNING id`)
    ).rows[0];
    const active = (
      await client.query(
        `INSERT INTO game_sessions(player_id,difficulty,score,jokers_used,email_order,total_emails,rules_version,battle_id,email_started_at,email_deadline_at)
      VALUES($1,'normal',1,1,$2,1,1,$3,NOW(),NOW()+INTERVAL '30 seconds') RETURNING id,email_deadline_at`,
        [players[0].id, JSON.stringify([oldEmail.id]), oldBattle.id],
      )
    ).rows[0];
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/006_game_formats.sql"),
        "utf8",
      ),
    );
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/007_time_attack_sets.sql"),
        "utf8",
      ),
    );
    const preservedActive = (
      await client.query("SELECT * FROM game_sessions WHERE id=$1", [active.id])
    ).rows[0];
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../src/db/migrations/008_open_competitions.sql"),
        "utf8",
      ),
    );
    const preservedBattle = (
      await client.query(
        "SELECT game_format,audience_mode,ends_at FROM battles WHERE id=$1",
        [oldBattle.id],
      )
    ).rows[0];
    assert.equal(preservedBattle.game_format, "classic");
    assert.equal(preservedBattle.audience_mode, "snapshot");
    assert.ok(preservedBattle.ends_at);
    assert.equal(preservedActive.game_format, "classic");
    assert.equal(preservedActive.mail_set_id, null);
    assert.equal(preservedActive.rules_version, 1);
    assert.equal(preservedActive.timer_rules.version, 1);
    assert.equal(preservedActive.score, 1);
    assert.equal(preservedActive.jokers_used, 1);
    assert.equal(
      preservedActive.email_deadline_at.getTime(),
      active.email_deadline_at.getTime(),
    );
    assert.equal(
      (
        await client.query("SELECT timer_rules FROM battles WHERE id=$1", [
          oldBattle.id,
        ])
      ).rows[0].timer_rules.version,
      1,
    );
    const newBattle = (
      await client.query(`INSERT INTO battles(name,mode,difficulty,starts_at,ends_at,email_order)
      VALUES('Nouvelle battle','individual','easy',NOW(),NOW()+INTERVAL '1 hour','[]') RETURNING id,timer_rules`)
    ).rows[0];
    assert.equal(newBattle.timer_rules.version, 2);
    await client.query(
      fs.readFileSync(
        path.join(
          __dirname,
          "../src/db/migrations/009_gentler_progression.sql",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await client.query("SELECT timer_rules FROM battles WHERE id=$1", [
          newBattle.id,
        ])
      ).rows[0].timer_rules,
      { version: 2 },
    );
    assert.deepEqual(
      (
        await client.query(
          "SELECT timer_rules FROM game_sessions WHERE id=$1",
          [active.id],
        )
      ).rows[0].timer_rules,
      { version: 1 },
    );
    const futureBattle = (
      await client.query(`INSERT INTO battles(name,mode,difficulty,starts_at,ends_at,email_order)
      VALUES('Battle avec baisse de 1 seconde','individual','normal',NOW(),NULL,'[]') RETURNING timer_rules`)
    ).rows[0];
    assert.deepEqual(futureBattle.timer_rules, {
      version: 2,
      decrementSeconds: 1,
    });
    const futureSession = (
      await client.query(
        `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails)
      VALUES($1,'normal','[]',0) RETURNING timer_rules`,
        [players[0].id],
      )
    ).rows[0];
    assert.deepEqual(futureSession.timer_rules, {
      version: 2,
      decrementSeconds: 1,
    });
    const preserved = (
      await client.query(
        "SELECT subject,usage,archived_at FROM emails WHERE id=$1",
        [oldEmail.id],
      )
    ).rows[0];
    assert.equal(preserved.subject, "Ancien scénario");
    assert.equal(preserved.usage, "both");
    assert.equal(preserved.archived_at, null);
    const { importEmails } = require("../src/services/mailCatalog");
    const legacyPreview = await importEmails(
      client,
      [
        {
          sender: "Historique",
          realSender: "historique@example.test",
          subject: "Ancien scénario",
          body: "Contenu historique",
          type: "safe",
          usage: "both",
          clues: [],
        },
      ],
      { preview: true },
    );
    assert.equal(legacyPreview.added, 0);
    assert.equal(legacyPreview.duplicates, 1);
    assert.equal(new Set(names).size, 3);
    const historical = (
      await client.query("SELECT * FROM game_sessions WHERE id=$1", [game.id])
    ).rows[0];
    assert.equal(historical.score, 99);
    assert.equal(historical.rules_version, 0);
    assert.equal(historical.service_id, team.id);
    assert.equal(historical.service_name, "Ancienne équipe");
    assert.equal(
      (
        await client.query(
          "SELECT COUNT(*)::int AS n FROM team_membership_history",
        )
      ).rows[0].n,
      3,
    );
    await assert.rejects(
      client.query(
        "INSERT INTO players(name,email) VALUES('AB','duplicate@example.test')",
      ),
      { code: "23505" },
    );
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
