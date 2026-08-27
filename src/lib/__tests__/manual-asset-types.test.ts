import { describe, it, expect } from 'vitest';
import {
  BEWERTUNG_VERALTET_NACH_TAGEN,
  bewertungsAlterInTagen,
  istVeraltet,
  summeManuellerWerte,
} from '../manual-asset-types';
import type { ManualAsset } from '../manual-asset-types';

function wert(over: Partial<ManualAsset> = {}): ManualAsset {
  return {
    id: 'a1',
    user_id: 'local',
    name: 'Auto',
    kind: 'vehicle',
    value: 15000,
    valued_at: '2026-01-15',
    ...over,
  };
}

const JETZT = new Date('2026-08-27T10:00:00Z');

describe('Manuelle Vermögenswerte', () => {
  it('sollte das Alter der Schätzung in Tagen nennen', () => {
    expect(bewertungsAlterInTagen(wert({ valued_at: '2026-08-20' }), JETZT)).toBe(7);
  });

  it('sollte eine Schätzung ab einem Jahr als veraltet ausweisen', () => {
    // Die Grenze wird an ihrer Prüfstelle gelesen, nicht bloss deklariert:
    // eine Grenzkonstante ohne Prüfstelle beruhigt beim Lesen und schützt
    // beim Laufen nicht (AGENTS.md §3).
    expect(BEWERTUNG_VERALTET_NACH_TAGEN).toBe(365);
    expect(istVeraltet(wert({ valued_at: '2026-08-20' }), JETZT)).toBe(false);
    expect(istVeraltet(wert({ valued_at: '2025-08-27' }), JETZT)).toBe(true);
  });

  it('sollte ein Datum in der Zukunft nicht als negatives Alter ausgeben', () => {
    expect(bewertungsAlterInTagen(wert({ valued_at: '2027-01-01' }), JETZT)).toBe(0);
  });

  it('sollte ein unlesbares Datum nicht in NaN kippen lassen', () => {
    // Ein NaN wanderte sonst still in jede Summe und machte das ganze
    // Vermögen unlesbar.
    expect(bewertungsAlterInTagen(wert({ valued_at: 'kaputt' }), JETZT)).toBe(0);
  });

  it('sollte Werte summieren und Unbrauchbares überspringen', () => {
    expect(
      summeManuellerWerte([
        wert({ value: 15000 }),
        wert({ id: 'a2', value: 250000 }),
        wert({ id: 'a3', value: Number.NaN }),
      ]),
    ).toBe(265000);
  });
});
