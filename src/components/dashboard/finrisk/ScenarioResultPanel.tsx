import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd. MMM yyyy', { locale: de });
  } catch {
    return iso;
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

interface Props {
  result: ScenarioResult | null;
  isCalculating: boolean;
  safetyBuffer: number;
}

/**
 * Ergebnis-Panel (FinRisk): Endsaldo vorher/nachher, Stress-Tragfähigkeit je
 * Sicherheitsniveau, das P10/P50/P90-Band nach Szenario und die Diagnose.
 */
export default function ScenarioResultPanel({ result, isCalculating, safetyBuffer }: Props) {
  if (isCalculating) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Szenario wird lokal simuliert …
      </div>
    );
  }
  if (!result) return null;

  const maxBreach = (() => {
    const series = result.breachProbabilities[String(safetyBuffer)] ?? [];
    return series.length ? Math.max(...series) : 0;
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Endsaldo vorher (P50)" value={eur.format(result.baselineEndP50)} />
        <Stat label="Endsaldo nachher (P50)" value={eur.format(result.scenarioEndP50)} />
        <Stat
          label="Veränderung"
          value={eur.format(result.deltaEndP50)}
          hint={result.deltaEndP50 < 0 ? 'Belastung' : 'Entlastung'}
        />
        <Stat
          label="Pufferbruch (max.)"
          value={`${Math.round(maxBreach * 100)} %`}
          hint={`Schwelle ${eur.format(safetyBuffer)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stress-Tragfähigkeit</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sicherheitsniveau</TableHead>
                <TableHead className="text-right">Tragbarer Schock</TableHead>
                <TableHead className="text-right">Kritischer Tag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.stressCapacity.map((s) => (
                <TableRow key={s.confidenceLevel}>
                  <TableCell>{Math.round(s.confidenceLevel * 100)} %</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {eur.format(s.maxAffordableShock)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">Tag {s.criticalDay}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Liquiditätsband nach Szenario (P10–P90)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.daily} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="finriskBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => format(parseISO(v), 'MMM', { locale: de })}
                  minTickGap={32}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tickFormatter={(v: number) => eur.format(v)} width={72} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => eur.format(v)}
                  labelFormatter={(l: string) => fmtDate(l)}
                />
                <Area
                  type="monotone"
                  dataKey="p10"
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={(d: { p10: number; p90: number }) => d.p90 - d.p10}
                  stackId="band"
                  stroke="none"
                  fill="url(#finriskBand)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {safetyBuffer > 0 && (
                  <ReferenceLine y={safetyBuffer} stroke="#d97706" strokeDasharray="4 4" />
                )}
                <ReferenceLine y={0} stroke="currentColor" className="stroke-muted-foreground" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Diagnose</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{result.diagnosis}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
