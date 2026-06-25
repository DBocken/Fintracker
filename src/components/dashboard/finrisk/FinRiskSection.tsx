import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLumpyRisk } from '@/hooks/useLumpyRisk';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { buildBaseCheckPayload, type QuestionContext } from '@/lib/finrisk/scenario-questions';
import type { ForecastInput, BufferBasis } from '@/lib/forecast-types';
import type { ScenarioPayload } from '@/lib/finrisk/scenario-payload-types';
import RiskSummaryCard from './RiskSummaryCard';
import ScenarioQuestionCards from './ScenarioQuestionCards';
import ScenarioResultPanel from './ScenarioResultPanel';
import FinRiskDebugView from './FinRiskDebugView';

interface Props {
  input: ForecastInput | null;
  months: number;
  safetyBuffer: number;
  bufferBasis: BufferBasis;
  startISO: string;
}

const MC = { trials: 500, seed: 1 };

/**
 * Dispozins (Überziehungszins) p. a. in Prozent. Eine Überziehung kostet Geld;
 * die Simulation soll die Erholung aus einem Liquiditätstief nicht zinsfrei und
 * damit zu optimistisch darstellen. Konservativ-marktüblicher Default.
 */
const OVERDRAFT_RATE = 11;

function maxBreach(
  breach: Record<string, number[]> | undefined,
  threshold: number,
): number | null {
  if (!breach) return null;
  const series = breach[String(threshold)];
  if (!series || series.length === 0) return 0;
  return Math.max(...series);
}

/**
 * FinRisk-Sektion: Kurzdiagnose (Alltag/Lumpy/Stress), Szenario-Fragekarten und
 * Ergebnis-Panel. Alles wird lokal im Worker gerechnet; nichts verlässt das Gerät.
 */
export default function FinRiskSection({ input, months, safetyBuffer, bufferBasis, startISO }: Props) {
  const { lumpy } = useLumpyRisk();

  const ctx: QuestionContext = useMemo(
    () => ({ horizonDays: Math.max(months, 6) * 30, thresholdAmount: safetyBuffer }),
    [months, safetyBuffer],
  );
  const config = useMemo(
    () => ({ months, safetyBuffer, bufferBasis, startDate: startISO, overdraftAnnualRate: OVERDRAFT_RATE }),
    [months, safetyBuffer, bufferBasis, startISO],
  );

  // Basisprüfung läuft automatisch und speist die Kurzdiagnose.
  const basePayload = useMemo(() => buildBaseCheckPayload(ctx), [ctx]);
  const { result: baseResult } = useScenarioRisk(input, config, basePayload, {
    monteCarlo: MC,
    lumpy: lumpy ?? undefined,
  });

  // Vom Nutzer gewähltes Szenario.
  const [activePayload, setActivePayload] = useState<ScenarioPayload | null>(null);
  const { result: scenarioResult, isCalculating } = useScenarioRisk(input, config, activePayload, {
    monteCarlo: MC,
    lumpy: lumpy ?? undefined,
  });

  const stress90 = baseResult?.stressCapacity.find((s) => Math.abs(s.confidenceLevel - 0.9) < 1e-9) ?? null;

  return (
    <section className="space-y-4" aria-labelledby="finrisk-heading">
      <div>
        <h2 id="finrisk-heading" className="text-lg font-semibold">
          Finanzrisiko & Szenarien
        </h2>
        <p className="text-sm text-muted-foreground">
          Nicht nur „geht mein Budget auf?", sondern: welche Zukunftspfade gefährden deine
          Liquidität – und wie teuer darf ein Schock bei 80/90/95 % Sicherheit sein?
        </p>
      </div>

      <RiskSummaryCard
        lumpy={lumpy}
        stress90={stress90}
        baseBreachProbability={maxBreach(baseResult?.breachProbabilities, safetyBuffer)}
      />

      <ScenarioQuestionCards ctx={ctx} onRun={setActivePayload} activeId={activePayload?.scenarioId} />

      <ScenarioResultPanel
        result={scenarioResult}
        isCalculating={isCalculating}
        safetyBuffer={safetyBuffer}
      />

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          Debug & Methodik <span className="ml-1 font-normal text-muted-foreground">für erfahrene Nutzer</span>
        </summary>
        <div className="border-t p-3 sm:p-4">
          <FinRiskDebugView payload={activePayload} result={scenarioResult} />
        </div>
      </details>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Diese Analyse wird lokal auf deinem Gerät berechnet. Deine Transaktionen und Forecasts
        werden nicht an unseren Server übertragen.
      </p>
    </section>
  );
}
