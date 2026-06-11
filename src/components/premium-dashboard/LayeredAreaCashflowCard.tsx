import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { parseISO, subDays, startOfMonth, format } from "date-fns";
import { de } from "date-fns/locale";
import type { Transaction } from "@/types";

type WindowKey = "7d" | "30d" | "12m";
type CurveMode = "smooth" | "step";

interface LayeredAreaCashflowCardProps {
  transactions: Transaction[];
}

type Point = {
  label: string;
  income: number;   // positive
  expensesNeg: number; // negative (darstellung unter 0)
  net: number;      // income + expensesNeg (also income - expenses)
  balance: number;  // kumuliert
};

const fmtEUR = (v: number) =>
  v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function LayeredAreaCashflowCard({ transactions }: LayeredAreaCashflowCardProps) {
  const [win, setWin] = useState<WindowKey>("30d");
  const [curve, setCurve] = useState<CurveMode>("smooth");

  const { data, empty } = useMemo(() => {
    if (!transactions?.length) return { data: [] as Point[], empty: true };

    const now = new Date();
    const rangeStart =
      win === "7d" ? subDays(now, 7) :
      win === "30d" ? subDays(now, 30) :
      // 12 Monate zurück ab Monatsanfang
      startOfMonth(subDays(now, 365));

    // Filtere Transaktionen im Fenster
    const filtered = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= rangeStart && d <= now;
    });

    if (!filtered.length) return { data: [] as Point[], empty: true };

    // Gruppierung: 7d/30d -> täglich, 12m -> monatlich
    const map = new Map<string, { sortKey: string; income: number; expenses: number }>();
    const push = (key: string, sortKey: string, inc: number, exp: number) => {
      if (!map.has(key)) map.set(key, { sortKey, income: 0, expenses: 0 });
      const v = map.get(key)!;
      v.income += inc;
      v.expenses += exp;
    };

    filtered.forEach(t => {
      const d = parseISO(t.date);
      if (win === "12m") {
        const k = format(startOfMonth(d), "yyyy-MM-01");
        const label = format(startOfMonth(d), "MMM yy", { locale: de });
        if (t.amount > 0) push(label, k, t.amount, 0);
        else push(label, k, 0, Math.abs(t.amount));
      } else {
        const k = format(d, "yyyy-MM-dd");
        const label = format(d, "dd.MM.", { locale: de });
        if (t.amount > 0) push(label, k, t.amount, 0);
        else push(label, k, 0, Math.abs(t.amount));
      }
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([label, v]) => ({ label, income: v.income, expenses: v.expenses }));

    let running = 0;
    const points: Point[] = sorted.map(row => {
      const income = row.income;
      const expensesNeg = -row.expenses; // negative für Darstellung unter 0
      const net = income + expensesNeg;
      running += net;
      return {
        label: row.label,
        income,
        expensesNeg,
        net,
        balance: running,
      };
    });

    return { data: points, empty: false };
  }, [transactions, win]);

  const curveType = curve === "smooth" ? "monotone" : "stepAfter";

  return (
    <Card className="card-premium">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>Wie ist mein Cashflow?</CardTitle>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <Button size="sm" variant={win === "7d" ? "default" : "outline"} onClick={() => setWin("7d")}>7d</Button>
            <Button size="sm" variant={win === "30d" ? "default" : "outline"} onClick={() => setWin("30d")}>30d</Button>
            <Button size="sm" variant={win === "12m" ? "default" : "outline"} onClick={() => setWin("12m")}>12M</Button>
          </div>
          <Button size="sm" variant={curve === "smooth" ? "default" : "outline"} onClick={() => setCurve(curve === "smooth" ? "step" : "smooth")}>
            {curve === "smooth" ? "Glatt" : "Stufig"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Keine Daten im Zeitraum
          </div>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--positive))" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="hsl(var(--positive))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v: number) => `${Math.round(v)}€`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                  formatter={(value: number, name: string) => {
                    const n = name === "income" ? "Einnahmen"
                      : name === "expensesNeg" ? "Ausgaben"
                      : name === "balance" ? "Saldo"
                      : name === "net" ? "Netto"
                      : name;
                    const v = name === "expensesNeg" ? -Number(value) : Number(value);
                    return [fmtEUR(v), n as string];
                  }}
                  labelFormatter={(label) => `Datum/Periode: ${label}`}
                />
                <ReferenceLine y={0} stroke="#6b7280" />

                {/* Einnahmen (über 0) */}
                <Area
                  type={curveType}
                  dataKey="income"
                  name="Einnahmen"
                  stroke="hsl(var(--positive))"
                  strokeWidth={2}
                  fill="url(#gradIncome)"
                />

                {/* Ausgaben (unter 0) */}
                <Area
                  type={curveType}
                  dataKey="expensesNeg"
                  name="Ausgaben"
                  stroke="hsl(var(--brand))"
                  strokeWidth={2}
                  fill="url(#gradExpenses)"
                />

                {/* Saldo (kumuliert) */}
                <Line
                  type={curveType}
                  dataKey="balance"
                  name="Saldo"
                  stroke="hsl(var(--accent))"
                  strokeWidth={3}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Glättung: „Glatt“ für geschwungene Linien, „Stufig“ für buchungsgetreue Sprünge. Null-Linie trennt Zufluss/Abfluss.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}