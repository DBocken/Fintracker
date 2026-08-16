/**
 * Fachliche Typen der Billing-Slice (WP 6.3).
 *
 * Sie liegen hier und **nicht** in der Komponentendatei, in der sie zuerst
 * gebraucht wurden (AGENTS.md §3, „Wohin ein Typ gehört"). Genau diese
 * Ablage-Gewohnheit hat in `use-etoro-account.ts` die Import-Richtung
 * umgedreht.
 */

/** Produktschlüssel. Der Preis ist Konfiguration des Dienstes, keine Konstante hier. */
export const PREMIUM_MONTHLY = "premium_monthly";

/** Woher eine Berechtigung kommt — Spiegel der Quellen des Dienstes. */
export type SubscriptionSource = "mollie" | "promo" | "admin";

/**
 * Was der Client über das Abo weiss.
 *
 * `unknown` ist ein eigener Zustand und kein `false` mit anderem Namen: Der
 * Dienst kann nicht erreichbar sein, und die App bleibt dann **vollständig
 * nutzbar** — sie ist local-first, das Abo ist Zusatzinformation. Ein
 * Ladefehler darf nicht wie „du hast kein Abo" aussehen; genau diese
 * Verwechslung hat `/debts` einmal behauptet, es gebe keine Schulden.
 */
export type SubscriptionState =
  | { status: "unknown" }
  | { status: "none" }
  | {
      status: "active";
      product: string;
      validUntil: Date;
      source: SubscriptionSource;
    };

/** Gilt gerade eine Berechtigung? */
export function isSubscribed(state: SubscriptionState): boolean {
  return state.status === "active";
}

/**
 * Übersetzt den Abo-Zustand in das Urteil, das `deriveTier` erwartet.
 *
 * `undefined` heisst dort „kein Urteil" und lässt den lokalen Override
 * wirken; `"free"` ist das **definitive Nein**, gegen das er nicht mehr
 * ankommt. Deshalb darf ein unbekannter Zustand hier niemals `"free"`
 * liefern — sonst würde ein Dienstausfall den Alpha- und Offline-Weg
 * mitsperren.
 */
export function entitlementTier(state: SubscriptionState): "premium" | "free" | undefined {
  if (state.status === "active") return "premium";
  if (state.status === "none") return "free";
  return undefined;
}
