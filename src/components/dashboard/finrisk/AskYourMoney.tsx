import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sparkles, Check, TrendingDown, TrendingUp, CalendarClock, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

/** Zeitpunkt-Vorlagen (Tagindex ab heute). */
const WHEN_PRESETS: { label: string; days: number }[] = [
  { label: 'bald', days: 7 },
  { label: 'in 1 Monat', days: 30 },
  { label: 'in 3 Monaten', days: 90 },
  { label: 'in 6 Monaten', days: 180 },
];

function pct(p: number): string {
  return `${Math.round(p * 100)} %`;
}

function whenLabel(extraDays: number): string {
  if (extraDays % 30 === 0) {
    const m = extraDays / 30;
    return `${m} ${m === 1 ? 'Monat' : 'Monate'} später`;
  }
  return `${Math.round(extraDays / 7)} Wochen später`;
}

/**
 * „Frag dein Geld" – Inverse Simulation: Du sagst, was du willst; die App rechnet
 * tausende deiner Zukünfte durch und antwortet mit ehrlicher Wahrscheinlichkeit –
 * und, falls knapp, mit einem Trade-off-Menü konkreter Wege zum Ziel.
 */
export default function AskYourMoney({ input, config }: Props) {
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

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="ask-money-heading">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[hsl(var(--brand))]" />
        <h3 id="ask-money-heading" className="text-sm font-semibold">
          Frag dein Geld
        </h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Kann ich mir das leisten? Ich rechne tausende deiner möglichen Zukünfte durch – und sage
        dir ehrlich, mit welcher Sicherheit. Lokal, nichts verlässt dein Gerät.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[120px]">
          <span className="mb-1 block text-[11px] text-muted-foreground">Betrag</span>
          <Input
            inputMode="decimal"
            placeholder="z. B. 2500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            aria-label="Betrag in Euro"
          />
        </label>
        <Button onClick={ask} disabled={!canAsk || isCalculating} className="shrink-0">
          {isCalculating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Kann ich mir das leisten?'}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Zeitpunkt">
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
          Ich rechne tausende Wege durch …
        </div>
      )}

      {!isCalculating && result && result.options.length > 0 && (
        <AffordabilityView result={result} fmtDate={fmtDate} />
      )}
      {!isCalculating && result && result.options.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Für diese Auswertung fehlen noch Daten (z. B. ein Zahlungskonto).
        </p>
      )}
    </section>
  );
}

function AffordabilityView({
  result,
  fmtDate,
}: {
  result: AffordabilityResult;
  fmtDate: (dayIndex: number) => string;
}) {
  const baseAmount = result.goal.amount;
  const ways = useMemo(() => result.options.filter((o) => o.lever !== 'asis'), [result.options]);

  if (result.affordableAsIs) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          Ja – {eur.format(baseAmount)} sind mit {pct(result.baseSuccess)} Sicherheit drin.
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tiefpunkt im pessimistischen Fall: {eur.format(result.options[0].worstValue)} am{' '}
          {fmtDate(result.options[0].worstDayIndex)}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm">
        <span className="font-medium">Knapp.</span> Ohne Änderung nur{' '}
        <span className="font-medium">{pct(result.baseSuccess)}</span> sicher
        {' '}(Ziel: {pct(result.targetConfidence)}).
        {ways.length > 0 ? ' So klappt es:' : ''}
      </p>

      {ways.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Mit einer einzelnen einfachen Änderung erreichbar wird es so nicht – versuch einen
          kleineren Betrag oder einen späteren Zeitpunkt.
        </p>
      ) : (
        <ul className="space-y-2">
          {ways.map((w, i) => (
            <WayRow key={i} option={w} fmtDate={fmtDate} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        Bewusstes Was-wäre-wenn auf Basis deiner echten Ein-/Ausgaben und deren Schwankung – keine
        Garantie.
      </p>
    </div>
  );
}

function WayRow({
  option,
  fmtDate,
}: {
  option: AffordabilityOption;
  fmtDate: (dayIndex: number) => string;
}) {
  const { icon, title } = describe(option);
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-background p-2.5">
      <span className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-[11px] text-muted-foreground">
            Tiefpunkt {eur.format(option.worstValue)} am {fmtDate(option.worstDayIndex)}
          </span>
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        {pct(option.successProbability)} sicher
      </span>
    </li>
  );
}

function describe(option: AffordabilityOption): { icon: JSX.Element; title: string } {
  switch (option.detail.kind) {
    case 'delay':
      return {
        icon: <CalendarClock className="h-4 w-4" />,
        title: whenLabel(option.detail.extraDays) + ' kaufen',
      };
    case 'cut':
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        title: `${eur.format(option.detail.perMonth)} pro Monat weniger ausgeben`,
      };
    case 'earn':
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        title: `${eur.format(option.detail.perMonth)} pro Monat mehr verdienen`,
      };
    default:
      return { icon: <Check className="h-4 w-4" />, title: 'Ohne Änderung' };
  }
}
