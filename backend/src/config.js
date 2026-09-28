"use strict";

function config() {
  return {
    authMode: process.env.AUTH_MODE || "entra",
    appUrl: process.env.APP_URL || "http://localhost:8080",
    tenantId: process.env.ENTRA_TENANT_ID?.toLowerCase(),
    clientId: process.env.ENTRA_CLIENT_ID?.toLowerCase(),
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    teamPolicy: "free",
  };
}
function validateConfig() {
  const c = config();
  for (const name of ["DATABASE_URL", "JWT_SECRET"]) {
    if (
      !process.env[name] ||
      (name === "JWT_SECRET" &&
        (process.env[name].length < 32 || /changeme/i.test(process.env[name])))
    )
      throw new Error(`${name} doit être configuré avec une valeur sûre`);
  }
  if (!["entra", "local"].includes(c.authMode))
    throw new Error("AUTH_MODE doit être entra ou local");
  const url = new URL(c.appUrl);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("APP_URL doit être une origine HTTP(S)");
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("APP_URL invalide");
  if (c.authMode === "entra") {
    for (const name of [
      "ENTRA_TENANT_ID",
      "ENTRA_CLIENT_ID",
      "ENTRA_CLIENT_SECRET",
    ])
      if (!process.env[name]) throw new Error(`${name} est requis pour le SSO`);
    if (
      !/^[0-9a-f-]{36}$/i.test(c.tenantId) ||
      !/^[0-9a-f-]{36}$/i.test(c.clientId)
    )
      throw new Error("Les identifiants Entra doivent être des GUID");
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw new Error("HTTPS est requis pour Entra hors localhost");
  } else if (
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 12 ||
    /changeme/i.test(process.env.ADMIN_PASSWORD)
  ) {
    throw new Error(
      "ADMIN_PASSWORD doit contenir au moins 12 caractères en mode local",
    );
  }
  return c;
}
module.exports = { config, validateConfig };
