"use strict";
const router = require("express").Router();
const crypto = require("node:crypto");
const pool = require("../db/pool");
const { config } = require("../config");
const { HttpError, text, uuid, transaction } = require("../lib/http");
const { authLimiter } = require("../middleware/rateLimiter");
const auth = require("../services/auth");
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/config", (_req, res) =>
  res.json({ mode: config().authMode, teamPolicy: config().teamPolicy }),
);
router.get("/me", auth.requireUser, (req, res) =>
  res.json({ player: req.user }),
);
router.post("/logout", async (req, res) => {
  const token = auth.cookie(req, "pcb_auth");
  if (token)
    await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      auth.hash(token),
    ]);
  res.clearCookie("pcb_auth", auth.cookieOptions()).json({ ok: true });
});
function localOnly(_req, _res, next) {
  if (config().authMode !== "local")
    throw new HttpError(404, "Authentification locale désactivée");
  next();
}
function email(value) {
  const e = text(value, "Email", 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new HttpError(400, "Email invalide");
  return e;
}
router.post("/register", authLimiter, localOnly, async (req, res) => {
  const name = text(req.body.name, "Pseudo", 40, 2).toUpperCase(),
    address = email(req.body.email),
    password = await auth.passwordHash(req.body.password);
  const { rows } = await pool.query(
    "INSERT INTO players(name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
    [name, address, password],
  );
  await auth.issueSession(res, rows[0].id);
  res.status(201).json({ ok: true });
});
router.post("/login", authLimiter, localOnly, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,password_hash FROM players WHERE email=$1",
    [email(req.body.email)],
  );
  if (!(await auth.passwordMatches(req.body.password, rows[0]?.password_hash)))
    throw new HttpError(401, "Email ou mot de passe incorrect");
  await auth.issueSession(res, rows[0].id);
  res.json({ ok: true });
});
router.post("/bootstrap", authLimiter, localOnly, async (req, res) => {
  if (
    !req.body.bootstrapSecret ||
    !auth.equal(req.body.bootstrapSecret, process.env.ADMIN_PASSWORD)
  )
    throw new HttpError(403, "Secret administrateur incorrect");
  const name = text(req.body.name, "Pseudo", 40, 2).toUpperCase(),
    address = email(req.body.email),
    password = await auth.passwordHash(req.body.password);
  const player = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(817412)");
    if (
      (await client.query("SELECT 1 FROM players WHERE role='admin'")).rows
        .length
    )
      throw new HttpError(409, "Un administrateur existe déjà");
    return (
      await client.query(
        "INSERT INTO players(name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id",
        [name, address, password],
      )
    ).rows[0];
  });
  await auth.issueSession(res, player.id);
  res.status(201).json({ ok: true });
});
router.get("/entra/login", authLimiter, async (req, res) => {
  if (config().authMode !== "entra") throw new HttpError(404, "SSO désactivé");
  const state = crypto.randomBytes(32).toString("hex"),
    browser = crypto.randomBytes(32).toString("hex"),
    nonce = crypto.randomBytes(32).toString("hex"),
    verifier = crypto.randomBytes(48).toString("base64url");
  await pool.query("DELETE FROM oauth_states WHERE expires_at<=NOW()");
  await pool.query(
    "INSERT INTO oauth_states(state_hash,browser_hash,nonce,verifier,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')",
    [auth.hash(state), auth.hash(browser), nonce, verifier],
  );
  res.cookie("pcb_oauth", browser, { ...auth.cookieOptions(), maxAge: 600000 });
  res.redirect(
    await auth.entraClient().getAuthCodeUrl({
      scopes: ["openid", "profile", "email"],
      redirectUri: `${new URL(config().appUrl).origin}/api/auth/entra/callback`,
      state,
      nonce,
      codeChallenge: crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url"),
      codeChallengeMethod: "S256",
      responseMode: "query",
    }),
  );
});
router.get("/entra/callback", async (req, res) => {
  if (config().authMode !== "entra") throw new HttpError(404, "SSO désactivé");
  const state = text(req.query.state, "État de connexion", 64, 64),
    browser = auth.cookie(req, "pcb_oauth");
  const { rows } = await pool.query(
    "DELETE FROM oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>NOW() RETURNING nonce,verifier",
    [auth.hash(state), auth.hash(browser || "")],
  );
  res.clearCookie("pcb_oauth", auth.cookieOptions());
  if (!rows.length) throw new HttpError(401, "Connexion expirée ou invalide");
  if (req.query.error)
    throw new HttpError(401, "Connexion Microsoft annulée ou refusée");
  const token = await auth.entraClient().acquireTokenByCode({
    code: text(req.query.code, "Code de connexion", 12000),
    scopes: ["openid", "profile", "email"],
    redirectUri: `${new URL(config().appUrl).origin}/api/auth/entra/callback`,
    codeVerifier: rows[0].verifier,
  });
  const identity = await auth.verifyIdentity(token.idToken, rows[0].nonce),
    oid = uuid(identity.oid),
    tid = uuid(identity.tid, "Tenant");
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  const role = roles.includes("PhishChips.Admin")
    ? "admin"
    : roles.includes("PhishChips.Organizer")
      ? "organizer"
      : "player";
  const player = await transaction(async (client) => {
    const known = (
      await client.query(
        "SELECT active,tenant_id FROM directory_employees WHERE id=$1",
        [oid],
      )
    ).rows[0];
    if (known && known.tenant_id !== tid)
      throw new HttpError(403, "Compte rattaché à un autre tenant");
    if (known && !known.active)
      throw new HttpError(403, "Compte désactivé dans l’annuaire");
    const address =
      typeof identity.email === "string" && identity.email.length <= 255
        ? identity.email.toLowerCase()
        : `${oid}@entra.invalid`;
    await client.query(
      `INSERT INTO directory_employees(id,tenant_id,display_name,email) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,email=EXCLUDED.email`,
      [
        oid,
        tid,
        String(identity.name || identity.preferred_username || oid).slice(
          0,
          200,
        ),
        address,
      ],
    );
    let p = (
      await client.query(
        "SELECT id FROM players WHERE directory_id=$1 FOR UPDATE",
        [oid],
      )
    ).rows[0];
    if (!p)
      p = (
        await client.query(
          `INSERT INTO players(name,email,directory_id,role,service_id) VALUES($1,$2,$3,$4,(SELECT service_id FROM directory_team_members WHERE employee_id=$3)) RETURNING id`,
          [`E-${oid}`, `${oid}@entra.invalid`, oid, role],
        )
      ).rows[0];
    else
      await client.query("UPDATE players SET role=$1 WHERE id=$2", [
        role,
        p.id,
      ]);
    await client.query(
      "UPDATE battle_participants SET player_id=$1 WHERE employee_id=$2 AND player_id IS NULL",
      [p.id, oid],
    );
    return p;
  });
  await auth.issueSession(res, player.id);
  res.redirect("/phishing.html");
});
module.exports = router;
