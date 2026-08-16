import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK, type KeyLike } from "jose";
import { buildApp } from "../src/server.js";
import type { Entitlement } from "../src/domain/entitlement.js";
import type { EntitlementRepository, MollieGateway, ProcessedEventStore } from "../src/ports.js";
import type { MollieConfig } from "../src/adapters/mollie-client.js";

const ISSUER = "https://idp.beispiel.invalid/";
const AUDIENCE = "fintracker-entitlements";

let privateKey: KeyLike;
let server: Server;
let basis: string;
const zeilen = new Map<string, Entitlement>();

const JETZT = new Date("2026-01-01T00:00:00Z");

const repo: EntitlementRepository = {
  async find(userId) {
    return zeilen.get(userId) ?? null;
  },
  async upsert(e) {
    zeilen.set(e.userId, e);
  },
};

const events: ProcessedEventStore = {
  async seen() {
    return false;
  },
  async remember() {},
};

const mollie: MollieGateway = {
  async getPayment() {
    return null;
  },
  async ensureSubscription() {
    return { subscriptionId: "sub_1" };
  },
};

const mollieConfig: MollieConfig = {
  apiKey: "test_key",
  redirectUrl: "https://app.beispiel.invalid/billing",
  webhookUrl: "https://dienst.beispiel.invalid/v1/mollie/webhook",
  amount: "4.99",
  currency: "EUR",
  description: "Test",
};

async function token(sub: string, opts: { issuer?: string } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuedAt()
    .setSubject(sub)
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(privateKey);
}

beforeAll(async () => {
  const paar = await generateKeyPair("RS256", { extractable: true });
  privateKey = paar.privateKey;
  const jwk = (await exportJWK(paar.publicKey)) as JWK;
  jwk.kid = "test-key";
  jwk.alg = "RS256";

  const app = buildApp({
    repo,
    events,
    mollie,
    mollieConfig,
    auth: { jwks: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER, audience: AUDIENCE },
    now: () => JETZT,
    startCheckout: async ({ userId }) => ({
      checkoutUrl: `https://checkout.beispiel.invalid/${userId}`,
    }),
  });

  await new Promise<void>((fertig) => {
    server = app.listen(0, () => fertig());
  });
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  zeilen.set("user-b", {
    userId: "user-b",
    product: "premium_monthly",
    validUntil: new Date("2026-06-01T00:00:00Z"),
    source: "mollie",
  });
});

afterAll(() => {
  server?.close();
});

describe("[SECURITY] GET /v1/entitlement", () => {
  it("sollte ohne Token 401 liefern", async () => {
    const antwort = await fetch(`${basis}/v1/entitlement`);
    expect(antwort.status).toBe(401);
  });

  it("sollte ein Token fremden Issuers ablehnen", async () => {
    const antwort = await fetch(`${basis}/v1/entitlement`, {
      headers: { authorization: `Bearer ${await token("user-b", { issuer: "https://fremd.invalid/" })}` },
    });
    expect(antwort.status).toBe(401);
  });

  it("sollte NUR die eigene Berechtigung liefern — auch wenn ein anderer Nutzer erfragt wird", async () => {
    // Der Kern der Isolation (Messlatte aus #298): Der Nutzer kommt
    // ausschliesslich aus dem Token. Es gibt keinen Parameter, ueber den A
    // nach der Berechtigung von B fragen koennte — deshalb hilft es auch
    // nicht, es zu versuchen.
    const antwort = await fetch(`${basis}/v1/entitlement?userId=user-b`, {
      headers: { authorization: `Bearer ${await token("user-a")}` },
    });

    expect(antwort.status).toBe(200);
    const daten = (await antwort.json()) as { active: boolean; product?: string };
    expect(daten.active).toBe(false);
    expect(daten.product).toBeUndefined();
  });

  it("sollte die eigene aktive Berechtigung liefern", async () => {
    const antwort = await fetch(`${basis}/v1/entitlement`, {
      headers: { authorization: `Bearer ${await token("user-b")}` },
    });

    const daten = (await antwort.json()) as { active: boolean; product?: string };
    expect(daten.active).toBe(true);
    expect(daten.product).toBe("premium_monthly");
  });

  it("sollte kein Zwischenspeichern erlauben", async () => {
    // Abo-Status ist eine widerrufbare Tatsache — ein Proxy-Cache wuerde einen
    // abgelaufenen Zustand am Leben halten.
    const antwort = await fetch(`${basis}/v1/entitlement`, {
      headers: { authorization: `Bearer ${await token("user-b")}` },
    });
    expect(antwort.headers.get("cache-control")).toContain("no-store");
    expect(antwort.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("[SECURITY] POST /v1/checkout", () => {
  it("sollte ohne Token 401 liefern", async () => {
    const antwort = await fetch(`${basis}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product: "premium_monthly" }),
    });
    expect(antwort.status).toBe(401);
  });

  it("sollte den Kauf dem Token-Nutzer zuordnen, nicht einer Angabe im Rumpf", async () => {
    // Wer `userId` im Rumpf mitschickt, kauft trotzdem fuer sich selbst.
    const antwort = await fetch(`${basis}/v1/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await token("user-a")}`,
      },
      body: JSON.stringify({ product: "premium_monthly", userId: "user-b" }),
    });

    const daten = (await antwort.json()) as { checkoutUrl: string };
    expect(daten.checkoutUrl).toContain("user-a");
    expect(daten.checkoutUrl).not.toContain("user-b");
  });
});

describe("POST /v1/mollie/webhook", () => {
  it("sollte einen unbekannten Vorgang mit 404 beantworten", async () => {
    const antwort = await fetch(`${basis}/v1/mollie/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "tr_erfunden" }),
    });
    expect(antwort.status).toBe(404);
  });

  it("sollte einen kaputten Rumpf mit 400 beantworten", async () => {
    const antwort = await fetch(`${basis}/v1/mollie/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nichts: true }),
    });
    expect(antwort.status).toBe(400);
  });

  it("sollte ohne Token erreichbar sein — Mollie hat keines", async () => {
    // Gegenprobe zur Zugangspruefung: Der Webhook DARF offen sein, gerade weil
    // ihm nichts geglaubt wird ausser der ID.
    const antwort = await fetch(`${basis}/v1/mollie/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "tr_erfunden" }),
    });
    expect(antwort.status).not.toBe(401);
  });
});
