/**
 * Was der Dienst über einen Nutzer weiss — und mehr nicht (WP 6.2).
 *
 * **Was hier NICHT steht, ist Teil der Zusage:** keine Kartendaten, kein
 * Betrag, keine Adresse, kein Zahlungsverlauf. Der Dienst hält Statusfakten,
 * keine Zahlungsdaten; die liegen bei Mollie und nur dort.
 *
 * Der Schlüssel ist die **interne userId** (`src/lib/identity.ts` der App),
 * nicht das Subject des Identitätsanbieters. Daran hängt die Zusage aus
 * WP 7.2: Subject-Wechsel ohne userId-Wechsel, Entitlements bleiben unberührt.
 */

/** Woher die Berechtigung kommt. `admin` löst den früheren Alpha-Hardcode ab. */
export type EntitlementSource = "mollie" | "promo" | "admin";

export interface Entitlement {
  userId: string;
  product: string;
  /** Ende der Berechtigung **inklusive** Kulanzfrist. */
  validUntil: Date;
  source: EntitlementSource;
  mollieCustomerId?: string;
  mollieSubscriptionId?: string;
}

/** Länge eines Abrechnungszeitraums in Monaten. */
export const PERIOD_MONTHS = 1;

/**
 * Kulanzfrist in Tagen — **Notwendigkeit, nicht Grosszügigkeit.**
 *
 * Mollie wiederholt eine fehlgeschlagene Abbuchung über mehrere Tage. Ohne
 * Puffer verliert ein zahlender Nutzer den Zugang genau in dem Fenster, in
 * dem sein Geld noch unterwegs ist — und meldet sich zu Recht.
 */
export const GRACE_DAYS = 5;

const TAG_MS = 24 * 60 * 60 * 1000;

function plusMonate(datum: Date, monate: number): Date {
  const kopie = new Date(datum.getTime());
  kopie.setUTCMonth(kopie.getUTCMonth() + monate);
  return kopie;
}

/**
 * Neues Gültigkeitsende nach einer erfolgreichen Zahlung.
 *
 * Verlängert wird ab dem **bezahlten Periodenende**, nicht ab dem
 * Zahlungszeitpunkt — sonst wandert der Abrechnungstag bei jeder frühen
 * Buchung nach hinten.
 *
 * **Die Kulanz summiert sich nicht auf.** Sie wird vor der Rechnung
 * abgezogen und danach wieder aufgeschlagen; `validUntil - GRACE` ist exakt
 * das vorige Periodenende. Wer stattdessen naiv `validUntil + Periode +
 * Kulanz` rechnet, verschenkt bei zwölf Zahlungen zwei Monate — lautlos, und
 * niemand sucht danach.
 *
 * Ist das Abo längst abgelaufen (Wiedereintritt nach Pause), wird ab *jetzt*
 * gerechnet: Der verfallene Zeitraum wird nicht nachträglich gutgeschrieben.
 */
export function extendAfterPayment(bestehend: Entitlement | null, jetzt: Date): Date {
  const vorigesPeriodenende = bestehend
    ? new Date(bestehend.validUntil.getTime() - GRACE_DAYS * TAG_MS)
    : null;

  const basis =
    vorigesPeriodenende && vorigesPeriodenende.getTime() > jetzt.getTime()
      ? vorigesPeriodenende
      : jetzt;

  return new Date(plusMonate(basis, PERIOD_MONTHS).getTime() + GRACE_DAYS * TAG_MS);
}

/** Gilt die Berechtigung zum Zeitpunkt `jetzt`? */
export function isActive(entitlement: Entitlement | null, jetzt: Date): boolean {
  if (!entitlement) return false;
  return entitlement.validUntil.getTime() > jetzt.getTime();
}
