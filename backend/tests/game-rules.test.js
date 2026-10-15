"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  visibleWords,
  classicSeconds,
  timeAttackScore,
} = require("../src/services/gameRules");
const body = (n) => "mot ".repeat(n);
const seconds = (difficulty, count, words = 40) =>
  classicSeconds(
    {
      difficulty,
      human_correct: count,
      score: count,
      timer_rules: { version: 2 },
    },
    body(words),
  );
test("Chronos classiques : progression humaine, planchers et longueur indépendante", () => {
  assert.deepEqual(
    [40, 60, 80].map((n) => seconds("easy", 0, n)),
    [60, 70, 80],
  );
  assert.deepEqual(
    [0, 1, 5, 13].map((n) => seconds("normal", n)),
    [60, 58, 50, 35],
  );
  assert.deepEqual(
    [0, 1, 10].map((n) => seconds("hardcore", n)),
    [45, 43, 25],
  );
  assert.deepEqual(
    [50, 51, 70, 71].map((n) => seconds("normal", 5, n)),
    [50, 60, 60, 70],
  );
  assert.equal(seconds("normal", 5, 40), 50);
  assert.equal(
    visibleWords(
      body(49) +
        `<a href="https://example.test/${body(200)}" data-real-link="${body(100)}">Consulter</a>`,
    ),
    50,
  );
  assert.equal(
    classicSeconds(
      {
        difficulty: "normal",
        human_correct: 0,
        score: 2,
        timer_rules: { version: 2 },
      },
      body(40),
    ),
    60,
    "Les SOS ne font pas décroître le chrono",
  );
});
test("Chronos historiques : mêmes règles, aucun bonus rétroactif", () => {
  assert.equal(
    classicSeconds(
      { difficulty: "easy", score: 10, timer_rules: { version: 1 } },
      body(80),
    ),
    30,
  );
  assert.equal(
    classicSeconds(
      { difficulty: "normal", score: 3, timer_rules: { version: 1 } },
      body(80),
    ),
    27,
  );
  assert.equal(
    classicSeconds(
      { difficulty: "hardcore", score: 50, timer_rules: { version: 1 } },
      body(80),
    ),
    5,
  );
});
test("Contre-la-montre : formules signées, erreurs cumulées", () => {
  for (const [good, bad, normal, hard] of [
    [4, 0, 4, 4],
    [6, 2, 4, 3],
    [8, 8, 0, -28],
    [7, 3, 4, 1],
  ]) {
    assert.equal(timeAttackScore(good, bad, "normal"), normal);
    assert.equal(timeAttackScore(good, bad, "hardcore"), hard);
  }
});
