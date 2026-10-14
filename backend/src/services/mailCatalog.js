"use strict";
const { createHash } = require("node:crypto");
const { HttpError, integer, text } = require("../lib/http");
const {
  CATALOG_LOCK,
  getSet,
  setInput,
  saveSet,
  event,
} = require("./mailSets");
const MAX_MAILS = 5000;
function normalizeEmails(input, defaultUsage = "training") {
  const rows = Array.isArray(input) ? input : input?.emails;
  if (!Array.isArray(input) && input?.schemaVersion !== 1)
    throw new HttpError(
      400,
      "Version JSON inconnue : schemaVersion doit valoir 1",
    );
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_MAILS)
    throw new HttpError(
      400,
      `Importez entre 1 et ${MAX_MAILS} mails à la fois`,
    );
  return rows.map((row, index) => {
    const label = `Mail ${index + 1}`;
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new HttpError(400, `${label} : objet JSON requis`);
    if (!["safe", "phishing"].includes(row.type))
      throw new HttpError(400, `${label} : type safe ou phishing requis`);
    const usage = row.usage ?? defaultUsage;
    if (!["training", "battle", "both"].includes(usage))
      throw new HttpError(
        400,
        `${label} : usage training, battle ou both requis`,
      );
    if (
      !Array.isArray(row.clues) ||
      row.clues.length > 8 ||
      (row.type === "phishing" && !row.clues.length)
    )
      throw new HttpError(
        400,
        `${label} : 1 à 8 indices pour le phishing, 0 à 8 pour un mail légitime`,
      );
    if (
      typeof row.body !== "string" ||
      !row.body.trim() ||
      row.body.length > 6000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(row.body)
    )
      throw new HttpError(
        400,
        `${label} : contenu requis, 6 000 caractères maximum`,
      );
    const email = {
      sender: text(row.sender, `${label} : expéditeur`, 300),
      realSender: text(row.realSender, `${label} : enveloppe SMTP`, 300),
      subject: text(row.subject, `${label} : sujet`, 300),
      body: row.body.trim(),
      type: row.type,
      usage,
      clues: row.clues.map((c) => text(c, `${label} : indice`, 500)),
    };
    // Availability and collection membership are metadata, not question content.
    const { usage: ignored, ...content } = email;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex");
    return { ...email, fingerprint };
  });
}
function mailIds(input) {
  if (!Array.isArray(input) || !input.length || input.length > 5000)
    throw new HttpError(400, "Sélectionnez entre 1 et 5 000 mails");
  return [...new Set(input.map((id) => integer(id, "Mail")))];
}
async function importEmails(
  client,
  input,
  { replace = false, preview = false, actorId, setId, newSet } = {},
) {
  await client.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
  if (setId !== undefined && newSet !== undefined)
    throw new HttpError(400, "Choisissez un set existant ou un nouveau set");
  let target;
  if (setId !== undefined) target = await getSet(client, setId);
  else {
    const spec =
      newSet === undefined
        ? {
            name: "Catalogue général",
            description: "Imports réalisés sans destination explicite.",
            defaultUsage: "training",
            status: "ready",
          }
        : setInput(newSet);
    if (spec.status === "archived")
      throw new HttpError(400, "Import impossible dans un set archivé");
    const existing = (
      await client.query(
        "SELECT * FROM mail_sets WHERE LOWER(name)=LOWER($1) AND status<>'archived'",
        [spec.name],
      )
    ).rows[0];
    if (existing && newSet !== undefined)
      throw new HttpError(
        409,
        "Ce set existe déjà : choisissez-le pour le compléter",
      );
    target = existing || {
      name: spec.name,
      description: spec.description,
      default_usage: spec.defaultUsage,
      status: spec.status,
    };
  }
  const normalized = normalizeEmails(input, target.default_usage);
  const current = (
    await client.query(`SELECT e.id,e.sender,e.real_sender AS "realSender",e.subject,e.body,e.type,e.usage,e.fingerprint,
    COALESCE((SELECT jsonb_agg(clue_text ORDER BY display_order) FROM email_clues WHERE email_id=e.id),'[]') AS clues
    FROM emails e WHERE archived_at IS NULL ORDER BY e.id`)
  ).rows;
  const existingByContent = new Map();
  for (const email of current) {
    try {
      const key = normalizeEmails([email])[0].fingerprint;
      if (!existingByContent.has(key)) existingByContent.set(key, email);
    } catch {
      /* Historical questions outside the current schema remain intact. */
    }
  }
  const members = target.id
    ? (
        await client.query(
          "SELECT e.id FROM mail_set_emails m JOIN emails e ON e.id=m.email_id WHERE m.set_id=$1 AND e.archived_at IS NULL",
          [target.id],
        )
      ).rows.map((e) => e.id)
    : [];
  const memberIds = new Set(members);
  const unique = [
    ...new Map(normalized.map((e) => [e.fingerprint, e])).values(),
  ];
  const additions = unique.filter((e) => !existingByContent.has(e.fingerprint));
  const reused = unique
    .map((e) => existingByContent.get(e.fingerprint))
    .filter(Boolean);
  const incomingIds = new Set(reused.map((e) => e.id));
  const detached = replace ? members.filter((id) => !incomingIds.has(id)) : [];
  const retired = detached.length
    ? (
        await client.query(
          `SELECT e.id FROM emails e WHERE e.id=ANY($1::int[])
    AND NOT EXISTS(SELECT 1 FROM mail_set_emails m WHERE m.email_id=e.id AND m.set_id<>$2)`,
          [detached, target.id],
        )
      ).rows.map((e) => e.id)
    : [];
  const linked =
    additions.length + reused.filter((e) => !memberIds.has(e.id)).length;
  const summary = {
    added: additions.length,
    reused: reused.length,
    duplicates:
      normalized.length -
      additions.length -
      reused.filter((e) => !memberIds.has(e.id)).length,
    linked,
    detached: detached.length,
    removed: retired.length,
    total: current.length - retired.length + additions.length,
    setTotal: replace ? unique.length : members.length + linked,
    safe: unique.filter((e) => e.type === "safe").length,
    phishing: unique.filter((e) => e.type === "phishing").length,
    usageConflicts: unique.filter(
      (e) =>
        existingByContent.has(e.fingerprint) &&
        existingByContent.get(e.fingerprint).usage !== e.usage,
    ).length,
    set: { id: target.id || null, name: target.name, status: target.status },
  };
  if (summary.total > MAX_MAILS)
    throw new HttpError(400, "Le catalogue est limité à 5 000 mails actifs");
  if (preview) return { ...summary, preview: true };
  if (!target.id)
    target = await saveSet(
      client,
      {
        name: target.name,
        description: target.description,
        defaultUsage: target.default_usage,
        status: target.status,
      },
      actorId,
    );
  if (replace)
    await client.query("DELETE FROM mail_set_emails WHERE set_id=$1", [
      target.id,
    ]);
  if (retired.length)
    await client.query(
      "UPDATE emails SET archived_at=NOW() WHERE id=ANY($1::int[])",
      [retired],
    );
  let inserted = [];
  if (additions.length) {
    inserted = (
      await client.query(
        `INSERT INTO emails(sender,real_sender,subject,body,type,usage,fingerprint)
      SELECT e->>'sender',e->>'realSender',e->>'subject',e->>'body',e->>'type',e->>'usage',e->>'fingerprint'
      FROM jsonb_array_elements($1::jsonb) e RETURNING id,fingerprint`,
        [JSON.stringify(additions)],
      )
    ).rows;
    const ids = new Map(inserted.map((e) => [e.fingerprint, e.id]));
    const clues = additions.flatMap((e) =>
      e.clues.map((clue, index) => ({
        id: ids.get(e.fingerprint),
        clue,
        index,
      })),
    );
    if (clues.length)
      await client.query(
        `INSERT INTO email_clues(email_id,clue_text,display_order)
      SELECT (c->>'id')::integer,c->>'clue',(c->>'index')::integer FROM jsonb_array_elements($1::jsonb) c`,
        [JSON.stringify(clues)],
      );
  }
  const ids = [...incomingIds, ...inserted.map((e) => e.id)];
  await client.query(
    "INSERT INTO mail_set_emails(set_id,email_id) SELECT $1,UNNEST($2::int[]) ON CONFLICT DO NOTHING",
    [target.id, ids],
  );
  await client.query("UPDATE mail_sets SET updated_at=NOW() WHERE id=$1", [
    target.id,
  ]);
  summary.set.id = target.id;
  await event(
    client,
    actorId,
    replace ? "replace" : "import",
    target.id,
    summary,
    summary.added,
    summary.removed,
  );
  return summary;
}
module.exports = { CATALOG_LOCK, normalizeEmails, mailIds, importEmails };
