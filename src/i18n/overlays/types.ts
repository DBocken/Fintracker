import type { TranslationTree } from '../translations/de';

/**
 * Dünnes Overlay über dem Basisbaum. Es führt NIE einen neuen Key ein, es
 * ersetzt nur den Wert eines Keys, den alle Locales ohnehin schon haben —
 * deshalb verletzt es AGENTS.md §6 nicht.
 *
 * Zwei Eigenschaften, beide notwendig:
 *
 * 1. Jeder Zweig ist optional — nur Abweichungen stehen drin.
 * 2. Blätter werden auf `string` GEWEITET. `translations` ist `as const`,
 *    seine Blätter sind damit String-LITERALE (`'Liquidität'`). Ein naives
 *    `DeepPartial<TranslationTree>` würde vom Overlay exakt denselben
 *    Literalwert verlangen und wäre unbenutzbar.
 *
 * Tippschutz kommt gratis: bei einem direkt annotierten Objektliteral greift
 * die Excess-Property-Prüfung rekursiv, `{ netWorth: { liquidty: '…' } }` ist
 * also ein Compile-Fehler — eine Garantie, die der Basisbaum selbst für
 * `en`/`ru` nicht hat.
 */
export type TranslationOverlay<T = TranslationTree> = {
  [K in keyof T]?: T[K] extends string ? string : TranslationOverlay<T[K]>;
};
