import { LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RiskDensityChart from './RiskDensityChart';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
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
 * Ergebnis-Panel (FinRisk): kompakte Kennzahlen + EINE Grafik – die
 * Wahrscheinlichkeits-Heatmap, die Band, Multimodalität, Pufferbruch und
 * Stress-Tragfähigkeit in einer Darstellung vereint – plus Klartext-Diagnose.
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
          hint={`Schwelle ${eur.format(safetyBuffer)} · ${result.horizonDays} Tage`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Liquiditäts-Heatmap nach Szenario</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskDensityChart result={result} safetyBuffer={safetyBuffer} />
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
