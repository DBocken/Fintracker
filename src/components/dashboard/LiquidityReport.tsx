import { useMemo, useState, useEffect, useId } from 'react';
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
  Lightbulb,
  X,
  LineChart,
  Grid3x3,
  Dices,
  LoaderCircle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoGroup, InfoStatStrip } from '@/components/common/InfoGroup';
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
import { useI18n } from '@/i18n/useI18n';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { useLumpyRisk } from '@/hooks/useLumpyRisk';
import { getChartColors, subscribeToDarkModeChanges } from '@/lib/chart-theme';
import { buildBaseCheckPayload } from '@/lib/finrisk/scenario-questions';
import ForecastPlanner from '@/components/dashboard/ForecastPlanner';
import StressPresetQuickAdd from '@/components/dashboard/StressPresetQuickAdd';
import RiskDensityChart from '@/components/dashboard/finrisk/RiskDensityChart';
import AskYourMoney from '@/components/dashboard/finrisk/AskYourMoney';
import RiskSummaryCard from '@/components/dashboard/finrisk/RiskSummaryCard';
import AdaptiveSpendingToggle from '@/components/dashboard/finrisk/AdaptiveSpendingToggle';
import { FeatureGate } from '@/components/FeatureGate';
import { DataQualityNotice } from '@/components/dashboard/DataQualityNotice';
import BudgetOptimizerPanel from '@/components/dashboard/BudgetOptimizerPanel';
import { summarizeOverrides, type OverrideChange } from '@/lib/forecast-overrides-summary';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { BufferBasis, ForecastMonthlySummary } from '@/lib/forecast-types';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/services/transaction-service';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { useSeriesSummary } from '@/hooks/useSeriesSummary';
import { ChartFigure } from '@/components/common/ChartFigure';
import { computeBufferShortfall } from '@/lib/liquidity-shortfall';
import DeltaBadge from '@/components/common/DeltaBadge';
import type { Prioritaet } from '@/types';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});


/**
 * Die drei Konfidenz-Ebenen der Prognose (WP-6.1), von aussen nach innen.
 *
 * Reihenfolge IST die Zeichenreihenfolge: die aeussere Flaeche liegt unten,
 * die innere oben. Weil sich die Flaechen ueberlagern, addiert sich die
 * Deckkraft zur Mitte hin — genau das macht den Rand diffus.
 *
 * Bewusst eine Modul-Konstante: sie enthaelt nur Datenschluessel und Zahlen,
 * keinen uebersetzten Text. Ein `t()` im Initializer wuerde beim Import
 * einfrieren (AGENTS.md Paragraf 6, Fallen-Tabelle).
 */
const BAND_LAYERS = [
  /** P05–P95: das Moeglichkeitsfeld. */
  { key: 'outer', floorKey: 'outerFloor', heightKey: 'outerHeight', opacityFactor: 0.45 },
  /** P10–P90: die fachlich benannte Bandbreite. */
  { key: 'band', floorKey: 'bandFloor', heightKey: 'bandHeight', opacityFactor: 0.7 },
  /** P25–P75: wo die Haelfte aller Durchlaeufe landet. */
  { key: 'core', floorKey: 'coreFloor', heightKey: 'coreHeight', opacityFactor: 1 },
] as const;

/** Ein Datenpunkt der Linien-Ansicht (Plan + optionales P10–P90-Band + Median). */
interface ChartPoint {
  date: string;
  operating: number;
  outerFloor?: number;
  outerHeight?: number;
  bandFloor?: number;
  bandHeight?: number;
  coreFloor?: number;
  coreHeight?: number;
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
  const money = useMoneyFormat();
  const { t } = useI18n();
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

  // Kategorie-Prioritäten (vom Nutzer gesetzt) → steuern den Spar-Wasserfall
  // im BudgetOptimizer: niedrige Priorität wird zuerst gekürzt.
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const priorityByCategory = useMemo(() => {
    const map = new Map<string, Prioritaet>();
    for (const c of categories) {
      if (c.attributes?.prioritaet) map.set(c.name, c.attributes.prioritaet);
    }
    return map;
  }, [categories]);

  // Liquiditäts-Fehlbetrag: fällt der projizierte Tiefststand unter den Puffer,
  // wieviel muss monatlich freigemacht werden? Treibt den „Liquidität sichern"-
  // Modus des BudgetOptimizers (deterministisch aus dem Forecast).
  const bufferShortfall = useMemo(() => {
    if (!forecast) return undefined;
    const days = Math.max(
      0,
      differenceInDays(parseISO(forecast.risk.lowestBalanceDate), parseISO(forecast.config.startDate)),
    );
    return computeBufferShortfall({
      lowestBalance: forecast.risk.lowestBalance,
      safetyBuffer,
      daysUntilTrough: days,
    });
  }, [forecast, safetyBuffer]);

  const [chartView, setChartView] = useState<ChartView>('lines');
  const [trials, setTrials] = useState(500);
  const [incomeUncertain, setIncomeUncertain] = useState(false);
  // „Bei Knappheit gegensteuern" – bewusstes Was-wäre-wenn (Issue #152), opt-in.
  const [discipline, setDiscipline] = useState(false);
  const [disciplineStrength, setDisciplineStrength] = useState(0.5);
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
    () => ({
      months,
      safetyBuffer,
      bufferBasis,
      startDate: startISO,
      overdraftAnnualRate: OVERDRAFT_RATE,
      // Gegensteuern wirkt auf das Wahrscheinlichkeitsband, die Heatmap und „Frag
      // dein Geld" – die Plan-Linie bleibt als ungesteuerte Baseline bestehen.
      ...(discipline ? { adaptiveSpending: { maxReductionPct: disciplineStrength } } : {}),
    }),
    [months, safetyBuffer, bufferBasis, startISO, discipline, disciplineStrength],
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
    // Das Wahrscheinlichkeitsband der EINEN Simulation wird auf dieselbe
    // Zeitachse gelegt.
    //
    // WP-6.1: DREI verschachtelte Flächen statt einer. Vorher gab es genau
    // eine Fläche von P10 bis P90 mit harter Kante — und eine harte Kante
    // liest sich als Zusage („darunter geht es nicht"), obwohl P10 gerade
    // heißt, dass jeder zehnte Durchlauf tiefer fällt. Gestapelt gerechnet
    // (Recharts kennt keine Fläche zwischen zwei Kurven): je Ebene ein
    // unsichtbarer Sockel plus die sichtbare Höhe darüber.
    const bandByDate = new Map((risk?.daily ?? []).map((d) => [d.date, d]));
    return forecast.daily.map((d) => {
      const band = bandByDate.get(d.date);
      return {
        date: d.date,
        operating: pick(d),
        // Äußere Ebene P05–P95: das Möglichkeitsfeld, am schwächsten.
        outerFloor: band?.p05,
        outerHeight: band ? band.p95 - band.p05 : undefined,
        // Mittlere Ebene P10–P90: die bisherige, fachlich benannte Bandbreite.
        bandFloor: band?.p10,
        bandHeight: band ? band.p90 - band.p10 : undefined,
        // Innere Ebene P25–P75: wo die Hälfte aller Durchläufe landet.
        coreFloor: band?.p25,
        coreHeight: band ? band.p75 - band.p25 : undefined,
        median: band?.p50,
      };
    });
  }, [forecast, bufferBasis, risk]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="shimmer" className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton variant="shimmer" key={i} className="h-24" />
          ))}
        </div>
        <Skeleton variant="shimmer" className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("liquidityReport.forecastError")}</AlertTitle>
        <AlertDescription>{error?.message ?? t("liquidityReport.unknownError")}</AlertDescription>
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
      ? { label: t("liquidityReport.riskStatus"), tone: 'critical' }
      : { label: t("liquidityReport.tightStatus"), tone: 'warning' }
    : { label: t("liquidityReport.stableStatus"), tone: 'good' };
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
          <span className="text-muted-foreground">{t("liquidityReport.horizonLabel")}</span>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {t("liquidityReport.monthsValue").replace("{months}", String(m))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("liquidityReport.bufferLabel")}</span>
          <Select value={String(safetyBuffer)} onValueChange={(v) => setSafetyBuffer(Number(v))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 500, 1000, 2000, 5000].map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {money.mask(eur.format(b))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("liquidityReport.basisLabel")}</span>
          <Select value={bufferBasis} onValueChange={(v) => setBufferBasis(v as BufferBasis)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operating">{t("liquidityReport.operatingBasis")}</SelectItem>
              <SelectItem value="available">{t("liquidityReport.availableBasis")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Drei Zonen: ÄNDERN (Editor) · SEHEN (Chart) · KONTEXT (Annahmen + Risiko).
          Mobil gestapelt – das Ergebnis steht oben (order-1); ab xl drei Spalten. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(300px,360px)]">
        {/* SEHEN: Ergebnis (Chart, KPIs) – mobil zuerst, auf Desktop in die Mitte. */}
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
          {/* Hero: „Frag dein Geld" – inverse Simulation (kann ich mir X leisten?). */}
          <AskYourMoney input={input ?? null} config={riskConfig} />

          {/* Insight nur bei echtem Risiko als Box – „stabil" steht kompakt im Chart-Label. */}
          {insights[0] && insights[0].kind === 'below_buffer' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('finrisk.liquidityRiskDetected')}</AlertTitle>
              <AlertDescription>{insights[0].message}</AlertDescription>
            </Alert>
          )}

          {/* Die EINE Grafik – umschaltbar zwischen Linien und Heatmap. */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {t("liquidityReport.liquidityChart").replace("{basis}", bufferBasis === 'available' ? t("liquidityReport.availableBasis") : t("liquidityReport.operatingBasis"))}
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
                    {isRiskCalculating ? t("liquidityReport.probabilitiesCalculating") : t("liquidityReport.noSimulation")}
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
                  {t("liquidityReport.bandCaption").replace('{days}', String(risk!.horizonDays))}{' '}
                  {chartView === 'lines' ? t("liquidityReport.asHeatmap") : t("liquidityReport.asLines")}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* KPIs – gebündeltes Readout in EINEM Block (kein Kachel-Raster),
              schwellwertbewusst gefärbt (Prinzip 8 + 2). */}
          <InfoStatStrip
            items={[
              {
                label: t("liquidityReport.lowestBalanceLabel"),
                value: money.mask(eur.format(liqRisk.lowestBalance)),
                hint: fmtDate(liqRisk.lowestBalanceDate),
                tone: lowestTone,
              },
              {
                label: t("liquidityReport.firstBreachLabel"),
                value: breach ? fmtDate(breach) : t("liquidityReport.noBreachLabel"),
                hint: breach ? t("liquidityReport.daysUnderBuffer").replace("{days}", String(liqRisk.daysBelowSafetyBuffer)) : t("liquidityReport.horizonOkay"),
                tone: breach ? 'warning' : 'good',
              },
              {
                label: t("liquidityReport.minOperatingLabel"),
                value: money.mask(eur.format(liqRisk.minimumOperatingCash)),
                hint: t("liquidityReport.operatingAvailable"),
              },
              {
                label: t("liquidityReport.minAvailableLabel"),
                value: money.mask(eur.format(liqRisk.minimumAvailableCash)),
                hint: t("liquidityReport.includingReserve"),
              },
            ]}
          />

          {/* Risikotreiber & Empfehlung */}
          {analysis && breach && (analysis.drivers.length > 0 || analysis.recommendation) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {analysis.drivers.length > 0 && (
                <InfoGroup title={t("liquidityReport.riskDrivers")}>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {t("liquidityReport.riskDriversDescription").replace("{highDate}", fmtDate(analysis.drawdownStart)).replace("{lowDate}", fmtDate(analysis.troughDate))}
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
                          −{money.mask(eur.format(d.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </InfoGroup>
              )}

              {analysis.recommendation && (
                <InfoGroup
                  title={
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Lightbulb className="h-4 w-4" />
                      {t("liquidityReport.recommendation")}
                    </span>
                  }
                >
                  <p className="text-sm">{analysis.recommendation.message}</p>
                </InfoGroup>
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
                {t("liquidityReport.assumptionsHeading")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("liquidityReport.assumptionsDescription")}
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

            <AdaptiveSpendingToggle
              enabled={discipline}
              onEnabledChange={setDiscipline}
              strength={disciplineStrength}
              onStrengthChange={setDisciplineStrength}
            />

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
            {t("liquidityReport.advancedAnalysis")}{' '}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{t("liquidityReport.budgetOptimization")}</span>
          </summary>
          <div className="space-y-6 border-t p-3 sm:p-4">
            <BudgetOptimizerPanel
              input={input}
              priorityByCategory={priorityByCategory}
              bufferShortfall={bufferShortfall}
            />
          </div>
        </details>
      </FeatureGate>

      {/* Monatskarten */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t("liquidityReport.monthlyOverview")}</h3>
        <MonthlyOverviewTable months={monthly} />
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
  const money = useMoneyFormat();
  const { t } = useI18n();
  const seriesSummary = useSeriesSummary();
  const colors = getChartColors();
  // Baseline: Daten bauen sich auf; bei prefers-reduced-motion direkt Zielzustand.
  const chartAnimation = useChartAnimation();
  // WP-6.8: Gradient-IDs aus `useId()`. Vorher `Date.now()` — das erzeugte bei
  // JEDEM Render eine neue ID (der Browser behaelt die alten `<defs>` im
  // Dokument) und kollidierte, sobald zwei Charts in derselben Millisekunde
  // montieren. `useId()` ist stabil und je Instanz eindeutig.
  const reactId = useId().replace(/:/g, '');
  const gradientId = `liqFill-${reactId}`;
  const mcBandGradientId = `mcBandFill-${reactId}`;
  const horizonMaskId = `horizonMask-${reactId}`;

  // Serien-Namen uebersetzt statt hartkodiert (AGENTS.md Paragraf 6). Die
  // Zuordnung steht in der Komponente und nicht als Modul-Konstante: eine
  // Modul-`const` mit `t()` friert beim Import ein und ignoriert jeden
  // spaeteren Sprachwechsel (AGENTS.md Paragraf 6, Fallen-Tabelle).
  const seriesLabels = {
    operating: t('liquidityReport.seriesOperating'),
    median: t('liquidityReport.seriesMedian'),
  };

  return (
    // WP-6.10: Der Verlauf ist die Kernaussage der Prognose — ohne
    // nicht-visuelle Fassung waere sie fuer Screenreader gar nicht vorhanden.
    <ChartFigure
      caption={t('liquidityReport.liquidityChartCaption')}
      summary={seriesSummary({
        title: t('liquidityReport.liquidityChartCaption'),
        values: chartData.map((point) => point.operating),
        formatValue: (value) => money.mask(eur.format(value)),
        labelAt: (index) => fmtDate(chartData[index]?.date ?? ''),
      })}
      columns={[
        { key: 'date', label: t('balanceChart.dateColumn'), format: (row) => fmtDate(row.date) },
        {
          key: 'operating',
          label: t('liquidityReport.seriesOperating'),
          numeric: true,
          format: (row) => money.mask(eur.format(row.operating)),
        },
        {
          key: 'median',
          label: t('liquidityReport.seriesMedian'),
          numeric: true,
          format: (row) => (row.median === undefined ? '—' : money.mask(eur.format(row.median))),
        },
        {
          // WP-6.1/6.10: Die Unsicherheit gehoert auch in die nicht-visuelle
          // Fassung. Ohne sie laese sich der Median wie eine Zusage.
          key: 'range',
          label: t('liquidityReport.rangeColumn'),
          numeric: true,
          format: (row) =>
            row.outerFloor === undefined || row.outerHeight === undefined
              ? '—'
              : `${money.mask(eur.format(row.outerFloor))} – ${money.mask(eur.format(row.outerFloor + row.outerHeight))}`,
        },
      ]}
      rows={chartData}
      rowKey={(row) => row.date}
    >
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillStartOpacity} />
              <stop offset="95%" stopColor={colors.operatingFillStart} stopOpacity={colors.operatingFillEndOpacity} />
            </linearGradient>
            {/* WP-6.1: Drei Fuellungen derselben Farbe, nach aussen schwaecher.
                Weil die Flaechen einander ueberlagern, addiert sich die Deckkraft
                zur Mitte hin — der Rand franst aus, statt zu schneiden. */}
            {/*
              WP-6.2 — Horizont-Perspektive.

              Eine Prognose ist am Tag 1 fast eine Tatsache und am Tag 365 eine
              Vermutung. Bisher sah beides gleich aus: dieselbe Deckkraft ueber
              die gesamte Breite, die Ferne also genauso behauptet wie die Naehe.

              Dieser Verlauf laeuft WAAGERECHT ueber die Zeitachse und laesst
              die spaeten Tage ausduennen. Als Maske und nicht als zweite
              Farbe, damit er auf alle drei Konfidenz-Ebenen gleich wirkt und
              sich nicht mit deren eigener Deckkraft verrechnet.

              Bis zur Haelfte des Horizonts bleibt die Darstellung voll: der
              naechste Monat ist die Aussage, mit der man plant, und ihn
              vorzeitig auszublenden waere Effekt statt Information.
            */}
            <linearGradient id={`${horizonMaskId}-gradient`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity={1} />
              <stop offset="50%" stopColor="white" stopOpacity={1} />
              <stop offset="100%" stopColor="white" stopOpacity={0.35} />
            </linearGradient>
            <mask id={horizonMaskId} maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
              <rect x="0" y="0" width="1" height="1" fill={`url(#${horizonMaskId}-gradient)`} />
            </mask>
            {BAND_LAYERS.map((layer) => (
              <linearGradient key={layer.key} id={`${mcBandGradientId}-${layer.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={colors.mcBandStart}
                  stopOpacity={colors.mcBandStartOpacity * layer.opacityFactor}
                />
                <stop
                  offset="95%"
                  stopColor={colors.mcBandStart}
                  stopOpacity={colors.mcBandEndOpacity * layer.opacityFactor}
                />
              </linearGradient>
            ))}
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
            tickFormatter={(v: number) => money.mask(eur.format(v))}
            width={72}
            tick={{ fontSize: 12, fill: colors.axisText }}
            axisLine={{ stroke: colors.axisStroke }}
          />
          <Tooltip
            {...chartTooltipProps({
              formatValue: (v) => money.mask(eur.format(v)),
              formatLabel: (l) => fmtDate(l),
              seriesLabels,
            })}
          />
          {/* WP-6.1: Von aussen nach innen gezeichnet. Je Ebene ein
              unsichtbarer Sockel plus die sichtbare Hoehe darueber — Recharts
              kennt keine Flaeche zwischen zwei Kurven, nur Stapel. Jede Ebene
              braucht ihre EIGENE stackId, sonst stapelten sich die drei
              Baender uebereinander statt ineinander. */}
          {hasBand &&
            BAND_LAYERS.map((layer) => (
              <Area
                key={`${layer.key}-floor`}
                type="monotone"
                dataKey={layer.floorKey}
                name={layer.floorKey}
                stackId={layer.key}
                stroke="none"
                fill="transparent"
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
                legendType="none"
                tooltipType="none"
              />
            ))}
          {hasBand &&
            BAND_LAYERS.map((layer) => (
              <Area
                key={`${layer.key}-height`}
                type="monotone"
                dataKey={layer.heightKey}
                name={layer.heightKey}
                stackId={layer.key}
                stroke="none"
                fill={`url(#${mcBandGradientId}-${layer.key})`}
                // WP-6.2: laesst die Flaeche zum Horizont hin ausduennen.
                mask={`url(#${horizonMaskId})`}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
                legendType="none"
                tooltipType="none"
              />
            ))}
          <Area
            type="monotone"
            dataKey="operating"
            name="operating"
            stroke={colors.operatingStroke}
            strokeWidth={2}
            fill={hasBand ? 'transparent' : `url(#${gradientId})`}
            isAnimationActive={chartAnimation.animate}
            animationDuration={chartAnimation.animationDuration}
            animationEasing={chartAnimation.animationEasing}
          />
          {hasBand && (
            <Line
              type="monotone"
              dataKey="median"
              name="median"
              stroke={colors.medianStroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={chartAnimation.animate}
              animationDuration={chartAnimation.animationDuration}
              animationEasing={chartAnimation.animationEasing}
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
    </ChartFigure>
  );
}

/** Segmentierter Umschalter zwischen Linien- und Heatmap-Ansicht. */
function ChartViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const { t } = useI18n();
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
    <div role="group" aria-label={t("liquidityReport.viewToggleLabel")} className="inline-flex overflow-hidden rounded-lg border">
      {opt('lines', t("liquidityReport.linesView"), LineChart)}
      {opt('heatmap', t("liquidityReport.heatmapView"), Grid3x3)}
    </div>
  );
}

/**
 * Monatsübersicht als kompakte Tabelle (Prinzip 8 „Karten sind Aktionen" +
 * „kompakter statt Kachel-Raster"): ein einziger, ruhig hinterlegter Block mit
 * einer Zeile pro Monat und dünnen Trennlinien statt einer Karte je Monat. Auf
 * schmalen Screens horizontal scrollbar. „Unter Puffer" wird schwellwertbewusst
 * über eine dezente Zeilentönung + Badge signalisiert (kein Karten-Rahmen).
 */
export function MonthlyOverviewTable({ months }: { months: ForecastMonthlySummary[] }) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const hasTransfers = months.some((m) => m.transfersOut > 0);
  const hasInterest = months.some((m) => m.interest > 0);
  const shortDate = (iso: string) => {
    try {
      return format(parseISO(iso), 'd.M.', { locale: de });
    } catch {
      return iso;
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl bg-muted/30">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th className="text-left">{t("liquidityReport.monthLabel")}</th>
            <th className="text-right">{t("liquidityReport.incomeLabel")}</th>
            <th className="text-right">{t("liquidityReport.fixedExpensesLabel")}</th>
            <th className="text-right">{t("liquidityReport.variableLabel")}</th>
            {hasTransfers && <th className="text-right">{t("liquidityReport.savingsTransferLabel")}</th>}
            {hasInterest && <th className="text-right">{t("liquidityReport.interestLabel")}</th>}
            <th className="text-right">{t("liquidityReport.monthEndLabel")}</th>
            <th className="text-right">{t("liquidityReport.monthLowLabel")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 [&>tr>td]:px-3 [&>tr>td]:py-2">
          {months.map((m, i) => (
            <tr key={m.month} className={cn('tabular-nums', m.belowSafetyBuffer && 'bg-warning/10')}>
              <td>
                <span className="flex items-center gap-1.5 font-medium">
                  {fmtMonth(m.month)}
                  {m.belowSafetyBuffer && (
                    <Badge variant="outline" className="border-warning text-warning">
                      {t("liquidityReport.belowBufferLabel")}
                    </Badge>
                  )}
                </span>
              </td>
              <td className="text-right text-emerald-600 dark:text-emerald-400">
                {money.mask(eur.format(m.income))}
              </td>
              <td className="text-right">−{money.mask(eur.format(m.fixedExpenses))}</td>
              <td className="text-right">−{money.mask(eur.format(m.variableExpenses))}</td>
              {hasTransfers && (
                <td className="text-right">
                  {m.transfersOut > 0 ? `−${money.mask(eur.format(m.transfersOut))}` : '—'}
                </td>
              )}
              {hasInterest && (
                <td className="text-right text-emerald-600 dark:text-emerald-400">
                  {m.interest > 0 ? `+${money.mask(eur.format(m.interest))}` : '—'}
                </td>
              )}
              <td className="text-right">
                <span className="flex items-center justify-end gap-1.5">
                  {/* Monatsende ggü. Vormonat – schwellwertbewusst (kleine Änderung = neutral). */}
                  {i > 0 && (
                    <DeltaBadge current={m.closingBalance} previous={months[i - 1].closingBalance} />
                  )}
                  <span className="font-semibold">{money.mask(eur.format(m.closingBalance))}</span>
                </span>
              </td>
              <td className="text-right text-xs text-muted-foreground">
                {money.mask(eur.format(m.lowestBalance))} · {shortDate(m.lowestBalanceDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dices className="h-4 w-4" /> {t("liquidityReport.probabilitySimulation")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("liquidityReport.trialsLabel")}</span>
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
              aria-label={t("liquidityReport.incomeUncertaintyAriaLabel")}
            />
            <span className="text-muted-foreground">{t("liquidityReport.incomeUncertaintyLabel")}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("liquidityReport.calculatedFor")}: <span className="font-medium text-foreground">{contextLabel}</span>
        </p>
        {isCalculating && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t("liquidityReport.calculatingProbability")}
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
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          {t("liquidityReport.activeAssumptions")}
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
            {t("liquidityReport.noActiveChanges")}
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
                    aria-label={t("liquidityReport.removeAssumption").replace("{label}", c.label)}
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
