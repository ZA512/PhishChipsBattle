"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// This suite writes fixtures. It refuses to connect to an ordinary application database.
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL doit désigner une base dédiée dont le nom finit par _test",
  );
process.env.DATABASE_URL = database;
process.env.AUTH_MODE = "local";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ADMIN_PASSWORD = crypto.randomBytes(24).toString("hex");
process.env.APP_URL = "http://localhost:8080";
process.env.TRUST_PROXY = "loopback";
const pool = require("../src/db/pool");
const { migrate } = require("../src/db/migrate");
const { createApp } = require("../src/app");
const { answerLimiter } = require("../src/middleware/rateLimiter");
const { passwordHash, passwordMatches } = require("../src/services/auth");
const { evaluateAchievements } = require("../src/services/achievements");
const { transaction } = require("../src/lib/http");
let server, base;
const run = crypto.randomBytes(5).toString("hex");
const password = "Local-test-password-2026";
before(async () => {
  await migrate();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
async function request(
  path,
  { user, method = "GET", body, token, headers = {} } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(user ? { Cookie: user.cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Session-Token": token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function ok(path, options, status = 200) {
  const result = await request(path, options);
  assert.equal(result.status, status, JSON.stringify(result.data));
  return result.data;
}
async function user(label, admin = false) {
  const result = await request(
    `/api/auth/${admin ? "bootstrap" : "register"}`,
    {
      method: "POST",
      body: {
        name: `${label}-${run}`,
        email: `${label}-${run}@example.test`,
        password,
        ...(admin ? { bootstrapSecret: process.env.ADMIN_PASSWORD } : {}),
      },
    },
  );
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const u = { cookie: result.cookie };
  u.id = (await ok("/api/auth/me", { user: u })).player.id;
  return u;
}
async function choose(u, teamId) {
  await ok("/api/teams/choose", { user: u, method: "POST", body: { teamId } });
}
async function begin(u, battleId) {
  return ok(
    "/api/sessions",
    {
      user: u,
      method: "POST",
      body: { difficulty: "easy", ...(battleId ? { battleId } : {}) },
    },
    201,
  );
}
async function next(u, s) {
  return ok(`/api/sessions/${s.sessionId}/next-email`, {
    user: u,
    token: s.sessionToken,
  });
}
async function answer(u, s, emailId, choice = "joker") {
  answerLimiter.resetKey(`player:${u.id}`);
  return ok(`/api/sessions/${s.sessionId}/answer`, {
    user: u,
    token: s.sessionToken,
    method: "POST",
    body: { emailId, choice, decisionTime: 0 },
  });
}
async function end(u, s) {
  return ok(`/api/sessions/${s.sessionId}/end`, {
    user: u,
    token: s.sessionToken,
    method: "POST",
    body: {},
  });
}

test("Parcours entreprise et régressions sur PostgreSQL", async (t) => {
  assert.equal((await ok("/api/auth/config")).bootstrapAvailable, true);
  const admin = await user("admin", true),
    alice = await user("alice"),
    bob = await user("bob"),
    newcomer = await user("entrant"),
    manager = await user("manager");
  assert.equal((await ok("/api/auth/config")).bootstrapAvailable, false);
  const a = (
    await ok(
      "/api/admin/services",
      {
        user: admin,
        method: "POST",
        body: { name: "Équipe A", code: `A_${run}` },
      },
      201,
    )
  ).service;
  const b = (
    await ok(
      "/api/admin/services",
      {
        user: admin,
        method: "POST",
        body: { name: "Équipe B", code: `B_${run}` },
      },
      201,
    )
  ).service;
  await choose(admin, a.id);
  await choose(alice, a.id);
  await choose(bob, a.id);
  await choose(manager, b.id);
  await pool.query("UPDATE players SET role='organizer' WHERE id=$1", [
    manager.id,
  ]);
  await t.test(
    "Catalogue privé : import atomique, droits, sélection, export et séries préservées",
    async () => {
      const fixtures = require("./mail-fixtures");
      const count = async () =>
        (
          await pool.query(
            "SELECT COUNT(*)::int AS n FROM emails WHERE archived_at IS NULL",
          )
        ).rows[0].n;
      const importCatalog = async (catalog, options = {}) =>
        ok("/api/admin/emails/import", {
          user: admin,
          method: "POST",
          body: { catalog, ...options },
        });
      assert.equal(
        await count(),
        0,
        "Une installation neuve ne contient aucun mail",
      );
      await migrate();
      assert.equal(
        await count(),
        0,
        "Un redémarrage ne recharge pas le catalogue",
      );
      assert.equal((await request("/api/admin/emails")).status, 401);
      for (const u of [alice, manager]) {
        assert.equal(
          (await request("/api/admin/emails", { user: u })).status,
          403,
        );
        for (const path of ["import", "export", "delete"])
          assert.equal(
            (
              await request(`/api/admin/emails/${path}`, {
                user: u,
                method: "POST",
                body: {
                  catalog: fixtures,
                  all: true,
                  confirm: "SUPPRIMER TOUT",
                },
              })
            ).status,
            403,
          );
      }
      assert.equal(
        (
          await request("/api/sessions", {
            user: alice,
            method: "POST",
            body: { difficulty: "easy" },
          })
        ).status,
        503,
      );
      const initial = [
        ...fixtures,
        {
          ...fixtures[0],
          subject: "Entraînement uniquement",
          usage: "training",
        },
        { ...fixtures[1], subject: "Battle uniquement", usage: "battle" },
      ];
      const preview = await importCatalog(initial, { preview: true });
      assert.equal(preview.added, 26);
      assert.equal(await count(), 0);
      const invalid = await request("/api/admin/emails/import", {
        user: admin,
        method: "POST",
        body: {
          catalog: [fixtures[0], { ...fixtures[1], type: "bad" }],
          replace: true,
        },
      });
      assert.equal(invalid.status, 400);
      assert.match(invalid.data.error, /Mail 2/);
      assert.equal(await count(), 0);
      assert.equal((await importCatalog(initial)).added, 26);
      assert.equal(
        (await importCatalog([fixtures[0], fixtures[0]])).duplicates,
        2,
      );
      const exported = await ok("/api/admin/emails/export", {
        user: admin,
        method: "POST",
        body: {},
      });
      assert.equal(exported.schemaVersion, 1);
      assert.equal(exported.emails.length, 26);
      assert.equal((await importCatalog(exported)).added, 0);
      const started = await begin(alice);
      const oldOrder = (
        await pool.query("SELECT email_order FROM game_sessions WHERE id=$1", [
          started.sessionId,
        ])
      ).rows[0].email_order;
      const special = (
        await pool.query(
          "SELECT id,usage FROM emails WHERE usage IN ('training','battle')",
        )
      ).rows;
      assert.ok(
        !oldOrder.includes(special.find((e) => e.usage === "battle").id),
      );
      const battle = await ok(
        "/api/battles",
        {
          user: admin,
          method: "POST",
          body: {
            name: "Catalogue figé",
            mode: "individual",
            playerIds: [alice.id, bob.id],
            difficulty: "easy",
            startsAt: new Date(Date.now() - 1000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            emailCount: 25,
            jokerLimit: 0,
            maxAttempts: 1,
          },
        },
        201,
      );
      const battleOrder = (
        await pool.query("SELECT email_order FROM battles WHERE id=$1", [
          battle.id,
        ])
      ).rows[0].email_order;
      assert.ok(
        !battleOrder.includes(special.find((e) => e.usage === "training").id),
      );
      assert.equal(
        (
          await importCatalog(
            [
              {
                ...fixtures[0],
                subject: "Sans utilisation explicite",
                usage: undefined,
              },
            ],
            { replace: true },
          )
        ).removed,
        26,
      );
      assert.equal(
        (await ok("/api/admin/emails", { user: admin })).totals.battle,
        0,
      );
      assert.equal((await next(alice, started)).emailId, oldOrder[0]);
      await answer(alice, started, oldOrder[0], "safe");
      await end(alice, started);
      const frozen = await begin(bob, battle.id);
      assert.equal((await next(bob, frozen)).emailId, battleOrder[0]);
      await end(bob, frozen);
      const active = (await ok("/api/admin/emails", { user: admin })).emails[0];
      const selected = await ok("/api/admin/emails/export", {
        user: admin,
        method: "POST",
        body: { ids: [active.id] },
      });
      assert.equal(selected.emails.length, 1);
      assert.equal(selected.emails[0].usage, "training");
      assert.equal(
        (
          await ok("/api/admin/emails/delete", {
            user: admin,
            method: "POST",
            body: { ids: [active.id] },
          })
        ).removed,
        1,
      );
      await migrate();
      assert.equal(await count(), 0);
      assert.equal(
        (await ok(`/api/sessions/${started.sessionId}/recap`, { user: alice }))
          .answers.length,
        1,
      );
      await importCatalog(fixtures);
      assert.equal(
        (
          await request("/api/admin/emails/delete", {
            user: admin,
            method: "POST",
            body: { all: true },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await ok("/api/admin/emails/delete", {
            user: admin,
            method: "POST",
            body: { all: true, confirm: "SUPPRIMER TOUT" },
          })
        ).removed,
        24,
      );
      assert.equal((await importCatalog(fixtures)).added, 24);
      // These catalog exercises must not contribute to the later scoring fixtures.
      await pool.query(
        "UPDATE game_sessions SET disqualified=TRUE WHERE id=ANY($1::int[])",
        [[started.sessionId, frozen.sessionId]],
      );
    },
  );
  await t.test(
    "Sets : imports ciblés, partage, brouillons, composition et historique figés",
    async () => {
      const baseline = (
        await pool.query("SELECT id FROM emails WHERE archived_at IS NULL")
      ).rows.map((e) => e.id);
      const make = async (name, status = "draft") =>
        (
          await ok(
            "/api/admin/mail-sets",
            {
              user: admin,
              method: "POST",
              body: {
                name,
                description: "Set synthétique de test",
                defaultUsage: "battle",
                status,
              },
            },
            201,
          )
        ).set;
      const imported = async (setId, catalog, options = {}) =>
        ok("/api/admin/emails/import", {
          user: admin,
          method: "POST",
          body: { setId, catalog, ...options },
        });
      const mail = (number, label) => ({
        ...require("./mail-fixtures")[number],
        subject: `Set fixture ${label}`,
        usage: undefined,
      });
      const fixtureA = [0, 1, 2, 3].map((i) => mail(i, "A" + i));
      for (const u of [alice, manager])
        assert.equal(
          (await request("/api/admin/mail-sets", { user: u })).status,
          403,
        );
      assert.equal(
        (await request("/api/battles/mail-sets", { user: alice })).status,
        403,
      );
      const before = (await ok("/api/admin/mail-sets", { user: admin })).sets
        .length;
      const planned = await ok("/api/admin/emails/import", {
        user: admin,
        method: "POST",
        body: {
          newSet: {
            name: "Prévisualisation sans écriture",
            defaultUsage: "battle",
          },
          catalog: fixtureA,
          preview: true,
        },
      });
      assert.equal(planned.set.status, "draft");
      assert.equal(
        (await ok("/api/admin/mail-sets", { user: admin })).sets.length,
        before,
      );
      const setA = await make("Typosquatting de test");
      const setB = await make("Bureau farfelu de test", "ready");
      assert.equal((await imported(setA.id, fixtureA)).added, 4);
      assert.ok(
        !(await ok("/api/battles/mail-sets", { user: manager })).sets.some(
          (s) => s.id === setA.id,
        ),
      );
      const res = await imported(setB.id, [
        { ...fixtureA[0], usage: "training" },
        mail(4, "B4"),
        mail(5, "B5"),
      ]);
      assert.equal(res.added, 2);
      assert.equal(res.reused, 1);
      assert.equal(res.linked, 3);
      assert.equal(res.usageConflicts, 1);
      let members = (
        await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin })
      ).emails;
      assert.equal(members.length, 4);
      assert.ok(members.every((e) => e.usage === "battle"));
      const shared = members.find((e) => e.subject === fixtureA[0].subject);
      assert.equal(
        (
          await ok(`/api/admin/emails?setId=${setB.id}`, { user: admin })
        ).emails.find((e) => e.id === shared.id).sets.length,
        2,
      );
      const invalid = await request("/api/admin/emails/import", {
        user: admin,
        method: "POST",
        body: {
          setId: setA.id,
          replace: true,
          catalog: [mail(6, "Invalid"), { type: "bad" }],
        },
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin }))
          .matched,
        4,
      );
      await ok(`/api/admin/mail-sets/${setA.id}`, {
        user: admin,
        method: "PUT",
        body: { name: setA.name, status: "ready", defaultUsage: "battle" },
      });
      await ok("/api/admin/emails/usage", {
        user: admin,
        method: "POST",
        body: { ids: [shared.id], usage: "both" },
      });
      const fields = {
        sets: [
          { setId: setA.id, count: 2 },
          { setId: setB.id, count: 2 },
        ],
        emailCount: 4,
        safeCount: 2,
      };
      const preview = await ok("/api/battles/mail-preview", {
        user: manager,
        method: "POST",
        body: fields,
      });
      assert.equal(preview.composition.sharedAvailable, 1);
      assert.equal(preview.composition.total, 4);
      assert.equal(preview.composition.safe, 2);
      const exclusive = await ok("/api/battles/mail-preview", {
        user: manager,
        method: "POST",
        body: { ...fields, excludeTraining: true },
      });
      assert.equal(exclusive.composition.sharedAvailable, 0);
      assert.equal(
        (
          await request("/api/battles/mail-preview", {
            user: manager,
            method: "POST",
            body: {
              ...fields,
              sets: [
                { setId: setA.id, count: 4 },
                { setId: setB.id, count: 3 },
              ],
              emailCount: 7,
            },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/battles/mail-preview", {
            user: manager,
            method: "POST",
            body: {
              ...fields,
              sets: [
                { setId: setA.id, count: 2 },
                { setId: setA.id, count: 2 },
              ],
            },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/battles/mail-preview", {
            user: alice,
            method: "POST",
            body: fields,
          })
        ).status,
        403,
      );
      const battle = await ok(
        "/api/battles",
        {
          user: manager,
          method: "POST",
          body: {
            ...fields,
            name: "Battle avec sets figés",
            mode: "individual",
            playerIds: [alice.id],
            difficulty: "easy",
            startsAt: new Date(Date.now() - 1000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            maxAttempts: 1,
            jokerLimit: 0,
          },
        },
        201,
      );
      const snapshot = (
        await pool.query(
          "SELECT email_order,mail_selection FROM battles WHERE id=$1",
          [battle.id],
        )
      ).rows[0];
      assert.equal(snapshot.email_order.length, 4);
      assert.equal(new Set(snapshot.email_order).size, 4);
      assert.equal(
        (
          await pool.query(
            "SELECT COUNT(*)::int AS n FROM emails WHERE id=ANY($1::int[]) AND type='safe'",
            [snapshot.email_order],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        snapshot.mail_selection.sets.reduce((n, s) => n + s.count, 0),
        4,
      );
      assert.equal(
        (await ok("/api/battles", { user: alice })).battles.find(
          (b) => b.id === battle.id,
        ).mail_selection,
        null,
      );
      await ok(`/api/admin/mail-sets/${setA.id}`, {
        user: admin,
        method: "PUT",
        body: {
          name: "Nom modifié après publication",
          status: "ready",
          defaultUsage: "battle",
        },
      });
      const history = await ok(`/api/admin/mail-sets/${setA.id}/history`, {
        user: admin,
      });
      assert.ok(
        history.events.some(
          (e) => e.operation === "import" && e.added === 4 && e.actor,
        ),
      );
      assert.equal(
        history.battles[0].mail_selection.sets.find((s) => s.id === setA.id)
          .name,
        setA.name,
      );
      const exported = await ok("/api/admin/emails/export", {
        user: admin,
        method: "POST",
        body: { setId: setA.id },
      });
      assert.equal(exported.emails.length, 4);
      assert.equal(exported.set.name, "Nom modifié après publication");
      const started = await begin(alice, battle.id);
      const first = await next(alice, started);
      assert.equal(first.emailId, snapshot.email_order[0]);
      const changed = await imported(setA.id, [mail(6, "Replacement")], {
        replace: true,
      });
      assert.equal(changed.detached, 4);
      assert.equal(changed.removed, 3);
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin }))
          .matched,
        1,
      );
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setB.id}`, { user: admin }))
          .matched,
        3,
      );
      assert.equal((await next(alice, started)).emailId, first.emailId);
      await answer(alice, started, first.emailId, "safe");
      await end(alice, started);
      assert.equal(
        (await ok(`/api/sessions/${started.sessionId}/recap`, { user: alice }))
          .answers.length,
        1,
      );
      const replacement = (
        await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin })
      ).emails[0];
      await ok("/api/admin/emails/sets", {
        user: admin,
        method: "POST",
        body: { setId: setB.id, ids: [replacement.id], action: "add" },
      });
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setB.id}`, { user: admin }))
          .matched,
        4,
      );
      await ok("/api/admin/emails/sets", {
        user: admin,
        method: "POST",
        body: { setId: setB.id, ids: [replacement.id], action: "remove" },
      });
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin }))
          .matched,
        1,
      );
      const inB = (
        await ok(`/api/admin/emails?setId=${setB.id}`, { user: admin })
      ).emails[0];
      // A stale mixed selection must not partially move valid members.
      assert.equal(
        (
          await request("/api/admin/emails/sets", {
            user: admin,
            method: "POST",
            body: {
              action: "move",
              sourceSetId: setA.id,
              setId: setB.id,
              ids: [replacement.id, inB.id],
            },
          })
        ).status,
        409,
      );
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin }))
          .matched,
        1,
      );
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setB.id}`, { user: admin }))
          .matched,
        3,
      );
      assert.equal(
        (
          await request("/api/admin/emails/sets", {
            user: admin,
            method: "POST",
            body: {
              action: "move",
              sourceSetId: setA.id,
              setId: setA.id,
              ids: [replacement.id],
            },
          })
        ).status,
        400,
      );
      // Moving a question already linked to the destination remains valid.
      await ok("/api/admin/emails/sets", {
        user: admin,
        method: "POST",
        body: { action: "add", setId: setB.id, ids: [replacement.id] },
      });
      assert.equal(
        (
          await ok("/api/admin/emails/sets", {
            user: admin,
            method: "POST",
            body: {
              action: "move",
              sourceSetId: setA.id,
              setId: setB.id,
              ids: [replacement.id],
            },
          })
        ).changed,
        1,
      );
      assert.equal(
        (await ok(`/api/admin/emails?setId=${setA.id}`, { user: admin }))
          .matched,
        0,
      );
      const paged = await ok(
        `/api/admin/emails?setId=${setB.id}&pageSize=2&page=2`,
        { user: admin },
      );
      assert.equal(paged.matched, 4);
      assert.equal(paged.pages, 2);
      assert.equal(paged.emails.length, 2);
      const selection = await ok(
        `/api/admin/emails/selection?setId=${setB.id}&page=2&pageSize=2`,
        { user: admin },
      );
      assert.equal(
        selection.ids.length,
        4,
        "La sélection complète ignore la pagination",
      );
      const legitimate = await ok(
        `/api/admin/emails?setId=${setB.id}&type=safe`,
        { user: admin },
      );
      assert.deepEqual(
        (
          await ok(`/api/admin/emails/selection?setId=${setB.id}&type=safe`, {
            user: admin,
          })
        ).ids,
        legitimate.emails.map((e) => e.id),
      );
      assert.deepEqual(
        (
          await ok(`/api/admin/emails/selection?setId=${setA.id}`, {
            user: admin,
          })
        ).ids,
        [],
      );
      assert.equal(
        (await request("/api/admin/emails/selection", { user: manager }))
          .status,
        403,
      );
      assert.equal(
        (await ok(`/api/admin/mail-sets/${setA.id}/history`, { user: admin }))
          .events[0].details.toSet,
        setB.id,
      );
      await ok(`/api/admin/mail-sets/${setB.id}`, {
        user: admin,
        method: "PUT",
        body: { name: setB.name, status: "archived", defaultUsage: "battle" },
      });
      assert.equal(
        (
          await request("/api/battles/mail-preview", {
            user: manager,
            method: "POST",
            body: fields,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/api/admin/emails/import", {
            user: admin,
            method: "POST",
            body: { setId: setB.id, catalog: fixtureA },
          })
        ).status,
        404,
      );
      assert.deepEqual(
        (
          await pool.query("SELECT email_order FROM battles WHERE id=$1", [
            battle.id,
          ])
        ).rows[0].email_order,
        snapshot.email_order,
      );
      await pool.query(
        "UPDATE game_sessions SET disqualified=TRUE WHERE id=$1",
        [started.sessionId],
      );
      await pool.query(
        "UPDATE emails SET archived_at=NOW() WHERE NOT(id=ANY($1::int[]))",
        [baseline],
      );
      await pool.query(
        "UPDATE mail_sets SET status='archived' WHERE id=ANY($1::int[])",
        [[setA.id, setB.id]],
      );
    },
  );
  await t.test(
    "Authentification, identité et origine des mutations",
    async () => {
      assert.equal((await request("/api/scores/players")).status, 401);
      assert.equal(
        (await request("/api/admin/services", { user: alice })).status,
        403,
      );
      assert.equal(
        (await request("/api/admin/services", { user: manager })).status,
        403,
      );
      assert.equal(
        (await request("/api/battles/participants", { user: manager })).status,
        200,
      );
      assert.equal(
        (await request("/api/auth/register", { method: "POST" })).status,
        400,
      );
      assert.equal(
        (
          await request("/api/sessions", {
            user: alice,
            method: "POST",
            body: { playerId: bob.id, difficulty: "easy" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/sessions", {
            user: alice,
            method: "POST",
            body: { playerId: "abc", difficulty: "easy" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/teams/choose", {
            user: alice,
            method: "POST",
            body: { teamId: b.id },
            headers: { Origin: "https://intrus.example" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/auth/login", {
            method: "POST",
            body: { email: `alice-${run}@example.test`, password: "incorrect" },
          })
        ).status,
        401,
      );
      assert.equal(
        (await request("/api/players/1abc/profile", { user: alice })).status,
        400,
      );
      assert.equal((await request("/health")).status, 200);
      const encoded = await passwordHash(password);
      assert.ok(await passwordMatches(password, encoded));
      assert.equal(await passwordMatches("wrong", encoded), false);
    },
  );
  await t.test(
    "Unicité concurrente des pseudos et rollback sans connexion bloquée",
    async () => {
      const attempts = await Promise.all(
        [alice, bob].map((u) =>
          request("/api/players", {
            user: u,
            method: "POST",
            body: { name: `unique-${run}` },
          }),
        ),
      );
      assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
      await assert.rejects(
        transaction(async (client) => {
          await client.query("SELECT 1");
          throw new Error("rollback attendu");
        }),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  const tenant = crypto.randomUUID(),
    ids = [manager, alice, bob, newcomer].map(() => crypto.randomUUID());
  const directory = [manager, alice, bob, newcomer].map((u, i) => ({
    id: ids[i],
    tenantId: tenant,
    displayName: `Collaborateur ${i}`,
    managerId: i ? ids[0] : null,
  }));
  await ok("/api/admin/directory/import", {
    user: admin,
    method: "POST",
    body: { fullSnapshot: true, employees: directory },
  });
  for (let i = 0; i < directory.length; i++)
    await pool.query("UPDATE players SET directory_id=$1 WHERE id=$2", [
      ids[i],
      [manager, alice, bob, newcomer][i].id,
    ]);
  await t.test(
    "Préconisation collègues prioritaire, fallback manager et choix libre",
    async () => {
      let state = await ok("/api/teams/me", { user: newcomer });
      assert.equal(state.currentTeamId, null);
      assert.equal(state.suggestion.teamId, a.id);
      assert.equal(state.suggestion.source, "peers");
      await choose(newcomer, b.id);
      state = await ok("/api/teams/me", { user: newcomer });
      assert.equal(state.currentTeamId, b.id);
      assert.equal(state.suggestion.teamId, a.id);
      await choose(bob, b.id);
      state = await ok("/api/teams/me", { user: newcomer });
      assert.equal(state.suggestion.source, "manager");
      assert.equal(state.suggestion.teamId, b.id);
      await choose(bob, a.id);
      await ok("/api/admin/directory/import", {
        user: admin,
        method: "POST",
        body: {
          fullSnapshot: true,
          employees: directory.map((e) => ({
            ...e,
            jobTitle: "Titre imaginatif modifié",
          })),
        },
      });
      assert.equal(
        (await ok("/api/teams/me", { user: newcomer })).currentTeamId,
        b.id,
      );
    },
  );
  let training;
  await t.test(
    "Horloge serveur, jokers bornés, double clic et reprise réseau idempotente",
    async () => {
      training = await begin(alice);
      const first = await next(alice, training);
      assert.equal(first.type, undefined);
      assert.equal(first.clues, undefined);
      const deadline = (
        await pool.query(
          "SELECT email_deadline_at FROM game_sessions WHERE id=$1",
          [training.sessionId],
        )
      ).rows[0].email_deadline_at;
      await next(alice, training);
      const resumed = await begin(alice);
      assert.equal(resumed.sessionId, training.sessionId);
      assert.equal(resumed.resumed, true);
      assert.equal(
        (
          await pool.query(
            "SELECT email_deadline_at FROM game_sessions WHERE id=$1",
            [training.sessionId],
          )
        ).rows[0].email_deadline_at.getTime(),
        deadline.getTime(),
      );
      assert.equal(
        (
          await request(`/api/sessions/${training.sessionId}/next-email`, {
            user: bob,
            token: training.sessionToken,
          })
        ).status,
        403,
      );
      const opts = {
        user: alice,
        token: training.sessionToken,
        method: "POST",
        body: { emailId: first.emailId, choice: "joker" },
      };
      const duplicates = await Promise.all([
        request(`/api/sessions/${training.sessionId}/answer`, opts),
        request(`/api/sessions/${training.sessionId}/answer`, opts),
      ]);
      duplicates.forEach((r) => assert.equal(r.status, 200));
      assert.equal(
        (
          await pool.query(
            "SELECT COUNT(*)::int AS n FROM email_answers WHERE session_id=$1",
            [training.sessionId],
          )
        ).rows[0].n,
        1,
      );
      for (let i = 0; i < 2; i++) {
        const email = await next(alice, training);
        await answer(alice, training, email.emailId);
      }
      const fourth = await next(alice, training);
      assert.equal(
        (
          await request(`/api/sessions/${training.sessionId}/answer`, {
            user: alice,
            token: training.sessionToken,
            method: "POST",
            body: { emailId: fourth.emailId, choice: "joker" },
          })
        ).status,
        409,
      );
      await pool.query(
        "UPDATE game_sessions SET email_started_at=clock_timestamp()-INTERVAL '29 seconds',email_deadline_at=clock_timestamp()+INTERVAL '1 second' WHERE id=$1",
        [training.sessionId],
      );
      const blocker = await pool.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM game_sessions WHERE id=$1 FOR UPDATE",
        [training.sessionId],
      );
      let expired;
      try {
        const waiting = answer(alice, training, fourth.emailId, "safe");
        await new Promise((resolve) => setTimeout(resolve, 1150));
        await blocker.query("COMMIT");
        expired = await waiting;
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
      assert.equal(expired.isTimeout, true);
      assert.equal(expired.score, 3);
      assert.equal(expired.decisionTime, 30);
      await end(alice, training);
      const retry = await ok(
        `/api/sessions/${training.sessionId}/answer`,
        opts,
      );
      assert.equal(retry.score, 1);
      assert.equal(
        (await ok(`/api/sessions/${training.sessionId}/recap`, { user: alice }))
          .answers.length,
        4,
      );
      await choose(alice, b.id);
      assert.equal(
        (
          await pool.query("SELECT service_id FROM game_sessions WHERE id=$1", [
            training.sessionId,
          ])
        ).rows[0].service_id,
        a.id,
      );
    },
  );
  let battle, game;
  await t.test(
    "Battle : roster figé, même séquence, tentative unique et droits",
    async () => {
      battle = await ok(
        "/api/battles",
        {
          user: manager,
          method: "POST",
          body: {
            name: "Battle test",
            mode: "teams",
            teamIds: [a.id, b.id],
            difficulty: "normal",
            startsAt: new Date(Date.now() - 1000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            emailCount: 2,
            jokerLimit: 1,
            maxAttempts: 1,
          },
        },
        201,
      );
      assert.equal(
        (
          await request("/api/battles", {
            user: alice,
            method: "POST",
            body: {},
          })
        ).status,
        403,
      );
      await choose(alice, a.id);
      game = await begin(alice, battle.id);
      const resumes = await Promise.all([
        begin(alice, battle.id),
        begin(alice, battle.id),
      ]);
      assert.ok(
        resumes.every((s) => s.sessionId === game.sessionId && s.resumed),
      );
      assert.equal(
        (await ok("/api/battles", { user: alice })).battles.find(
          (b) => b.id === battle.id,
        ).ongoing,
        true,
      );
      const other = await begin(bob, battle.id);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT email_order FROM game_sessions WHERE id=ANY($1::int[]) ORDER BY id",
            [[game.sessionId, other.sessionId]],
          )
        ).rows.map((r) => r.email_order),
        Array(2).fill(
          (
            await pool.query("SELECT email_order FROM battles WHERE id=$1", [
              battle.id,
            ])
          ).rows[0].email_order,
        ),
      );
      assert.equal(
        (
          await pool.query("SELECT service_id FROM game_sessions WHERE id=$1", [
            game.sessionId,
          ])
        ).rows[0].service_id,
        b.id,
      );
      const first = await next(alice, game);
      await answer(alice, game, first.emailId);
      const second = await next(alice, game);
      const type = (
        await pool.query("SELECT type FROM emails WHERE id=$1", [
          second.emailId,
        ])
      ).rows[0].type;
      await answer(alice, game, second.emailId, type);
      assert.equal(
        (
          await request("/api/sessions", {
            user: alice,
            method: "POST",
            body: { battleId: battle.id },
          })
        ).status,
        409,
      );
      const late = await user("late");
      await choose(late, a.id);
      assert.equal(
        (
          await request("/api/sessions", {
            user: late,
            method: "POST",
            body: { battleId: battle.id },
          })
        ).status,
        403,
      );
      const closed = await ok(`/api/battles/${battle.id}/close`, {
        user: manager,
        method: "POST",
        body: {},
      });
      const team = closed.results.teams.find((team) => team.id === b.id);
      assert.equal(team.totalScore, 2);
      assert.equal(team.score, Math.round((2 / team.participants) * 100) / 100);
      assert.equal(
        (
          await pool.query("SELECT completed FROM game_sessions WHERE id=$1", [
            other.sessionId,
          ])
        ).rows[0].completed,
        true,
      );
      assert.equal(
        (
          await request(`/api/sessions/${other.sessionId}/next-email`, {
            user: bob,
            token: other.sessionToken,
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "Modération auditée et protection contre une correction périmée",
    async () => {
      const path = `/api/admin/sessions/${game.sessionId}/correction`,
        body = {
          score: 0,
          disqualified: true,
          revision: 0,
          reason: "Triche vérifiée dans la fixture",
        };
      assert.equal(
        (await request(path, { user: alice, method: "POST", body })).status,
        403,
      );
      assert.equal(
        (await request(path, { user: manager, method: "POST", body })).status,
        403,
      );
      await ok(path, { user: admin, method: "POST", body });
      assert.equal(
        (await request(path, { user: admin, method: "POST", body })).status,
        409,
      );
      const adjustments = await ok("/api/admin/score-adjustments", {
        user: admin,
      });
      assert.equal(adjustments.adjustments[0].actor_id, admin.id);
      assert.equal(adjustments.adjustments[0].old_score, 2);
      const results = await ok(`/api/battles/${battle.id}/results`, {
        user: alice,
      });
      assert.equal(
        results.results.players.find((p) => p.player_id === alice.id).score,
        0,
      );
    },
  );
  await t.test(
    "Suppression : nouveau choix et conservation historique",
    async () => {
      await ok(`/api/admin/services/${a.id}`, {
        user: admin,
        method: "DELETE",
      });
      const state = await ok("/api/teams/me", { user: alice });
      assert.equal(state.selectionRequired, true);
      assert.equal(state.currentTeamId, null);
      assert.ok(!state.teams.some((team) => team.id === a.id));
      assert.equal(
        (
          await request("/api/sessions", {
            user: alice,
            method: "POST",
            body: { difficulty: "easy" },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT service_id,service_name FROM game_sessions WHERE id=$1",
            [training.sessionId],
          )
        ).rows[0].service_id,
        a.id,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT service_id FROM battle_participants WHERE battle_id=$1 AND player_id=$2",
            [battle.id, bob.id],
          )
        ).rows[0].service_id,
        a.id,
      );
      await choose(alice, b.id);
    },
  );
  await t.test(
    "Top 10 exact, formule du détail, séquence mensuelle et exclusion des scores historiques",
    async () => {
      const team = (
        await ok(
          "/api/admin/services",
          {
            user: admin,
            method: "POST",
            body: { name: "Classement", code: `C_${run}` },
          },
          201,
        )
      ).service;
      let firstPlayer;
      for (let i = 0; i < 12; i++) {
        const p = (
          await pool.query(
            "INSERT INTO players(name,email,service_id) VALUES($1,$2,$3) RETURNING id",
            [`rank${i}-${run}`, `rank${i}-${run}@example.test`, team.id],
          )
        ).rows[0];
        if (i === 0) firstPlayer = p.id;
        for (const month of ["2026-06-15", "2026-07-15"])
          await pool.query(
            `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,score,current_email_index,completed,ended_at,service_id,service_name,rules_version) VALUES($1,'hardcore','[]',162,$2,$2,TRUE,$3,$4,'Classement',1)`,
            [p.id, i < 10 ? 100 : 10, `${month}T12:00:00Z`, team.id],
          );
      }
      await pool.query(
        `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,score,completed,ended_at,service_id,rules_version) VALUES($1,'hardcore','[]',162,162,TRUE,'2026-07-15T12:00:00Z',$2,0)`,
        [firstPlayer, team.id],
      );
      const ranking = await ok(
          "/api/scores/services?month=2026-07&difficulty=hardcore",
          { user: admin },
        ),
        detail = await ok(
          `/api/scores/services/${team.id}?month=2026-07&difficulty=hardcore`,
          { user: admin },
        );
      assert.equal(
        ranking.scores.find((t) => t.id === team.id).player_count,
        "10",
      );
      assert.equal(detail.top10.length, 10);
      assert.equal(detail.others.length, 2);
      assert.equal(
        Number(ranking.scores.find((t) => t.id === team.id).avg_best_score),
        detail.avgBestScore,
      );
      assert.equal(detail.avgBestScore, 100);
      const players = await ok(
        "/api/scores/players?month=2026-07&difficulty=hardcore",
        { user: admin },
      );
      assert.equal(players.scores.find((p) => p.id === firstPlayer).streak, 2);
      assert.equal(
        (await request("/api/scores/players?month=2026-99", { user: admin }))
          .status,
        400,
      );
    },
  );
  await t.test(
    "Succès atteignables et résultats pédagogiques sans jokers",
    async () => {
      await evaluateAchievements(alice.id, training.sessionId);
      const unlocked = await ok(`/api/players/${alice.id}/achievements`, {
        user: alice,
      });
      assert.ok(
        unlocked.achievements.some((a) => a.key === "top1_easy" && a.unlocked),
      );
      const overview = await ok("/api/admin/stats/overview", { user: admin });
      assert.equal(overview.assistedAnswers, 3);
      assert.equal(overview.evaluatedAnswers, 0);
      assert.equal(overview.timeouts, 1);
      assert.equal(overview.successRate, 0);
      assert.equal(
        (await request("/api/admin/stats/hardest-emails", { user: admin }))
          .status,
        200,
      );
      assert.equal(
        (await request("/api/admin/stats/activity", { user: admin })).status,
        200,
      );
      const profile = await ok(`/api/players/${alice.id}/profile`, {
        user: alice,
      });
      assert.equal(profile.stats.totalCorrect, 0);
      assert.ok(
        !(
          await ok("/api/scores/players?difficulty=easy", { user: alice })
        ).scores.some((p) => p.id === alice.id),
        "Une nouvelle partie abandonnée ne crée pas de record",
      );
    },
  );
  await t.test(
    "Formats de jeu : règles, reprise, scores et statistiques cloisonnés",
    async (t) => {
      const team = (
        await ok(
          "/api/admin/services",
          {
            user: admin,
            method: "POST",
            body: { name: "Modes de jeu", code: "FORMATS_" + run },
          },
          201,
        )
      ).service;
      const actor = await user("chronos"),
        learner = await user("decouverte");
      await choose(actor, team.id);
      await choose(learner, team.id);
      const imported = await ok("/api/admin/emails/import", {
        user: admin,
        method: "POST",
        body: {
          newSet: {
            name: "Chronos " + run,
            status: "ready",
            defaultUsage: "both",
          },
          catalog: Array.from({ length: 32 }, (_, i) => ({
            sender: "Horloges <chrono@example.test>",
            realSender: "chrono@example.test",
            subject: "Chrono " + run + " " + i,
            body: "mot ".repeat(i === 1 ? 60 : i === 2 ? 80 : 40),
            type: i % 2 ? "phishing" : "safe",
            usage: "both",
            clues: ["Indice de vérification pédagogique."],
          })),
        },
      });
      const fixture = (
        await ok("/api/admin/emails?setId=" + imported.set.id, { user: admin })
      ).emails.map((e) => e.id);
      const start = async (
        u,
        format,
        difficulty = "normal",
        duration = 300,
        count = 8,
      ) => {
        const s = await ok(
          "/api/sessions",
          {
            user: u,
            method: "POST",
            body: {
              format,
              difficulty,
              ...(format === "time_attack"
                ? { durationSeconds: duration }
                : {}),
            },
          },
          201,
        );
        await pool.query(
          "UPDATE game_sessions SET email_order=$1,total_emails=$2 WHERE id=$3",
          [JSON.stringify(fixture.slice(0, count)), count, s.sessionId],
        );
        return s;
      };
      const classify = async (u, s, good = true) => {
        const email = await next(u, s),
          type = (
            await pool.query("SELECT type FROM emails WHERE id=$1", [
              email.emailId,
            ])
          ).rows[0].type;
        return answer(
          u,
          s,
          email.emailId,
          good ? type : type === "safe" ? "phishing" : "safe",
        );
      };
      const finish = async (u, s, choices) => {
        let response;
        for (const good of choices) response = await classify(u, s, good);
        return response;
      };
      await t.test(
        "Classique : bons classements humains, SOS, longueurs et trois erreurs",
        async () => {
          const s = await start(actor, "classic", "normal", 300, 8);
          assert.equal(s.rulesVersion, 2);
          // Select short, long, short then short messages explicitly for the clock checks.
          const ordered = (
            await pool.query(
              "SELECT id,body FROM emails WHERE id=ANY($1::int[]) ORDER BY LENGTH(body),id",
              [fixture],
            )
          ).rows;
          const short = ordered.filter(
              (e) => e.body.trim().split(/\s+/).length === 40,
            ),
            long = ordered.find(
              (e) => e.body.trim().split(/\s+/).length === 60,
            );
          const order = [
            short[0].id,
            long.id,
            ...short.slice(1, 7).map((e) => e.id),
          ];
          await pool.query(
            "UPDATE game_sessions SET email_order=$1 WHERE id=$2",
            [JSON.stringify(order), s.sessionId],
          );
          const first = await next(actor, s);
          assert.ok(first.remainingMs > 59000 && first.remainingMs <= 60000);
          await classify(actor, s, false);
          const second = await next(actor, s);
          assert.ok(second.remainingMs > 69000 && second.remainingMs <= 70000);
          await answer(actor, s, second.emailId, "joker");
          const third = await next(actor, s);
          assert.ok(third.remainingMs > 59000 && third.remainingMs <= 60000);
          await classify(actor, s, true);
          const fourth = await next(actor, s);
          assert.ok(fourth.remainingMs > 57000 && fourth.remainingMs <= 58000);
          await pool.query(
            "UPDATE game_sessions SET email_deadline_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
            [s.sessionId],
          );
          const timeout = await answer(actor, s, fourth.emailId, "safe");
          assert.equal(timeout.isTimeout, true);
          assert.equal(timeout.errors, 2);
          const fifth = await next(actor, s);
          assert.ok(fifth.remainingMs > 57000 && fifth.remainingMs <= 58000);
          const ended = await classify(actor, s, false);
          assert.equal(ended.completed, true);
          assert.equal(ended.finishReason, "errors");
          assert.equal(ended.score, 2);
          const battle = await ok(
            "/api/battles",
            {
              user: admin,
              method: "POST",
              body: {
                name: "Battle historique de chrono " + run,
                mode: "individual",
                difficulty: "normal",
                startsAt: new Date(Date.now() - 60000).toISOString(),
                endsAt: new Date(Date.now() + 3600000).toISOString(),
                emailCount: 4,
                maxAttempts: 1,
                jokerLimit: 3,
                playerIds: [actor.id],
              },
            },
            201,
          );
          await pool.query(
            "UPDATE battles SET timer_rules='{\"version\":1}',email_order=$1 WHERE id=$2",
            [JSON.stringify(order.slice(0, 4)), battle.id],
          );
          const legacy = await begin(actor, battle.id);
          assert.equal(legacy.rulesVersion, 1);
          const old = await next(actor, legacy);
          assert.ok(old.remainingMs > 29000 && old.remainingMs <= 30000);
          const resume = await begin(actor, battle.id);
          assert.equal(resume.sessionId, legacy.sessionId);
          assert.deepEqual(
            (await next(actor, legacy)).deadlineAt,
            old.deadlineAt,
          );
          await answer(actor, legacy, old.emailId, "joker");
          const olderLong = await next(actor, legacy);
          assert.ok(
            olderLong.remainingMs > 28000 && olderLong.remainingMs <= 29000,
          );
          await end(actor, legacy);
        },
      );
      await t.test(
        "Découverte : aucun score, aucun chrono, erreurs illimitées et aucun badge",
        async () => {
          const s = await start(learner, "discovery", "easy", 300, 8),
            first = await next(learner, s);
          assert.equal(first.remainingMs, null);
          assert.equal(first.deadlineAt, null);
          assert.equal(first.score, null);
          assert.equal(first.jokerLimit, 0);
          const last = await finish(learner, s, Array(8).fill(false));
          assert.equal(last.errors, 8);
          assert.equal(last.score, null);
          assert.equal(last.completed, true);
          assert.deepEqual(last.newAchievements, []);
          assert.deepEqual(
            await evaluateAchievements(learner.id, s.sessionId),
            [],
          );
          assert.equal(
            (
              await ok("/api/players/" + learner.id + "/profile", {
                user: learner,
              })
            ).stats.gamesPlayed,
            0,
          );
          assert.ok(
            !(await ok("/api/scores/players", { user: learner })).scores.some(
              (r) => r.id === learner.id,
            ),
          );
          assert.equal(
            (
              await ok("/api/sessions/" + s.sessionId + "/recap", {
                user: learner,
              })
            ).session.score,
            null,
          );
        },
      );
      let normal, hard, negativeNormal, negativeHard;
      await t.test(
        "Contre-la-montre : quatre configurations, malus cumulés, négatifs et SOS rejetés",
        async () => {
          normal = await start(actor, "time_attack", "normal", 300, 8);
          const first = await next(actor, normal);
          assert.ok(first.remainingMs > 299000 && first.remainingMs <= 300000);
          assert.equal(
            (
              await request("/api/sessions/" + normal.sessionId + "/answer", {
                user: actor,
                method: "POST",
                token: normal.sessionToken,
                body: { emailId: first.emailId, choice: "joker" },
              })
            ).status,
            400,
          );
          const n = await finish(actor, normal, [
            true,
            true,
            true,
            true,
            true,
            true,
            false,
            false,
          ]);
          assert.equal(n.score, 4);
          assert.equal(n.finishReason, "all_emails");
          hard = await start(actor, "time_attack", "hardcore", 300, 8);
          const h = await finish(actor, hard, [
            false,
            true,
            true,
            false,
            true,
            true,
            true,
            true,
          ]);
          assert.equal(h.score, 3);
          const down = await start(actor, "time_attack", "hardcore", 300, 16);
          const d = await finish(
            actor,
            down,
            Array.from({ length: 16 }, (_, i) => i % 2 === 0),
          );
          assert.equal(d.score, -28);
          assert.equal(d.errors, 8);
          assert.equal(d.gameOver, false);
          negativeNormal = await start(actor, "time_attack", "normal", 600, 1);
          assert.equal(
            (await finish(actor, negativeNormal, [false])).score,
            -1,
          );
          negativeHard = await start(actor, "time_attack", "hardcore", 600, 2);
          assert.equal(
            (await finish(actor, negativeHard, [false, false])).score,
            -3,
          );
          assert.deepEqual(
            await evaluateAchievements(actor.id, negativeHard.sessionId),
            [],
          );
          for (const body of [
            { format: "time_attack", difficulty: "easy", durationSeconds: 300 },
            {
              format: "time_attack",
              difficulty: "normal",
              durationSeconds: 400,
            },
            { format: "discovery", difficulty: "easy", battleId: 1 },
          ])
            assert.equal(
              (
                await request("/api/sessions", {
                  user: actor,
                  method: "POST",
                  body,
                })
              ).status,
              400,
            );
        },
      );
      await t.test(
        "Chrono global : correction, reprise, concurrence et expiration sans interaction",
        async () => {
          const s = await start(actor, "time_attack", "normal", 300, 8),
            first = await next(actor, s);
          const type = (
            await pool.query("SELECT type FROM emails WHERE id=$1", [
              first.emailId,
            ])
          ).rows[0].type;
          const opts = {
            user: actor,
            token: s.sessionToken,
            method: "POST",
            body: { emailId: first.emailId, choice: type },
          };
          const responses = await Promise.all([
            request("/api/sessions/" + s.sessionId + "/answer", opts),
            request("/api/sessions/" + s.sessionId + "/answer", opts),
          ]);
          responses.forEach((r) => {
            assert.equal(r.status, 200);
            assert.equal(r.data.score, 1);
          });
          const state = await ok("/api/sessions/" + s.sessionId + "/state", {
            user: actor,
          });
          assert.equal(state.stats.answers, 1);
          assert.equal(state.deadlineAt, first.deadlineAt);
          const resumed = await ok(
            "/api/sessions",
            {
              user: actor,
              method: "POST",
              body: {
                format: "time_attack",
                difficulty: "normal",
                durationSeconds: 300,
              },
            },
            201,
          );
          assert.equal(resumed.sessionId, s.sessionId);
          assert.equal(resumed.deadlineAt, first.deadlineAt);
          const second = await next(actor, s);
          assert.equal(second.deadlineAt, first.deadlineAt);
          assert.ok(second.remainingMs < first.remainingMs);
          await end(actor, s);
          const zero = await start(actor, "time_attack", "normal", 300, 8),
            shown = await next(actor, zero);
          await pool.query(
            "UPDATE game_sessions SET global_deadline_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
            [zero.sessionId],
          );
          const stop = require("../src/services/gameRules").startExpiryWorker();
          try {
            await new Promise((r) => setTimeout(r, 1150));
          } finally {
            stop();
          }
          assert.equal(
            (
              await pool.query(
                "SELECT completed FROM game_sessions WHERE id=$1",
                [zero.sessionId],
              )
            ).rows[0].completed,
            true,
            "La clôture a lieu sans requête du joueur",
          );
          const late = await answer(actor, zero, shown.emailId, "safe");
          assert.equal(late.timeUp, true);
          assert.equal(late.score, 0);
          assert.equal(late.stats.answers, 0);
          assert.equal(late.finishReason, "time_up");
          const resumedResult = await ok(
            "/api/sessions/" + zero.sessionId + "/state",
            { user: actor },
          );
          assert.equal(resumedResult.completed, true);
          assert.equal(
            (
              await request("/api/sessions/" + zero.sessionId + "/state", {
                user: learner,
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        "Hall of Fame et profils : combinaisons séparées, moyenne top 10, modération signée",
        async () => {
          for (const [duration, difficulty, value] of [
            [300, "normal", 4],
            [300, "hardcore", 3],
            [600, "normal", -1],
            [600, "hardcore", -3],
          ]) {
            const scores = await ok(
              "/api/scores/time-attack/players?duration=" +
                duration +
                "&difficulty=" +
                difficulty,
              { user: actor },
            );
            assert.equal(
              scores.scores.find((r) => r.id === actor.id).best_score,
              value,
            );
            const teams = await ok(
              "/api/scores/time-attack/services?duration=" +
                duration +
                "&difficulty=" +
                difficulty,
              { user: actor },
            );
            assert.equal(
              teams.scores.find((r) => r.id === team.id).avg_best_score,
              value,
            );
            const detail = await ok(
              "/api/scores/time-attack/services/" +
                team.id +
                "/detail?duration=" +
                duration +
                "&difficulty=" +
                difficulty,
              { user: actor },
            );
            assert.equal(detail.avgBestScore, value);
          }
          const before = await ok("/api/players/" + actor.id + "/profile", {
            user: actor,
          });
          assert.ok(
            before.battles.some((b) =>
              b.name.startsWith("Battle historique de chrono"),
            ),
          );
          assert.deepEqual(
            (await ok(`/api/players/${actor.id}/profile`, { user: learner }))
              .battles,
            [],
            "Les compétitions privées ne sont pas exposées sur le profil d’autrui",
          );
          assert.equal(before.stats.bestScore, 2);
          assert.equal(
            before.formats.filter((r) => r.family === "time_attack").length,
            4,
          );
          assert.ok(
            !(await ok("/api/scores/players", { user: actor })).scores.some(
              (r) => r.id === actor.id && r.best_score === 4,
            ),
          );
          await ok(
            "/api/admin/sessions/" + negativeHard.sessionId + "/correction",
            {
              user: admin,
              method: "POST",
              body: {
                score: -2,
                revision: 0,
                disqualified: false,
                reason: "Correction signée de vérification",
              },
            },
          );
          assert.equal(
            (
              await ok(
                "/api/scores/time-attack/players?duration=600&difficulty=hardcore",
                { user: actor },
              )
            ).scores.find((r) => r.id === actor.id).best_score,
            -2,
          );
          assert.equal(
            (
              await request(
                "/api/admin/sessions/" + normal.sessionId + "/correction",
                {
                  user: admin,
                  method: "POST",
                  body: {
                    score: -100,
                    revision: 0,
                    disqualified: false,
                    reason: "Hors borne",
                  },
                },
              )
            ).status,
            400,
          );
          const stats = await ok(
            "/api/admin/stats/overview?family=time_attack&duration=600&difficulty=hardcore",
            { user: admin },
          );
          assert.equal(stats.formats.length, 1);
          assert.equal(stats.formats[0].best_score, -2);
          assert.equal(stats.assistedAnswers, 0);
          assert.equal(
            (
              await request(
                "/api/admin/stats/hardest-emails?family=discovery",
                { user: admin },
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                "/api/admin/stats/activity?family=time_attack&duration=600",
                { user: admin },
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "Contre-la-montre : top 10 négatif et départage par bonnes réponses",
        async () => {
          const team = (
            await ok(
              "/api/admin/services",
              {
                user: admin,
                method: "POST",
                body: { name: "Classement négatif", code: "NEG_" + run },
              },
              201,
            )
          ).service;
          const players = [];
          for (let i = 1; i <= 12; i++) {
            const player = (
              await pool.query(
                "INSERT INTO players(name,email,service_id) VALUES($1,$2,$3) RETURNING id",
                [
                  "NEG" + i + "_" + run,
                  "neg" + i + "_" + run + "@example.test",
                  team.id,
                ],
              )
            ).rows[0];
            players.push(player.id);
            await pool.query(
              `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,score,current_email_index,completed,ended_at,service_id,service_name,rules_version,game_format,duration_seconds,human_correct,errors,finish_reason)
            VALUES($1,'normal','[]',32,$2,$3,TRUE,clock_timestamp(),$4,'Classement négatif',2,'time_attack',600,0,$3,'all_emails')`,
              [player.id, -i, i, team.id],
            );
          }
          await pool.query(
            `INSERT INTO game_sessions(player_id,difficulty,email_order,total_emails,score,current_email_index,completed,ended_at,service_id,service_name,rules_version,game_format,duration_seconds,human_correct,errors,finish_reason)
          VALUES($1,'normal','[]',32,-1,5,TRUE,clock_timestamp(),$2,'Classement négatif',2,'time_attack',600,2,3,'all_emails')`,
            [players[0], team.id],
          );
          const ranking = await ok(
            "/api/scores/time-attack/players?duration=600&difficulty=normal",
            { user: actor },
          );
          assert.equal(
            ranking.scores.find((r) => r.id === players[0]).good_answers,
            2,
          );
          const detail = await ok(
            "/api/scores/time-attack/services/" +
              team.id +
              "/detail?duration=600&difficulty=normal",
            { user: actor },
          );
          assert.equal(detail.top10.length, 10);
          assert.equal(detail.others.length, 2);
          assert.equal(detail.avgBestScore, -5.5);
          const services = await ok(
            "/api/scores/time-attack/services?duration=600&difficulty=normal",
            { user: actor },
          );
          assert.equal(
            services.scores.find((r) => r.id === team.id).avg_best_score,
            -5.5,
          );
        },
      );
    },
  );

  await t.test(
    "Limite de réponses par compte et déconnexion effective",
    async () => {
      await choose(bob, b.id);
      const s = await begin(bob),
        email = await next(bob, s);
      answerLimiter.resetKey(`player:${bob.id}`);
      const path = `/api/sessions/${s.sessionId}/answer`,
        opts = {
          user: bob,
          token: s.sessionToken,
          method: "POST",
          body: { emailId: email.emailId, choice: "joker" },
        };
      for (let i = 0; i < 10; i++)
        assert.equal((await request(path, opts)).status, 200);
      assert.equal((await request(path, opts)).status, 429);
      const aliceSession = await begin(alice),
        aliceEmail = await next(alice, aliceSession);
      assert.equal(
        (
          await request(`/api/sessions/${aliceSession.sessionId}/answer`, {
            user: alice,
            token: aliceSession.sessionToken,
            method: "POST",
            body: { emailId: aliceEmail.emailId, choice: "joker" },
          })
        ).status,
        200,
      );
      await ok("/api/auth/logout", { user: bob, method: "POST", body: {} });
      assert.equal((await request("/api/auth/me", { user: bob })).status, 401);
    },
  );
});
