"use strict";
const crypto = require("node:crypto");
const { HttpError, integer } = require("../lib/http");
const { CATALOG_LOCK } = require("./mailSets");
function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// A capacity-constrained matching assigns shared questions to exactly one set.
// Reassignment through residual edges avoids greedy failures with overlapping sets.
function allocate(emails, selections, safeCount) {
  const unique = [...new Map(emails.map((e) => [e.id, e])).values()];
  const setStart = 3 + unique.length,
    sink = setStart + selections.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  function edge(from, to, capacity) {
    const direct = { to, capacity, reverse: graph[to].length };
    const reverse = { to: from, capacity: 0, reverse: graph[from].length };
    graph[from].push(direct);
    graph[to].push(reverse);
    return direct;
  }
  const total = selections.reduce((n, s) => n + s.count, 0);
  edge(0, 1, safeCount);
  edge(0, 2, total - safeCount);
  const assignments = [];
  shuffle(unique).forEach((email, i) => {
    const node = 3 + i;
    edge(email.type === "safe" ? 1 : 2, node, 1);
    for (const index of shuffle(selections.map((_, i) => i))) {
      if (email.setIds.includes(selections[index].setId))
        assignments.push({
          email,
          index,
          edge: edge(node, setStart + index, 1),
        });
    }
  });
  selections.forEach((s, i) => edge(setStart + i, sink, s.count));
  let flow = 0;
  while (flow < total) {
    const parents = new Int32Array(graph.length).fill(-1),
      edges = new Int32Array(graph.length);
    const queue = [0];
    parents[0] = 0;
    for (let head = 0; head < queue.length && parents[sink] === -1; head++) {
      const node = queue[head];
      graph[node].forEach((e, index) => {
        if (e.capacity > 0 && parents[e.to] === -1) {
          parents[e.to] = node;
          edges[e.to] = index;
          queue.push(e.to);
        }
      });
    }
    if (parents[sink] === -1)
      throw new HttpError(
        400,
        "Composition impossible : vérifiez les quantités par set, le nombre de mails légitimes et les mails communs entre sets.",
      );
    for (let node = sink; node !== 0; node = parents[node]) {
      const from = parents[node],
        e = graph[from][edges[node]];
      e.capacity--;
      graph[node][e.reverse].capacity++;
    }
    flow++;
  }
  return assignments
    .filter((a) => a.edge.capacity === 0)
    .map((a) => ({ email: a.email, setId: selections[a.index].setId }));
}
async function selectBattleEmails(client, body) {
  const count = integer(body.emailCount ?? 20, "Nombre d’emails", { max: 162 });
  await client.query("SELECT pg_advisory_xact_lock_shared($1)", [CATALOG_LOCK]);
  // Compatibility for integrations predating sets; the new UI always selects sets.
  if (body.sets === undefined) {
    const available = (
      await client.query(`SELECT e.id FROM emails e WHERE e.archived_at IS NULL AND e.usage IN ('battle','both')
      AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id WHERE m.email_id=e.id AND s.status='ready') ORDER BY e.id`)
    ).rows.map((e) => e.id);
    if (count > available.length)
      throw new HttpError(
        400,
        "Pas assez de mails disponibles pour les battles. Demandez à l’administrateur d’en importer dans un set prêt.",
      );
    return { order: shuffle(available).slice(0, count), composition: null };
  }
  if (!Array.isArray(body.sets) || !body.sets.length || body.sets.length > 20)
    throw new HttpError(400, "Choisissez entre 1 et 20 sets");
  const selections = body.sets.map((s) => ({
    setId: integer(s?.setId, "Set"),
    count: integer(s?.count, "Quantité par set", { max: 162 }),
  }));
  if (new Set(selections.map((s) => s.setId)).size !== selections.length)
    throw new HttpError(400, "Un set ne peut être sélectionné qu’une fois");
  if (selections.reduce((n, s) => n + s.count, 0) !== count)
    throw new HttpError(
      400,
      "Le total des quantités par set doit correspondre au nombre d’emails",
    );
  if (
    body.excludeTraining !== undefined &&
    typeof body.excludeTraining !== "boolean"
  )
    throw new HttpError(400, "excludeTraining doit être un booléen");
  const safeCount = integer(
    body.safeCount ?? Math.floor(count / 2),
    "Mails légitimes",
    { min: 0, max: count },
  );
  const ids = selections.map((s) => s.setId);
  const sets = (
    await client.query(
      "SELECT id,name,updated_at FROM mail_sets WHERE id=ANY($1::int[]) AND status='ready'",
      [ids],
    )
  ).rows;
  if (sets.length !== ids.length)
    throw new HttpError(
      409,
      "Un set est absent, en brouillon ou archivé : actualisez la liste",
    );
  const rows = (
    await client.query(
      `SELECT e.id,e.type,e.usage,array_agg(m.set_id ORDER BY m.set_id) AS set_ids
    FROM emails e JOIN mail_set_emails m ON m.email_id=e.id WHERE e.archived_at IS NULL AND m.set_id=ANY($1::int[])
    AND (e.usage='battle' OR (e.usage='both' AND $2::boolean=FALSE)) GROUP BY e.id ORDER BY e.id`,
      [ids, !!body.excludeTraining],
    )
  ).rows;
  const emails = rows.map((e) => ({ ...e, setIds: e.set_ids }));
  const assignments = allocate(emails, selections, safeCount);
  const composition = {
    total: count,
    safe: safeCount,
    phishing: count - safeCount,
    excludeTraining: !!body.excludeTraining,
    sharedAvailable: emails.filter((e) => e.usage === "both").length,
    sharedSelected: assignments.filter((a) => a.email.usage === "both").length,
    sets: selections.map((s) => {
      const metadata = sets.find((x) => x.id === s.setId),
        selected = assignments.filter((a) => a.setId === s.setId);
      return {
        id: s.setId,
        name: metadata.name,
        updatedAt: metadata.updated_at,
        count: s.count,
        safe: selected.filter((a) => a.email.type === "safe").length,
        phishing: selected.filter((a) => a.email.type === "phishing").length,
        available: emails.filter((e) => e.setIds.includes(s.setId)).length,
      };
    }),
  };
  return { order: shuffle(assignments.map((a) => a.email.id)), composition };
}
module.exports = { allocate, selectBattleEmails };
