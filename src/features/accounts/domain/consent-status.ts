/**
 * Reine Ableitungen zur Bankfreigabe (PSD2-Consent) einer Kontoverbindung.
 *
 * **Warum ein eigener Typ statt `ConsentCheckResult` aus dem Service.** Die
 * `domain` eines Slices darf laut AGENTS.md §3 (`check:layers`, Regel
 * `feature-domain-rein`) nicht in `src/services/` greifen — sie ist der reine
 * Kern. `ConsentSnapshot` beschreibt deshalb strukturell genau das, was diese
 * Ableitungen brauchen; `ConsentCheckResult` ist darauf zuweisbar, ohne dass
 * eine Zeile Anpassung noetig waere. Sobald der Consent-Typ nach `src/lib/`
 * wandert (er wird von Service UND Oberflaeche gebraucht — „Wohin ein Typ
 * gehoert"), kann `ConsentSnapshot` durch ihn ersetzt werden.
 */

import type { Account } from '@/lib/account-types';

/** Ab dieser Restlaufzeit warnt die Flaeche vor dem Ablauf. */
export const CONSENT_EXPIRY_WARNING_DAYS = 7;

/** Das Wenige, was fuer die Zustandsableitung noetig ist. */
export interface ConsentSnapshot {
  expired: boolean;
  expiresAt?: string | null;
  daysRemaining?: number | null;
}

/**
 * Laeuft die Freigabe bald ab?
 *
 * Bewusst FALSCH fuer eine bereits abgelaufene Freigabe: „abgelaufen" und
 * „laeuft bald ab" sind zwei Aussagen, und beide zugleich waeren ein
 * Widerspruch auf demselben Konto.
 */
export function isConsentExpiringSoon(status: ConsentSnapshot | undefined): boolean {
  if (!status || status.expired) return false;
  if (status.daysRemaining == null) return false;
  return status.daysRemaining <= CONSENT_EXPIRY_WARNING_DAYS;
}

/** Die Konten, deren Bankfreigabe abgelaufen ist — in Listenreihenfolge. */
export function selectExpiredConsentAccounts(
  accounts: Account[],
  statuses: Record<string, ConsentSnapshot | undefined>,
): Account[] {
  return accounts.filter((account) => statuses[account.id]?.expired);
}
