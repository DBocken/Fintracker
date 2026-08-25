import { describe, expect, it } from 'vitest';
import { decodeScenarioParam, encodeScenarioParam } from '../scenario-payload-link';
import type { ScenarioPayload } from '../scenario-payload-types';

const PAYLOAD: ScenarioPayload = {
  scenarioId: 'chat-kombination',
  scenarioType: 'custom_combination',
  timeHorizonDays: 219,
  thresholdAmount: 3000,
  events: [
    {
      eventType: 'flow_change',
      amount: 0,
      flowSelector: { kind: 'ids', ids: ['c-kfz', 'c-tanken'] },
      factor: 0,
    },
    { eventType: 'expense', amount: 5000, dayIndex: 99, description: 'urlaub' },
  ],
};

describe('scenario-payload-link', () => {
  it('sollte einen Payload verlustfrei durch die URL tragen', () => {
    const param = encodeScenarioParam(PAYLOAD);
    // URL-sicher ohne weiteres Encoding — sonst zerlegte ein Router-Redirect
    // den Parameter still.
    expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeScenarioParam(param)).toEqual(PAYLOAD);
  });

  it('sollte Umlaute in Beschreibungen überleben', () => {
    const mitUmlaut: ScenarioPayload = {
      ...PAYLOAD,
      events: [{ eventType: 'expense', amount: 100, description: 'Möbel für draußen' }],
    };
    expect(decodeScenarioParam(encodeScenarioParam(mitUmlaut))).toEqual(mitUmlaut);
  });

  it('sollte Unlesbares ablehnen statt halb zu parsen — die URL ist eine Datengrenze', () => {
    expect(decodeScenarioParam(null)).toBeNull();
    expect(decodeScenarioParam('')).toBeNull();
    expect(decodeScenarioParam('%%%nicht-base64%%%')).toBeNull();
    // Gültiges base64url, aber falsche Struktur.
    expect(decodeScenarioParam(btoa(JSON.stringify({ scenarioId: 'x' })))).toBeNull();
    // Horizont außerhalb der Engine-Grenzen.
    expect(
      decodeScenarioParam(encodeScenarioParam({ ...PAYLOAD, timeHorizonDays: 9999 })),
    ).toBeNull();
  });
});
