// Test the actual deployment Compose with packaged images and a fresh isolated DB.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = "phishchips-image-" + randomBytes(6).toString("hex") + "-test";
const directory = mkdtempSync(path.join(tmpdir(), "phishchips-image-test-"));
const envFile = path.join(directory, ".env");
const settings = {
  IMAGE_PREFIX: process.env.IMAGE_PREFIX || "ghcr.io/za512/phishchipsbattle",
  IMAGE_TAG: process.env.IMAGE_TAG || "ci-smoke",
  POSTGRES_DB: "phishchips_image_test",
  POSTGRES_USER: "pcb_image_test",
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  JWT_SECRET: randomBytes(48).toString("hex"),
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  AUTH_MODE: "local",
  APP_URL: "http://127.0.0.1",
  FRONTEND_BIND_IP: "127.0.0.1",
  FRONTEND_PORT: "0",
  ENTRA_TENANT_ID: "",
  ENTRA_CLIENT_ID: "",
  ENTRA_CLIENT_SECRET: "",
  CORS_ORIGIN: "",
  TRUST_PROXY: "loopback,linklocal,uniquelocal",
};
writeFileSync(
  envFile,
  Object.entries(settings)
    .map(([key, value]) => key + "=" + value)
    .join("\n"),
);
const environment = { ...process.env, ...settings };
const composeArgs = [
  "compose",
  "--project-name",
  project,
  "--project-directory",
  root,
  "--env-file",
  envFile,
  "-f",
  path.join(root, "docker-compose.yml"),
];
function docker(args, capture = false) {
  return execFileSync("docker", args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}
function compose(args, capture = false) {
  return docker([...composeArgs, ...args], capture);
}
let started = false;
try {
  const config = JSON.parse(compose(["config", "--format", "json"], true));
  for (const service of ["api", "frontend"]) {
    assert.equal(
      config.services[service].build,
      undefined,
      service + " must not build on deployment",
    );
    assert.equal(
      (config.services[service].volumes || []).length,
      0,
      service + " must not mount source files",
    );
    assert.equal(
      config.services[service].image,
      settings.IMAGE_PREFIX + "-" + service + ":" + settings.IMAGE_TAG,
    );
  }
  docker(["pull", "postgres:16-alpine"]);
  started = true;
  compose([
    "up",
    "-d",
    "--no-build",
    "--pull",
    "never",
    "--wait",
    "--wait-timeout",
    "180",
  ]);
  const address = compose(["port", "frontend", "80"], true).trim();
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  const origin = "http://" + address;
  for (const asset of [
    "login.html",
    "phishing.html",
    "enterprise-admin.html",
    "profile.html",
    "portal.css",
    "theme-outlook.css",
    "account.js",
    "mail-catalog.js",
    "feedback.js",
    "script.js",
    "secu.png",
    "img/PhishChips-mail.png",
  ]) {
    const response = await fetch(origin + "/" + asset);
    assert.equal(response.status, 200, asset + " must be packaged");
    assert.ok(
      response.headers.get("content-security-policy"),
      asset + " must have CSP headers",
    );
    assert.ok(
      (await response.arrayBuffer()).byteLength > 0,
      asset + " must not be empty",
    );
  }
  const api = await fetch(origin + "/api/auth/config");
  assert.equal(api.status, 200, "Nginx must proxy to the API");
  const auth = await api.json();
  assert.equal(auth.mode, "local");
  assert.equal(
    auth.bootstrapAvailable,
    true,
    "API must query the fresh database",
  );
  assert.equal((await fetch(origin + "/Dockerfile")).status, 404);
  assert.equal((await fetch(origin + "/nginx.conf")).status, 403);
  console.log(
    "Packaged images verified: static assets, CSP, Nginx/API proxy, database and healthchecks.",
  );
} catch (error) {
  if (started) {
    try {
      compose(["logs", "--tail", "80"]);
    } catch {}
  }
  throw error;
} finally {
  try {
    // The random project name belongs only to this invocation; never touches an existing stack.
    if (started) compose(["down", "--volumes", "--remove-orphans"]);
  } finally {
    unlinkSync(envFile);
    rmdirSync(directory);
  }
}
