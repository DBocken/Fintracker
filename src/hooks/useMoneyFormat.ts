import { useCallback, useMemo } from 'react';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import { formatCurrency } from '@/lib/utils';
import { isAmountMasked, maskAmount, type AmountKind, type GentleLevel } from '@/lib/gentle-mode';

export type MoneyFormat = {
  /**
   * Formatierter Betrag der Klasse `total` — Summen, Salden, Gesamtschuld.
   *
   * Die Voreinstellung ist bewusst die geschützteste Klasse: Wer nichts über
   * seinen Betrag sagt, bekommt die vorsichtigste Behandlung.
   */
  format(amount: number, currency?: string): string;
  /** Der als Nächstes fällige Betrag — sichtbar ab Stufe 2. */
  formatInstallment(amount: number, currency?: string): string;
  /** Was schon geschafft ist — sichtbar ab Stufe 1. */
  formatProgress(amount: number, currency?: string): string;
  /** Bereits formatierte Beträge verdecken (Recharts-Ticks, fremde Formatierer). */
  mask(formatted: string, kind?: AmountKind): string;
  /** Für Fälle, in denen nicht der Text, sondern die Darstellung abweichen muss. */
  masked: boolean;
  /** Dasselbe je Klasse — etwa um eine Achsenbeschriftung ganz wegzulassen. */
  isMasked(kind?: AmountKind): boolean;
  /** Die aktuelle Stufe, für Flächen, die ihre Aussage danach wählen. */
  level: GentleLevel;
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
 *
 * **Warum drei Formatierer statt eines mit Klassen-Argument.** Weil die
 * geschützteste Klasse dann die ist, die man bekommt, ohne etwas zu tun.
 * `format(betrag, 'EUR', 'installment')` verlangt, an die Währung zu denken,
 * um über die Klasse zu sprechen — und macht die riskante Angabe zur
 * bequemeren. Die Stufen selbst stehen in `docs/debt-avoidance-recovery.md`.
 */
export function useMoneyFormat(): MoneyFormat {
  const { level } = useGentleMode();

  const format = useCallback(
    (amount: number, currency = 'EUR') => maskAmount(formatCurrency(amount, currency), level),
    [level],
  );

  const formatInstallment = useCallback(
    (amount: number, currency = 'EUR') =>
      maskAmount(formatCurrency(amount, currency), level, 'installment'),
    [level],
  );

  const formatProgress = useCallback(
    (amount: number, currency = 'EUR') =>
      maskAmount(formatCurrency(amount, currency), level, 'progress'),
    [level],
  );

  const mask = useCallback(
    (formatted: string, kind?: AmountKind) => maskAmount(formatted, level, kind),
    [level],
  );

  const isMasked = useCallback((kind?: AmountKind) => isAmountMasked(level, kind), [level]);

  return useMemo(
    () => ({
      format,
      formatInstallment,
      formatProgress,
      mask,
      masked: isAmountMasked(level),
      isMasked,
      level,
    }),
    [format, formatInstallment, formatProgress, mask, isMasked, level],
  );
}

export default useMoneyFormat;
