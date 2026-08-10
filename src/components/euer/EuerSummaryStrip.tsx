import { InfoStatStrip } from '@/features/shared/presentation/InfoGroup';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { EuerReport } from '@/lib/euer-report';

export function EuerSummaryStrip({ report }: { report: EuerReport }) {
  const { t } = useI18n();
  // Gewinn zählt datengetrieben hoch (Aufbau-Baseline, reduced-motion-fest).
  const gewinn = useAnimatedNumber(report.gewinn, { enabled: !useReducedMotion() });

  return (
    <InfoStatStrip
      items={[
        {
          label: t('euer.page.income', 'Betriebseinnahmen'),
          value: formatCurrency(report.einnahmen.total),
        },
        {
          label: t('euer.page.expensesDeductible', 'Abziehbare Ausgaben'),
          value: formatCurrency(report.ausgaben.deductibleTotal),
        },
        {
          label: t('euer.page.profit', 'Gewinn'),
          value: formatCurrency(gewinn),
          tone: report.gewinn >= 0 ? 'positive' : 'critical',
        },
      ]}
    />
  );
}
