import { useEffect, useState } from 'react';
import { InfoStatStrip } from '@/features/shared/presentation/InfoGroup';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { TaxYearReport } from '@/lib/tax-report';

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** Zählt einen Betrag beim Mount hoch (datengetriebener Aufbau, reduced-motion-fest). */
function useCountUp(target: number): number {
  const [value, setValue] = useState(REDUCED_MOTION ? target : 0);
  useEffect(() => {
    if (REDUCED_MOTION) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 600;
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export function TaxSummaryStrip({ report }: { report: TaxYearReport }) {
  const { t } = useI18n();
  const credit = useCountUp(report.creditTotal);

  return (
    <InfoStatStrip
      items={[
        {
          label: t('tax.page.markedTotal', 'Markierte Ausgaben'),
          value: formatCurrency(report.markedTotal),
        },
        {
          label: t('tax.page.creditTotal', 'Steuerermäßigung (§35a/§35c)'),
          value: formatCurrency(credit),
          tone: report.creditTotal > 0 ? 'positive' : 'default',
        },
        {
          label: t('tax.page.txCount', 'Buchungen'),
          value: String(report.txCount),
        },
      ]}
    />
  );
}
