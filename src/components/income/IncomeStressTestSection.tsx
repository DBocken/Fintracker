import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';
import type { IncomeStream } from '@/lib/income-streams';
import IncomeStressTestDialog from './IncomeStressTestDialog';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const MIN_SHARE = 0.03;
const MAX_ROWS = 6;

/**
 * Plattform-Stresstest: je relevantem Strom eine klickbare Zeile, die den
 * „Was, wenn dieser Strom wegfällt?"-Dialog öffnet.
 */
export default function IncomeStressTestSection({ streams }: { streams: IncomeStream[] }) {
  const { t } = useI18n();
  const [active, setActive] = useState<IncomeStream | null>(null);

  const candidates = streams.filter((s) => s.share >= MIN_SHARE).slice(0, MAX_ROWS);
  if (candidates.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        {t('income.stress.sectionTitle')}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{t('income.stress.sectionDescription')}</p>
      <ul className="space-y-2">
        {candidates.map((stream) => (
          <li key={stream.key}>
            <InteractiveCard
              onClick={() => setActive(stream)}
              aria-label={t('income.stress.rowAria').replace('{name}', stream.label)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{stream.label}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {formatCurrency(stream.monthlyAverage)} · {Math.round(stream.share * 100)}%
                </span>
              </div>
            </InteractiveCard>
          </li>
        ))}
      </ul>
      <IncomeStressTestDialog stream={active} open={active !== null} onOpenChange={(o) => !o && setActive(null)} />
    </div>
  );
}
