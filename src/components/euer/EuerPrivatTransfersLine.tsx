import { InfoGroup } from '@/components/common/InfoGroup';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { EuerReport } from '@/lib/euer-report';

/** Kartenlose Info-Zeile: Privatentnahmen/-einlagen sind NIE gewinnwirksam. */
export function EuerPrivatTransfersLine({ report }: { report: EuerReport }) {
  const { t } = useI18n();
  const { entnahmen, einlagen } = report.privatTransfers;
  if (entnahmen <= 0 && einlagen <= 0) return null;

  return (
    <InfoGroup
      title={t('euer.page.privatTitle', 'Privatentnahmen & -einlagen')}
      description={t('euer.page.privatHint', 'Nie gewinnwirksam – reine Info für die Anlage EÜR.')}
    >
      <dl className="space-y-1 text-sm">
        {entnahmen > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t('euer.page.privatEntnahmen', 'Privatentnahmen')}</dt>
            <dd className="tabular-nums">{formatCurrency(entnahmen)}</dd>
          </div>
        )}
        {einlagen > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t('euer.page.privatEinlagen', 'Privateinlagen')}</dt>
            <dd className="tabular-nums">{formatCurrency(einlagen)}</dd>
          </div>
        )}
      </dl>
    </InfoGroup>
  );
}
