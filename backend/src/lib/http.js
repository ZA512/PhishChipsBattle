"use strict";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function integer(
  value,
  label = "ID",
  { min = 1, max = 2147483647, optional = false } = {},
) {
  if (optional && (value === undefined || value === null || value === ""))
    return null;
  if (
    !["string", "number"].includes(typeof value) ||
    !/^\d+$/.test(String(value))
  ) {
    throw new HttpError(400, `${label} invalide`);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new HttpError(400, `${label} invalide`);
  return n;
}
function text(value, label, max = 100, min = 1) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    throw new HttpError(400, `${label} invalide (${min}–${max} caractères)`);
  }
  return value.trim();
}
function uuid(value, label = "Identifiant annuaire") {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, `${label} invalide`);
  return value.toLowerCase();
}
async function transaction(work, pool = require("../db/pool")) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* Preserve the original error. */
    }
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { HttpError, integer, text, uuid, transaction };
