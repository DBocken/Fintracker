import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dices } from 'lucide-react';
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

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd. MMM yyyy', { locale: de });
  } catch {
    return iso;
  }
}

export interface MonteCarloSettings {
  enabled: boolean;
  trials: number;
  incomeUncertain: boolean;
}

interface Props {
  settings: MonteCarloSettings;
  onChange: (patch: Partial<MonteCarloSettings>) => void;
  result: MonteCarloResult | null;
  safetyBuffer: number;
}

const TRIAL_OPTIONS = [200, 500, 1000];

/**
 * Monte-Carlo-Panel (Stufe 4): schaltet die stochastische Bandbreite ein und
 * zeigt Pufferbruch-Wahrscheinlichkeit, Verteilungen und das P10/P50/P90-Fächer-
 * diagramm der maßgeblichen Cash-Sicht.
 */
export default function MonteCarloPanel({ settings, onChange, result, safetyBuffer }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Dices className="h-4 w-4" /> Monte-Carlo-Bandbreite
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
                aria-label="Einnahmen unsicher"
              />
              <span className="text-muted-foreground">Einnahmen unsicher</span>
            </label>
          </div>

          {result && (
            <>
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
                  label="Endvermögen Median"
                  value={eur.format(result.endingNetWorth.p50)}
                  hint={`P10 ${eur.format(result.endingNetWorth.p10)}`}
                />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={result.band}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    stackOffset="none"
                  >
                    <defs>
                      <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => format(parseISO(v), 'MMM', { locale: de })}
                      minTickGap={32}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => eur.format(v)}
                      width={72}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [eur.format(v), bandLabel(name)]}
                      labelFormatter={(l: string) => fmtDate(l)}
                    />
                    {/* Untere Kante (transparent) + Bandhöhe als gestapelte Fläche. */}
                    <Area
                      type="monotone"
                      dataKey="p10"
                      name="p10"
                      stackId="band"
                      stroke="none"
                      fill="transparent"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey={(d: { p10: number; p90: number }) => d.p90 - d.p10}
                      name="p90"
                      stackId="band"
                      stroke="none"
                      fill="url(#mcBand)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="p50"
                      name="p50"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {safetyBuffer > 0 && (
                      <ReferenceLine
                        y={safetyBuffer}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                        label={{ value: 'Puffer', position: 'insideTopRight', fontSize: 11 }}
                      />
                    )}
                    <ReferenceLine
                      y={0}
                      stroke="currentColor"
                      className="stroke-muted-foreground"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.monteCarlo.trials} Durchläufe · Streuung kalibriert aus deiner Ausgaben-
                historie. Fläche = P10–P90, Linie = Median.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function bandLabel(name: string): string {
  if (name === 'p50') return 'Median';
  if (name === 'p10') return 'P10 (unten)';
  return 'Bandbreite';
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
