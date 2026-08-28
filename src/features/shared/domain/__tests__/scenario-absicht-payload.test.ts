import { describe, expect, it } from 'vitest';
import { baueSzenarioPayload, maxPufferbruch } from '@/features/shared/domain/scenario-absicht-payload';
import type { SzenarioAbsicht } from '@/features/shared/domain/scenario-intent';
import type { RecurringFlow } from '@/lib/forecast-types';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

function flow(id: string, name: string, amount: number, category?: string): RecurringFlow {
  return { id, name, amount, cadence: 'monthly', anchorDate: '2026-08-01', accountId: 'acc-1', category };
}

const FLOWS: RecurringFlow[] = [
  flow('c-gehalt', 'Gehalt Arbeitgeber', 2000),
  flow('c-kfz', 'Kfz-Versicherung', -40, 'Versicherungen'),
  flow('c-tanken', 'Aral Tankstelle', -120, 'Kraftstoff'),
  flow('c-werkstatt', 'Autohaus Müller Wartung', -35, 'Werkstatt'),
  flow('c-miete', 'Miete', -900, 'Wohnen'),
  { ...flow('c-alt', 'Alter Kfz-Vertrag', -10, 'Versicherungen'), disabled: true },
];

/** Die Referenz-Absicht: Auto weg, Erhöhung unbeziffert, 5k im Dezember, Schwelle. */
const REFERENZ: SzenarioAbsicht = {
  deltas: [
    { art: 'einkommen', abTag: 60 },
    { art: 'flow_entfaellt', konzept: 'auto', stichworte: ['kfz', 'kraftstoff', 'werkstatt', 'auto'], abTag: 0 },
    { art: 'einmalausgabe', betrag: 5000, abTag: 99, label: 'urlaub' },
  ],
  schwelle: 'notgroschen',
};

describe('baueSzenarioPayload', () => {
  it('sollte die Referenz-Absicht in Payload-Ereignisse übersetzen', () => {
    const { payload, aufloesungen, schwelleEur } = baueSzenarioPayload(REFERENZ, {
      flows: FLOWS,
      safetyBuffer: 3000,
    });

    expect(schwelleEur).toBe(3000);
    expect(payload?.thresholdAmount).toBe(3000);
    expect(payload?.scenarioType).toBe('custom_combination');
    // 99 Tage bis zur Ausgabe + Nachlauf, mindestens aber der Nachlauf selbst.
    expect(payload?.timeHorizonDays).toBe(219);

    const arten = payload?.events?.map((e) => e.eventType);
    expect(arten).toEqual(['flow_change', 'expense']);
    expect(aufloesungen).toHaveLength(3);
  });

  it('sollte ein unbeziffertes Einkommens-Delta NICHT simulieren, sondern benennen', () => {
    const { payload, aufloesungen } = baueSzenarioPayload(REFERENZ, { flows: FLOWS });
    expect(aufloesungen[0]).toMatchObject({ unberuecksichtigt: true });
    // Kein recurring_flow-Ereignis für das unbezifferte Delta.
    expect(payload?.events?.some((e) => e.eventType === 'recurring_flow')).toBe(false);
  });

  it('sollte flow_entfaellt auf die KONKRETEN Posten auflösen und sie benennen', () => {
    const { payload, aufloesungen } = baueSzenarioPayload(REFERENZ, { flows: FLOWS });
    const auto = aufloesungen[1];
    expect(auto.getroffeneFlows?.map((f) => f.id).sort()).toEqual(['c-kfz', 'c-tanken', 'c-werkstatt']);
    // Deaktivierte Posten zählen nicht — sie laufen ohnehin nicht.
    expect(auto.getroffeneFlows?.map((f) => f.id)).not.toContain('c-alt');
    // Und das Gehalt bleibt unangetastet.
    const wegfall = payload?.events?.find((e) => e.eventType === 'flow_change');
    expect(wegfall?.flowSelector).toEqual({
      kind: 'ids',
      ids: expect.arrayContaining(['c-kfz', 'c-tanken', 'c-werkstatt']),
    });
    expect(wegfall?.factor).toBe(0);
  });

  it('sollte ein Konzept ohne Treffer als unberücksichtigt melden statt still zu schweigen', () => {
    const { aufloesungen } = baueSzenarioPayload(
      { deltas: [{ art: 'flow_entfaellt', konzept: 'boot', stichworte: ['boot'], abTag: 0 }] },
      { flows: FLOWS },
    );
    expect(aufloesungen[0]).toMatchObject({ unberuecksichtigt: true, getroffeneFlows: [] });
  });

  it('sollte einen Jobverlust als factor 0 auf den größten Einkommens-Posten übersetzen', () => {
    const { payload } = baueSzenarioPayload(
      { deltas: [{ art: 'einkommen', prozent: -100, abTag: 90 }], schwelle: 'notgroschen' },
      { flows: FLOWS, safetyBuffer: 2000 },
    );
    expect(payload?.events?.[0]).toMatchObject({
      eventType: 'flow_change',
      flowSelector: { kind: 'largestIncome' },
      factor: 0,
      dayIndex: 90,
    });
  });

  it('sollte ohne wirksames Delta kein Payload liefern', () => {
    const { payload } = baueSzenarioPayload(
      { deltas: [{ art: 'einkommen', abTag: 30 }] },
      { flows: FLOWS },
    );
    expect(payload).toBeNull();
  });
});

describe('maxPufferbruch', () => {
  const result = {
    breachProbabilities: { '3000': [0, 0.02, 0.11, 0.05] },
  } as unknown as ScenarioResult;

  it('sollte das Maximum der Schwellen-Reihe liefern', () => {
    expect(maxPufferbruch(result, 3000)).toBeCloseTo(0.11);
  });

  it('sollte ohne Schwelle null liefern', () => {
    expect(maxPufferbruch(result, undefined)).toBeNull();
  });
});
