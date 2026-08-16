import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWK, type KeyLike } from "jose";
import { verifyAccessToken } from "../src/auth/verify-jwt.js";

const ISSUER = "https://idp.beispiel.invalid/";
const AUDIENCE = "fintracker-entitlements";

let privateKey: KeyLike;
let jwks: ReturnType<typeof createLocalJWKSet>;
let fremderKey: KeyLike;

beforeAll(async () => {
  const paar = await generateKeyPair("RS256", { extractable: true });
  privateKey = paar.privateKey;
  const publicJwk = (await exportJWK(paar.publicKey)) as JWK;
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  jwks = createLocalJWKSet({ keys: [publicJwk] });

  const fremd = await generateKeyPair("RS256", { extractable: true });
  fremderKey = fremd.privateKey;
});

async function token(opts: {
  sub?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  key?: KeyLike;
} = {}) {
  let jwt = new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setExpirationTime(opts.expiresIn ?? "1h");
  if (opts.sub !== undefined) jwt = jwt.setSubject(opts.sub);
  return jwt.sign(opts.key ?? privateKey);
}

/**
 * Die Zugangsprüfung des Dienstes (WP 6.2).
 *
 * **Issuer ist Konfiguration** — das ist der Punkt, an dem Phase 7 hängt:
 * Der Wechsel des Identitätsanbieters darf zwei Umgebungsvariablen kosten,
 * keine Zeile Code. Deshalb nimmt die Funktion Issuer und Schlüsselquelle
 * entgegen, statt sie zu kennen.
 */
describe("[SECURITY] verifyAccessToken", () => {
  it("sollte ein gueltiges Token annehmen und die interne userId liefern", async () => {
    const ergebnis = await verifyAccessToken(await token({ sub: "user-a" }), {
      jwks,
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(ergebnis.userId).toBe("user-a");
  });

  it("sollte ein Token eines FREMDEN Issuers ablehnen", async () => {
    // Ohne diese Pruefung akzeptiert der Dienst jedes Token, das irgendein
    // IdP dieser Welt ausgestellt hat.
    await expect(
      verifyAccessToken(await token({ sub: "user-a", issuer: "https://fremd.invalid/" }), {
        jwks,
        issuer: ISSUER,
        audience: AUDIENCE,
      }),
    ).rejects.toThrow();
  });

  it("sollte ein Token mit fremder Signatur ablehnen", async () => {
    await expect(
      verifyAccessToken(await token({ sub: "user-a", key: fremderKey }), {
        jwks,
        issuer: ISSUER,
        audience: AUDIENCE,
      }),
    ).rejects.toThrow();
  });

  it("sollte ein Token OHNE sub ablehnen", async () => {
    // Ein Token ohne Subject gehoert zu niemandem. Es waere ein Zugang, der
    // auf jeden passt.
    await expect(
      verifyAccessToken(await token({}), { jwks, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/sub/i);
  });

  it("sollte ein abgelaufenes Token ablehnen", async () => {
    await expect(
      verifyAccessToken(await token({ sub: "user-a", expiresIn: "-1h" }), {
        jwks,
        issuer: ISSUER,
        audience: AUDIENCE,
      }),
    ).rejects.toThrow();
  });

  it("sollte ein Token fuer eine andere Zielgruppe ablehnen", async () => {
    await expect(
      verifyAccessToken(await token({ sub: "user-a", audience: "anderer-dienst" }), {
        jwks,
        issuer: ISSUER,
        audience: AUDIENCE,
      }),
    ).rejects.toThrow();
  });

  it("sollte ein leeres oder fehlendes Token ablehnen, ohne zu werfen wie ein Programmfehler", async () => {
    await expect(
      verifyAccessToken("", { jwks, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow();
  });
});
