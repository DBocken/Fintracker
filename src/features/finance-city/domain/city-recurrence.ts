/**
 * WP-5.1 — Wiederkehr-Erkennung für die Flusslinien der Finanzstadt.
 *
 * Das Stadtmodell wusste bis hierher NICHT, welche Zahlungen wiederkehren.
 * WP-E2 hatte `computeContracts` (`@/lib/contract-derivation`) bewusst aus der
 * Etagen-Ableitung entfernt, weil es Händler mit zu wenigen Buchungen
 * überspringt und dadurch ganze Etagen verschwanden — die Entscheidung war
 * richtig und wird hier NICHT zurückgenommen.
 *
 * Stattdessen: die Wiederkehr aus den Daten ableiten, die ohnehin schon durch
 * die Etagen-Aggregation laufen. Jede Etage kennt die Datums-Liste ihrer
 * Buchungen; in wie vielen VERSCHIEDENEN Kalendermonaten ein Händler gebucht
 * hat, ist das belastbarste Signal, das ohne zusätzliche Query zu haben ist.
 * Keine neue Abfrage, keine Rücknahme einer getroffenen Entscheidung, reine
 * Funktion (README-Architekturtabelle, `domain/`).
 *
 * Bewusst NICHT dasselbe wie ein „Vertrag" im Sinne von
 * `contract-derivation.ts`: Dort geht es um eine Nutzer-bestätigte
 * Vertragsentscheidung samt Zyklus und Preisänderung. Hier reicht die
 * schwächere Aussage „das kommt regelmäßig wieder", weil die Flusslinie nur
 * eine Betonung ist und keine Zahl behauptet, die anderswo anders lautet.
 */

/**
 * Mindestzahl VERSCHIEDENER Kalendermonate, in denen ein Händler gebucht haben
 * muss, damit seine Zahlungen als wiederkehrend gelten.
 *
 * Drei ist die kleinste Zahl, die einen Rhythmus von einem Zufall trennt: bei
 * zwei Monaten in Folge ist ein einmaliger Kauf mit Nachbestellung genauso
 * wahrscheinlich wie ein Abo. Höher anzusetzen würde vierteljährliche Zahlungen
 * (Versicherungen!) aus kurzen Datenfenstern verschwinden lassen — und genau
 * die sind Fixkosten, die man sehen will.
 */
export const RECURRING_MIN_MONTHS = 3;

/** `YYYY-MM` aus einem ISO-Datum. Rein lexikalisch — kein `Date`-Parsing, keine Zeitzonen-Verschiebung. */
function monthKey(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  return match ? `${match[1]}-${match[2]}` : null;
}

/**
 * Zählt die verschiedenen Kalendermonate einer Buchungsreihe. Unparsbare
 * Datumsangaben zählen nicht mit (statt als eigener „Monat" durchzugehen und
 * die Wiederkehr künstlich hochzuzählen).
 */
export function distinctMonthCount(dates: readonly string[]): number {
  const months = new Set<string>();
  for (const date of dates) {
    const key = monthKey(date);
    if (key) months.add(key);
  }
  return months.size;
}

/** Wiederkehrend = in mindestens `RECURRING_MIN_MONTHS` verschiedenen Kalendermonaten gebucht. */
export function isRecurring(dates: readonly string[]): boolean {
  return distinctMonthCount(dates) >= RECURRING_MIN_MONTHS;
}
