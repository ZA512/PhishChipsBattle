"use strict";
const { HttpError, text, uuid, transaction } = require("../lib/http");
const { config } = require("../config");
const { entraClient } = require("./auth");

async function importDirectory(employees, actorId, source = "import") {
  if (
    !Array.isArray(employees) ||
    !employees.length ||
    employees.length > 50000
  )
    throw new HttpError(400, "Annuaire vide ou trop volumineux");
  const normalized = employees.map((e) => ({
    id: uuid(e.id),
    tenantId: uuid(e.tenantId || config().tenantId, "Tenant"),
    displayName: text(e.displayName, "Nom", 200),
    email: e.email ? text(e.email, "Email", 255).toLowerCase() : null,
    managerId: e.managerId ? uuid(e.managerId) : null,
    jobTitle: e.jobTitle ? text(e.jobTitle, "Intitulé", 200) : null,
    department: e.department ? text(e.department, "Département", 200) : null,
    active: e.active !== false,
  }));
  if (
    new Set(normalized.map((e) => e.id)).size !== normalized.length ||
    new Set(normalized.map((e) => e.tenantId)).size !== 1
  )
    throw new HttpError(
      400,
      "L’annuaire doit contenir des identifiants uniques d’un seul tenant",
    );
  if (
    config().authMode === "entra" &&
    normalized[0].tenantId !== config().tenantId
  )
    throw new HttpError(403, "Tenant annuaire non autorisé");
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(817413)");
    const existing = (
      await client.query(
        "SELECT id,tenant_id FROM directory_employees WHERE id=ANY($1::uuid[])",
        [normalized.map((e) => e.id)],
      )
    ).rows;
    if (existing.some((e) => e.tenant_id !== normalized[0].tenantId))
      throw new HttpError(409, "Identifiant déjà rattaché à un autre tenant");
    for (const e of normalized)
      await client.query(
        `INSERT INTO directory_employees(id,tenant_id,display_name,email,manager_id,job_title,department,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,email=EXCLUDED.email,
      manager_id=EXCLUDED.manager_id,job_title=EXCLUDED.job_title,department=EXCLUDED.department,active=EXCLUDED.active,synced_at=NOW()`,
        [
          e.id,
          e.tenantId,
          e.displayName,
          e.email,
          e.managerId,
          e.jobTitle,
          e.department,
          e.active,
        ],
      );
    // Deactivation occurs only after a full, successfully retrieved directory; assignments never move.
    await client.query(
      "UPDATE directory_employees SET active=FALSE,synced_at=NOW() WHERE tenant_id=$1 AND NOT(id=ANY($2::uuid[]))",
      [normalized[0].tenantId, normalized.map((e) => e.id)],
    );
    await client.query(
      "INSERT INTO directory_sync_runs(actor_id,source,imported) VALUES($1,$2,$3)",
      [actorId, source, normalized.length],
    );
    return { imported: normalized.length };
  });
}
async function syncGraph(actorId) {
  if (config().authMode !== "entra")
    throw new HttpError(400, "Configurez Entra pour synchroniser Graph");
  const token = await entraClient().acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  let url =
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled&$expand=manager($select=id)&$top=100";
  const employees = [];
  const visited = new Set();
  while (url) {
    if (
      visited.has(url) ||
      visited.size > 1000 ||
      new URL(url).origin !== "https://graph.microsoft.com"
    )
      throw new HttpError(502, "Pagination Graph invalide");
    visited.add(url);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        `Graph a refusé la synchronisation (${response.status}). Aucune affectation modifiée.`,
      );
    const page = await response.json();
    if (!Array.isArray(page.value))
      throw new HttpError(502, "Réponse Graph invalide");
    for (const e of page.value)
      employees.push({
        id: e.id,
        tenantId: config().tenantId,
        displayName: e.displayName,
        email: e.mail || e.userPrincipalName,
        jobTitle: e.jobTitle,
        department: e.department,
        managerId: e.manager?.id,
        active: e.accountEnabled !== false,
      });
    url = page["@odata.nextLink"] || null;
  }
  return importDirectory(employees, actorId, "graph");
}
module.exports = { importDirectory, syncGraph };
