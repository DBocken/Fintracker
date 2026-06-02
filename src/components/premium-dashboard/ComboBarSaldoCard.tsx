"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Row = { formattedDate: string; income: number; expenses: number; net: number };

interface ComboBarSaldoCardProps {
  data: Row[];
}

const fmtEUR = (v: number) =>
  v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ComboBarSaldoCard({ data }: ComboBarSaldoCardProps) {
  const empty = !data || data.length === 0;

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle>Balken je Monat + Saldo-Linie</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Keine Monatsdaten
          </div>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis tickFormatter={(v: number) => `${Math.round(v)}€`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const label =
                      name === "income" ? "Einnahmen" :
                      name === "expenses" ? "Ausgaben" :
                      name === "net" ? "Saldo" : name;
                    return [fmtEUR(value), label as string];
                  }}
                  labelFormatter={(label) => `Monat: ${label}`}
                />
                <Legend />
                <Bar dataKey="income" name="Einnahmen" fill="#16a34a" />
                <Bar dataKey="expenses" name="Ausgaben" fill="#dc2626" />
                <Line type="monotone" dataKey="net" name="Saldo" stroke="#2563eb" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}