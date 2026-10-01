"use strict";
const router = require("express").Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const { HttpError, integer, transaction } = require("../lib/http");
const {
  CATALOG_LOCK,
  mailIds,
  importEmails,
} = require("../services/mailCatalog");
router.use(adminAuth);
const details = `SELECT e.id,e.sender,e.real_sender AS "realSender",e.subject,e.body,e.type,e.usage,
  COALESCE((SELECT jsonb_agg(clue_text ORDER BY display_order) FROM email_clues WHERE email_id=e.id),'[]') AS clues
  FROM emails e WHERE e.archived_at IS NULL`;

router.get("/emails", async (req, res) => {
  const page = integer(req.query.page ?? 1, "Page");
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : "";
  const type = req.query.type ?? "",
    usage = req.query.usage ?? "";
  if (
    !["", "phishing", "safe"].includes(type) ||
    !["", "training", "battle", "both"].includes(usage)
  )
    throw new HttpError(400, "Filtre invalide");
  const filter =
    "FROM emails WHERE archived_at IS NULL AND ($1='' OR subject ILIKE '%'||$1||'%' OR sender ILIKE '%'||$1||'%') AND ($2='' OR type=$2) AND ($3='' OR usage=$3)";
  const [list, count, totals] = await Promise.all([
    pool.query(
      `SELECT id,sender,subject,type,usage ${filter} ORDER BY id DESC LIMIT 50 OFFSET $4`,
      [search, type, usage, (page - 1) * 50],
    ),
    pool.query(`SELECT COUNT(*)::int AS n ${filter}`, [search, type, usage]),
    pool.query(
      "SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE usage IN ('training','both'))::int AS training,COUNT(*) FILTER(WHERE usage IN ('battle','both'))::int AS battle FROM emails WHERE archived_at IS NULL",
    ),
  ]);
  res.json({
    emails: list.rows,
    page,
    pages: Math.max(1, Math.ceil(count.rows[0].n / 50)),
    matched: count.rows[0].n,
    totals: totals.rows[0],
  });
});
router.post("/emails/export", async (req, res) => {
  const ids = req.body.ids === undefined ? null : mailIds(req.body.ids);
  const emails = (
    await pool.query(
      `${details} AND ($1::int[] IS NULL OR e.id=ANY($1)) ORDER BY e.id`,
      [ids],
    )
  ).rows;
  res.set(
    "Content-Disposition",
    'attachment; filename="phishchips-mails.json"',
  );
  res.json({ schemaVersion: 1, emails: emails.map(({ id, ...e }) => e) });
});
router.get("/emails/:id", async (req, res) => {
  const email = (
    await pool.query(`${details} AND e.id=$1`, [integer(req.params.id)])
  ).rows[0];
  if (!email)
    throw new HttpError(404, "Mail introuvable ou retiré du catalogue");
  res.json({ email });
});
router.post("/emails/import", async (req, res) => {
  for (const key of ["replace", "preview"])
    if (req.body[key] !== undefined && typeof req.body[key] !== "boolean")
      throw new HttpError(400, `${key} doit être un booléen`);
  res.json(
    await transaction((client) =>
      importEmails(client, req.body.catalog, {
        replace: req.body.replace,
        preview: req.body.preview,
        actorId: req.user.id,
      }),
    ),
  );
});
router.post("/emails/delete", async (req, res) => {
  const all = req.body.all === true;
  if (all && req.body.confirm !== "SUPPRIMER TOUT")
    throw new HttpError(400, "Confirmez avec SUPPRIMER TOUT");
  const ids = all ? null : mailIds(req.body.ids);
  const removed = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
    const r = await client.query(
      "UPDATE emails SET archived_at=NOW() WHERE archived_at IS NULL AND ($1::int[] IS NULL OR id=ANY($1))",
      [ids],
    );
    await client.query(
      "INSERT INTO mail_catalog_events(actor_id,operation,removed) VALUES($1,'delete',$2)",
      [req.user.id, r.rowCount],
    );
    return r.rowCount;
  });
  res.json({ removed });
});
module.exports = router;
