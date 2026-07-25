/**
 * Hilfsfunktionen für Recharts-Tooltips.
 *
 * recharts 3 typisiert die Werte, die an `formatter`/`labelFormatter` gehen,
 * bewusst weit: `ValueType` deckt `number | string | Array` ab und darf
 * `undefined` sein, `NameType`/`label` sind ReactNode. Vorher waren die
 * Callbacks in dieser Codebasis auf `number`/`string` annotiert — das war eine
 * Zusicherung, die die Bibliothek nie gegeben hat.
 *
 * In Fintracker zeigen alle `dataKey`s auf numerische Felder (die Chart-Daten
 * kommen aus `@/lib/analysis-data` und Co.), der nicht-numerische Fall tritt
 * also praktisch nicht ein. Die Helfer machen die Konvertierung an einer
 * Stelle total, statt sie an 15 Aufrufstellen per Cast zu übergehen.
 */

/** Tooltip-Wert als Zahl; nicht-numerische Eingaben werden zu 0. */
export function chartNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(value)) return chartNumber(value[0]);
  return 0;
}

/** Tooltip-Name/-Label als String; `null`/`undefined` werden zu ''. */
export function chartText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}
