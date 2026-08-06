import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useI18n } from '@/i18n/useI18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartRamp, CHART_BRAND } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';
import { buildSunburstBreakdown } from '@/lib/analysis-data';
import type { SunburstTree } from '@/lib/analysis-data';
import { SpendingSunburstChart } from './SpendingSunburstChart';
import { buildTransactionsHref } from './filter-utils';
import type { AusgabenklasseFilter } from './filter-constants';
import { chartText, chartTooltipProps } from '@/lib/chart-tooltip';
import { niceTicksForData, valueAxisProps } from '@/lib/chart-axis';
import { useSeriesSummary } from '@/hooks/useSeriesSummary';
import { ChartFigure } from '@/components/common/ChartFigure';

interface SunburstInner {
  id: string;
  name: string;
  value: number;
}
interface SunburstOuter {
  id: string;
  parentId: string;
  name: string;
  value: number;
}
interface SunburstData {
  inner: SunburstInner[];
  outer: SunburstOuter[];
  total: number;
}

interface SeriesPoint {
  date: string;
  income: number;
  expenses: number;
}

const formatCurrencyInt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const formatPercentInt = (v: number) => `${Math.round(v)}%`;

// Konstante Start-/Endwinkel (Uhrzeigersinn, Start oben)
const baseStartAngle = 90;
const baseEndAngle = -270;

/** Balkendiagramm: Ausgaben im Zeitverlauf. */
export function ExpensesOverTimeCard({ series }: { series: SeriesPoint[] }) {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();
  const seriesSummary = useSeriesSummary();
  // WP-6.8: Runde Achsenwerte statt Recharts-Interpolation (Befund D-1).
  const expenseTicks = useMemo(() => niceTicksForData(series, ['expenses']), [series]);
  return (
    <Card className="card-premium h-full">
      <CardHeader>
        <CardTitle>{t("expensesOverTime.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* WP-6.10: nicht-visuelle Entsprechung neben dem Diagramm. */}
        <ChartFigure
          caption={t("expensesOverTime.title")}
          summary={seriesSummary({
            title: t("expensesOverTime.title"),
            values: series.map((point) => point.expenses),
            formatValue: formatCurrencyInt,
            labelAt: (index) => series[index]?.date ?? '',
          })}
          columns={[
            { key: 'date', label: t('balanceChart.dateColumn'), format: (row) => row.date },
            {
              key: 'expenses',
              label: t("expensesOverTime.expensesLabel"),
              numeric: true,
              format: (row) => formatCurrencyInt(Math.round(row.expenses)),
            },
          ]}
          rows={series}
          rowKey={(row) => row.date}
        >
        <div className="h-44 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                {...valueAxisProps({
                  ticks: expenseTicks,
                  width: 56,
                  tickFormatter: (v) => `${Math.round(v)} €`,
                })}
              />
              <Tooltip
                {...chartTooltipProps({
                  formatValue: (v) => formatCurrencyInt(Math.round(v)),
                  seriesLabels: { expenses: t("expensesOverTime.expensesLabel") },
                })}
              />
              <Bar
                dataKey="expenses"
                fill={CHART_BRAND}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </ChartFigure>
      </CardContent>
    </Card>
  );
}

/**
 * Anteilsbalken, der sich beim Einblenden von 0 auf seinen Zielanteil *aufbaut*
 * (Animations-Baseline: füllen statt aufpoppen). Bei `prefers-reduced-motion`
 * erscheint direkt der Zielzustand ohne Bewegung.
 */
function GrowBar({ fraction, color, reduce }: { fraction: number; color: string; reduce: boolean }) {
  const [grown, setGrown] = useState(reduce);
  useEffect(() => {
    if (reduce) {
      setGrown(true);
      return;
    }
    // Erst nach dem ersten Paint auf die Zielbreite gehen, damit der
    // Width-Übergang sichtbar von 0 aus wächst.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [reduce]);
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full', !reduce && 'transition-[width] duration-700 ease-out')}
        style={{ width: grown ? `${pct}%` : '0%', backgroundColor: color }}
      />
    </div>
  );
}

interface BreakdownListProps {
  sunburst: SunburstData;
  colorMap: Map<string, string>;
  showPercent: boolean;
  total: number;
  onNavigateKlasse: (superId: string) => void;
  onNavigateCategory: (outerId: string) => void;
}

/**
 * Mobile Aufschlüsselung: macht *alle* tieferen Sunburst-Ebenen lesbar &
 * antippbar, da der Donut-Hover auf Touch nicht greift. Klassen sind
 * aufklappbar (Akkordion) und enthüllen ihre Hauptkategorien mit eigenen
 * aufbauenden Anteilsbalken. Klassen ohne Kinder navigieren direkt.
 */
function SpendingBreakdownList({
  sunburst,
  colorMap,
  showPercent,
  total,
  onNavigateKlasse,
  onNavigateCategory,
}: BreakdownListProps) {
  const { animate } = useChartAnimation();
  const reduce = !animate;
  const groups = useMemo(() => buildSunburstBreakdown(sunburst), [sunburst]);
  // Größte Klasse initial offen — eine Hauptaussage sofort sichtbar (Ruhe vor Fülle).
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    groups[0] && groups[0].children.length > 0 ? new Set([groups[0].id]) : new Set(),
  );

  const fmtValue = (value: number, denom: number) =>
    showPercent && denom > 0 ? formatPercentInt((value / denom) * 100) : formatCurrencyInt(Math.round(value));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { t } = useI18n();

  if (groups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("spendingBreakdown.noExpenses")}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {groups.map((group) => {
        const color = colorMap.get(group.id) || CHART_BRAND;
        const hasChildren = group.children.length > 0;
        const isOpen = expanded.has(group.id);
        return (
          <li key={group.id} className="rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => (hasChildren ? toggle(group.id) : onNavigateKlasse(group.id))}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-label={
                hasChildren
                  ? `${group.name} ${isOpen ? t("spendingBreakdown.toggleClose") : t("spendingBreakdown.toggleOpen")}`
                  : `${group.name}: ${t("spendingBreakdown.viewTransactions")}`
              }
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{group.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {fmtValue(group.value, total)}
                  </span>
                </span>
                <span className="mt-1.5 block">
                  <GrowBar fraction={group.share} color={color} reduce={reduce} />
                </span>
              </span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground',
                  hasChildren && !reduce && 'transition-transform',
                  hasChildren && isOpen && 'rotate-90',
                  !hasChildren && 'opacity-60',
                )}
              />
            </button>

            {hasChildren && isOpen && (
              <ul className="space-y-1.5 px-3 pb-2.5 pl-7">
                {group.children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onNavigateCategory(child.id)}
                      aria-label={`${child.name}: ${t("spendingBreakdown.viewTransactions")}`}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm text-muted-foreground">{child.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {fmtValue(child.value, group.value)}
                          </span>
                        </span>
                        <span className="mt-1 block">
                          <GrowBar fraction={child.share} color={color} reduce={reduce} />
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Sunburst (zwei konzentrische Ringe): Ausgabenklasse (innen) -> Hauptkategorie (außen). */
export function SpendingBreakdownCard({ sunburst, tree }: { sunburst: SunburstData; tree?: SunburstTree }) {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();
  // Umschalter zwischen Euro und Prozent
  const [showPercent, setShowPercent] = useState(false);
  // Hover-State (kann eine Ausgabenklasse- oder Hauptkategorie-ID sein)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const navigate = useNavigate();

  // Klick auf den Innenring (Ausgabenklasse) -> gefilterte Buchungen je Klasse.
  const navigateToKlasse = (superId: string) => {
    navigate(buildTransactionsHref({ ausgabenklasse: superId as AusgabenklasseFilter }));
  };
  // Klick auf den Außenring (Hauptkategorie) -> gefilterte Buchungen je Kategorie.
  // Die Außenring-ID hat die Form `${superId}::${mainId}`.
  const navigateToCategory = (outerId: string) => {
    const mainId = outerId.split('::')[1];
    if (mainId) navigate(buildTransactionsHref({ category: mainId }));
  };
  // Navigation per reiner Kategorie-ID (Sunburst-Chart liefert sie direkt).
  const navigateToCategoryId = (categoryId: string) => {
    navigate(buildTransactionsHref({ category: categoryId }));
  };

  const totalExpenses = sunburst?.total ?? 0;

  // Farbzuordnung für Ausgabenklassen (innerer Ring)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const ramp = chartRamp(sunburst.inner.length);
    sunburst.inner.forEach((item, idx) => {
      map.set(item.id, ramp[idx]);
    });
    return map;
  }, [sunburst]);

  // Schnellzugriff auf Outer-Items per ID (für Hover-Logik)
  const outerById = useMemo(() => {
    const map = new Map<string, SunburstOuter>();
    (sunburst.outer || []).forEach((o) => map.set(o.id, o));
    return map;
  }, [sunburst]);

  // Gruppiere Hauptkategorien (Außenring) nach Ausgabenklasse (Innenring)
  const childrenByParent = useMemo(() => {
    const map = new Map<string, SunburstOuter[]>();
    (sunburst.outer || []).forEach((o) => {
      const arr = map.get(o.parentId) || [];
      arr.push(o);
      map.set(o.parentId, arr);
    });
    // Sortiere für deterministische Darstellung
    for (const arr of map.values()) {
      arr.sort((a, b) => b.value - a.value);
    }
    return map;
  }, [sunburst]);

  // Winkelbereiche je Oberkategorie basierend auf innerem Ring
  const angleMap = useMemo(() => {
    const map = new Map<string, { startAngle: number; endAngle: number; span: number }>();
    const total = totalExpenses > 0 ? totalExpenses : (sunburst.inner || []).reduce((s, it) => s + (it.value || 0), 0);
    let current = baseStartAngle;
    const fullSpan = Math.abs(baseStartAngle - baseEndAngle); // 360°
    (sunburst.inner || []).forEach((item) => {
      const span = total > 0 ? (item.value / total) * fullSpan : 0;
      const startAngle = current;
      const endAngle = current - span; // Uhrzeigersinn
      map.set(item.id, { startAngle, endAngle, span });
      current = endAngle;
    });
    return map;
  }, [sunburst, totalExpenses]);

  // Legendeneinträge für Ausgabenklassen (Innenring)
  const legendItems = useMemo(() => {
    return (sunburst.inner || []).map((item) => ({
      id: item.id,
      name: item.name,
      color: colorMap.get(item.id) || CHART_BRAND,
      value: showPercent && totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : Math.round(item.value),
    }));
  }, [sunburst, colorMap, showPercent, totalExpenses]);

  // Tooltip-Formatter für Sunburst (beide Ringe)
  const tooltipFormatter = (value: unknown, name: unknown): [string, string] => {
    const label = chartText(name);
    const val = Number(value);
    if (!Number.isFinite(val)) return ['–', label];
    if (showPercent && totalExpenses > 0) {
      return [formatPercentInt((val / totalExpenses) * 100), label];
    }
    return [formatCurrencyInt(Math.round(val)), label];
  };

  return (
    <Card className="card-premium flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>{t("spendingBreakdown.title")}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={showPercent}
            onCheckedChange={(v) => setShowPercent(Boolean(v))}
            aria-label={t("spendingBreakdown.percent")}
          />
          <span className="text-sm text-muted-foreground">{t("spendingBreakdown.percent")}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Mobil: grafisches, mehrstufiges Sunburst zum Reinzoomen (Hover greift
            auf Touch nicht). Fallback auf die antippbare Liste, falls kein Baum. */}
        <div className="md:hidden">
          {tree ? (
            <SpendingSunburstChart
              tree={tree}
              colorMap={colorMap}
              showPercent={showPercent}
              onNavigateKlasse={navigateToKlasse}
              onNavigateCategory={navigateToCategoryId}
            />
          ) : (
            <SpendingBreakdownList
              sunburst={sunburst}
              colorMap={colorMap}
              showPercent={showPercent}
              total={totalExpenses}
              onNavigateKlasse={navigateToKlasse}
              onNavigateCategory={navigateToCategory}
            />
          )}
        </div>

        {/* Desktop: Sunburst — zwei konzentrische Pie-Ringe, Radien relativ zur Kartengröße */}
        {/* WP-6.10: Auf Mobil ist die antippbare Liste oben die nicht-visuelle
            Entsprechung — die ist hier aber `md:hidden`. Desktop bekommt sie
            deshalb ueber ChartFigure, sonst waere der Donut dort der einzige
            Zugriffsweg auf die Zahlen. */}
        <ChartFigure
          className="hidden min-h-0 flex-1 md:flex md:h-72"
          caption={t("spendingBreakdown.title")}
          columns={[
            { key: 'name', label: t("spendingBreakdown.categoryColumn"), format: (row) => row.name },
            {
              key: 'value',
              label: t("spendingBreakdown.shareColumn"),
              numeric: true,
              format: (row) =>
                showPercent && totalExpenses > 0
                  ? formatPercentInt((row.value / totalExpenses) * 100)
                  : formatCurrencyInt(Math.round(row.value)),
            },
          ]}
          rows={[...sunburst.inner, ...sunburst.outer]}
          rowKey={(row) => row.id}
        >
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip {...chartTooltipProps()} formatter={tooltipFormatter} />
              {/* Innerer Ring: Ausgabenklassen */}
              <Pie
                data={sunburst.inner}
                dataKey="value"
                nameKey="name"
                innerRadius="24%"
                outerRadius="62%"
                paddingAngle={1}
                startAngle={baseStartAngle}
                endAngle={baseEndAngle}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              >
                {sunburst.inner.map((entry) => {
                  const col = colorMap.get(entry.id) || CHART_BRAND;
                  // Dimming-Logik: Wenn eine Unterkategorie gehovered ist, hebe nur deren Parent hervor
                  const activeOuter = hoveredKey ? outerById.get(hoveredKey) : null;
                  const isDimmed = hoveredKey
                    ? activeOuter
                      ? entry.id !== activeOuter.parentId
                      : entry.id !== hoveredKey
                    : false;
                  return (
                    <Cell
                      key={entry.id}
                      fill={col}
                      opacity={isDimmed ? 0.5 : 1}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredKey(entry.id)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => navigateToKlasse(entry.id)}
                    />
                  );
                })}
              </Pie>

              {/* Äußerer Ring: Hauptkategorien je Ausgabenklasse, exakt im Winkelbereich des Parents */}
              {(sunburst.inner || []).map((parent) => {
                const children = childrenByParent.get(parent.id) || [];
                const angles = angleMap.get(parent.id);
                if (!angles || children.length === 0) return null;

                return (
                  <Pie
                    key={`outer-${parent.id}`}
                    data={children}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="66%"
                    outerRadius="92%"
                    startAngle={angles.startAngle}
                    endAngle={angles.endAngle}
                    paddingAngle={0}
                    isAnimationActive={chartAnimation.animate}
                    animationDuration={chartAnimation.animationDuration}
                    animationEasing={chartAnimation.animationEasing}
                  >
                    {children.map((entry) => {
                      const parentColor = colorMap.get(entry.parentId) || CHART_BRAND;
                      const isDimmed = hoveredKey
                        ? hoveredKey !== entry.id && hoveredKey !== entry.parentId
                        : false;
                      return (
                        <Cell
                          key={entry.id}
                          fill={parentColor}
                          opacity={isDimmed ? 0.4 : 0.85}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredKey(entry.id)}
                          onMouseLeave={() => setHoveredKey(null)}
                          onClick={() => navigateToCategory(entry.id)}
                        />
                      );
                    })}
                  </Pie>
                );
              })}
            </PieChart>
          </ResponsiveContainer>
        </div>
        </ChartFigure>

        {/* Legende (Ausgabenklassen) — nur Desktop; mobil übernimmt die Liste oben. */}
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {legendItems.map((item) => {
            const isActive =
              hoveredKey === item.id ||
              (!!hoveredKey && outerById.get(hoveredKey)?.parentId === item.id);
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setHoveredKey(item.id)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => navigateToKlasse(item.id)}
                aria-label={`${item.name}: ${t("spendingBreakdown.viewTransactions")}`}
                className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className={`text-xs ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
                <span className={`text-xs tabular-nums ${isActive ? 'font-semibold' : ''}`}>
                  {showPercent ? `${item.value}%` : formatCurrencyInt(item.value)}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
