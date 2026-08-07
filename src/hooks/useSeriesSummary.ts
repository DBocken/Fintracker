/**
 * WP-6.10 — der eine Satz, der ein Diagramm zusammenfasst.
 *
 * Verbindet die reine Formanalyse (`@/lib/chart-summary`) mit den
 * übersetzten Satzschablonen. Bewusst ein Hook und keine Modul-Konstante:
 * eine `const` mit `t()` im Initializer friert beim Import ein und ignoriert
 * jeden späteren Sprachwechsel (AGENTS.md §6, Fallen-Tabelle).
 */

import { useCallback } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { describeSeries } from '@/lib/chart-summary';

export type SeriesSummaryOptions = {
  /** Worum es geht — üblicherweise der Titel des Diagramms. */
  title: string;
  values: readonly number[];
  /** Formatiert einen Wert für die Sprachausgabe (Währung, Prozent, …). */
  formatValue: (value: number) => string;
  /** Beschriftung an einer Position — für „Tiefstwert im März". */
  labelAt: (index: number) => string;
};

/**
 * Liefert eine Funktion, die eine Zahlenreihe in einen Satz übersetzt.
 *
 * Gibt `undefined` zurück, wenn die Serie keine brauchbaren Werte enthält —
 * „keine Daten" ist eine andere Aussage als „flach bei null" und wird von der
 * Leerzustands-Darstellung der jeweiligen Karte getragen, nicht hier.
 */
export function useSeriesSummary(): (options: SeriesSummaryOptions) => string | undefined {
  const { t } = useI18n();
  const money = useMoneyFormat();

  return useCallback(
    ({ title, values, formatValue: rawFormat, labelAt }: SeriesSummaryOptions) => {
      const shape = describeSeries(values);
      if (!shape) return undefined;

      // WP-9.5: Der Sanfte Modus wirkt HIER und nicht in den ~20 Aufrufstellen.
      // Jede von ihnen reicht einen eigenen Formatierer herein; ihn dort einzeln
      // zu maskieren waere wieder eine Frage der Aufmerksamkeit.
      const formatValue = (value: number) => money.mask(rawFormat(value));

      const key =
        shape.trend === 'rising'
          ? 'chartFigure.summaryRising'
          : shape.trend === 'falling'
            ? 'chartFigure.summaryFalling'
            : 'chartFigure.summaryFlat';

      return t(key)
        .replace('{title}', title)
        .replace('{first}', formatValue(shape.first))
        .replace('{last}', formatValue(shape.last))
        .replace('{max}', formatValue(shape.max))
        .replace('{maxLabel}', labelAt(shape.maxIndex))
        .replace('{min}', formatValue(shape.min))
        .replace('{minLabel}', labelAt(shape.minIndex))
        .replace('{count}', String(shape.count));
    },
    [t, money],
  );
}
