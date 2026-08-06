import { useCallback, useMemo } from 'react';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import { formatCurrency } from '@/lib/utils';
import { maskAmount } from '@/lib/gentle-mode';

export type MoneyFormat = {
  /** Formatierter Betrag — im Sanften Modus die Maske. */
  format(amount: number, currency?: string): string;
  /** Bereits formatierte Beträge verdecken (Recharts-Ticks, fremde Formatierer). */
  mask(formatted: string): string;
  /** Für Fälle, in denen nicht der Text, sondern die Darstellung abweichen muss. */
  masked: boolean;
};

/**
 * Geldbeträge so formatieren, dass der Sanfte Modus nicht vergessen werden
 * kann (WP-9.5).
 *
 * Der Befund dahinter: 78 Dateien geben Beträge aus, **acht** haben den
 * Sanften Modus berücksichtigt — und diese acht mit drei verschiedenen
 * Masken. In der Aufrufstelle ist Maskieren eine Frage der Aufmerksamkeit;
 * hier ist es eine Eigenschaft des Formatierers.
 *
 * `mask()` gibt es zusätzlich für Stellen, die ihren eigenen Formatierer
 * mitbringen — Recharts-Achsen etwa bekommen eine Formatierungsfunktion
 * hereingereicht und sollen nicht auf `formatCurrency` umgestellt werden
 * müssen, nur um verdeckt zu werden.
 */
export function useMoneyFormat(): MoneyFormat {
  const { enabled } = useGentleMode();

  const format = useCallback(
    (amount: number, currency = 'EUR') => maskAmount(formatCurrency(amount, currency), enabled),
    [enabled],
  );

  const mask = useCallback((formatted: string) => maskAmount(formatted, enabled), [enabled]);

  return useMemo(() => ({ format, mask, masked: enabled }), [format, mask, enabled]);
}

export default useMoneyFormat;
