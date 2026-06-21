import { useCallback, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { parseISO, startOfMonth, format } from 'date-fns';
import type { Transaction, Category } from '../../types';
import { dyadProps } from '@/lib/dyad';
import { chartRamp } from '@/lib/chart-colors';

interface TimelineChartProps {
  data: Array<{
    formattedDate: string;
    income: number;
    expenses: number;
    net: number;
  }>;
  flowTransactions: Transaction[];
  categories: Category[];
}

export function TimelineChart({ data, flowTransactions, categories }: TimelineChartProps) {
  // Hilfsmap für Kategorien
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  // Höchsten Vorfahren als Hauptkategorie bestimmen
  const resolveMainCategory = useCallback((catId: string | null): { mainId: string; mainName: string } => {
    if (!catId) {
      return { mainId: '__uncategorized_main', mainName: 'Unkategorisiert' };
    }
    let current = categoryMap.get(catId) || null;
    if (!current) {
      return { mainId: '__uncategorized_main', mainName: 'Unkategorisiert' };
    }
    let main = current;
    const visited = new Set<string>();
    while (current && current.parent_id) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      const parent = categoryMap.get(current.parent_id);
      if (!parent) break;
      main = parent;
      current = parent;
    }
    return { mainId: main.id, mainName: main.name };
  }, [categoryMap]);

  // Monatsbezogene Ausgaben pro Hauptkategorie berechnen
  const monthlyCategoryExpenses = useMemo(() => {
    const map = new Map<string, Record<string, number>>(); // label -> { mainName: amount }
    flowTransactions.forEach(t => {
      if (t.amount >= 0) return; // nur Ausgaben
      const monthStart = startOfMonth(parseISO(t.date));
      const label = format(monthStart, 'MMM yyyy');
      const assignedId = t.subcategory_id ?? t.category_id ?? null;
      const { mainName } = resolveMainCategory(assignedId);
      const amt = Math.abs(t.amount);
      if (!map.has(label)) map.set(label, {});
      const bucket = map.get(label)!;
      bucket[mainName] = (bucket[mainName] || 0) + amt;
    });
    return map;
  }, [flowTransactions, categoryMap, resolveMainCategory]);

  // Alle vorhandenen Hauptkategorie-Namen über die Monate sammeln
  const allMainNames = useMemo(() => {
    const set = new Set<string>();
    monthlyCategoryExpenses.forEach(byMain => {
      Object.keys(byMain).forEach(n => set.add(n));
    });
    // Sortierung nach Gesamtsumme absteigend (optional, für bessere Reihenfolge)
    const totals: Record<string, number> = {};
    monthlyCategoryExpenses.forEach(byMain => {
      Object.entries(byMain).forEach(([n, v]) => {
        totals[n] = (totals[n] || 0) + v;
      });
    });
    return Array.from(set).sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
  }, [monthlyCategoryExpenses]);

  // Monochrome Brand-Rampe statt kategorialer Palette (#54)
  const colorMap = useMemo(() => {
    const ramp = chartRamp(allMainNames.length);
    const m: Record<string, string> = {};
    allMainNames.forEach((name, idx) => {
      m[name] = ramp[idx];
    });
    return m;
  }, [allMainNames]);

  // UI-States
  const [showIncome, setShowIncome] = useState(true);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const toggleCategory = (name: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Daten mit Stacking für Ausgaben vorbereiten
  const chartData = useMemo(() => {
    const selected = Array.from(selectedCats);
    return data.map(d => {
      const byMain = monthlyCategoryExpenses.get(d.formattedDate) || {};
      const entry: Record<string, any> = {
        formattedDate: d.formattedDate,
        income: d.income,
        net: d.net,
        expenses: d.expenses,
      };
      if (selected.length === 0) {
        // Kein Stacking: nur ein roter Balken "expenses"
        return entry;
      }
      let selectedSum = 0;
      selected.forEach(name => {
        const val = byMain[name] || 0;
        entry[name] = val;
        selectedSum += val;
      });
      const rest = Math.max(0, d.expenses - selectedSum);
      entry['Rest'] = rest;
      return entry;
    });
  }, [data, monthlyCategoryExpenses, selectedCats]);

  const hasSelection = selectedCats.size > 0;

  return (
    <Card {...dyadProps("TimelineChart")}>
      <CardHeader>
        <CardTitle>Wie entwickelt sich mein Geld im Zeitverlauf?</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Steuerung */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={showIncome} onCheckedChange={(v) => setShowIncome(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Einnahmen anzeigen</span>
            </div>
          </div>
          {/* Kategorien-Auswahl */}
          <div className="flex flex-wrap gap-3">
            {allMainNames.map((name) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedCats.has(name)}
                  onCheckedChange={() => toggleCategory(name)}
                />
                <span className="text-sm" style={{ color: colorMap[name] }}>
                  {name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="formattedDate" />
            <YAxis tickFormatter={(value) => `${(value as number).toFixed(0)}€`} />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
                name
              ]}
              labelFormatter={(label) => `Monat: ${label}`}
            />
            <Legend />

            {/* Einnahmen (optional) */}
            {showIncome && (
              <Bar dataKey="income" fill="hsl(var(--positive))" name="Einnahmen" />
            )}

            {/* Ausgaben: ein Brand-Balken oder gestapelte Kategorien (Monochrom-Rampe) + Rest */}
            {!hasSelection ? (
              <Bar dataKey="expenses" fill="hsl(var(--brand))" name="Ausgaben" />
            ) : (
              <>
                {Array.from(selectedCats).map((name) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="expenses"
                    fill={colorMap[name]}
                    name={name}
                  />
                ))}
                <Bar dataKey="Rest" stackId="expenses" fill="hsl(var(--muted-foreground))" name="Rest" />
              </>
            )}

            {/* Netto-Bilanz als Linie */}
            <Line type="monotone" dataKey="net" stroke="hsl(var(--foreground))" name="Netto-Bilanz" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}