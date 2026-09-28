const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { verifyIdentity } = require("../src/services/auth");
test("Identité OIDC : signature, audience, tenant, nonce et expiration", async () => {
  const { generateKeyPair, SignJWT } = await import("jose");
  const tenant = randomUUID(),
    client = randomUUID(),
    oid = randomUUID(),
    nonce = "nonce-expected";
  process.env.ENTRA_TENANT_ID = tenant;
  process.env.ENTRA_CLIENT_ID = client;
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const sign = (claims = {}, key = privateKey) =>
    new SignJWT({ tid: tenant, oid, nonce, ...claims })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(oid)
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience(client)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
  assert.equal((await verifyIdentity(await sign(), nonce, publicKey)).oid, oid);
  await assert.rejects(
    verifyIdentity(await sign({ nonce: "replayed" }), nonce, publicKey),
  );
  await assert.rejects(
    verifyIdentity(await sign({ tid: randomUUID() }), nonce, publicKey),
  );
  // Construct separate wrong-audience and expired tokens.
  const token = (aud, exp) =>
    new SignJWT({ tid: tenant, oid, nonce })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(oid)
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);
  await assert.rejects(
    verifyIdentity(await token(randomUUID(), "5m"), nonce, publicKey),
  );
  await assert.rejects(
    verifyIdentity(
      await token(client, Math.floor(Date.now() / 1000) - 1),
      nonce,
      publicKey,
    ),
  );
  const other = await generateKeyPair("RS256");
  await assert.rejects(
    verifyIdentity(await sign({}, other.privateKey), nonce, publicKey),
  );
});
