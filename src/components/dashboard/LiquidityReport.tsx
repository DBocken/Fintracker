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
import { AlertTriangle, ShieldCheck, TrendingDown, CalendarClock, Lightbulb, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useMonteCarloForecast } from '@/hooks/useMonteCarloForecast';
import ForecastPlanner from '@/components/dashboard/ForecastPlanner';
import MonteCarloPanel, {
  type MonteCarloSettings,
} from '@/components/dashboard/MonteCarloPanel';
import { FeatureGate } from '@/components/FeatureGate';
import { DataQualityNotice } from '@/components/dashboard/DataQualityNotice';
import FinRiskSection from '@/components/dashboard/finrisk/FinRiskSection';
import BudgetOptimizerPanel from '@/components/dashboard/BudgetOptimizerPanel';
import { summarizeOverrides, type OverrideChange } from '@/lib/forecast-overrides-summary';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
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
    <Card className="p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

const HORIZON_OPTIONS = [6, 12, 24, 36];

/**
 * Liquiditäts-Report (Stufe 1): zeigt die tagesgenaue Liquiditätsprojektion mit
 * Sicherheitspuffer, Monatstief, Risiko-Kennzahlen und Monatszusammenfassungen.
 *
 * Layout: auf großen Schirmen zweispaltig – links das Ergebnis (Chart +
 * Kennzahlen), rechts die Szenario-Steuerung (klebt beim Scrollen). So geht
 * durch die Zentrierung keine Fläche verloren. Mobil bleibt alles gestapelt.
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

  // Aktive Annahmen: aus den direkt eingetragenen Overrides verdichtet. Ersetzt
  // den früheren Szenario-Vergleich – der Nutzer plant unmittelbar, sieht hier
  // jede Abweichung vom Ist-Zustand und kann sie einzeln zurücknehmen.
  const activeChanges = useMemo(
    () =>
      summarizeOverrides(overrides, {
        flows: input?.allRecurringFlows ?? input?.recurringFlows,
      }),
    [overrides, input],
  );

  // Einen einzelnen Annahme-Chip lösen (gezielt das richtige Feld räumen).
  const clearChange = (c: OverrideChange) => clearOverrideChange(overrides, c, updatePlanning);

  // Monte Carlo (Stufe 4): stochastische Bandbreite. Standardmäßig an – die
  // eigentliche Simulation über X Durchläufe ist das Herzstück der Seite und
  // soll die Wahrscheinlichkeitsverteilung sofort zeigen (Web-Worker, blockiert
  // das UI nicht). Speist direkt aus `input`, das die eingetragenen Annahmen
  // bereits enthält – deterministische Linie und Band beantworten dieselbe Frage.
  const [mcSettings, setMcSettings] = useState<MonteCarloSettings>({
    enabled: true,
    trials: 500,
    incomeUncertain: false,
  });
  const { result: monteCarlo, isCalculating: isMonteCarloCalculating } = useMonteCarloForecast(
    input,
    { months, safetyBuffer, bufferBasis, useDailyProfile: true },
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
    // Das Monte-Carlo-Band (P10–P90) wird hier in dieselbe Zeitachse gelegt,
    // damit die Wahrscheinlichkeitsverteilung als Gradient im EINEN Chart liegt.
    const bandByDate = new Map((monteCarlo?.band ?? []).map((d) => [d.date, d]));
    return forecast.daily.map((d) => {
      const band = bandByDate.get(d.date);
      return {
        date: d.date,
        operating: pick(d),
        // Untere Kante + Bandhöhe (gestapelt) ergeben die P10–P90-Fläche.
        bandFloor: band?.p10,
        bandHeight: band ? band.p90 - band.p10 : undefined,
        median: band?.p50,
      };
    });
  }, [forecast, bufferBasis, monteCarlo]);

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

  // Tooltip-Beschriftung der Chart-Serien (eine Darstellung: Plan + Monte-Carlo-Median).
  const CHART_SERIES_LABELS: Record<string, string> = {
    operating: 'Plan',
    median: 'Median (P50)',
  };

  const { risk, monthly, insights } = forecast;
  const breach = risk.firstBelowSafetyBufferDate;
  const lowestTone = risk.lowestBalance < 0 ? 'critical' : breach ? 'warning' : 'good';

  // Kompakter Status fürs Chart-Label (statt einer großen Box bei „alles ok").
  const status: { label: string; tone: 'good' | 'warning' | 'critical' } = breach
    ? risk.lowestBalance < 0
      ? { label: 'Risiko', tone: 'critical' }
      : { label: 'Knapp', tone: 'warning' }
    : { label: 'Stabil', tone: 'good' };
  const statusClass =
    status.tone === 'critical'
      ? 'border-destructive/40 text-destructive'
      : status.tone === 'warning'
        ? 'border-warning/50 text-warning'
        : 'border-emerald-600/40 text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-6">
      {/* Hinweis auf unvollständige Datenbasis (ändert die Berechnung nicht) */}
      <DataQualityNotice />

      {/* Steuerung: mobil ein ruhiges Stapel-Raster (Label über voller Select-Breite),
          ab sm dreispaltig. Ersetzt die fixen Breiten, die auf dem Handy umbrachen. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Horizont</span>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="h-10 w-full">
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

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Sicherheitspuffer</span>
          <Select value={String(safetyBuffer)} onValueChange={(v) => setSafetyBuffer(Number(v))}>
            <SelectTrigger className="h-10 w-full">
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

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Basis</span>
          <Select value={bufferBasis} onValueChange={(v) => setBufferBasis(v as BufferBasis)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operating">Giro (operativ)</SelectItem>
              <SelectItem value="available">Verfügbar (inkl. Reserve)</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Drei Zonen: ÄNDERN (Editor) · SEHEN (Chart) · KONTEXT (Annahmen + MC).
          Mobil/Tablet gestapelt – das Ergebnis steht oben (order-1), damit der
          Nutzer die Wirkung jeder Eingabe sofort sieht; der Editor folgt direkt.
          Ab xl drei Spalten: Editor links, Chart breit in der Mitte (wächst auf
          großen Schirmen), Kontext rechts. Beide Seitenspalten kleben mit. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(300px,360px)]">
        {/* SEHEN: Ergebnis (Chart, KPIs) – mobil zuerst, auf Desktop in die Mitte. */}
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
          {/* Insight nur bei echtem Risiko als Box – „stabil" steht kompakt im Chart-Label. */}
          {insights[0] && insights[0].kind === 'below_buffer' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Liquiditätsrisiko erkannt</AlertTitle>
              <AlertDescription>{insights[0].message}</AlertDescription>
            </Alert>
          )}

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Liquiditätsverlauf ({bufferBasis === 'available' ? 'verfügbar' : 'Giro'})
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                  {status.label}
                </span>
                {monteCarlo && (
                  <span className="text-sm font-normal text-muted-foreground">
                    · Wahrscheinlichkeitsband P10–P90
                  </span>
                )}
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
                      <linearGradient id="mcBandFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
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
                      formatter={(v: number, name: string) => [eur.format(v), CHART_SERIES_LABELS[name] ?? name]}
                      labelFormatter={(l: string) => fmtDate(l)}
                    />
                    {/* Monte-Carlo-Wahrscheinlichkeitsband (P10–P90) als Gradient,
                        hinter den Linien – damit es genau EINE Darstellung gibt. */}
                    {monteCarlo && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="bandFloor"
                          name="bandFloor"
                          stackId="mc"
                          stroke="none"
                          fill="transparent"
                          isAnimationActive={false}
                          legendType="none"
                          tooltipType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="bandHeight"
                          name="bandHeight"
                          stackId="mc"
                          stroke="none"
                          fill="url(#mcBandFill)"
                          isAnimationActive={false}
                          legendType="none"
                          tooltipType="none"
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="operating"
                      name="operating"
                      stroke="#1d5c54"
                      strokeWidth={2}
                      fill={monteCarlo ? 'transparent' : 'url(#liqFill)'}
                    />
                    {monteCarlo && (
                      <Line
                        type="monotone"
                        dataKey="median"
                        name="median"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
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

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
        </div>

        {/* ÄNDERN: direkter Editor – Verträge zu Punkt X beenden, neue Posten,
            Budgets, Transfers. Auf Desktop links und klebend, mobil unter dem
            Chart. Ersetzt den früheren Szenario-Explorer durch echtes Eintragen. */}
        <FeatureGate feature="simulation">
          <div
            className="order-2 space-y-3 xl:order-1 xl:sticky xl:top-4 xl:self-start"
            aria-labelledby="planning-tools-heading"
          >
            <div>
              <h2 id="planning-tools-heading" className="text-lg font-semibold">
                Annahmen eintragen
              </h2>
              <p className="text-sm text-muted-foreground">
                Beende Verträge zum Stichtag, plane neue Posten oder ändere Budgets – die Grafik
                zeigt die Wirkung sofort.
              </p>
            </div>

            <ForecastPlanner overrides={overrides} onChange={updatePlanning} input={input} />
          </div>
        </FeatureGate>

        {/* KONTEXT: aktive Annahmen (zum Zurücknehmen) + Wahrscheinlichkeits-
            Simulation. Mobil zuletzt, auf Desktop rechts und klebend. */}
        <FeatureGate feature="simulation">
          <div className="order-3 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <ActiveChangesPanel changes={activeChanges} onClear={clearChange} />

            {/* Steuerung & Kennzahlen der Wahrscheinlichkeits-Simulation. Das
                Gradient-Band selbst liegt in der EINEN Hauptgrafik in der Mitte. */}
            <MonteCarloPanel
              settings={mcSettings}
              onChange={(patch) => setMcSettings((prev) => ({ ...prev, ...patch }))}
              result={monteCarlo}
              isCalculating={isMonteCarloCalculating}
              contextLabel={activeChanges.length > 0 ? `${activeChanges.length} Annahmen` : 'Basisplanung'}
            />
          </div>
        </FeatureGate>
      </div>

      {/* Tiefer gehende Analysen – volle Breite, einklappbar, damit die
          Hauptansicht (Eintragen → Sehen) fokussiert bleibt. */}
      <FeatureGate feature="simulation" fallback={null}>
        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Erweiterte Analysen{' '}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              Risiko &amp; Budget-Optimierung
            </span>
          </summary>
          <div className="space-y-6 border-t p-3 sm:p-4">
            <FinRiskSection
              input={input}
              months={months}
              safetyBuffer={safetyBuffer}
              bufferBasis={bufferBasis}
              startISO={forecast.config.startDate}
            />

            <BudgetOptimizerPanel input={input} />
          </div>
        </details>
      </FeatureGate>

      {/* Monatskarten */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Monatsübersicht</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {monthly.map((m) => (
            <Card key={m.month} className={m.belowSafetyBuffer ? 'border-warning' : undefined}>
              <div className="space-y-2">
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
              </div>
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

/**
 * Aktive Annahmen als entfernbare Chips. Macht sichtbar, welche Eingaben die
 * Prognose gerade vom Ist-Zustand entfernen – kritisch, damit der Nutzer den
 * Chart nicht mit der Realität verwechselt. Jeder Chip lässt sich einzeln lösen.
 */
function ActiveChangesPanel({
  changes,
  onClear,
}: {
  changes: OverrideChange[];
  onClear: (c: OverrideChange) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          Aktive Annahmen
          {changes.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {changes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Änderungen. Trage links Annahmen ein – sie erscheinen hier und du kannst sie
            jederzeit einzeln zurücknehmen.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <li key={c.id}>
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                  <span className="max-w-[16rem] truncate">{c.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full"
                    aria-label={`Annahme entfernen: ${c.label}`}
                    onClick={() => onClear(c)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Nimmt genau eine aktive Annahme zurück. Bei zusammengesetzten Vertrags-
 * Overrides (Betrag + End-Datum) wird nur das betroffene Feld geräumt; bleibt
 * danach ein leeres Override-Objekt, wird der ganze Eintrag entfernt.
 */
function clearOverrideChange(
  overrides: ForecastOverrides,
  change: OverrideChange,
  updatePlanning: (patch: Partial<ForecastOverrides>) => void,
): void {
  switch (change.source) {
    case 'recurringFlowOverrides': {
      const next = { ...overrides.recurringFlowOverrides };
      const updated = { ...next[change.key] };
      if (change.field) delete updated[change.field];
      if (Object.keys(updated).length > 0) next[change.key] = updated;
      else delete next[change.key];
      updatePlanning({ recurringFlowOverrides: next });
      break;
    }
    case 'categoryBudgets': {
      const next = { ...overrides.categoryBudgets };
      delete next[change.key];
      updatePlanning({ categoryBudgets: next });
      break;
    }
    case 'accountInterest': {
      const next = { ...overrides.accountInterest };
      delete next[change.key];
      updatePlanning({ accountInterest: next });
      break;
    }
    case 'plannedEvents':
      updatePlanning({ plannedEvents: overrides.plannedEvents.filter((e) => e.id !== change.key) });
      break;
    case 'transfers':
      updatePlanning({ transfers: overrides.transfers.filter((t) => t.id !== change.key) });
      break;
    case 'sinkingFunds':
      updatePlanning({ sinkingFunds: overrides.sinkingFunds.filter((f) => f.id !== change.key) });
      break;
  }
}
