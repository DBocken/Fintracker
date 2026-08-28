/**
 * SzenarioAbsicht → ScenarioPayload (WP-H).
 *
 * Der zweite Übersetzungsschritt nach `scenario-intent.ts`: Aus der im TEXT
 * erkannten Veränderungs-Menge wird das Payload, das `runScenarioPayload`
 * versteht. REIN und ohne I/O, damit die Übersetzung ohne Worker und ohne
 * React testbar ist — die Fläche ruft sie und reicht das Ergebnis an den
 * bestehenden Monte-Carlo-Worker.
 *
 * Transparenz vor Vollständigkeit: Ein `flow_entfaellt` trifft die
 * KONKRETEN laufenden Posten, deren Name/Kategorie ein Stichwort enthält —
 * die getroffenen Posten werden je Delta zurückgemeldet (`getroffeneFlows`),
 * damit die Fläche zeigen kann, WAS wegfällt, statt still zu behaupten,
 * alles erwischt zu haben. Ein unbeziffertes Einkommens-Delta fließt NICHT
 * ein (`unberuecksichtigt`), sondern wird von der Fläche nachgefragt — ein
 * erfundener Betrag wäre eine falsche Simulation.
 */
import type { RecurringFlow } from './forecast-types';
import type { ScenarioEvent, ScenarioPayload, ScenarioResult } from './finrisk/scenario-payload-types';
import type { SzenarioAbsicht, SzenarioDelta } from './scenario-intent';

export interface DeltaAufloesung {
  delta: SzenarioDelta;
  /** Für `flow_entfaellt`: die konkret getroffenen laufenden Posten. */
  getroffeneFlows?: { id: string; name: string }[];
  /**
   * true, wenn das Delta NICHT in den Payload eingeflossen ist — unbeziffertes
   * Einkommen oder ein Konzept ohne Treffer im Bestand. Die Fläche benennt
   * das; die Simulation rechnet dann ohne dieses Delta (konservativ, solange
   * das Delta die Lage verbessert hätte).
   */
  unberuecksichtigt: boolean;
}

export interface SzenarioPayloadErgebnis {
  /** `null`, wenn KEIN Delta wirksam wurde — dann gibt es nichts zu rechnen. */
  payload: ScenarioPayload | null;
  /** Je Delta der Absicht eine Auflösung, in derselben Reihenfolge. */
  aufloesungen: DeltaAufloesung[];
  /** Aufgelöste Schwelle in EUR (aus der Forecast-Konfiguration, nie aus dem Text). */
  schwelleEur?: number;
}

const HORIZONT_NACHLAUF_TAGE = 120;
const MIN_HORIZONT_TAGE = 90;
const MAX_HORIZONT_TAGE = 730;

function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Trifft ein Stichwort diesen Posten? Name UND Kategorie zählen. */
function trifftFlow(flow: RecurringFlow, stichworte: readonly string[]): boolean {
  const heuhaufen = normalisiere(`${flow.name} ${flow.category ?? ''}`);
  return stichworte.some((s) => heuhaufen.includes(normalisiere(s)));
}

export function baueSzenarioPayload(
  absicht: SzenarioAbsicht,
  optionen: {
    /** Laufende Posten des Nutzers (aus dem ForecastInput). */
    flows: readonly RecurringFlow[];
    /** Sicherheitspuffer aus der Forecast-Konfiguration. */
    safetyBuffer?: number;
  },
): SzenarioPayloadErgebnis {
  const events: ScenarioEvent[] = [];
  const aufloesungen: DeltaAufloesung[] = [];

  for (const delta of absicht.deltas) {
    switch (delta.art) {
      case 'einmalausgabe': {
        events.push({
          eventType: 'expense',
          amount: delta.betrag,
          dayIndex: delta.abTag,
          description: delta.label,
        });
        aufloesungen.push({ delta, unberuecksichtigt: false });
        break;
      }
      case 'einkommen': {
        if (delta.prozent !== undefined) {
          // Prozentuale Änderung des GRÖSSTEN Einkommens-Eintrags — ein
          // Jobverlust ist nicht „alle Einnahmen −100 %" (Nebenjob bliebe).
          events.push({
            eventType: 'flow_change',
            amount: 0,
            flowSelector: { kind: 'largestIncome' },
            factor: Math.max(0, 1 + delta.prozent / 100),
            dayIndex: delta.abTag,
          });
          aufloesungen.push({ delta, unberuecksichtigt: false });
        } else if (delta.betragProMonat !== undefined) {
          // Absoluter Mehr-/Minderbetrag als eigener Monatsposten — robust,
          // ohne das heutige Gehalt kennen zu müssen.
          events.push({
            eventType: 'recurring_flow',
            amount: Math.abs(delta.betragProMonat),
            direction: delta.betragProMonat >= 0 ? 'income' : 'expense',
            dayIndex: delta.abTag,
          });
          aufloesungen.push({ delta, unberuecksichtigt: false });
        } else {
          // Unbeziffert: erkannt, aber ohne Betrag nicht simulierbar. Die
          // Fläche fragt nach — geraten wird nicht.
          aufloesungen.push({ delta, unberuecksichtigt: true });
        }
        break;
      }
      case 'flow_entfaellt': {
        const getroffen = optionen.flows
          .filter((f) => !f.disabled && trifftFlow(f, delta.stichworte))
          .map((f) => ({ id: f.id, name: f.name }));
        if (getroffen.length > 0) {
          events.push({
            eventType: 'flow_change',
            amount: 0,
            flowSelector: { kind: 'ids', ids: getroffen.map((f) => f.id) },
            factor: 0,
            dayIndex: delta.abTag,
          });
        }
        aufloesungen.push({ delta, getroffeneFlows: getroffen, unberuecksichtigt: getroffen.length === 0 });
        break;
      }
      case 'flow_neu': {
        events.push({
          eventType: 'recurring_flow',
          amount: delta.betragProMonat,
          direction: delta.richtung === 'einnahme' ? 'income' : 'expense',
          dayIndex: delta.abTag,
        });
        aufloesungen.push({ delta, unberuecksichtigt: false });
        break;
      }
    }
  }

  const schwelleEur = absicht.schwelle === 'notgroschen' ? optionen.safetyBuffer : undefined;

  if (events.length === 0) {
    return { payload: null, aufloesungen, schwelleEur };
  }

  const weitesterTag = Math.max(0, ...absicht.deltas.map((d) => d.abTag));
  const payload: ScenarioPayload = {
    scenarioId: 'chat-kombination',
    scenarioType: 'custom_combination',
    timeHorizonDays: Math.min(
      MAX_HORIZONT_TAGE,
      Math.max(MIN_HORIZONT_TAGE, weitesterTag + HORIZONT_NACHLAUF_TAGE),
    ),
    ...(schwelleEur !== undefined ? { thresholdAmount: schwelleEur } : {}),
    events,
  };

  return { payload, aufloesungen, schwelleEur };
}

/**
 * Höchste Pufferbruch-Wahrscheinlichkeit über den Horizont für die Schwelle —
 * die eine Zahl, die „ohne den Notgroschen anzugreifen" beantwortet.
 * `null`, wenn ohne Schwelle gerechnet wurde.
 */
export function maxPufferbruch(result: ScenarioResult, schwelleEur: number | undefined): number | null {
  if (schwelleEur === undefined) return null;
  const reihe = result.breachProbabilities[String(schwelleEur)];
  if (!reihe || reihe.length === 0) return 0;
  return Math.max(...reihe);
}
