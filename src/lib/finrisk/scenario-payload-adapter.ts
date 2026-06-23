/**
 * FinRisk – Szenario-Payload-Adapter (v27)
 *
 * Bildet ein UI-nahes {@link ScenarioPayload} auf das bestehende
 * {@link ForecastScenario}-Modell ab (`src/lib/forecast-scenario.ts`). So bleibt
 * der Engine-Kern unberührt: ein Payload wird zu Modifikatoren, die der bewährte
 * `applyScenario`-Mechanismus deterministisch auf den Input anwendet.
 *
 * Mapping:
 *  - `expense`            → `oneTime` (negativ) am Tag `start + dayIndex`.
 *  - `income`             → `oneTime` (positiv) am Tag `start + dayIndex`.
 *  - `income_reduction`   → je Tag im Fenster ein `oneTime` (negativ) in Höhe der
 *                            täglichen Reduktion. Das reproduziert die kumulative
 *                            Einkommensminderung des v27-Referenzmodells exakt und
 *                            kommt ohne Engine-Erweiterung aus.
 *  - `baseline_multiplier` / `payload.baselineMultiplier`
 *                         → `variable` (`percentChange = (faktor − 1) · 100`).
 *
 * Die Eintrittswahrscheinlichkeit (`probability < 1`) wird hier NICHT angewandt –
 * sie ist eine Mixture über Monte-Carlo-Pfade und wird im Orchestrator
 * (`scenario-engine.ts`) behandelt. `payloadToScenario` liefert den vollen
 * (deterministischen) Szenario-Effekt.
 */
import { addDays, format, parseISO } from 'date-fns';
import type { ForecastScenario, ScenarioModifier } from '../forecast-scenario-types';
import type { ScenarioEvent, ScenarioPayload } from './scenario-payload-types';

const ISO = 'yyyy-MM-dd';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Datum als `start + offset` Tage im ISO-Format. */
function dayFrom(startISO: string, offset: number): string {
  return format(addDays(parseISO(startISO), Math.max(0, offset)), ISO);
}

/** Übersetzt ein einzelnes Ereignis in einen oder mehrere Modifikatoren. */
function eventToModifiers(event: ScenarioEvent, startISO: string, index: number): ScenarioModifier[] {
  const baseId = `evt-${index}`;
  switch (event.eventType) {
    case 'expense':
      return [
        {
          id: baseId,
          type: 'oneTime',
          amount: -Math.abs(event.amount),
          date: dayFrom(startISO, event.dayIndex ?? 0),
          label: event.description ?? 'Anschaffung',
        },
      ];

    case 'income':
      return [
        {
          id: baseId,
          type: 'oneTime',
          amount: Math.abs(event.amount),
          date: dayFrom(startISO, event.dayIndex ?? 0),
          label: event.description ?? 'Zusätzliche Einnahme',
        },
      ];

    case 'baseline_multiplier':
      return [
        {
          id: baseId,
          type: 'variable',
          percentChange: round2((event.amount - 1) * 100),
          label: event.description ?? 'Höhere Alltagskosten',
        },
      ];

    case 'income_reduction': {
      // Tägliche Einkommensminderung über das Fenster als Folge von Einmalposten.
      // Kumulativ identisch zur v27-Referenz: nach k Tagen fehlt amount · k.
      const start = Math.max(0, event.startDayIndex ?? 0);
      const end = Math.max(start, event.endDayIndex ?? start);
      const dailyAmount = Math.abs(event.amount);
      const mods: ScenarioModifier[] = [];
      for (let day = start; day <= end; day++) {
        mods.push({
          id: `${baseId}-d${day}`,
          type: 'oneTime',
          amount: -dailyAmount,
          date: dayFrom(startISO, day),
          label: event.description ?? 'Einkommensausfall',
        });
      }
      return mods;
    }

    default:
      return [];
  }
}

/**
 * Übersetzt ein {@link ScenarioPayload} in ein {@link ForecastScenario}.
 *
 * @param payload  Das UI-Payload.
 * @param startISO Startdatum des Forecasts (Tag 0 der `dayIndex`-Skala).
 */
export function payloadToScenario(payload: ScenarioPayload, startISO: string): ForecastScenario {
  const modifiers: ScenarioModifier[] = [];

  // Globaler Baseline-Faktor (separat vom Ereignis-Array möglich).
  if (payload.baselineMultiplier != null && payload.baselineMultiplier !== 1) {
    modifiers.push({
      id: 'baseline-multiplier',
      type: 'variable',
      percentChange: round2((payload.baselineMultiplier - 1) * 100),
      label: 'Höhere Alltagskosten',
    });
  }

  (payload.events ?? []).forEach((event, index) => {
    modifiers.push(...eventToModifiers(event, startISO, index));
  });

  return {
    id: payload.scenarioId,
    name: payload.scenarioType,
    description: payload.notes,
    modifiers,
  };
}
