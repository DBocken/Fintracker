import { useI18n } from "@/i18n/useI18n";
import { useServerEntitlement } from "@/hooks/useServerEntitlement";
import { useStartCheckout, type StartCheckoutOptions } from "./use-start-checkout";
import { PREMIUM_MONTHLY, type SubscriptionState } from "../domain/subscription";

/**
 * ViewModel der Kauf-Fläche (WP 6.3).
 *
 * Kennt die Oberfläche nicht — kein Import aus `src/components/` oder
 * `src/pages/` (AGENTS.md §3, Regel `feature-application-ohne-ui`). Damit
 * lässt sich später eine zweite Präsentation danebenstellen, ohne die
 * Datenbeschaffung ein zweites Mal zu schreiben (§4).
 *
 * Die Berechtigung selbst kommt aus `useServerEntitlement` — sie ist
 * app-weite Infrastruktur, nicht Besitz dieser Slice. Diese Slice besitzt den
 * **Kauf**.
 */

/** Die vier Zustände, die die Fläche unterscheiden muss (§9.1). */
export type BillingScreenState =
  | "loading"
  /** Kein Abo — Kaufangebot. Ausdrücklich NICHT derselbe Zustand wie „Fehler". */
  | "empty"
  | "active"
  /** Dienst nicht erreichbar. Muss benannt werden, sonst liest es sich als „kein Abo". */
  | "error"
  /** Kein Zahlungsweg hinterlegt — es gibt (noch) nichts zu kaufen. */
  | "unavailable";

export interface BillingViewModel {
  screen: BillingScreenState;
  subscription: SubscriptionState;
  product: string;
  startCheckout: () => void;
  isStarting: boolean;
  /** Der Kauf selbst ist fehlgeschlagen (nicht die Statusabfrage). */
  checkoutFailed: boolean;
  /** Fertig formatiertes Gültigkeitsdatum, oder `null`. */
  validUntilLabel: string | null;
}

export function useBilling(options: StartCheckoutOptions = {}): BillingViewModel {
  const { locale } = useI18n();
  const entitlement = useServerEntitlement();
  const checkout = useStartCheckout(options);

  const screen: BillingScreenState = !entitlement.isConfigured
    ? "unavailable"
    : entitlement.isLoading
      ? "loading"
      : entitlement.isError
        ? "error"
        : entitlement.state.status === "active"
          ? "active"
          : "empty";

  const validUntilLabel =
    entitlement.state.status === "active"
      ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(entitlement.state.validUntil)
      : null;

  return {
    screen,
    subscription: entitlement.state,
    product: PREMIUM_MONTHLY,
    startCheckout: () => checkout.mutate(PREMIUM_MONTHLY),
    isStarting: checkout.isPending,
    checkoutFailed: checkout.isError,
    validUntilLabel,
  };
}
