import { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoGroup, InfoStatStrip } from '@/features/shared/presentation/InfoGroup';
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
import { useI18n } from '@/i18n/useI18n';
import { useDateFnsLocale } from '@/i18n/useDateFnsLocale';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { useLumpyRisk } from '@/hooks/useLumpyRisk';
import { subscribeToDarkModeChanges } from '@/lib/chart-theme';
import { buildBaseCheckPayload } from '@/lib/finrisk/scenario-questions';
import ForecastPlanner from '@/components/dashboard/ForecastPlanner';
import StressPresetQuickAdd from '@/components/dashboard/StressPresetQuickAdd';
import RiskDensityChart from '@/components/dashboard/finrisk/RiskDensityChart';
import AskYourMoney from '@/components/dashboard/finrisk/AskYourMoney';
import RiskSummaryCard from '@/components/dashboard/finrisk/RiskSummaryCard';
import AdaptiveSpendingToggle from '@/components/dashboard/finrisk/AdaptiveSpendingToggle';
import { FeatureGate } from '@/components/FeatureGate';
import PremiumTeaser from '@/components/premium/PremiumTeaser';
import { DataQualityNotice } from '@/components/dashboard/DataQualityNotice';
import BudgetOptimizerPanel from '@/components/dashboard/BudgetOptimizerPanel';
import {
  summarizeOverrides,
  overrideChangeRemovalPatch,
  type OverrideChange,
} from '@/lib/forecast-overrides-summary';
import type { ForecastOverrides } from '@/lib/forecast-types';
import type { BufferBasis } from '@/lib/forecast-types';
import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/services/transaction-service';
import { computeBufferShortfall } from '@/lib/liquidity-shortfall';
import type { Prioritaet } from '@/types';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import {
  eur,
  fmtDate,
  maxBreach,
  HORIZON_OPTIONS,
  OVERDRAFT_RATE,
  type ChartView,
} from './liquidity/chart-shared';
import { ChartLinesView } from './liquidity/ChartLinesView';
import {
  ActiveChangesPanel,
  ChartViewToggle,
  MonthlyOverviewTable,
  SimulationControls,
} from './liquidity/LiquidityViews';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';


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
  const dateFnsLocale = useDateFnsLocale();
  const {
    overrides,
    updateConfig,
    updatePlanning,
    isError: overridesError,
    refetch: refetchOverrides,
  } = useForecastOverrides();
  const { months, safetyBuffer, bufferBasis } = overrides;
  const setMonths = (m: number) => updateConfig({ months: m });
  const setSafetyBuffer = (b: number) => updateConfig({ safetyBuffer: b });
  const setBufferBasis = (b: BufferBasis) => updateConfig({ bufferBasis: b });

  const { forecast, input, analysis, isLoading, isError, refetch: refetchForecast } = useForecast({
    months,
    safetyBuffer,
    bufferBasis,
  });

  // Kategorie-Prioritäten (vom Nutzer gesetzt) → steuern den Spar-Wasserfall
  // im BudgetOptimizer: niedrige Priorität wird zuerst gekürzt.
  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
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
  const clearChange = (c: OverrideChange) => updatePlanning(overrideChangeRemovalPatch(overrides, c));

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

  const hasLoadError = isError || categoriesError || overridesError;

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

  if (hasLoadError) {
    // Vorher stand hier `error.message` — also „IndexedDB nicht erreichbar" auf
    // dem Bildschirm eines Menschen, der die App benutzt statt sie zu bauen.
    // Dazu fehlte jeder Wiederholversuch. `FinanceErrorState` sagt WAS nicht
    // ging, dass die Daten nicht verloren sind, und bietet den naechsten
    // Schritt (WP-9.2).
    return (
      <FinanceErrorState
        variant="data"
        onRetry={() => {
          refetchForecast();
          void refetchCategories();
          void refetchOverrides();
        }}
      />
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
            <SelectTrigger className="h-10 w-full" aria-label={t("liquidityReport.horizonLabel")}>
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
            <SelectTrigger className="h-10 w-full" aria-label={t("liquidityReport.bufferLabel")}>
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
            <SelectTrigger className="h-10 w-full" aria-label={t("liquidityReport.basisLabel")}>
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
                hint: fmtDate(liqRisk.lowestBalanceDate, dateFnsLocale),
                tone: lowestTone,
              },
              {
                label: t("liquidityReport.firstBreachLabel"),
                value: breach ? fmtDate(breach, dateFnsLocale) : t("liquidityReport.noBreachLabel"),
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
                    {t("liquidityReport.riskDriversDescription").replace("{highDate}", fmtDate(analysis.drawdownStart, dateFnsLocale)).replace("{lowDate}", fmtDate(analysis.troughDate, dateFnsLocale))}
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
      <FeatureGate
        feature="simulation"
        fallback={<PremiumTeaser feature="simulation" tourId="liquidity-simulation-teaser" />}
      >
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
