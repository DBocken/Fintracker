import { useMemo } from 'react';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import { buildPayoutRadar, type IncomeStream } from '@/lib/income-streams';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

function confidenceLabel(t: (k: string) => string, confidence: number): string {
  if (confidence >= 0.8) return t('income.radar.confidenceHigh');
  if (confidence >= 0.5) return t('income.radar.confidenceMedium');
  return t('income.radar.confidenceLow');
}

/**
 * Payout-Radar: „Wann kommt das nächste Geld?" — vorhergesagte nächste
 * Auszahlungen je Strom (reines Readout, kein Karten-Chrome).
 */
export default function IncomePayoutRadar({ streams }: { streams: IncomeStream[] }) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const radar = useMemo(() => buildPayoutRadar(streams), [streams]);

  return (
    <InfoGroup title={t('income.radar.title')} description={t('income.radar.description')}>
      {radar.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t('income.radar.empty')}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {radar.map((entry) => (
            <li key={entry.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{entry.label}</div>
                <div className="text-xs text-muted-foreground">
                  {entry.overdue ? (
                    <span className="text-warning">{t('income.radar.overdue')}</span>
                  ) : (
                    t('income.radar.expectedOn').replace('{date}', formatDate(entry.nextDateISO))
                  )}
                  {' · '}
                  {confidenceLabel(t, entry.confidence)}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold tabular-nums">
                {money.mask(formatCurrency(entry.nextAmount))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </InfoGroup>
  );
}
