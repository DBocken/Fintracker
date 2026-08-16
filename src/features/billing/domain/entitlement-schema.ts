import { z } from "zod";
import { safeParseAtBoundary } from "@/lib/schemas/boundary";
import type { SubscriptionState } from "./subscription";

/**
 * Datengrenze zum EntitlementService (WP 6.3, AGENTS.md §8).
 *
 * Die Antwort kommt über das Netz und wird geprüft, nicht geglaubt — auch
 * wenn der Dienst unserer ist. Ein Feld, das fehlt oder eine andere Form hat,
 * darf nicht als „aktives Abo" durchgehen.
 */

const entitlementResponseSchema = z.object({
  active: z.boolean(),
  product: z.string().min(1).optional(),
  validUntil: z.string().datetime().optional(),
  source: z.enum(["mollie", "promo", "admin"]).optional(),
});

export const checkoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
});

/**
 * Liest die Dienst-Antwort in einen Abo-Zustand.
 *
 * Bei kaputter Antwort kommt `unknown` heraus, **nicht** `none`: Wir wissen
 * dann nicht, ob ein Abo besteht — und „ich weiss es nicht" als „du hast
 * keins" auszugeben, wäre gegenüber einem zahlenden Nutzer die falsche
 * Auskunft.
 */
export function readEntitlement(roh: unknown): SubscriptionState {
  const gelesen = safeParseAtBoundary(entitlementResponseSchema, roh, "entitlement");
  if (!gelesen.ok) return { status: "unknown" };

  const daten = gelesen.data;
  if (!daten.active) return { status: "none" };

  // `active: true` ohne die Begleitfelder ist ebenfalls unbrauchbar — ohne
  // Ablaufdatum liesse sich der Offline-Cache nicht begrenzen.
  if (!daten.product || !daten.validUntil || !daten.source) return { status: "unknown" };

  return {
    status: "active",
    product: daten.product,
    validUntil: new Date(daten.validUntil),
    source: daten.source,
  };
}
