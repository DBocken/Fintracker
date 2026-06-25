import { LoaderCircle } from 'lucide-react';
import RiskDensityChart from './RiskDensityChart';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="text-base font-bold tabular-nums sm:text-lg">{value}</div>
      {hint && <div className="text-[11px] leading-tight text-muted-foreground">{hint}</div>}
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
 *
 * Bewusst FLACH (keine Karte-in-Karte): Das Panel sitzt bereits in einem
 * umrandeten Bereich; verschachtelte Cards wirken auf Mobile gedrängt. Stattdessen
 * leichte Sektionen mit kleinen Überschriften.
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      <RiskDensityChart result={result} safetyBuffer={safetyBuffer} />

      <section className="space-y-1 border-t pt-3">
        <h4 className="text-sm font-medium">Diagnose</h4>
        <p className="text-sm">{result.diagnosis}</p>
        {result.warnings.length > 0 && (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
