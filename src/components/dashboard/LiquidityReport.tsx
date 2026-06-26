import { useMemo, useState, useEffect } from 'react';
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
import {
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  CalendarClock,
  Lightbulb,
  X,
  LineChart,
  Grid3x3,
  Dices,
  LoaderCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { useLumpyRisk } from '@/hooks/useLumpyRisk';
import { getChartColors, subscribeToDarkModeChanges } from '@/lib/chart-theme';
import { buildBaseCheckPayload } from '@/lib/finrisk/scenario-questions';
import ForecastPlanner from '@/components/dashboard/ForecastPlanner';
import StressPresetQuickAdd from '@/components/dashboard/StressPresetQuickAdd';
import RiskDensityChart from '@/components/dashboard/finrisk/RiskDensityChart';
import RiskSummaryCard from '@/components/dashboard/finrisk/RiskSummaryCard';
import { FeatureGate } from '@/components/FeatureGate';
import { DataQualityNotice } from '@/components/dashboard/DataQualityNotice';
import BudgetOptimizerPanel from '@/components/dashboard/BudgetOptimizerPanel';
import { summarizeOverrides, type OverrideChange } from '@/lib/forecast-overrides-summary';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { BufferBasis } from '@/lib/forecast-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const CHART_SERIES_LABELS: Record<string, string> = {
  operating: 'Plan',
  median: 'Median (P50)',
};

/** Ein Datenpunkt der Linien-Ansicht (Plan + optionales P10–P90-Band + Median). */
interface ChartPoint {
  date: string;
  operating: number;
  bandFloor?: number;
  bandHeight?: number;
  median?: number;
}

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

/** Höchste Pufferbruch-Wahrscheinlichkeit über den Horizont für eine Schwelle. */
function maxBreach(breach: Record<string, number[]> | undefined, threshold: number): number | null {
  if (!breach) return null;
  const series = breach[String(threshold)];
  if (!series || series.length === 0) return 0;
  return Math.max(...series);
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

/** Dispozins p. a. – eine Überziehung kostet Geld (siehe FinRisk). */
const OVERDRAFT_RATE = 11;

type ChartView = 'lines' | 'heatmap';

/**
 * Liquiditäts-Report: tagesgenaue Projektion mit EINER Wahrscheinlichkeits-
 * Simulation, die zwei Ansichten derselben Daten speist – Linien (Plan +
 * P10–P90-Band + Median) und Heatmap (Dichte, auch multimodal). Umschaltbar,
 * damit es genau eine Grafik gibt statt zwei konkurrierender Simulationen.
 *
 * Eingaben laufen ausschließlich über die Annahmen (links): direkter Editor plus
 * Stresstest-Schnellaktionen, die unter passenden Namen echte Posten/Budgets
 * eintragen. Keine zweite, davon getrennte Szenario-Eingabe mehr.
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

  const [chartView, setChartView] = useState<ChartView>('lines');
  const [trials, setTrials] = useState(500);
  const [incomeUncertain, setIncomeUncertain] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  // Sektion, die das gerade gewählte Szenario betrifft (anhaltender Kontrast,
  // unabhängig vom kurzen Puls nach dem Eintragen).
  const [activeScenarioSection, setActiveScenarioSection] = useState<string | null>(null);
  const [, setThemeUpdate] = useState(0);

  // Re-render chart when theme changes (dark mode toggle)
  useEffect(() => {
    const cleanup = subscribeToDarkModeChanges(() => {
      setThemeUpdate((prev) => prev + 1);
    });
    return cleanup;
  }, []);

  // Wrapper for preset application with highlighting
  const handlePresetApply = (patch: Partial<ForecastOverrides>) => {
    updatePlanning(patch);
    // Determine which section to highlight based on patch contents
    if (patch.categoryBudgets && Object.keys(patch.categoryBudgets).length > 0) {
      setHighlightedSection('budgets');
    } else if (patch.plannedEvents && patch.plannedEvents.length > 0) {
      setHighlightedSection('events');
    }
  };

  // EINE Wahrscheinlichkeits-Simulation (FinRisk-Basislauf): liefert Band,
  // Dichte-Heatmap, Pufferbruch- und Stress-Kennzahlen in einem Lauf. Speist
  // sowohl die Linien- als auch die Heatmap-Ansicht – kein zweiter MC-Apparat.
  const startISO = forecast?.config.startDate;
  const basePayload = useMemo(
    () => buildBaseCheckPayload({ horizonDays: Math.max(months, 6) * 30, thresholdAmount: safetyBuffer }),
    [months, safetyBuffer],
  );
  const riskConfig = useMemo(
    () => ({ months, safetyBuffer, bufferBasis, startDate: startISO, overdraftAnnualRate: OVERDRAFT_RATE }),
    [months, safetyBuffer, bufferBasis, startISO],
  );
  const { lumpy } = useLumpyRisk();
  const { result: risk, isCalculating: isRiskCalculating } = useScenarioRisk(
    input,
    riskConfig,
    basePayload,
    {
      monteCarlo: { trials, seed: 1, incomeVolatility: incomeUncertain ? 0.08 : 0 },
      lumpy: lumpy ?? undefined,
    },
  );

  // Aktive Annahmen: aus den direkt eingetragenen Overrides verdichtet. Jede
  // Abweichung vom Ist-Zustand erscheint hier und lässt sich einzeln zurücknehmen.
  const activeChanges = useMemo(
    () =>
      summarizeOverrides(overrides, {
        flows: input?.allRecurringFlows ?? input?.recurringFlows,
      }),
    [overrides, input],
  );

  // Einen einzelnen Annahme-Chip lösen (gezielt das richtige Feld räumen).
  const clearChange = (c: OverrideChange) => clearOverrideChange(overrides, c, updatePlanning);

  // Operatives Konto, dem Stresstest-Posten zugeordnet werden.
  const primaryAccountId = useMemo(() => {
    const accts = input?.accounts ?? [];
    return (
      accts.find((a) => a.kind === 'checking') ??
      accts.find((a) => a.kind === 'cash') ??
      accts[0]
    )?.id ?? null;
  }, [input]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    const pick = (d: { availableCash: number; operatingCash: number }) =>
      bufferBasis === 'available' ? d.availableCash : d.operatingCash;
    // Das Wahrscheinlichkeitsband (P10–P90) der EINEN Simulation wird auf
    // dieselbe Zeitachse gelegt – als Gradient hinter der Plan-Linie.
    const bandByDate = new Map((risk?.daily ?? []).map((d) => [d.date, d]));
    return forecast.daily.map((d) => {
      const band = bandByDate.get(d.date);
      return {
        date: d.date,
        operating: pick(d),
        bandFloor: band?.p10,
        bandHeight: band ? band.p90 - band.p10 : undefined,
        median: band?.p50,
      };
    });
  }, [forecast, bufferBasis, risk]);

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

  const { risk: liqRisk, monthly, insights } = forecast;
  const breach = liqRisk.firstBelowSafetyBufferDate;
  const lowestTone = liqRisk.lowestBalance < 0 ? 'critical' : breach ? 'warning' : 'good';
  const hasBand = !!risk && risk.daily.length > 0;

  // Kompakter Status fürs Chart-Label (statt einer großen Box bei „alles ok").
  const status: { label: string; tone: 'good' | 'warning' | 'critical' } = breach
    ? liqRisk.lowestBalance < 0
      ? { label: 'Risiko', tone: 'critical' }
      : { label: 'Knapp', tone: 'warning' }
    : { label: 'Stabil', tone: 'good' };
  const statusClass =
    status.tone === 'critical'
      ? 'border-destructive/40 text-destructive'
      : status.tone === 'warning'
        ? 'border-warning/50 text-warning'
        : 'border-emerald-600/40 text-emerald-600 dark:text-emerald-400';

  const stress90 = risk?.stressCapacity.find((s) => Math.abs(s.confidenceLevel - 0.9) < 1e-9) ?? null;
  const baseBreach = maxBreach(risk?.breachProbabilities, safetyBuffer);

  return (
    <div className="space-y-6">
      {/* Hinweis auf unvollständige Datenbasis (ändert die Berechnung nicht) */}
      <DataQualityNotice />

      {/* Steuerung: mobil ein ruhiges Stapel-Raster, ab sm dreispaltig. */}
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

      {/* Drei Zonen: ÄNDERN (Editor) · SEHEN (Chart) · KONTEXT (Annahmen + Risiko).
          Mobil gestapelt – das Ergebnis steht oben (order-1); ab xl drei Spalten. */}
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

          {/* Die EINE Grafik – umschaltbar zwischen Linien und Heatmap. */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  Liquiditätsverlauf ({bufferBasis === 'available' ? 'verfügbar' : 'Giro'})
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                    {status.label}
                  </span>
                </CardTitle>
                <ChartViewToggle value={chartView} onChange={setChartView} />
              </div>
            </CardHeader>
            <CardContent>
              {chartView === 'heatmap' ? (
                hasBand ? (
                  <RiskDensityChart result={risk!} safetyBuffer={safetyBuffer} />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
                    {isRiskCalculating ? 'Wahrscheinlichkeiten werden simuliert …' : 'Noch keine Simulation.'}
                  </div>
                )
              ) : (
                <ChartLinesView
                  chartData={chartData}
                  hasBand={hasBand}
                  safetyBuffer={safetyBuffer}
                />
              )}
              {hasBand && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Wahrscheinlichkeitsband P10–P90 aus {risk!.horizonDays} Tagen ·{' '}
                  {chartView === 'lines' ? 'als Heatmap umschaltbar' : 'als Linien umschaltbar'}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              icon={<TrendingDown className="h-4 w-4" />}
              label="Tiefststand"
              value={eur.format(liqRisk.lowestBalance)}
              tone={lowestTone}
              hint={fmtDate(liqRisk.lowestBalanceDate)}
            />
            <Kpi
              icon={<CalendarClock className="h-4 w-4" />}
              label="Erster Pufferbruch"
              value={breach ? fmtDate(breach) : 'keiner'}
              tone={breach ? 'warning' : 'good'}
              hint={breach ? `${liqRisk.daysBelowSafetyBuffer} Tage unter Puffer` : 'im Horizont'}
            />
            <Kpi
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Min. Giro"
              value={eur.format(liqRisk.minimumOperatingCash)}
              hint="operativ verfügbar"
            />
            <Kpi
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Min. verfügbar"
              value={eur.format(liqRisk.minimumAvailableCash)}
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

        {/* ÄNDERN: direkter Editor + Stresstest-Schnellaktionen. Auf Desktop links
            und klebend, mobil unter dem Chart. Alle Eingaben an einer Stelle. */}
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
                Beende Verträge zum Stichtag, plane neue Posten oder spiele einen Stresstest durch –
                die Grafik zeigt die Wirkung sofort.
              </p>
            </div>

            <StressPresetQuickAdd
              startISO={forecast.config.startDate}
              accountId={primaryAccountId}
              variableExpenses={input?.variableExpenses}
              overrides={overrides}
              onApply={handlePresetApply}
              onActiveScenarioChange={setActiveScenarioSection}
            />

            <ForecastPlanner
              overrides={overrides}
              onChange={updatePlanning}
              input={input}
              highlightedSection={highlightedSection}
              onHighlightComplete={() => setHighlightedSection(null)}
              activeSection={activeScenarioSection}
            />
          </div>
        </FeatureGate>

        {/* KONTEXT: aktive Annahmen (zum Zurücknehmen), Risiko-Kurzdiagnose und
            die Steuerung der Wahrscheinlichkeits-Simulation. */}
        <FeatureGate feature="simulation">
          <div className="order-3 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <ActiveChangesPanel changes={activeChanges} onClear={clearChange} />

            <RiskSummaryCard lumpy={lumpy} stress90={stress90} baseBreachProbability={baseBreach} />

            <SimulationControls
              trials={trials}
              onTrials={setTrials}
              incomeUncertain={incomeUncertain}
              onIncomeUncertain={setIncomeUncertain}
              isCalculating={isRiskCalculating}
              contextLabel={activeChanges.length > 0 ? `${activeChanges.length} Annahmen` : 'Basisplanung'}
            />
          </div>
        </FeatureGate>
      </div>

      {/* Tiefer gehende Analysen – volle Breite, einklappbar. */}
      <FeatureGate feature="simulation" fallback={null}>
        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Erweiterte Analysen{' '}
            <span className="ml-1 text-sm font-normal text-muted-foreground">Budget-Optimierung</span>
          </summary>
          <div className="space-y-6 border-t p-3 sm:p-4">
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

/**
 * Lines view of the chart with theme-aware colors.
 * Uses gradients and line colors that adapt to light/dark mode.
 */
function ChartLinesView({
  chartData,
  hasBand,
  safetyBuffer,
}: {
  chartData: ChartPoint[];
  hasBand: boolean;
  safetyBuffer: number;
}) {
  const colors = getChartColors();
  const gradientId = `liqFill-${Date.now()}`;
  const mcBandGradientId = `mcBandFill-${Date.now()}`;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillStartOpacity} />
              <stop offset="95%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillEndOpacity} />
            </linearGradient>
            <linearGradient id={mcBandGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.mcBandStart} stopOpacity={colors.mcBandStartOpacity} />
              <stop offset="95%" stopColor={colors.mcBandStart} stopOpacity={colors.mcBandEndOpacity} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(parseISO(v), 'MMM', { locale: de })}
            minTickGap={32}
            tick={{ fontSize: 12, fill: colors.axisText }}
            axisLine={{ stroke: colors.axisStroke }}
          />
          <YAxis
            tickFormatter={(v: number) => eur.format(v)}
            width={72}
            tick={{ fontSize: 12, fill: colors.axisText }}
            axisLine={{ stroke: colors.axisStroke }}
          />
          <Tooltip
            formatter={(v: number, name: string) => [eur.format(v), CHART_SERIES_LABELS[name] ?? name]}
            labelFormatter={(l: string) => fmtDate(l)}
            contentStyle={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
          {hasBand && (
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
                fill={`url(#${mcBandGradientId})`}
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
            stroke={colors.operatingStroke}
            strokeWidth={2}
            fill={hasBand ? 'transparent' : `url(#${gradientId})`}
          />
          {hasBand && (
            <Line
              type="monotone"
              dataKey="median"
              name="median"
              stroke={colors.medianStroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {safetyBuffer > 0 && (
            <ReferenceLine
              y={safetyBuffer}
              stroke={colors.bufferLine}
              strokeDasharray="4 4"
              label={{ value: 'Puffer', position: 'insideTopRight', fontSize: 11, fill: colors.axisText }}
            />
          )}
          <ReferenceLine
            y={0}
            stroke={colors.zeroLine}
            strokeDasharray="2 2"
            label={{ value: '0 €', position: 'insideBottomRight', fontSize: 11, fill: colors.axisText, offset: -8 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Segmentierter Umschalter zwischen Linien- und Heatmap-Ansicht. */
function ChartViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const opt = (v: ChartView, label: string, Icon: typeof LineChart) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
        value === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Ansicht" className="inline-flex overflow-hidden rounded-lg border">
      {opt('lines', 'Linien', LineChart)}
      {opt('heatmap', 'Heatmap', Grid3x3)}
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
 * Steuerung der Wahrscheinlichkeits-Simulation (Durchläufe, Einnahme-Streuung).
 * Die Verteilung selbst liegt in der EINEN Grafik – hier stehen nur die Schalter.
 */
function SimulationControls({
  trials,
  onTrials,
  incomeUncertain,
  onIncomeUncertain,
  isCalculating,
  contextLabel,
}: {
  trials: number;
  onTrials: (v: number) => void;
  incomeUncertain: boolean;
  onIncomeUncertain: (v: boolean) => void;
  isCalculating: boolean;
  contextLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dices className="h-4 w-4" /> Wahrscheinlichkeits-Simulation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Durchläufe</span>
            <Select value={String(trials)} onValueChange={(v) => onTrials(Number(v))}>
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[200, 500, 1000].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={incomeUncertain}
              onCheckedChange={onIncomeUncertain}
              aria-label="Einnahmen pauschal mit acht Prozent Streuung berechnen"
            />
            <span className="text-muted-foreground">Einnahmen mit 8 % Streuung</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Berechnet für: <span className="font-medium text-foreground">{contextLabel}</span>
        </p>
        {isCalculating && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Wahrscheinlichkeitsspanne wird berechnet …
          </div>
        )}
      </CardContent>
    </Card>
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
