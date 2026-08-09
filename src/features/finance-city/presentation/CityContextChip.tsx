/**
 * Kontext-Chip der aktuellen Ebene (WP-D3, herausgelöst aus `CityPage.tsx` in
 * WP 6.4): Was betrachte ich? Wie groß ist es? Welcher Anteil an der
 * Gesamtausgabe?
 *
 * Bewusst OHNE Karten-Chrome/Rahmen — reines Readout, kein Klickziel
 * (`docs/design-principles.md` Prinzip 8 greift daher nicht). Die Zahlen
 * kommen fertig aus `domain/city-context.ts`; hier findet keine Aggregation
 * statt (AGENTS.md §8).
 */

import { useI18n } from '@/i18n/useI18n';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CityContextSummary } from '../domain/city-context';
import type { CityOverviewInfo } from '../domain/city-overview-adapter';

export type CityContextChipProps = {
  context: CityContextSummary;
  /** Nur in der Übersicht gesetzt (WP-D8): beide Seiten und was übrig bleibt. */
  overview?: CityOverviewInfo;
  /** Nur in der Ziele-Welt gesetzt (WP-D7): Summen über Brüche wären sinnlos, der Chip zählt Trophäen. */
  goalsSummary: { achieved: number; total: number } | null;
  isIncomeWorld: boolean;
  valueFormat: 'currency' | 'percent';
  formatAmount: (amount: number) => string;
};

export function CityContextChip(props: CityContextChipProps) {
  return (
    <div
      data-testid="city-context-chip"
      className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground"
    >
      {props.context.kind === 'city' ? <CityLevelSummary {...props} /> : <FocusSummary {...props} />}
    </div>
  );
}

/** Stadt-Ebene: Trophäen (Ziele), Bilanz (Übersicht) oder Gesamtbetrag. */
function CityLevelSummary({ context, overview, goalsSummary, isIncomeWorld }: CityContextChipProps) {
  const { t } = useI18n();
  if (context.kind !== 'city') return null;

  if (goalsSummary) {
    return (
      <span className="font-medium text-foreground">
        {t('city.contextGoalsSummary')
          .replace('{achieved}', String(goalsSummary.achieved))
          .replace('{count}', String(goalsSummary.total))}
      </span>
    );
  }

  if (overview) {
    return (
      <>
        {t('city.tabIncome')} {formatCurrency(overview.incomeTotal)}
        {' · '}
        {t('city.tabExpenses')} {formatCurrency(overview.expensesTotal)}
        {' · '}
        <span className="font-medium text-foreground">
          {t(overview.balance >= 0 ? 'city.overviewBalanceSurplus' : 'city.overviewBalanceDeficit')}{' '}
          {formatCurrency(Math.abs(overview.balance))}
        </span>
      </>
    );
  }

  return (
    <>
      {t(isIncomeWorld ? 'city.contextTotalIncomeLabel' : 'city.contextTotalLabel')} ·{' '}
      <span className="font-medium text-foreground">{formatCurrency(context.amount)}</span>
    </>
  );
}

/**
 * Distrikt-/Etagen-Ebene. Gebäude-/Etagen-Zähler und Anteils-Prozente gibt es
 * nur in den Geld-Welten — im Ziele-Modell (1 Gebäude je Bauprojekt, Brüche
 * statt Beträge) wären sie Rauschen.
 */
function FocusSummary({ context, isIncomeWorld, valueFormat, formatAmount }: CityContextChipProps) {
  const { t } = useI18n();
  if (context.kind === 'city') return null;
  const isMoney = valueFormat === 'currency';

  return (
    <>
      <span className="font-medium text-foreground">{context.label}</span>
      {' · '}
      {formatAmount(context.amount)}
      {isMoney && context.kind === 'district' && (
        <>
          {' · '}
          {t('city.contextBuildingCount').replace('{count}', String(context.buildingCount))}
        </>
      )}
      {isMoney && context.kind === 'subcategory' && context.contractCount > 0 && (
        <>
          {' · '}
          {/* WP-D5: Einnahmen-Etagen sind MONATE, Ausgaben-Etagen Verträge/Händler. */}
          {t(isIncomeWorld ? 'city.contextMonthCount' : 'city.contextContractCount').replace(
            '{count}',
            String(context.contractCount),
          )}
        </>
      )}
      {isMoney && typeof context.share === 'number' && (
        <>
          {' · '}
          {t(isIncomeWorld ? 'city.contextShareOfTotalIncome' : 'city.contextShareOfTotal').replace(
            '{percent}',
            formatPercent(context.share, 0),
          )}
        </>
      )}
    </>
  );
}
