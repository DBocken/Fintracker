import { getAccessToken } from "@/services/auth-service";
import { entitlementBaseUrl } from "@/lib/billing-config";
import { safeParseAtBoundary } from "@/lib/schemas/boundary";
import { checkoutResponseSchema, readEntitlement } from "@/features/billing/domain/entitlement-schema";
import type { SubscriptionState } from "@/features/billing/domain/subscription";

/**
 * Zugang zum EntitlementService (WP 6.3).
 *
 * **Der Client kennt Mollie nicht.** Kein SDK, kein API-Key, kein Mollie-Typ —
 * er kennt diesen Dienst und bekommt von ihm eine Redirect-URL. Ein Wechsel
 * des Zahlungsdienstleisters berührt keine Datei unter `src/`.
 */

async function autorisiert(pfad: string, init: RequestInit = {}): Promise<Response> {
  const basis = entitlementBaseUrl();
  if (!basis) throw new Error("entitlement service not configured");

  const token = await getAccessToken();
  if (!token) throw new Error("not authenticated");

  return fetch(`${basis.replace(/\/$/, "")}${pfad}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Aktueller Abo-Status.
 *
 * Wirft bei Netz- oder Dienstfehlern — der aufrufende Hook macht daraus einen
 * **benannten** Fehlerzustand. Stillschweigend `none` zu liefern wäre die
 * gefährlichere Variante: Sie behauptet gegenüber einem zahlenden Nutzer, er
 * habe kein Abo.
 */
export async function fetchSubscription(): Promise<SubscriptionState> {
  const antwort = await autorisiert("/v1/entitlement");
  if (!antwort.ok) throw new Error(`entitlement service responded ${antwort.status}`);
  return readEntitlement(await antwort.json());
}

/** Startet den Kauf und liefert die Weiterleitungsadresse des Anbieters. */
export async function startCheckout(product: string): Promise<string> {
  const antwort = await autorisiert("/v1/checkout", {
    method: "POST",
    body: JSON.stringify({ product }),
  });
  if (!antwort.ok) throw new Error(`checkout could not be started (${antwort.status})`);

  const gelesen = safeParseAtBoundary(checkoutResponseSchema, await antwort.json(), "checkout");
  if (!gelesen.ok) throw new Error("unusable checkout response");
  return gelesen.data.checkoutUrl;
}
