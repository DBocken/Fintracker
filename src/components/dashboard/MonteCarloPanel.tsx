import { Dices, LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MonteCarloResult } from '@/lib/forecast-montecarlo-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export interface MonteCarloSettings {
  enabled: boolean;
  trials: number;
  incomeUncertain: boolean;
}

interface Props {
  settings: MonteCarloSettings;
  onChange: (patch: Partial<MonteCarloSettings>) => void;
  result: MonteCarloResult | null;
  isCalculating?: boolean;
  contextLabel?: string;
}

const TRIAL_OPTIONS = [200, 500, 1000];

/**
 * Monte-Carlo-Steuerung & Kennzahlen (Stufe 4). Die Wahrscheinlichkeits-
 * verteilung selbst (P10–P90-Gradientband + Median) wird direkt im Haupt-
 * Liquiditätschart gezeichnet – hier stehen nur Schalter und die Kennzahlen,
 * damit es genau EINE Darstellung gibt.
 */
export default function MonteCarloPanel({
  settings,
  onChange,
  result,
  isCalculating = false,
  contextLabel = 'Basisplanung',
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Dices className="h-4 w-4" /> Wahrscheinlichkeits-Simulation
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => onChange({ enabled: v })}
            aria-label="Monte Carlo aktivieren"
          />
        </CardTitle>
      </CardHeader>
      {settings.enabled && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Durchläufe</span>
              <Select
                value={String(settings.trials)}
                onValueChange={(v) => onChange({ trials: Number(v) })}
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIAL_OPTIONS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={settings.incomeUncertain}
                onCheckedChange={(v) => onChange({ incomeUncertain: v })}
                aria-label="Einnahmen pauschal mit acht Prozent Streuung berechnen"
              />
              <span className="text-muted-foreground">Einnahmen mit 8 % Streuung</span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Berechnet für: <span className="font-medium text-foreground">{contextLabel}</span>
            {result && (
              <>
                {' · '}
                {result.monteCarlo.trials} Durchläufe · das Gradientband (P10–P90) liegt im Chart oben.
              </>
            )}
          </p>

          {isCalculating && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Wahrscheinlichkeitsspanne wird berechnet …
            </div>
          )}

          {result && !isCalculating && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Pufferbruch"
                value={`${Math.round(result.breachProbability * 100)} %`}
                tone={
                  result.breachProbability >= 0.5
                    ? 'critical'
                    : result.breachProbability > 0
                      ? 'warning'
                      : 'good'
                }
                hint="Wahrscheinlichkeit"
              />
              <Stat
                label="Tiefststand P10"
                value={eur.format(result.lowestBalance.p10)}
                hint="pessimistisch"
              />
              <Stat
                label="Tiefststand Median"
                value={eur.format(result.lowestBalance.p50)}
                hint="P50"
              />
              <Stat
                label="Kontosumme am Ende"
                value={eur.format(result.endingNetWorth.p50)}
                hint={`P10 ${eur.format(result.endingNetWorth.p10)}`}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'critical' | 'good';
}) {
  const toneClass =
    tone === 'critical'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'good'
          ? 'text-emerald-600 dark:text-emerald-400'
          : '';
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
