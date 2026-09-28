"use strict";
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const pool = require("../db/pool");
const { config } = require("../config");
const { HttpError } = require("../lib/http");
const scrypt = promisify(crypto.scrypt);
const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const equal = (a, b) =>
  crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
function cookie(req, key) {
  const item = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${key}=`));
  return item ? item.slice(key.length + 1) : null;
}
const cookieOptions = () => ({
  httpOnly: true,
  secure: new URL(config().appUrl).protocol === "https:",
  sameSite: "lax",
  path: "/",
});
async function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new HttpError(
      400,
      "Le mot de passe doit contenir 12 à 128 caractères",
    );
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function passwordMatches(password, encoded) {
  const [salt, digest] = (
    encoded || `${"0".repeat(32)}:${"0".repeat(128)}`
  ).split(":");
  const key = await scrypt(
    typeof password === "string" && password.length <= 128 ? password : "",
    salt,
    64,
  );
  return !!encoded && crypto.timingSafeEqual(key, Buffer.from(digest, "hex"));
}
async function issueSession(res, playerId) {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query("DELETE FROM auth_sessions WHERE expires_at<=NOW()");
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,player_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')",
    [hash(token), playerId],
  );
  res.cookie("pcb_auth", token, {
    ...cookieOptions(),
    maxAge: 8 * 60 * 60 * 1000,
  });
}
async function loadUser(req, _res, next) {
  const token = cookie(req, "pcb_auth");
  req.user = null;
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const { rows } = await pool.query(
      `SELECT p.id,p.name,p.email,p.role,p.service_id,p.directory_id,
      COALESCE(d.display_name,p.name) AS display_name FROM auth_sessions a JOIN players p ON p.id=a.player_id
      LEFT JOIN directory_employees d ON d.id=p.directory_id
      WHERE a.token_hash=$1 AND a.expires_at>NOW() AND (d.id IS NULL OR d.active=TRUE)`,
      [hash(token)],
    );
    req.user = rows[0] || null;
  }
  next();
}
function requireUser(req, _res, next) {
  if (!req.user) throw new HttpError(401, "Connexion requise");
  next();
}
function mutationOrigin(req, _res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      (origin && origin !== new URL(config().appUrl).origin) ||
      req.get("sec-fetch-site") === "cross-site"
    )
      throw new HttpError(403, "Origine de la requête refusée");
  }
  next();
}
let msalClient;
function entraClient() {
  if (!msalClient) {
    const { ConfidentialClientApplication } = require("@azure/msal-node");
    const c = config();
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        authority: `https://login.microsoftonline.com/${c.tenantId}`,
      },
    });
  }
  return msalClient;
}
let entraKeys;
async function verifyIdentity(idToken, nonce, keyResolver) {
  const c = config();
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  entraKeys ||= createRemoteJWKSet(
    new URL(
      `https://login.microsoftonline.com/${c.tenantId}/discovery/v2.0/keys`,
    ),
  );
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keyResolver || entraKeys, {
      issuer: `https://login.microsoftonline.com/${c.tenantId}/v2.0`,
      audience: c.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "tid", "oid", "nonce"],
    }));
  } catch {
    throw new HttpError(401, "Identité Microsoft invalide ou expirée");
  }
  if (payload.tid !== c.tenantId || payload.nonce !== nonce)
    throw new HttpError(401, "Identité Entra refusée");
  return payload;
}
module.exports = {
  hash,
  equal,
  cookie,
  cookieOptions,
  passwordHash,
  passwordMatches,
  issueSession,
  loadUser,
  requireUser,
  mutationOrigin,
  entraClient,
  verifyIdentity,
};
