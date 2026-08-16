import { molliePaymentSchema, type MolliePayment } from "../domain/mollie.js";
import type { MollieGateway } from "../ports.js";

/**
 * Der einzige Weg nach draussen zu Mollie (WP 6.2).
 *
 * **Hier und nur hier liegt der API-Key.** Er ist serverseitig, er verlässt
 * diesen Prozess nicht, und der Client der App kennt Mollie überhaupt nicht —
 * er kennt unseren Dienst und eine Redirect-URL.
 *
 * Der Host steht im Anbieter-Register (`docs/security/anbieter-register.md`)
 * und wird von `pnpm check:external-endpoints` gegen den Code geprüft.
 */

const MOLLIE_API = "https://api.mollie.com/v2";

export interface MollieConfig {
  apiKey: string;
  /** Wohin Mollie den Nutzer nach der Zahlung zurückschickt. */
  redirectUrl: string;
  /** Wohin Mollie die Statusmeldung schickt. */
  webhookUrl: string;
  /** Betrag als Dezimalzeichenkette, z. B. "4.99". */
  amount: string;
  currency: string;
  description: string;
}

async function mollieFetch(
  pfad: string,
  config: MollieConfig,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${MOLLIE_API}${pfad}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function mollieGateway(config: MollieConfig): MollieGateway {
  return {
    async getPayment(paymentId: string): Promise<MolliePayment | null> {
      const antwort = await mollieFetch(`/payments/${encodeURIComponent(paymentId)}`, config);
      // 404 ist hier kein Fehler, sondern die Antwort: Mollie kennt die ID
      // nicht — der behauptete Vorgang existiert nicht.
      if (antwort.status === 404) return null;
      if (!antwort.ok) throw new Error(`Mollie antwortete mit ${antwort.status}`);
      return molliePaymentSchema.parse(await antwort.json());
    },

    async ensureSubscription({ customerId, product, userId }) {
      const antwort = await mollieFetch(
        `/customers/${encodeURIComponent(customerId)}/subscriptions`,
        config,
        {
          method: "POST",
          body: JSON.stringify({
            amount: { currency: config.currency, value: config.amount },
            interval: "1 month",
            description: config.description,
            webhookUrl: config.webhookUrl,
            metadata: { userId, product },
          }),
        },
      );
      if (!antwort.ok) throw new Error(`Abo anlegen fehlgeschlagen (${antwort.status})`);
      const daten = (await antwort.json()) as { id?: string };
      if (!daten.id) throw new Error("Mollie lieferte kein Abo");
      return { subscriptionId: daten.id };
    },
  };
}

/**
 * Legt Kunde und erste Zahlung an und liefert die Checkout-URL.
 *
 * `sequenceType: "first"` erzeugt das Mandat — erst damit sind spätere
 * Abbuchungen möglich. Das Abo selbst entsteht deshalb nicht hier, sondern
 * beim ersten `paid`-Webhook.
 */
export async function createFirstPayment(
  config: MollieConfig,
  input: { userId: string; product: string },
): Promise<{ checkoutUrl: string }> {
  const kunde = await mollieFetch("/customers", config, {
    method: "POST",
    body: JSON.stringify({ metadata: { userId: input.userId } }),
  });
  if (!kunde.ok) throw new Error(`Kunde anlegen fehlgeschlagen (${kunde.status})`);
  const kundeDaten = (await kunde.json()) as { id?: string };
  if (!kundeDaten.id) throw new Error("Mollie lieferte keinen Kunden");

  const zahlung = await mollieFetch("/payments", config, {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: config.currency, value: config.amount },
      description: config.description,
      redirectUrl: config.redirectUrl,
      webhookUrl: config.webhookUrl,
      customerId: kundeDaten.id,
      sequenceType: "first",
      // Die Zuordnung setzen WIR. Sie kommt über die authentifizierte API
      // zurück, nicht über den Webhook-Rumpf — deshalb ist sie belastbar.
      metadata: { userId: input.userId, product: input.product },
    }),
  });
  if (!zahlung.ok) throw new Error(`Zahlung anlegen fehlgeschlagen (${zahlung.status})`);

  const daten = (await zahlung.json()) as { _links?: { checkout?: { href?: string } } };
  const url = daten._links?.checkout?.href;
  if (!url) throw new Error("Mollie lieferte keine Checkout-URL");
  return { checkoutUrl: url };
}
