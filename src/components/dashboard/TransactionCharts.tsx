import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartRamp, CHART_BRAND } from '@/lib/chart-colors';
import { buildTransactionsHref } from './filter-utils';
import type { AusgabenklasseFilter } from './filter-constants';

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
  return (
    <Card className="card-premium h-full">
      <CardHeader>
        <CardTitle>Wie ändern sich meine Ausgaben?</CardTitle>
      </CardHeader>
      <CardContent>
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
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => `${Math.round(v)} €`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
                formatter={(v: number) => [formatCurrencyInt(Math.round(v)), 'Ausgaben']}
              />
              <Bar dataKey="expenses" fill={CHART_BRAND} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Sunburst (zwei konzentrische Ringe): Ausgabenklasse (innen) -> Hauptkategorie (außen). */
export function SpendingBreakdownCard({ sunburst }: { sunburst: SunburstData }) {
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
  const tooltipFormatter = (value: number | string, name: string) => {
    const val = Number(value);
    if (!Number.isFinite(val)) return ['–', name];
    if (showPercent && totalExpenses > 0) {
      return [formatPercentInt((val / totalExpenses) * 100), name];
    }
    return [formatCurrencyInt(Math.round(val)), name];
  };

  return (
    <Card className="card-premium flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Wohin fließt mein Geld?</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={showPercent} onCheckedChange={(v) => setShowPercent(Boolean(v))} />
          <span className="text-sm text-muted-foreground">Prozent</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Sunburst: zwei konzentrische Pie-Ringe, Radien relativ zur Kartengröße */}
        <div className="h-52 min-h-0 flex-1 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={tooltipFormatter} />
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
                isAnimationActive={false}
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
                    isAnimationActive={false}
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

        {/* Legende (Ausgabenklassen) */}
        <div className="flex flex-wrap gap-1.5">
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
                aria-label={`${item.name}: Buchungen ansehen`}
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
