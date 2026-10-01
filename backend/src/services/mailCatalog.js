"use strict";
const { createHash } = require("node:crypto");
const { HttpError, integer, text } = require("../lib/http");
const CATALOG_LOCK = 817415;
const MAX_MAILS = 5000;

function normalizeEmails(input) {
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
    const usage = row.usage ?? "training";
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
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(email))
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
  { replace = false, preview = false, actorId } = {},
) {
  const normalized = normalizeEmails(input);
  await client.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
  const current = (
    await client.query(
      "SELECT id,fingerprint FROM emails WHERE archived_at IS NULL",
    )
  ).rows;
  const seen = new Set(replace ? [] : current.map((e) => e.fingerprint));
  // Older installations have immutable questions without a stored fingerprint.
  // Compute their compatible fingerprints without rewriting historical content.
  if (!replace && current.some((e) => !e.fingerprint)) {
    const legacy = (
      await client.query(`SELECT sender,real_sender AS "realSender",subject,body,type,usage,
      COALESCE((SELECT jsonb_agg(clue_text ORDER BY display_order) FROM email_clues WHERE email_id=e.id),'[]') AS clues
      FROM emails e WHERE archived_at IS NULL AND fingerprint IS NULL`)
    ).rows;
    for (const email of legacy) {
      try {
        seen.add(normalizeEmails([email])[0].fingerprint);
      } catch {
        /* Legacy content outside today's import schema remains playable. */
      }
    }
  }
  const additions = normalized.filter((e) => {
    if (seen.has(e.fingerprint)) return false;
    seen.add(e.fingerprint);
    return true;
  });
  const summary = {
    added: additions.length,
    duplicates: normalized.length - additions.length,
    removed: replace ? current.length : 0,
    total: (replace ? 0 : current.length) + additions.length,
  };
  if (summary.total > 5000)
    throw new HttpError(400, "Le catalogue est limité à 5 000 mails actifs");
  if (preview) return { ...summary, preview: true };
  if (replace)
    await client.query(
      "UPDATE emails SET archived_at=NOW() WHERE archived_at IS NULL",
    );
  if (additions.length) {
    const inserted = (
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
  await client.query(
    "INSERT INTO mail_catalog_events(actor_id,operation,added,removed) VALUES($1,$2,$3,$4)",
    [
      actorId || null,
      replace ? "replace" : "import",
      summary.added,
      summary.removed,
    ],
  );
  return summary;
}
module.exports = { CATALOG_LOCK, normalizeEmails, mailIds, importEmails };
