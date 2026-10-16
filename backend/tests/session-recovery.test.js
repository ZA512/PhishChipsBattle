"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "../../frontend/session-recovery.js"),
    "utf8",
  ),
  context,
);
const { load } = context.window.PCBRecovery;
test("Rejouer ignore une tentative abandonnée ou terminée, sans repasser par le résultat", async () => {
  for (const finishReason of ["abandoned", "errors", "all_emails", "time_up"]) {
    let discarded = 0;
    const result = await load({
      id: "42",
      request: async (url) => {
        assert.equal(url, "/api/sessions/42/state");
        return { sessionId: 42, completed: true, finishReason };
      },
      discard: () => discarded++,
    });
    assert.equal(result, undefined);
    assert.equal(discarded, 1);
  }
});
test("Une reprise conserve la tentative active ; consulter un résultat reste explicite", async () => {
  for (const completed of [false, true]) {
    const state = { sessionId: 42, completed };
    assert.equal(
      await load({
        id: "42",
        request: async () => state,
        viewResult: completed,
        discard: () =>
          assert.fail("Une reprise active ou une consultation ne s’efface pas"),
      }),
      state,
    );
  }
});
test("Une reprise périmée s’efface, les erreurs réseau ou d’accès restent visibles", async () => {
  for (const status of [404, 410, 401, 403, 500]) {
    let discarded = 0;
    const error = Object.assign(new Error("Test"), { status });
    const attempt = load({
      id: "42",
      request: async () => {
        throw error;
      },
      discard: () => discarded++,
    });
    if ([404, 410].includes(status)) {
      assert.equal(await attempt, undefined);
      assert.equal(discarded, 1);
    } else {
      await assert.rejects(attempt, (e) => e === error);
      assert.equal(discarded, 0);
    }
  }
});
