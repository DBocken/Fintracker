import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LumpyRiskProfile } from '@/lib/finrisk/lumpy-risk';
import type { StressCapacityLevel } from '@/lib/finrisk/scenario-payload-types';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

type Tone = 'good' | 'warning' | 'critical';

const TONE_DOT: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-destructive',
};

function Row({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
        <span className="text-sm">{label}</span>
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

interface Props {
  lumpy: LumpyRiskProfile | null;
  /** Stress-Tragfähigkeit auf 90 %-Niveau aus der aktuellen Auswertung. */
  stress90: StressCapacityLevel | null;
  /** Pufferbruch-Wahrscheinlichkeit der Basisprüfung (0..1), falls bekannt. */
  baseBreachProbability: number | null;
}

/**
 * Kurzdiagnose-Karte (FinRisk): Alltagstragfähigkeit, Lumpy-Risiko und
 * Stress-Tragfähigkeit als Ampel – die drei Kernaussagen der Risikoanalyse.
 */
export default function RiskSummaryCard({ lumpy, stress90, baseBreachProbability }: Props) {
  const alltagTone: Tone =
    baseBreachProbability == null
      ? 'good'
      : baseBreachProbability >= 0.5
        ? 'critical'
        : baseBreachProbability > 0
          ? 'warning'
          : 'good';
  const alltagValue =
    baseBreachProbability == null
      ? 'wird geprüft …'
      : baseBreachProbability === 0
        ? 'tragfähig'
        : `${Math.round(baseBreachProbability * 100)} % Pufferbruch`;

  const lumpyTone: Tone =
    lumpy == null || lumpy.lumpyRiskLevel === 'low'
      ? 'good'
      : lumpy.lumpyRiskLevel === 'medium'
        ? 'warning'
        : 'critical';
  const lumpyValue =
    lumpy == null || lumpy.lumpyCount === 0
      ? 'kein nennenswertes'
      : `${lumpy.lumpyRateAnnual.toFixed(1)}×/Jahr · P90 ${eur.format(lumpy.lumpySeverityP90)}`;

  const stressTone: Tone =
    stress90 == null
      ? 'good'
      : stress90.maxAffordableShock <= 0
        ? 'critical'
        : stress90.maxAffordableShock < 1000
          ? 'warning'
          : 'good';
  const stressValue =
    stress90 == null
      ? 'wird geprüft …'
      : `${eur.format(stress90.maxAffordableShock)} bei 90 %`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Risiko-Kurzdiagnose
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Row tone={alltagTone} label="Alltag tragfähig" value={alltagValue} />
        <Row tone={lumpyTone} label="Lumpy-Risiko (seltene Großausgaben)" value={lumpyValue} />
        <Row tone={stressTone} label="Stress-Tragfähigkeit" value={stressValue} />
        <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          {stressTone === 'critical' ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          Lokal berechnet · keine Finanzberatung.
        </p>
      </CardContent>
    </Card>
  );
}
