import type { Entitlement } from "./domain/entitlement.js";
import type { MolliePayment } from "./domain/mollie.js";

/**
 * Die Aussenanschlüsse des Dienstes als Schnittstellen (WP 6.2).
 *
 * **Warum überhaupt Ports.** In dieser Umgebung gibt es keinen
 * Docker-Daemon — und in CI soll die Entscheidungslogik nicht an einer
 * Datenbank hängen, um prüfbar zu sein. Wichtiger als die Testbarkeit ist
 * aber, was daraus folgt: Die sicherheitsrelevanten Eigenschaften
 * (Idempotenz, „dem Rumpf wird nicht geglaubt", Nutzer-Isolation) sind
 * Eigenschaften der **Logik**, nicht der Datenbank. Wer sie nur gegen echtes
 * Postgres prüfen kann, prüft sie in der Praxis seltener.
 */

export interface EntitlementRepository {
  find(userId: string): Promise<Entitlement | null>;
  upsert(entitlement: Entitlement): Promise<void>;
}

/**
 * Dedupe-Speicher für die Idempotenz.
 *
 * Der Schlüssel ist **(paymentId, status)**, nicht die paymentId allein: Eine
 * Zahlung durchläuft mehrere Zustände (`open` → `paid`), und jeder davon löst
 * einen eigenen Webhook aus. Nur die *Wiederholung derselben Kombination* ist
 * eine Dublette.
 */
export interface ProcessedEventStore {
  seen(paymentId: string, status: string): Promise<boolean>;
  remember(paymentId: string, status: string): Promise<void>;
}

/** Der einzige Weg nach draussen zu Mollie. Hält als Einziger den API-Key. */
export interface MollieGateway {
  /** `null`, wenn Mollie die ID nicht kennt. */
  getPayment(paymentId: string): Promise<MolliePayment | null>;
  ensureSubscription(input: {
    customerId: string;
    product: string;
    userId: string;
  }): Promise<{ subscriptionId: string }>;
}
