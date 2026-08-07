/**
 * WP-6.10 — Textuelle Beschreibung einer Datenserie.
 *
 * Eine Tabelle macht die Zahlen zugänglich, aber nicht die *Aussage*. Wer ein
 * Liniendiagramm sieht, erfasst „steigt, mit einem Einbruch im März" in einer
 * Sekunde; wer 24 Tabellenzeilen vorgelesen bekommt, nicht. Diese Datei leitet
 * deshalb die Form der Kurve aus den Daten ab — als ein Satz, der vor der
 * Tabelle steht.
 *
 * Rein und ohne React: die Formulierung selbst (und damit i18n) passiert an
 * der Aufrufstelle, hier entsteht nur die Struktur.
 */

/** Wohin sich eine Serie insgesamt bewegt. */
export type SeriesTrend = 'rising' | 'falling' | 'flat';

export type SeriesShape = {
  count: number;
  first: number;
  last: number;
  min: number;
  max: number;
  /** Index des kleinsten bzw. größten Werts — für „Tiefpunkt im März". */
  minIndex: number;
  maxIndex: number;
  total: number;
  trend: SeriesTrend;
};

/**
 * Ab welcher relativen Änderung eine Serie als steigend/fallend gilt.
 *
 * Ohne Schwelle hieße jede Serie „steigend" oder „fallend" — bei Geldbeträgen
 * ist eine Änderung von exakt 0 praktisch nie. 5 % der Spannweite ist die
 * Größenordnung, ab der eine Bewegung im Diagramm überhaupt sichtbar ist.
 */
const FLAT_THRESHOLD_RATIO = 0.05;

/**
 * Beschreibt die Form einer Zahlenreihe.
 *
 * Liefert `null` für eine leere Serie: „keine Daten" ist eine andere Aussage
 * als „flach bei null" und gehört an der Aufrufstelle anders formuliert.
 * Nicht-endliche Werte werden übersprungen.
 */
export function describeSeries(values: readonly number[]): SeriesShape | null {
  const usable: number[] = [];
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) usable.push(value);
  }
  if (usable.length === 0) return null;

  let min = usable[0];
  let max = usable[0];
  let minIndex = 0;
  let maxIndex = 0;
  let total = 0;

  usable.forEach((value, index) => {
    if (value < min) {
      min = value;
      minIndex = index;
    }
    if (value > max) {
      max = value;
      maxIndex = index;
    }
    total += value;
  });

  const first = usable[0];
  const last = usable[usable.length - 1];
  const span = max - min;
  const change = last - first;
  // Bei völlig flacher Serie ist span 0 — dann ist jede Änderung ebenfalls 0
  // und die Division würde NaN ergeben.
  const relative = span === 0 ? 0 : change / span;

  let trend: SeriesTrend = 'flat';
  if (relative > FLAT_THRESHOLD_RATIO) trend = 'rising';
  else if (relative < -FLAT_THRESHOLD_RATIO) trend = 'falling';

  return { count: usable.length, first, last, min, max, minIndex, maxIndex, total, trend };
}
