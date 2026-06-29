import { useMemo, useState } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useLumpyRisk } from '@/hooks/useLumpyRisk';
import { useScenarioRisk } from '@/hooks/useScenarioRisk';
import { buildBaseCheckPayload, type QuestionContext } from '@/lib/finrisk/scenario-questions';
import type { ForecastInput, BufferBasis } from '@/lib/forecast-types';
import type { ScenarioPayload } from '@/lib/finrisk/scenario-payload-types';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import RiskSummaryCard from './RiskSummaryCard';
import ScenarioSelector from './ScenarioSelector';
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

  // „Was-wäre-wenn: bei Knappheit gegensteuern" – bewusstes Opt-in, keine Prognose.
  const [discipline, setDiscipline] = useState(false);
  const [disciplineStrength, setDisciplineStrength] = useState(0.5);

  const ctx: QuestionContext = useMemo(
    () => ({ horizonDays: Math.max(months, 6) * 30, thresholdAmount: safetyBuffer }),
    [months, safetyBuffer],
  );
  const config = useMemo(
    () => ({
      months,
      safetyBuffer,
      bufferBasis,
      startDate: startISO,
      overdraftAnnualRate: OVERDRAFT_RATE,
      ...(discipline ? { adaptiveSpending: { maxReductionPct: disciplineStrength } } : {}),
    }),
    [months, safetyBuffer, bufferBasis, startISO, discipline, disciplineStrength],
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

      {/* Was-wäre-wenn-Schalter: Gegensteuern bei Knappheit. Formular-Container
          (nicht klickbare Karte) – die ganze Kopfzeile schaltet den Switch. */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="finrisk-discipline" className="flex cursor-pointer items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
            <span>
              <span className="text-sm font-medium">Was, wenn du von Anfang an gegensteuerst?</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Bei Knappheit hältst du diskretionäre Ausgaben zurück – Fixkosten &amp; Verträge
                bleiben. Bewusstes Was-wäre-wenn, keine Prognose.
              </span>
            </span>
          </label>
          <Switch
            id="finrisk-discipline"
            checked={discipline}
            onCheckedChange={setDiscipline}
            aria-label="Bei Knappheit gegensteuern"
          />
        </div>
        {discipline && (
          <div className="mt-3 flex items-center gap-3 border-t pt-3">
            <span className="shrink-0 text-xs text-muted-foreground">Wie konsequent</span>
            <Slider
              value={[Math.round(disciplineStrength * 100)]}
              onValueChange={([v]) => setDisciplineStrength((v ?? 50) / 100)}
              min={10}
              max={100}
              step={10}
              className="max-w-[240px] flex-1"
              aria-label="Konsequenz des Gegensteuerns"
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums">
              {Math.round(disciplineStrength * 100)} %
            </span>
          </div>
        )}
      </div>

      <ScenarioSelector ctx={ctx} onRun={setActivePayload} activeId={activePayload?.scenarioId} />

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
