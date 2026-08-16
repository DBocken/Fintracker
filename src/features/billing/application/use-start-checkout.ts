import { useMutation } from "@tanstack/react-query";
import { isSafeExternalAuthUrl } from "@/lib/safe-url";
import { startCheckout } from "@/services/entitlement-service";

/**
 * Startet den Kauf und leitet zum Anbieter weiter (WP 6.3).
 *
 * **Die Redirect-URL kommt aus einer API-Antwort und ist damit nicht
 * vertrauenswürdig** (`docs/security-boundaries.md`, AGENTS.md §10 Regel 5).
 * Sie läuft deshalb durch `isSafeExternalAuthUrl`, bevor sie in
 * `window.location.href` landet — dieselbe Prüfung wie beim
 * GoCardless-Redirect in `BankCallbackPage`. Ohne sie wäre eine `javascript:`-
 * oder Fremdhost-URL ein offener Weiterleitungspunkt.
 */

/** Erlaubte Ziel-Suffixe des Zahlungswegs. Mollie leitet über `mollie.com`. */
export const CHECKOUT_HOST_SUFFIXES = ["mollie.com"];

export interface StartCheckoutOptions {
  /** Nur für Tests: ersetzt die echte Weiterleitung. */
  navigate?: (url: string) => void;
}

export function useStartCheckout(options: StartCheckoutOptions = {}) {
  const navigate = options.navigate ?? ((url: string) => {
    window.location.href = url;
  });

  return useMutation({
    mutationFn: async (product: string) => {
      const url = await startCheckout(product);
      if (!isSafeExternalAuthUrl(url, { allowedHostSuffixes: CHECKOUT_HOST_SUFFIXES })) {
        throw new Error("unsafe redirect target blocked");
      }
      return url;
    },
    onSuccess: (url) => navigate(url),
  });
}
