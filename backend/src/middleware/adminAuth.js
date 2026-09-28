"use strict";
const { HttpError } = require("../lib/http");
function adminAuth(req, _res, next) {
  if (req.user?.role === "admin") return next();
  throw new HttpError(req.user ? 403 : 401, "Accès administrateur requis");
}
function organizerAuth(req, _res, next) {
  if (!["admin", "organizer"].includes(req.user?.role))
    throw new HttpError(req.user ? 403 : 401, "Accès organisateur requis");
  next();
}
module.exports = { adminAuth, organizerAuth };
