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
      assert.equal(overview.evaluatedAnswers, 1);
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
      assert.equal(
        (
          await ok("/api/scores/players?difficulty=easy", { user: alice })
        ).scores.find((p) => p.id === alice.id).name,
        "Collaborateur 1",
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
