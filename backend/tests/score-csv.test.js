"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
// Execute the actual CSV exporter, isolating only its browser download sink.
const source = fs.readFileSync(
  path.join(__dirname, "../../frontend/scores.js"),
  "utf8",
);
const start = source.indexOf("function exportCsv("),
  end = source.indexOf('\ndocument.querySelectorAll(".csv-export-btn")', start);
assert.ok(start >= 0 && end > start);
async function exported(type, row) {
  let blob, filename;
  const anchor = {
    click() {
      filename = this.download;
    },
  };
  const context = {
    lastData: { [type]: [row] },
    scoreFormat: "time_attack",
    scoreDuration: 600,
    scoreSetId: "7",
    activeDifficulty: "hardcore",
    Blob,
    setTimeout: (work) => work(),
    Date,
    document: {
      createElement: () => anchor,
      getElementById: () => ({
        selectedOptions: [{ textContent: "Set express" }],
      }),
    },
    URL: {
      createObjectURL(value) {
        blob = value;
        return "blob:test";
      },
      revokeObjectURL() {},
    },
    alert() {
      throw Error("Unexpected empty export");
    },
  };
  vm.runInNewContext(
    source.slice(start, end) + `;exportCsv('${type}');`,
    context,
  );
  return { csv: await blob.text(), filename };
}
test("CSV Contre-la-montre : score négatif numérique et configuration explicite", async () => {
  const { csv, filename } = await exported("players-global", {
    name: "=SOMME(1;2)",
    service_name: "QA",
    best_score: -28,
    good_answers: 8,
    errors: 8,
    games_played: 1,
  });
  assert.match(filename, /time_attack-600-hardcore/);
  assert.match(filename, /set-7/);
  assert.ok(csv.includes("Contre-la-montre"));
  assert.ok(csv.includes('"Set express"'));
  assert.ok(csv.includes('"10";"Difficile"'));
  assert.ok(csv.includes('"-28"'));
  assert.ok(!csv.includes('"\'-28"'));
  assert.ok(
    csv.includes('"\'=SOMME(1;2)"'),
    "Les formules provenant du pseudo restent neutralisées",
  );
});
test("CSV des équipes : moyenne négative conservée", async () => {
  const { csv } = await exported("services-global", {
    name: "QA",
    code: "QA",
    avg_best_score: -5.5,
    player_count: 12,
  });
  assert.ok(csv.includes('"-5.5"'));
  assert.ok(!csv.includes('"\'-5.5"'));
});
