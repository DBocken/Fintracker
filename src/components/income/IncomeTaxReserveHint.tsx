import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { InfoGroup } from '@/components/common/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import { getUserSettings } from '@/services/transaction-service';
import { computeTaxReserve, resolveTaxReservePercent } from '@/lib/tax-reserve';
import type { IncomeStream } from '@/lib/income-streams';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * Steuer-Puffer-Hinweis: „Davon solltest du ~X % zurücklegen." Reines Readout
 * (kein Karten-Chrome) mit Pflicht-Disclaimer. Verschwindet vollständig, wenn
 * der Prozentsatz auf 0 steht oder kein steuerrelevantes Einkommen vorliegt.
 */
export default function IncomeTaxReserveHint({ streams }: { streams: IncomeStream[] }) {
  const { t } = useI18n();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const percent = resolveTaxReservePercent(settings);
  const result = computeTaxReserve(streams, percent);
  if (!result) return null;

  return (
    <InfoGroup title={t('income.tax.title')}>
      <ul className="space-y-1">
        {result.byMain.map((entry) => (
          <li key={entry.mainCategoryId} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">{entry.mainCategoryName}</span>
            <span className="shrink-0 tabular-nums">
              {formatCurrency(entry.incomeTotal)} → {formatCurrency(entry.reserveAmount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-sm font-semibold">
        <span>{t('income.tax.reserveTotalLabel')}</span>
        <span className="tabular-nums">{formatCurrency(result.reserveTotal)}</span>
      </div>
      <p className="mt-2 text-sm">{t('income.tax.hintLine').replace('{percent}', String(result.percent))}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('income.tax.disclaimer')}</p>
      <Link to="/settings" className="mt-1 inline-block text-xs text-brand hover:underline">
        {t('income.tax.settingsLink')}
      </Link>
    </InfoGroup>
  );
}
