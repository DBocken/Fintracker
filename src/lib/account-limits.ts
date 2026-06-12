import { ANONYMOUS_ACCOUNT_LIMIT, FREE_ACCOUNT_LIMIT } from "@/lib/constants";
import type { Tier } from "@/lib/tier";

/**
 * Konto-Limits pro Tier (Issue #59), zentral und pur — geprüft in der
 * Service-Schicht (account-service.createAccount), nicht nur im UI.
 *
 * - anonymous: 1 Konto — im Anonym-Modus ist das Konto quasi die lokale,
 *   verschlüsselte Datei. Kein Login, keine Cloud.
 * - free: 3 Konten (bestehendes FREE_ACCOUNT_LIMIT)
 * - premium: unbegrenzt
 */
export function accountLimitForTier(tier: Tier): number {
  switch (tier) {
    case "anonymous":
      return ANONYMOUS_ACCOUNT_LIMIT;
    case "free":
      return FREE_ACCOUNT_LIMIT;
    case "premium":
      return Number.POSITIVE_INFINITY;
  }
}

export interface AccountCreationCheck {
  allowed: boolean;
  limit: number;
  current: number;
  /** Freundlicher Hinweis (Copy nach #54: keine Drohkulisse, Privacy-Versprechen sichtbar). */
  message?: string;
}

export function evaluateAccountCreation(tier: Tier, currentCount: number): AccountCreationCheck {
  const limit = accountLimitForTier(tier);
  if (currentCount < limit) {
    return { allowed: true, limit, current: currentCount };
  }

  const message =
    tier === "anonymous"
      ? "Mehrere Konten gibt es mit dem kostenlosen Login. Deine Daten bleiben trotzdem auf deinem Gerät — der Login schaltet nur zusätzliche Konten und die Bankanbindung frei."
      : `Du hast das Maximum von ${limit} Konten erreicht. Mehr Konten kommen mit Premium.`;

  return { allowed: false, limit, current: currentCount, message };
}
