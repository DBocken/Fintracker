import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sparkles, Check, TrendingDown, TrendingUp, CalendarClock, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useAffordability } from '@/hooks/useAffordability';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type {
  AffordabilityGoal,
  AffordabilityOption,
  AffordabilityResult,
} from '@/lib/finrisk/affordability';
import { cn } from '@/lib/utils';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface Props {
  input: ForecastInput | null;
  config: ForecastConfig;
}

function pct(p: number): string {
  return `${Math.round(p * 100)} %`;
}

function getWhenPresets(t: (key: string) => string): { label: string; days: number }[] {
  return [
    { label: t('finrisk.soon'), days: 7 },
    { label: t('finrisk.in1Month'), days: 30 },
    { label: t('finrisk.in3Months'), days: 90 },
    { label: t('finrisk.in6Months'), days: 180 },
  ];
}

/**
 * „Frag dein Geld" – Inverse Simulation: Du sagst, was du willst; die App rechnet
 * tausende deiner Zukünfte durch und antwortet mit ehrlicher Wahrscheinlichkeit –
 * und, falls knapp, mit einem Trade-off-Menü konkreter Wege zum Ziel.
 */
export default function AskYourMoney({ input, config }: Props) {
  const { t } = useI18n();
  const startISO = config.startDate ?? format(new Date(), 'yyyy-MM-dd');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState(30);
  const [goal, setGoal] = useState<AffordabilityGoal | null>(null);

  const { result, isCalculating } = useAffordability(input, config, goal);

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
  const canAsk = Number.isFinite(parsedAmount) && parsedAmount > 0 && !!input;

  const ask = () => {
    if (!canAsk) return;
    setGoal({ amount: parsedAmount, dayIndex: days });
  };

  const fmtDate = (dayIndex: number) => {
    try {
      return format(addDays(parseISO(startISO), dayIndex), 'd. MMM', { locale: de });
    } catch {
      return '';
    }
  };

  const WHEN_PRESETS = getWhenPresets(t);

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="ask-money-heading">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[hsl(var(--brand))]" />
        <h3 id="ask-money-heading" className="text-sm font-semibold">
          {t('finrisk.askYourMoneyTitle')}
        </h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('finrisk.askYourMoneyDesc')}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[120px]">
          <span className="mb-1 block text-[11px] text-muted-foreground">{t('finrisk.amount')}</span>
          <Input
            inputMode="decimal"
            placeholder={t('finrisk.amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            aria-label={t('finrisk.amountLabel')}
          />
        </label>
        <Button onClick={ask} disabled={!canAsk || isCalculating} className="shrink-0">
          {isCalculating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t('finrisk.canIAfford')}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('finrisk.when')}>
        {WHEN_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            aria-pressed={days === p.days}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs transition-colors',
              days === p.days ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isCalculating && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {t('finrisk.calculating')}
        </div>
      )}

      {!isCalculating && result && result.options.length > 0 && (
        <AffordabilityView result={result} fmtDate={fmtDate} t={t} />
      )}
      {!isCalculating && result && result.options.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('finrisk.dataInsufficient')}
        </p>
      )}
    </section>
  );
}

function AffordabilityView({
  result,
  fmtDate,
  t,
}: {
  result: AffordabilityResult;
  fmtDate: (dayIndex: number) => string;
  t: (key: string) => string;
}) {
  const baseAmount = result.goal.amount;
  const ways = useMemo(() => result.options.filter((o) => o.lever !== 'asis'), [result.options]);

  if (result.affordableAsIs) {
    return (
      <div className="mt-4 rounded-lg bg-emerald-500/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          {t('finrisk.yes')} – {t('finrisk.isAffordable').replace('{amount}', eur.format(baseAmount)).replace('{confidence}', pct(result.baseSuccess))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('finrisk.worstPoint').replace('{value}', eur.format(result.options[0].worstValue)).replace('{date}', fmtDate(result.options[0].worstDayIndex))}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm">
        <span className="font-medium">{t('finrisk.tight')}</span> {t('finrisk.withoutChange').replace('{confidence}', pct(result.baseSuccess)).replace('{target}', pct(result.targetConfidence))}
        {ways.length > 0 ? ' ' + t('finrisk.hereIsHow') : ''}
      </p>

      {ways.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('finrisk.noSimpleSolution')}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {ways.map((w, i) => (
            <WayRow key={i} option={w} fmtDate={fmtDate} t={t} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t('finrisk.disclaimer')}
      </p>
    </div>
  );
}

function WayRow({
  option,
  fmtDate,
  t,
}: {
  option: AffordabilityOption;
  fmtDate: (dayIndex: number) => string;
  t: (key: string) => string;
}) {
  const { icon, title } = describe(option, t);
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-[11px] text-muted-foreground">
            {t('finrisk.worstPoint').replace('{value}', eur.format(option.worstValue)).replace('{date}', fmtDate(option.worstDayIndex))}
          </span>
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        {pct(option.successProbability)} {t('finrisk.confident')}
      </span>
    </li>
  );
}

function describe(option: AffordabilityOption, t: (key: string) => string): { icon: JSX.Element; title: string } {
  switch (option.detail.kind) {
    case 'delay': {
      const months = Math.round(option.detail.extraDays / 30);
      if (months >= 1) {
        return {
          icon: <CalendarClock className="h-4 w-4" />,
          title: t('finrisk.delay').replace('{months}', String(months)),
        };
      }
      const weeks = Math.round(option.detail.extraDays / 7);
      return {
        icon: <CalendarClock className="h-4 w-4" />,
        title: t('finrisk.weeks').replace('{weeks}', String(weeks)),
      };
    }
    case 'cut':
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        title: t('finrisk.cut').replace('{amount}', eur.format(option.detail.perMonth)),
      };
    case 'earn':
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        title: t('finrisk.earn').replace('{amount}', eur.format(option.detail.perMonth)),
      };
    default:
      return { icon: <Check className="h-4 w-4" />, title: t('finrisk.noChange') };
  }
}
