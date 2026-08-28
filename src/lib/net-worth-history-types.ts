/**
 * Vermögens-Historie als FORTSCHREIBUNG (Welle 4, #333 Punkt 2).
 *
 * #333 liess die Wahl zwischen Fortschreibung und Rückrechnung offen. Sie ist
 * getroffen: **Fortschreibung.** Rückrechnen liesse sich nur der Konto-Teil
 * (aus Buchungen und Ankern); für Depots fehlen die historischen Kurse, für
 * manuell gepflegte Werte gibt es keine Historie. Eine Kurve, die für Konten
 * echt und für den Rest geraten ist, wäre schlechter als keine — sie sähe
 * genauso aus wie eine echte.
 *
 * Der Preis ist benannt: Die Historie beginnt bei der Einführung, nicht bei
 * der ersten Buchung. Das ist der ehrliche Handel, und die Fläche sagt es.
 *
 * Reine Form und reine Auswahl, kein I/O.
 */

/** Ein Monatsschnappschuss der Aufstellung. */
export interface NetWorthSnapshot {
  /** `YYYY-MM` — je Monat höchstens einer. */
  month: string;
  /** Stichtag, an dem der Schnappschuss entstand (ISO `YYYY-MM-DD`). */
  takenAt: string;
  netWorth: number;
  cash: number;
  investments: number;
  manualAssets: number;
  receivables: number;
  debts: number;
}

/** Monatsschlüssel eines Datums. */
export function monatsSchluessel(datum: Date): string {
  return datum.toISOString().slice(0, 7);
}

/**
 * Den Bestand um einen Schnappschuss fortschreiben.
 *
 * Je Monat gilt der ZULETZT genommene: Wer am 3. und am 28. öffnet, hat am
 * 28. den aktuelleren Stand, und zwei Punkte für denselben Monat wären eine
 * Kurve, die in sich springt. Rein — der Aufrufer speichert.
 */
export function fortschreiben(
  bestand: readonly NetWorthSnapshot[],
  neuer: NetWorthSnapshot,
): NetWorthSnapshot[] {
  const ohneMonat = bestand.filter((s) => s.month !== neuer.month);
  return [...ohneMonat, neuer].sort((a, b) => a.month.localeCompare(b.month));
}

/** Veränderung zwischen zwei Ständen — `null`, wenn es keinen Vergleich gibt. */
export interface VermoegensVeraenderung {
  von: NetWorthSnapshot;
  bis: NetWorthSnapshot;
  differenz: number;
  /** Anteil an `von.netWorth`; `null` bei Nullbasis oder Vorzeichenwechsel. */
  quote: number | null;
  monate: number;
}

/**
 * Entwicklung über die vorhandene Historie.
 *
 * Die Quote bleibt `null`, wenn der Ausgangswert null ist ODER das Vorzeichen
 * wechselt: „+250 %" von −2.000 € auf +3.000 € ist arithmetisch richtig und
 * als Aussage wertlos — der Weg aus den Schulden heraus ist keine Rendite.
 */
export function entwicklung(
  historie: readonly NetWorthSnapshot[],
): VermoegensVeraenderung | null {
  if (historie.length < 2) return null;

  const sortiert = [...historie].sort((a, b) => a.month.localeCompare(b.month));
  const von = sortiert[0];
  const bis = sortiert[sortiert.length - 1];
  const differenz = bis.netWorth - von.netWorth;

  const vorzeichenWechsel = von.netWorth < 0 !== bis.netWorth < 0;
  const quote = von.netWorth === 0 || vorzeichenWechsel ? null : differenz / Math.abs(von.netWorth);

  const [vonJahr, vonMonat] = von.month.split('-').map(Number);
  const [bisJahr, bisMonat] = bis.month.split('-').map(Number);
  const monate = (bisJahr - vonJahr) * 12 + (bisMonat - vonMonat);

  return { von, bis, differenz, quote, monate };
}
