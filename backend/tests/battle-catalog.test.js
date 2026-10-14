"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { allocate } = require("../src/services/battleCatalog");
test("Composition équilibrée : les mails communs sont réaffectés sans doublons", () => {
  const emails = [
    { id: 1, type: "safe", setIds: [1, 2] },
    { id: 2, type: "safe", setIds: [1] },
    { id: 3, type: "phishing", setIds: [2] },
  ];
  const selected = allocate(
    emails,
    [
      { setId: 1, count: 1 },
      { setId: 2, count: 2 },
    ],
    2,
  );
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((a) => a.email.id)).size, 3);
  assert.deepEqual(
    selected.filter((a) => a.setId === 1).map((a) => a.email.id),
    [2],
  );
  assert.deepEqual(
    selected
      .filter((a) => a.setId === 2)
      .map((a) => a.email.id)
      .sort(),
    [1, 3],
  );
});
test("Une quantité impossible à cause des chevauchements est refusée", () => {
  assert.throws(
    () =>
      allocate(
        [
          { id: 1, type: "safe", setIds: [1, 2] },
          { id: 2, type: "phishing", setIds: [1, 2] },
        ],
        [
          { setId: 1, count: 2 },
          { setId: 2, count: 1 },
        ],
        1,
      ),
    /Composition impossible/,
  );
});
test("Le nombre de légitimes ne peut pas être compensé par des phishing", () => {
  assert.throws(
    () =>
      allocate(
        [
          { id: 1, type: "phishing", setIds: [1] },
          { id: 2, type: "phishing", setIds: [1] },
        ],
        [{ setId: 1, count: 2 }],
        1,
      ),
    /Composition impossible/,
  );
  const selected = allocate(
    [
      { id: 1, type: "phishing", setIds: [1] },
      { id: 2, type: "phishing", setIds: [1] },
    ],
    [{ setId: 1, count: 2 }],
    0,
  );
  assert.equal(selected.length, 2);
});
