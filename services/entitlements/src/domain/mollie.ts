import { z } from "zod";

/**
 * Die Datengrenze zu Mollie (WP 6.2).
 *
 * **Der Webhook liefert nur eine ID.** Mollie ruft `POST /v1/mollie/webhook`
 * mit `{ id: "tr_…" }` auf — mehr steht nicht drin, und mehr wird auch nicht
 * geglaubt. Den Status holt der Dienst anschliessend selbst über die
 * authentifizierte Mollie-API (`GET /v2/payments/:id`).
 *
 * Das ist stärker als eine Signatur über einen selbst gelieferten Rumpf: Wer
 * den Webhook-Aufruf fälscht, kann damit nur eine Payment-ID *behaupten* —
 * die Wahrheit über Betrag, Status und Zugehörigkeit kommt über einen Kanal,
 * den er nicht kontrolliert. Und es ist zugleich der von Mollie vorgesehene
 * Weg.
 */

/** Rumpf des Webhook-Aufrufs. Absichtlich minimal — mehr wird nicht gelesen. */
export const webhookBodySchema = z.object({
  id: z.string().min(1).max(64),
});

/**
 * Was wir aus einer Mollie-Zahlung brauchen.
 *
 * `metadata` haben **wir** beim Checkout gesetzt; sie kommt über die
 * authentifizierte API zurück, nicht über den Webhook-Rumpf — deshalb ist sie
 * als Zuordnung zu einem Nutzer belastbar.
 */
export const molliePaymentSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "pending", "authorized", "paid", "canceled", "expired", "failed"]),
  sequenceType: z.enum(["oneoff", "first", "recurring"]).optional(),
  customerId: z.string().nullish(),
  subscriptionId: z.string().nullish(),
  metadata: z
    .object({
      userId: z.string().min(1),
      product: z.string().min(1),
    })
    .nullish(),
});

export type MolliePayment = z.infer<typeof molliePaymentSchema>;

/** Nur dieser Status verlängert eine Berechtigung. */
export function istBezahlt(payment: MolliePayment): boolean {
  return payment.status === "paid";
}
