import { extendAfterPayment, type Entitlement } from "./entitlement.js";
import { istBezahlt, molliePaymentSchema } from "./mollie.js";
import type { EntitlementRepository, MollieGateway, ProcessedEventStore } from "../ports.js";

/**
 * Die Entscheidung hinter dem Webhook (WP 6.2) — reine Logik über Ports.
 *
 * Vier Eigenschaften trägt diese Funktion, und alle vier sind ohne Datenbank
 * prüfbar:
 *
 * 1. **Dem Rumpf wird nicht geglaubt.** Aus dem Aufruf wird ausschliesslich
 *    die Payment-ID gelesen; Status, Betrag und Zugehörigkeit holt der Dienst
 *    über die authentifizierte Mollie-API. Ein gefälschter Aufruf kann damit
 *    nur eine ID *behaupten*.
 * 2. **Idempotenz** über `(paymentId, status)`. Mollie stellt bei
 *    Zeitüberschreitung erneut zu; ohne Dedupe verlängert jede Wiederholung
 *    das Abo weiter.
 * 3. **Nur Statusfakten.** Gespeichert werden Produkt, Gültigkeit, Quelle und
 *    die Mollie-Kennungen — kein Betrag, keine Kartendaten.
 * 4. **Nur der zugeordnete Nutzer.** Ohne `metadata.userId` bricht der Vorgang
 *    ab, statt zu raten.
 */

export type WebhookOutcome =
  | "unknown-payment"
  | "duplicate"
  | "not-paid"
  | "no-owner"
  | "extended";

export interface WebhookResult {
  outcome: WebhookOutcome;
  userId?: string;
  validUntil?: Date;
}

export interface WebhookDeps {
  repo: EntitlementRepository;
  events: ProcessedEventStore;
  mollie: MollieGateway;
  now: Date;
}

export async function handleWebhook(
  /**
   * Der Aufruf. `status` wird bewusst **nicht** ausgewertet — das Feld steht
   * hier nur, damit sichtbar ist, dass es ignoriert wird, selbst wenn ein
   * Angreifer es mitschickt.
   */
  aufruf: { paymentId: string; status?: string },
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const roh = await deps.mollie.getPayment(aufruf.paymentId);
  if (!roh) return { outcome: "unknown-payment" };

  // Datengrenze: Auch die Antwort des Anbieters wird geprüft, nicht geglaubt.
  const payment = molliePaymentSchema.parse(roh);

  if (await deps.events.seen(payment.id, payment.status)) {
    return { outcome: "duplicate" };
  }

  if (!istBezahlt(payment)) {
    // Kein aktiver Widerruf: Die Berechtigung läuft von selbst aus. Eine
    // Rücknahme mitten im bezahlten Zeitraum wäre ein Rückabwicklungsproblem.
    await deps.events.remember(payment.id, payment.status);
    return { outcome: "not-paid" };
  }

  const zuordnung = payment.metadata;
  if (!zuordnung) {
    // Ohne Zuordnung gibt es keinen Eigentümer. Raten wäre hier der Fehler.
    await deps.events.remember(payment.id, payment.status);
    return { outcome: "no-owner" };
  }

  const bestehend = await deps.repo.find(zuordnung.userId);
  const validUntil = extendAfterPayment(bestehend, deps.now);

  let subscriptionId = payment.subscriptionId ?? bestehend?.mollieSubscriptionId ?? undefined;
  if (!subscriptionId && payment.sequenceType === "first" && payment.customerId) {
    // Die erste Zahlung erzeugt das Mandat — erst danach lässt sich ein Abo
    // anlegen. Deshalb hier und nicht beim Checkout.
    const abo = await deps.mollie.ensureSubscription({
      customerId: payment.customerId,
      product: zuordnung.product,
      userId: zuordnung.userId,
    });
    subscriptionId = abo.subscriptionId;
  }

  const naechster: Entitlement = {
    userId: zuordnung.userId,
    product: zuordnung.product,
    validUntil,
    source: "mollie",
    mollieCustomerId: payment.customerId ?? bestehend?.mollieCustomerId,
    mollieSubscriptionId: subscriptionId,
  };

  await deps.repo.upsert(naechster);
  await deps.events.remember(payment.id, payment.status);

  return { outcome: "extended", userId: naechster.userId, validUntil };
}
