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
const {
  USAGES,
  getSet,
  saveSet,
  listSets,
  event,
} = require("../services/mailSets");
router.use(adminAuth);
router.get("/mail-sets", async (_req, res) =>
  res.json({ sets: await listSets(pool) }),
);
router.post("/mail-sets", async (req, res) =>
  res
    .status(201)
    .json({ set: await transaction((c) => saveSet(c, req.body, req.user.id)) }),
);
router.put("/mail-sets/:id", async (req, res) =>
  res.json({
    set: await transaction((c) =>
      saveSet(c, req.body, req.user.id, integer(req.params.id, "Set")),
    ),
  }),
);
router.get("/mail-sets/:id/history", async (req, res) => {
  const set = await getSet(pool, req.params.id, true);
  const events = (
    await pool.query(
      `SELECT e.*,p.name AS actor FROM mail_catalog_events e LEFT JOIN players p ON p.id=e.actor_id
    WHERE set_id=$1 ORDER BY e.id DESC LIMIT 100`,
      [set.id],
    )
  ).rows;
  const battles = (
    await pool.query(
      `SELECT id,name,starts_at,status,mail_selection FROM battles b WHERE EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(b.mail_selection->'sets','[]'::jsonb)) x WHERE (x->>'id')::integer=$1) ORDER BY id DESC LIMIT 100`,
      [set.id],
    )
  ).rows;
  res.json({ set, events, battles });
});
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
  const setId = integer(req.query.setId, "Set", { optional: true, min: 0 });
  if (
    !["", "phishing", "safe"].includes(type) ||
    !["", "training", "battle", "both"].includes(usage)
  )
    throw new HttpError(400, "Filtre invalide");
  const filter = `FROM emails e WHERE archived_at IS NULL AND ($1='' OR subject ILIKE '%'||$1||'%' OR sender ILIKE '%'||$1||'%') AND ($2='' OR type=$2) AND ($3='' OR usage=$3)
    AND ($4::integer IS NULL OR ($4=0 AND NOT EXISTS(SELECT 1 FROM mail_set_emails WHERE email_id=e.id)) OR EXISTS(SELECT 1 FROM mail_set_emails WHERE email_id=e.id AND set_id=$4))`;
  const [list, count, totals] = await Promise.all([
    pool.query(
      `SELECT id,sender,subject,type,usage,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'status',s.status) ORDER BY s.name)
        FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id WHERE m.email_id=e.id),'[]') AS sets ${filter} ORDER BY id DESC LIMIT 50 OFFSET $5`,
      [search, type, usage, setId, (page - 1) * 50],
    ),
    pool.query(`SELECT COUNT(*)::int AS n ${filter}`, [
      search,
      type,
      usage,
      setId,
    ]),
    pool.query(
      `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE usage IN ('training','both') AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id WHERE m.email_id=e.id AND s.status='ready'))::int AS training,
        COUNT(*) FILTER(WHERE usage IN ('battle','both') AND EXISTS(SELECT 1 FROM mail_set_emails m JOIN mail_sets s ON s.id=m.set_id WHERE m.email_id=e.id AND s.status='ready'))::int AS battle FROM emails e WHERE archived_at IS NULL`,
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
  const set =
    req.body.setId === undefined
      ? null
      : await getSet(pool, req.body.setId, true);
  const emails = (
    await pool.query(
      `${details} AND ($1::int[] IS NULL OR e.id=ANY($1)) AND ($2::int IS NULL OR EXISTS(SELECT 1 FROM mail_set_emails WHERE set_id=$2 AND email_id=e.id)) ORDER BY e.id`,
      [ids, set?.id ?? null],
    )
  ).rows;
  res.set(
    "Content-Disposition",
    'attachment; filename="phishchips-mails.json"',
  );
  res.json({
    schemaVersion: 1,
    ...(set
      ? {
          set: {
            name: set.name,
            description: set.description,
            defaultUsage: set.default_usage,
          },
        }
      : {}),
    emails: emails.map(({ id, ...e }) => e),
  });
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
        setId: req.body.setId,
        newSet: req.body.newSet,
      }),
    ),
  );
});
router.post("/emails/sets", async (req, res) => {
  const ids = mailIds(req.body.ids),
    action = req.body.action;
  if (!["add", "remove"].includes(action))
    throw new HttpError(400, "Action de set invalide");
  const result = await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
    const set = await getSet(c, req.body.setId);
    const active = (
      await c.query(
        "SELECT id FROM emails WHERE id=ANY($1::int[]) AND archived_at IS NULL",
        [ids],
      )
    ).rows;
    if (active.length !== ids.length)
      throw new HttpError(
        409,
        "La sélection contient un mail retiré : actualisez le catalogue",
      );
    const r =
      action === "add"
        ? await c.query(
            "INSERT INTO mail_set_emails(set_id,email_id) SELECT $1,UNNEST($2::int[]) ON CONFLICT DO NOTHING",
            [set.id, ids],
          )
        : await c.query(
            "DELETE FROM mail_set_emails WHERE set_id=$1 AND email_id=ANY($2::int[])",
            [set.id, ids],
          );
    await c.query("UPDATE mail_sets SET updated_at=NOW() WHERE id=$1", [
      set.id,
    ]);
    await event(
      c,
      req.user.id,
      action === "add" ? "attach" : "detach",
      set.id,
      { count: r.rowCount },
    );
    return { changed: r.rowCount };
  });
  res.json(result);
});
router.post("/emails/usage", async (req, res) => {
  const ids = mailIds(req.body.ids),
    usage = req.body.usage;
  if (!USAGES.includes(usage)) throw new HttpError(400, "Utilisation invalide");
  res.json(
    await transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock($1)", [CATALOG_LOCK]);
      const before = (
        await c.query(
          "SELECT id,usage FROM emails WHERE id=ANY($1::int[]) AND archived_at IS NULL",
          [ids],
        )
      ).rows;
      if (before.length !== ids.length)
        throw new HttpError(
          409,
          "La sélection contient un mail retiré : actualisez le catalogue",
        );
      await c.query("UPDATE emails SET usage=$1 WHERE id=ANY($2::int[])", [
        usage,
        ids,
      ]);
      await event(c, req.user.id, "usage", null, { before, usage });
      return { changed: ids.length };
    }),
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
