/**
 * Nachschlagewerk für Vertragsentscheidungen — inklusive der Fingerprints,
 * die vor der verschärften Händler-Normalisierung entstanden sind.
 *
 * `ContractDecision.fingerprint` ist PERSISTIERT und enthält bei
 * händlerbasierten Familien den normalisierten Namen
 * (`merchant:rewe sagt danke de muenchen|out`). Nach der Verschärfung lautet
 * derselbe Fingerprint `merchant:rewe sagt danke|out` — der alte Eintrag wäre
 * verwaist, und eine ausdrücklich als „kein Vertrag" abgelehnte Familie käme
 * still zurück. Kein Test wäre rot: Die Entscheidung steht weiter im Speicher,
 * sie wird nur nicht mehr gefunden.
 *
 * Genau dieses Fehlerbild hat das Repo schon einmal gehabt (F-CONTRACT-1,
 * zweite IBAN desselben Händlers) — dort löst es `computeContracts` über
 * `mergedSources`. Hier ist es dieselbe Idee an der Speichergrenze: Eine
 * Entscheidung wird unter ihrem gespeicherten UND unter ihrem heutigen
 * Fingerprint auffindbar gemacht. Keine Datenmigration, kein Umschreiben von
 * Nutzerdaten.
 *
 * IBAN-basierte Fingerprints sind unberührt — sie enthalten keinen
 * normalisierten Namen.
 */
import type { ContractDecision } from '@/lib/contract-types';
import { normalizeMerchantName } from '@/lib/merchant-normalization';

const MERCHANT_PREFIX = 'merchant:';

/**
 * Heutiger Fingerprint zu einem gespeicherten. Für IBAN-Fingerprints und für
 * bereits heutige Werte ist das der Wert selbst.
 */
export function heutigerFingerprint(gespeichert: string): string {
  if (!gespeichert.startsWith(MERCHANT_PREFIX)) return gespeichert;
  const trenner = gespeichert.lastIndexOf('|');
  if (trenner < 0) return gespeichert;

  const name = gespeichert.slice(MERCHANT_PREFIX.length, trenner);
  const richtung = gespeichert.slice(trenner);
  // `normalizeMerchantName` ist idempotent: ein heutiger Wert bleibt, ein
  // alter („netflix.com") wird auf die heutige Form gezogen.
  const heute = normalizeMerchantName(name) || name;
  return `${MERCHANT_PREFIX}${heute}${richtung}`;
}

/**
 * Baut die Nachschlage-Map. Eine Entscheidung ist unter ihrem gespeicherten
 * und unter ihrem heutigen Fingerprint erreichbar.
 *
 * Kollisionen (zwei Altfamilien fallen heute zusammen) entscheidet der
 * ZULETZT geänderte Eintrag — dieselbe Regel, die der Nutzer erwartet, wenn er
 * seine Meinung geändert hat.
 */
export function indexContractDecisions(
  decisions: readonly ContractDecision[],
): Map<string, ContractDecision> {
  const map = new Map<string, ContractDecision>();
  const juenger = (a: ContractDecision, b: ContractDecision) =>
    (a.updated_at ?? a.created_at ?? '') >= (b.updated_at ?? b.created_at ?? '') ? a : b;

  for (const decision of decisions) {
    const vorhanden = map.get(decision.fingerprint);
    map.set(decision.fingerprint, vorhanden ? juenger(decision, vorhanden) : decision);
  }
  // Alias-Durchlauf getrennt: Ein exakt gespeicherter Treffer darf nie von
  // einem Alias verdrängt werden.
  for (const decision of decisions) {
    const heute = heutigerFingerprint(decision.fingerprint);
    if (heute === decision.fingerprint) continue;
    const vorhanden = map.get(heute);
    if (!vorhanden) map.set(heute, decision);
    else if (vorhanden.fingerprint !== heute) map.set(heute, juenger(decision, vorhanden));
  }
  return map;
}
