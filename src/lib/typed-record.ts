/**
 * WP 5.3 (KOMP-5) — `(Object.keys(labels) as T[])` stand als eigener Cast an
 * fünf Stellen in `BudgetFormDialog.tsx` und zwei Stellen in
 * `DebtFormDialog.tsx`, immer um dieselbe Enum-Beschriftung (`Record<T,
 * string>`) in `<SelectItem>`-Optionen zu verwandeln.
 *
 * `Object.keys` liefert zur Laufzeit immer `string[]` — TypeScript hat keine
 * Möglichkeit, aus einem `Record<T, …>`-Objekt zur Laufzeit die engere Union
 * `T` zurückzugewinnen. Der Cast ist an DIESER Stelle unvermeidlich; er
 * gehört aber einmal hierher, nicht an jede Aufrufstelle.
 */

/** Schlüssel eines `Record<T, …>` als `T[]`, nicht als `string[]`. */
export function typedKeys<T extends string>(record: Record<T, unknown>): T[] {
  return Object.keys(record) as T[];
}

/** Eine `<SelectItem>`-taugliche Option: der typisierte Wert plus sein Label. */
export interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

/** Baut aus einem Enum-Label-Record (`{ [K in T]: string }`) eine Options-Liste. */
export function recordToOptions<T extends string>(record: Record<T, string>): LabeledOption<T>[] {
  return typedKeys(record).map((value) => ({ value, label: record[value] }));
}
