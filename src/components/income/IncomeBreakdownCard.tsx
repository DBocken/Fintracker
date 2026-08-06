import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { chartRamp, CHART_INCOME } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useI18n } from '@/i18n/useI18n';
import { buildTransactionsHref } from '@/components/dashboard/filter-utils';
import type { IncomeBreakdown } from '@/lib/analysis-data';
import { chartText, chartTooltipProps } from '@/lib/chart-tooltip';
import { ChartFigure } from '@/components/common/ChartFigure';

const formatCurrencyInt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const formatPercentInt = (v: number) => `${Math.round(v)}%`;

/** Synthetische Gruppen-IDs sind keine echten Kategorie-IDs — Klicks darauf filtern nicht. */
function isSyntheticGroupId(id: string): boolean {
  return id.startsWith('__');
}

function categoryHrefFor(id: string): string {
  return buildTransactionsHref({ category: isSyntheticGroupId(id) ? 'all' : id });
}

/** Anteilsbalken, der sich beim Einblenden von 0 auf seinen Zielanteil aufbaut. */
function GrowBar({ fraction, color, reduce }: { fraction: number; color: string; reduce: boolean }) {
  const [grown, setGrown] = useState(reduce);
  useEffect(() => {
    if (reduce) {
      setGrown(true);
      return;
    }
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
  breakdown: IncomeBreakdown;
  colorMap: Map<string, string>;
  showPercent: boolean;
}

/** Mobile Aufschlüsselung: Hauptkategorien aufklappbar, Unterkategorien antippbar. */
function IncomeBreakdownList({ breakdown, colorMap, showPercent }: BreakdownListProps) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    breakdown.groups[0] && breakdown.groups[0].children.length > 0 ? new Set([breakdown.groups[0].id]) : new Set(),
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

  if (breakdown.groups.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('income.noIncome')}</p>;
  }

  return (
    <ul className="space-y-2">
      {breakdown.groups.map((group) => {
        const color = colorMap.get(group.id) || CHART_INCOME;
        const hasChildren = group.children.length > 0;
        const isOpen = expanded.has(group.id);
        return (
          <li key={group.id} className="rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => (hasChildren ? toggle(group.id) : navigate(categoryHrefFor(group.id)))}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-label={
                hasChildren
                  ? `${group.name} ${isOpen ? t('spendingBreakdown.toggleClose') : t('spendingBreakdown.toggleOpen')}`
                  : `${group.name}: ${t('spendingBreakdown.viewTransactions')}`
              }
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{group.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {fmtValue(group.value, breakdown.total)}
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
                      onClick={() => navigate(categoryHrefFor(child.id))}
                      aria-label={`${child.name}: ${t('spendingBreakdown.viewTransactions')}`}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
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

/** Donut: Anteil je Einkommens-Hauptkategorie. Spiegelbild von SpendingBreakdownCard. */
export default function IncomeBreakdownCard({ breakdown }: { breakdown: IncomeBreakdown }) {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();
  const [showPercent, setShowPercent] = useState(false);
  const navigate = useNavigate();

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const ramp = chartRamp(breakdown.groups.length);
    breakdown.groups.forEach((g, idx) => map.set(g.id, ramp[idx]));
    return map;
  }, [breakdown]);

  const tooltipFormatter = (value: unknown, name: unknown): [string, string] => {
    const label = chartText(name);
    const val = Number(value);
    if (!Number.isFinite(val)) return ['–', label];
    if (showPercent && breakdown.total > 0) return [formatPercentInt((val / breakdown.total) * 100), label];
    return [formatCurrencyInt(Math.round(val)), label];
  };

  return (
    <Card className="card-premium flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>{t('income.breakdownTitle')}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={showPercent}
            onCheckedChange={(v) => setShowPercent(Boolean(v))}
            aria-label={t('spendingBreakdown.percent')}
          />
          <span className="text-sm text-muted-foreground">{t('spendingBreakdown.percent')}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="md:hidden">
          <IncomeBreakdownList breakdown={breakdown} colorMap={colorMap} showPercent={showPercent} />
        </div>

        {/* WP-6.10: Mobil traegt die antippbare Liste oben die Zahlen; die ist
            hier `md:hidden`, deshalb bekommt Desktop eine eigene Tabelle. */}
        <ChartFigure
          className="hidden min-h-0 flex-1 md:flex md:h-72"
          caption={t('income.breakdownTitle')}
          columns={[
            { key: 'name', label: t('income.sourceColumn'), format: (row) => row.name },
            {
              key: 'value',
              label: t('income.totalColumn'),
              numeric: true,
              format: (row) =>
                showPercent && breakdown.total > 0
                  ? formatPercentInt((row.value / breakdown.total) * 100)
                  : formatCurrencyInt(Math.round(row.value)),
            },
          ]}
          rows={breakdown.groups}
          rowKey={(row) => row.id}
        >
        <div className="min-h-0 flex-1">
          {breakdown.groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('income.noIncome')}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip {...chartTooltipProps()} formatter={tooltipFormatter} />
                <Pie
                  data={breakdown.groups}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={1}
                  isAnimationActive={chartAnimation.animate}
                  animationDuration={chartAnimation.animationDuration}
                  animationEasing={chartAnimation.animationEasing}
                >
                  {breakdown.groups.map((g) => (
                    <Cell
                      key={g.id}
                      fill={colorMap.get(g.id) || CHART_INCOME}
                      className="cursor-pointer"
                      onClick={() => navigate(categoryHrefFor(g.id))}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        </ChartFigure>

        <div className="hidden flex-wrap gap-1.5 md:flex">
          {breakdown.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => navigate(categoryHrefFor(g.id))}
              aria-label={`${g.name}: ${t('spendingBreakdown.viewTransactions')}`}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/50"
            >
              <span className="h-2 w-2 shrink-0 rounded" style={{ backgroundColor: colorMap.get(g.id) || CHART_INCOME }} />
              <span className="text-xs">{g.name}</span>
              <span className="text-xs tabular-nums">
                {showPercent ? formatPercentInt((g.value / (breakdown.total || 1)) * 100) : formatCurrencyInt(g.value)}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
