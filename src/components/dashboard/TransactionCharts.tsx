import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartRamp, CHART_BRAND } from '@/lib/chart-colors';

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

interface TransactionChartsProps {
  series: any[];
  granularity: string;
  sunburst: SunburstData;
}

export function TransactionCharts({ series, granularity, sunburst }: TransactionChartsProps) {
  // Umschalter zwischen Euro und Prozent für Sunburst
  const [showPercent, setShowPercent] = useState(false);
  // Hover-State (kann eine Haupt- oder Unterkategorie-ID sein)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Formatter
  const formatCurrencyInt = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const formatPercentInt = (v: number) => `${Math.round(v)}%`;

  const totalExpenses = sunburst?.total ?? 0;

  // Farbzuordnung für Hauptkategorien (innerer Ring)
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

  // Gruppiere Unterkategorien nach Oberkategorie
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

  // Konstante Start-/Endwinkel (Uhrzeigersinn, Start oben)
  const baseStartAngle = 90;
  const baseEndAngle = -270;

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

  // Legendeneinträge für Hauptkategorien
  const legendItems = useMemo(() => {
    return (sunburst.inner || []).map((item) => ({
      id: item.id,
      name: item.name,
      color: colorMap.get(item.id) || CHART_BRAND,
      value: showPercent && totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : Math.round(item.value),
    }));
  }, [sunburst, colorMap, showPercent, totalExpenses]);

  // Tooltip-Formatter für Sunburst (beide Ringe)
  const tooltipFormatter = (value: any, name: string) => {
    const val = Number(value);
    if (!Number.isFinite(val)) return ['–', name];
    if (showPercent && totalExpenses > 0) {
      return [formatPercentInt((val / totalExpenses) * 100), name];
    }
    return [formatCurrencyInt(Math.round(val)), name];
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="card-premium">
        <CardHeader>
          <CardTitle>
            {granularity === 'daily' ? 'Tägliche' : 
             granularity === 'weekly' ? 'Wöchentliche' : 'Monatliche'} Ausgaben
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="period" angle={-45} textAnchor="end" height={60}/>
              <YAxis tickFormatter={(v: number) => `${Math.round(v)}€`}/>
              <Tooltip formatter={(v: number) => formatCurrencyInt(Math.round(v))}/>
              <Bar dataKey="expenses" fill={CHART_BRAND}/>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="card-premium">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ausgaben nach Kategorie (Sunburst)</CardTitle>
          <div className="flex items-center gap-2">
            <Switch checked={showPercent} onCheckedChange={(v) => setShowPercent(Boolean(v))} />
            <span className="text-sm text-muted-foreground">Prozent</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {/* Sunburst: zwei konzentrische Pie-Ringe */}
            <div className="w-full">
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Tooltip formatter={tooltipFormatter} />
                  {/* Innerer Ring: Hauptkategorien */}
                  <Pie
                    data={sunburst.inner}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={80}
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
                          onMouseEnter={() => setHoveredKey(entry.id)}
                          onMouseLeave={() => setHoveredKey(null)}
                        />
                      );
                    })}
                  </Pie>

                  {/* Äußerer Ring: Unterkategorien je Oberkategorie, exakt im Winkelbereich des Parents */}
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
                        innerRadius={86}
                        outerRadius={120}
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
                              onMouseEnter={() => setHoveredKey(entry.id)}
                              onMouseLeave={() => setHoveredKey(null)}
                            />
                          );
                        })}
                      </Pie>
                    );
                  })}
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legende (Hauptkategorien) */}
            <div className="flex flex-wrap gap-2">
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
                    className={`flex items-center gap-2 rounded px-2 py-1 transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className={`text-sm ${isActive ? 'font-semibold' : ''}`}>
                      {item.name}
                    </span>
                    <span className={`text-sm ${isActive ? 'font-semibold' : ''}`}>
                      {showPercent ? `${item.value}%` : formatCurrencyInt(item.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}