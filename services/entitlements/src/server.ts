import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { handleWebhook } from "./domain/handle-webhook.js";
import { isActive } from "./domain/entitlement.js";
import { webhookBodySchema } from "./domain/mollie.js";
import { remoteJwks, verifyAccessToken, type VerifyOptions } from "./auth/verify-jwt.js";
import type { EntitlementRepository, MollieGateway, ProcessedEventStore } from "./ports.js";
import { createPool, postgresEntitlementRepository, postgresProcessedEvents } from "./db/postgres.js";
import { createFirstPayment, mollieGateway, type MollieConfig } from "./adapters/mollie-client.js";

/**
 * EntitlementService (WP 6.2) — erster EU-souveräner Dienst der App.
 *
 * Drei Routen, drei Datenflüsse:
 *   GET  /v1/entitlement    Client fragt seinen eigenen Status (JWT)
 *   POST /v1/checkout       Client startet den Kauf, bekommt eine Redirect-URL
 *   POST /v1/mollie/webhook Mollie meldet eine Payment-ID (kein JWT)
 *
 * **Der Client kennt Mollie nicht.** Kein SDK, kein Key, kein Mollie-Typ —
 * er kennt diesen Dienst und eine URL, die er vor dem Redirect durch
 * `isSafeExternalAuthUrl` schickt.
 */

function pflicht(name: string): string {
  const wert = process.env[name];
  // Kein stiller Produktions-Default: Eine fehlende Konfiguration ist ein
  // benannter Startfehler, keine halb funktionierende Instanz (BTR-S6).
  if (!wert) throw new Error(`Konfiguration fehlt: ${name}`);
  return wert;
}

export interface AppDeps {
  repo: EntitlementRepository;
  events: ProcessedEventStore;
  mollie: MollieGateway;
  mollieConfig: MollieConfig;
  /** Schlüsselquelle und Issuer — beides Konfiguration, siehe verify-jwt.ts. */
  auth: VerifyOptions;
  now?: () => Date;
  /** Nur für Tests: umgeht den echten Mollie-Aufruf beim Checkout. */
  startCheckout?: (input: { userId: string; product: string }) => Promise<{ checkoutUrl: string }>;
}

export function buildApp(deps: AppDeps) {
  const app = express();
  const jetzt = deps.now ?? (() => new Date());

  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  /** Zieht den Aufrufer aus dem Bearer-Token — oder beendet mit 401. */
  async function aufrufer(req: express.Request): Promise<{ userId: string } | null> {
    const kopf = req.header("authorization") ?? "";
    const token = kopf.startsWith("Bearer ") ? kopf.slice(7) : "";
    try {
      return await verifyAccessToken(token, deps.auth);
    } catch {
      return null;
    }
  }

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/v1/entitlement", async (req, res) => {
    const caller = await aufrufer(req);
    if (!caller) return void res.status(401).json({ error: "unauthorized" });

    // Der Nutzer kommt AUSSCHLIESSLICH aus dem Token, nie aus Query oder Rumpf.
    // Damit gibt es keinen Weg, das Entitlement eines anderen zu erfragen.
    const eintrag = await deps.repo.find(caller.userId);
    const aktiv = isActive(eintrag, jetzt());

    res.json({
      active: aktiv,
      product: aktiv ? eintrag?.product : undefined,
      validUntil: aktiv ? eintrag?.validUntil.toISOString() : undefined,
      source: aktiv ? eintrag?.source : undefined,
    });
  });

  const checkoutBody = z.object({ product: z.string().min(1).max(64) });

  app.post("/v1/checkout", async (req, res) => {
    const caller = await aufrufer(req);
    if (!caller) return void res.status(401).json({ error: "unauthorized" });

    const gelesen = checkoutBody.safeParse(req.body);
    if (!gelesen.success) return void res.status(400).json({ error: "bad-request" });

    try {
      const starten =
        deps.startCheckout ??
        ((input: { userId: string; product: string }) =>
          createFirstPayment(deps.mollieConfig, input));
      const { checkoutUrl } = await starten({
        userId: caller.userId,
        product: gelesen.data.product,
      });
      res.json({ checkoutUrl });
    } catch {
      res.status(502).json({ error: "provider-unavailable" });
    }
  });

  app.post("/v1/mollie/webhook", async (req, res) => {
    // Kein JWT: Mollie ruft hier an. Genau deshalb wird dem Rumpf nichts
    // geglaubt ausser der ID — den Status holt handleWebhook selbst.
    const gelesen = webhookBodySchema.safeParse(req.body);
    if (!gelesen.success) return void res.status(400).json({ error: "bad-request" });

    try {
      const ergebnis = await handleWebhook(
        { paymentId: gelesen.data.id },
        { repo: deps.repo, events: deps.events, mollie: deps.mollie, now: jetzt() },
      );

      if (ergebnis.outcome === "unknown-payment") {
        return void res.status(404).json({ error: "unknown-payment" });
      }
      // Alles Übrige mit 200 quittieren — sonst stellt Mollie eine korrekt
      // verarbeitete Meldung endlos erneut zu.
      res.status(200).json({ outcome: ergebnis.outcome });
    } catch {
      // 500 ist hier richtig: Mollie SOLL erneut zustellen, wenn wir gerade
      // nicht konnten. Die Idempotenz fängt die Wiederholung ab.
      res.status(500).json({ error: "internal" });
    }
  });

  return app;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const pool = createPool(pflicht("DATABASE_URL"));
  const mollieConfig: MollieConfig = {
    apiKey: pflicht("MOLLIE_API_KEY"),
    redirectUrl: pflicht("MOLLIE_REDIRECT_URL"),
    webhookUrl: pflicht("MOLLIE_WEBHOOK_URL"),
    amount: pflicht("BILLING_AMOUNT"),
    currency: process.env.BILLING_CURRENCY ?? "EUR",
    description: process.env.BILLING_DESCRIPTION ?? "Fintracker Premium",
  };

  const app = buildApp({
    repo: postgresEntitlementRepository(pool),
    events: postgresProcessedEvents(pool),
    mollie: mollieGateway(mollieConfig),
    mollieConfig,
    auth: {
      // Issuer ist Konfiguration — Phase 7 tauscht diese zwei Variablen.
      jwks: remoteJwks(pflicht("AUTH_JWKS_URL")),
      issuer: pflicht("AUTH_ISSUER"),
      audience: process.env.AUTH_AUDIENCE,
    },
  });

  const port = Number(process.env.PORT ?? 8080);
  app.listen(port, () => console.log(`EntitlementService hört auf ${port}`));
}
