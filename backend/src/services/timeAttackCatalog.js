"use strict";
const { HttpError } = require("../lib/http");
// Battle-only questions must never become a solo practice pool.
const ELIGIBLE =
  "e.archived_at IS NULL AND e.usage IN ('training','both','express')";
async function availableSources(client) {
  const sets = (
    await client.query(`SELECT s.id,s.name,COUNT(e.id)::int AS total
    FROM mail_sets s JOIN mail_set_emails m ON m.set_id=s.id
    JOIN emails e ON e.id=m.email_id AND ${ELIGIBLE}
    WHERE s.status='ready' GROUP BY s.id ORDER BY LOWER(s.name),s.id`)
  ).rows;
  const general = (
    await client.query(`SELECT COUNT(*)::int AS total FROM emails e
    WHERE ${ELIGIBLE} AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id
    WHERE m.email_id=e.id AND s.status='ready')`)
  ).rows[0].total;
  return { sets, total: general };
}
async function selectSource(client, setId) {
  let set = null;
  if (setId !== null) {
    set = (
      await client.query(
        "SELECT id,name FROM mail_sets WHERE id=$1 AND status='ready'",
        [setId],
      )
    ).rows[0];
    if (!set)
      throw new HttpError(404, "Set introuvable, en brouillon ou archivé");
  }
  const rows = (
    await client.query(
      `SELECT e.id FROM emails e WHERE ${ELIGIBLE}
    AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id
    WHERE m.email_id=e.id AND s.status='ready' AND ($1::integer IS NULL OR s.id=$1)) ORDER BY e.id`,
      [setId],
    )
  ).rows;
  if (!rows.length)
    throw new HttpError(
      409,
      "Aucun mail disponible : utilisez training, both ou express dans un set prêt.",
    );
  return { set, ids: rows.map((e) => e.id) };
}
module.exports = { availableSources, selectSource };
