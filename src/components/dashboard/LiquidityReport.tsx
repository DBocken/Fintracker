import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, ShieldCheck, TrendingDown, CalendarClock, Lightbulb } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useScenarioForecast } from '@/hooks/useScenarioForecast';
import { useMonteCarloForecast } from '@/hooks/useMonteCarloForecast';
import ForecastPlanner from '@/components/dashboard/ForecastPlanner';
import ScenarioPanel from '@/components/dashboard/ScenarioPanel';
import MonteCarloPanel, {
  type MonteCarloSettings,
} from '@/components/dashboard/MonteCarloPanel';
import { buildPresetScenarios } from '@/lib/forecast-scenario';
import type { BufferBasis } from '@/lib/forecast-types';

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

function fmtMonth(yyyymm: string): string {
  try {
    return format(parseISO(`${yyyymm}-01`), 'MMM yyyy', { locale: de });
  } catch {
    return yyyymm;
  }
}

/** Eine kompakte KPI-Kachel. */
function Kpi({
  icon,
  label,
  value,
  tone = 'default',
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'critical' | 'good';
  hint?: string;
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
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const HORIZON_OPTIONS = [6, 12, 24, 36];

/**
 * Liquiditäts-Report (Stufe 1): zeigt die tagesgenaue Liquiditätsprojektion mit
 * Sicherheitspuffer, Monatstief, Risiko-Kennzahlen und Monatszusammenfassungen.
 */
export default function LiquidityReport() {
  const { overrides, updateConfig, updatePlanning } = useForecastOverrides();
  const { months, safetyBuffer, bufferBasis } = overrides;
  const setMonths = (m: number) => updateConfig({ months: m });
  const setSafetyBuffer = (b: number) => updateConfig({ safetyBuffer: b });
  const setBufferBasis = (b: BufferBasis) => updateConfig({ bufferBasis: b });

  const { forecast, input, analysis, isLoading, isError, error } = useForecast({
    months,
    safetyBuffer,
    bufferBasis,
  });

  // Szenarien (Stufe 3): Presets + eigene, aktives Szenario als lokaler Zustand.
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const scenarios = useMemo(() => {
    const presets = forecast ? buildPresetScenarios(forecast.config.startDate) : [];
    return [...presets, ...overrides.scenarios];
  }, [forecast, overrides.scenarios]);
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { scenarioResult, comparison } = useScenarioForecast(
    input,
    forecast,
    { months, safetyBuffer, bufferBasis },
    activeScenario,
  );

  // Monte Carlo (Stufe 4): stochastische Bandbreite, hinter einem Schalter.
  const [mcSettings, setMcSettings] = useState<MonteCarloSettings>({
    enabled: false,
    trials: 500,
    incomeUncertain: false,
  });
  const monteCarlo = useMonteCarloForecast(
    input,
    { months, safetyBuffer, bufferBasis },
    {
      trials: mcSettings.trials,
      seed: 1,
      incomeVolatility: mcSettings.incomeUncertain ? 0.08 : 0,
    },
    mcSettings.enabled,
  );

  const chartData = useMemo(() => {
    if (!forecast) return [];
    const pick = (d: { availableCash: number; operatingCash: number }) =>
      bufferBasis === 'available' ? d.availableCash : d.operatingCash;
    const scenarioByDate = new Map(
      (scenarioResult?.daily ?? []).map((d) => [d.date, pick(d)]),
    );
    return forecast.daily.map((d) => ({
      date: d.date,
      operating: pick(d),
      scenario: scenarioByDate.get(d.date),
    }));
  }, [forecast, scenarioResult, bufferBasis]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Forecast konnte nicht berechnet werden</AlertTitle>
        <AlertDescription>{error?.message ?? 'Unbekannter Fehler.'}</AlertDescription>
      </Alert>
    );
  }

  if (!forecast) return null;

  const { risk, monthly, insights } = forecast;
  const breach = risk.firstBelowSafetyBufferDate;
  const lowestTone = risk.lowestBalance < 0 ? 'critical' : breach ? 'warning' : 'good';

  return (
    <div className="space-y-6">
      {/* Steuerung */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Horizont</span>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} Monate
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sicherheitspuffer</span>
          <Select value={String(safetyBuffer)} onValueChange={(v) => setSafetyBuffer(Number(v))}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 500, 1000, 2000, 5000].map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {eur.format(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Basis</span>
          <Select value={bufferBasis} onValueChange={(v) => setBufferBasis(v as BufferBasis)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operating">Giro (operativ)</SelectItem>
              <SelectItem value="available">Verfügbar (inkl. Reserve)</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Planung: Zinsen, Budgets, geplante Posten, Rücklagen */}
      <ForecastPlanner overrides={overrides} onChange={updatePlanning} input={input} />

      {/* Szenarien: Was-wäre-wenn */}
      <ScenarioPanel
        scenarios={scenarios}
        activeId={activeScenarioId}
        onSelect={setActiveScenarioId}
        comparison={comparison}
        customScenarios={overrides.scenarios}
        onAddScenario={(s) => updateConfig({ scenarios: [...overrides.scenarios, s] })}
        onDeleteScenario={(id) =>
          updateConfig({ scenarios: overrides.scenarios.filter((s) => s.id !== id) })
        }
      />

      {/* Monte Carlo: stochastische Bandbreite */}
      <MonteCarloPanel
        settings={mcSettings}
        onChange={(patch) => setMcSettings((prev) => ({ ...prev, ...patch }))}
        result={monteCarlo}
        safetyBuffer={safetyBuffer}
      />

      {/* Insight */}
      {insights[0] && (
        <Alert variant={insights[0].kind === 'below_buffer' ? 'destructive' : 'default'}>
          {insights[0].kind === 'below_buffer' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          <AlertTitle>
            {insights[0].kind === 'below_buffer'
              ? 'Liquiditätsrisiko erkannt'
              : 'Liquidität stabil'}
          </AlertTitle>
          <AlertDescription>{insights[0].message}</AlertDescription>
        </Alert>
      )}

      {/* Risikotreiber & Empfehlung */}
      {analysis && breach && (analysis.drivers.length > 0 || analysis.recommendation) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {analysis.drivers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risikotreiber</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Vom Hoch am {fmtDate(analysis.drawdownStart)} bis zum Tief am{' '}
                  {fmtDate(analysis.troughDate)} belasten diese Posten am stärksten:
                </p>
                <ul className="space-y-2">
                  {analysis.drivers.map((d, i) => (
                    <li key={`${d.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{d.name}</span>
                        {d.occurrences && d.occurrences > 1 && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {d.occurrences}×
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        −{eur.format(d.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {analysis.recommendation && (
            <Card className="border-emerald-600/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Empfehlung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{analysis.recommendation.message}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={<TrendingDown className="h-4 w-4" />}
          label="Tiefststand"
          value={eur.format(risk.lowestBalance)}
          tone={lowestTone}
          hint={fmtDate(risk.lowestBalanceDate)}
        />
        <Kpi
          icon={<CalendarClock className="h-4 w-4" />}
          label="Erster Pufferbruch"
          value={breach ? fmtDate(breach) : 'keiner'}
          tone={breach ? 'warning' : 'good'}
          hint={breach ? `${risk.daysBelowSafetyBuffer} Tage unter Puffer` : 'im Horizont'}
        />
        <Kpi
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Min. Giro"
          value={eur.format(risk.minimumOperatingCash)}
          hint="operativ verfügbar"
        />
        <Kpi
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Min. verfügbar"
          value={eur.format(risk.minimumAvailableCash)}
          hint="inkl. Reserve"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Liquiditätsverlauf ({bufferBasis === 'available' ? 'verfügbar' : 'Giro'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="liqFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d5c54" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1d5c54" stopOpacity={0.02} />
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
                  formatter={(v: number, name: string) => [
                    eur.format(v),
                    name === 'scenario' ? activeScenario?.name ?? 'Szenario' : 'Basis',
                  ]}
                  labelFormatter={(l: string) => fmtDate(l)}
                />
                <Area
                  type="monotone"
                  dataKey="operating"
                  name="operating"
                  stroke="#1d5c54"
                  strokeWidth={2}
                  fill="url(#liqFill)"
                />
                {activeScenario && (
                  <Line
                    type="monotone"
                    dataKey="scenario"
                    name="scenario"
                    stroke="#d97706"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                )}
                {safetyBuffer > 0 && (
                  <ReferenceLine
                    y={safetyBuffer}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{ value: 'Puffer', position: 'insideTopRight', fontSize: 11 }}
                  />
                )}
                <ReferenceLine y={0} stroke="currentColor" className="stroke-muted-foreground" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monatskarten */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Monatsübersicht</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {monthly.map((m) => (
            <Card key={m.month} className={m.belowSafetyBuffer ? 'border-warning' : undefined}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{fmtMonth(m.month)}</span>
                  {m.belowSafetyBuffer && (
                    <Badge variant="outline" className="border-warning text-warning">
                      unter Puffer
                    </Badge>
                  )}
                </div>
                <dl className="space-y-1 text-sm">
                  <Row label="Einnahmen" value={eur.format(m.income)} positive />
                  <Row label="Fixkosten" value={`−${eur.format(m.fixedExpenses)}`} />
                  <Row label="Variabel" value={`−${eur.format(m.variableExpenses)}`} />
                  {m.transfersOut > 0 && (
                    <Row label="Sparen/Transfer" value={`−${eur.format(m.transfersOut)}`} />
                  )}
                  {m.interest > 0 && (
                    <Row label="Zinsen" value={`+${eur.format(m.interest)}`} positive />
                  )}
                  <div className="my-1 border-t" />
                  <Row label="Monatsende" value={eur.format(m.closingBalance)} bold />
                  <Row
                    label="Monatstief"
                    value={`${eur.format(m.lowestBalance)} · ${format(parseISO(m.lowestBalanceDate), 'd.M.', { locale: de })}`}
                    muted
                  />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  bold,
  muted,
}: {
  label: string;
  value: string;
  positive?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={[
          positive ? 'text-emerald-600 dark:text-emerald-400' : '',
          bold ? 'font-semibold' : '',
          muted ? 'text-xs text-muted-foreground' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}
