"use strict";
const { HttpError, integer, text } = require("../lib/http");
const CATALOG_LOCK = 817415;
const USAGES = ["training", "battle", "both"];
function setInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "Définition du set invalide");
  const defaultUsage = body.defaultUsage ?? "training",
    status = body.status ?? "draft";
  if (
    !USAGES.includes(defaultUsage) ||
    !["draft", "ready", "archived"].includes(status)
  )
    throw new HttpError(400, "Disponibilité ou état du set invalide");
  return {
    name: text(body.name, "Nom du set", 100),
    description: text(body.description ?? "", "Description", 1000, 0),
    defaultUsage,
    status,
  };
}
async function event(
  client,
  actorId,
  operation,
  setId,
  details = {},
  added = 0,
  removed = 0,
) {
  await client.query(
    "INSERT INTO mail_catalog_events(actor_id,operation,set_id,details,added,removed) VALUES($1,$2,$3,$4,$5,$6)",
    [
      actorId || null,
      operation,
      setId || null,
      JSON.stringify(details),
      added,
      removed,
    ],
  );
}
async function getSet(client, value, allowArchived = false) {
  const set = (
    await client.query("SELECT * FROM mail_sets WHERE id=$1", [
      integer(value, "Set"),
    ])
  ).rows[0];
  if (!set || (!allowArchived && set.status === "archived"))
    throw new HttpError(404, "Set introuvable ou archivé");
  return set;
}
async function saveSet(client, input, actorId, id = null) {
  const fields = setInput(input);
  await client.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
  const before = id ? await getSet(client, id, true) : null;
  let set;
  try {
    set = (
      await client.query(
        id
          ? "UPDATE mail_sets SET name=$1,description=$2,default_usage=$3,status=$4,updated_at=NOW() WHERE id=$5 RETURNING *"
          : "INSERT INTO mail_sets(name,description,default_usage,status) VALUES($1,$2,$3,$4) RETURNING *",
        id
          ? [
              fields.name,
              fields.description,
              fields.defaultUsage,
              fields.status,
              id,
            ]
          : [
              fields.name,
              fields.description,
              fields.defaultUsage,
              fields.status,
            ],
      )
    ).rows[0];
  } catch (error) {
    if (error.code === "23505")
      throw new HttpError(409, "Un set non archivé porte déjà ce nom");
    throw error;
  }
  await event(client, actorId, "set", set.id, { before, after: set });
  return set;
}
async function listSets(client, readyOnly = false) {
  return (
    await client.query(
      `SELECT s.*,
    COUNT(e.id)::int AS total,
    COUNT(e.id) FILTER(WHERE e.type='safe')::int AS safe,
    COUNT(e.id) FILTER(WHERE e.type='phishing')::int AS phishing,
    COUNT(e.id) FILTER(WHERE e.usage IN ('training','both'))::int AS training,
    COUNT(e.id) FILTER(WHERE e.usage IN ('battle','both'))::int AS battle,
    COUNT(e.id) FILTER(WHERE e.usage='battle')::int AS battle_only,
    COUNT(e.id) FILTER(WHERE e.usage='both')::int AS shared,
    COUNT(e.id) FILTER(WHERE e.usage IN ('battle','both') AND e.type='safe')::int AS battle_safe,
    COUNT(e.id) FILTER(WHERE e.usage IN ('battle','both') AND e.type='phishing')::int AS battle_phishing,
    COUNT(e.id) FILTER(WHERE e.usage='battle' AND e.type='safe')::int AS battle_only_safe,
    COUNT(e.id) FILTER(WHERE e.usage='battle' AND e.type='phishing')::int AS battle_only_phishing,
    (SELECT MAX(created_at) FROM mail_catalog_events WHERE set_id=s.id AND operation IN ('import','replace')) AS last_imported_at,
    (SELECT COUNT(*)::int FROM battles b WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(b.mail_selection->'sets','[]'::jsonb)) x WHERE (x->>'id')::integer=s.id)) AS battles_used
    FROM mail_sets s LEFT JOIN mail_set_emails m ON m.set_id=s.id
    LEFT JOIN emails e ON e.id=m.email_id AND e.archived_at IS NULL
    WHERE ($1::boolean=FALSE OR s.status='ready') GROUP BY s.id ORDER BY s.status='archived',LOWER(s.name),s.id`,
      [readyOnly],
    )
  ).rows;
}
module.exports = {
  CATALOG_LOCK,
  USAGES,
  setInput,
  getSet,
  saveSet,
  listSets,
  event,
};
