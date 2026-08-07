/**
 * Plattform-Stresstest: „Was passiert mit meiner Liquidität, wenn dieser
 * Einkommensstrom wegfällt?" Baut aus einem {@link IncomeStream} ein
 * `flow`-Szenario für die bestehende Forecast-Szenario-Engine
 * ({@link buildStreamLossScenario} → `runScenarioComparison`).
 *
 * WICHTIG (verifiziert): Das Matching läuft über Flow-IDs, NICHT über
 * `kind:'keyword'`. `resolveFlowSelector` matcht Keywords gegen den ROHEN
 * `flow.name`, während `IncomeStream.counterparty` normalisiert ist — der
 * normalisierte Name ist meist kein Substring des rohen Namens. Wir lösen die
 * IDs daher selbst auf:
 *  - Gehalts-Flows: `id === 'salary:' + normalizeMerchantName(payee)` — identisch
 *    zu `stream.counterparty`.
 *  - Vertrags-Flows: `normalizeMerchantName(flow.name) === stream.counterparty`.
 */
import { t } from "@/i18n/serviceT";
import { normalizeMerchantName } from "@/lib/merchant-normalization";
import type { RecurringFlow } from "./forecast-types";
import type { ForecastScenario } from "./forecast-scenario-types";
import type { IncomeStream } from "./income-streams";

/** IDs der Forecast-Flows, die zu diesem Einkommensstrom gehören. */
export function findStreamFlowIds(stream: IncomeStream, flows: RecurringFlow[]): string[] {
  const salaryId = `salary:${stream.counterparty}`;
  return flows
    .filter(
      (f) =>
        f.amount > 0 &&
        (f.id === salaryId || normalizeMerchantName(f.name) === stream.counterparty),
    )
    .map((f) => f.id);
}

/**
 * „Dieser Strom fällt ab sofort weg" (Faktor 0 über den ganzen Horizont).
 * `null`, wenn der Strom in der Prognose nicht auftaucht (z. B. unregelmäßige
 * Einnahmen werden nicht als RecurringFlow projiziert) — dann kein Scheinwert.
 */
export function buildStreamLossScenario(
  stream: IncomeStream,
  flows: RecurringFlow[],
): ForecastScenario | null {
  const ids = findStreamFlowIds(stream, flows);
  if (ids.length === 0) return null;
  return {
    id: `stress-${stream.key}`,
    name: t("income.stress.scenarioName", "{name} fällt weg").replace("{name}", stream.label),
    modifiers: [
      { id: "m1", type: "flow", flowSelector: { kind: "ids", ids }, factor: 0 },
    ],
  };
}
