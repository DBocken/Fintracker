import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScenarioPayload, ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

interface Props {
  payload: ScenarioPayload | null;
  result: ScenarioResult | null;
}

function Block({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{title}</div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Debug-Ansicht (FinRisk, für erfahrene Nutzer): zeigt Payload, Stress-Capacity
 * und Warnungen. Macht explizit, dass nichts an einen Server übertragen wird.
 */
export default function FinRiskDebugView({ payload, result }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Debug & Methodik</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Diese Analyse wird vollständig lokal auf deinem Gerät berechnet. Transaktionen,
          Forecasts und Szenario-Ergebnisse werden nicht an einen Server übertragen.
        </p>
        {payload && <Block title="ScenarioPayload" value={payload} />}
        {result && <Block title="Stress-Capacity" value={result.stressCapacity} />}
        {result && result.warnings.length > 0 && <Block title="Warnungen" value={result.warnings} />}
      </CardContent>
    </Card>
  );
}
