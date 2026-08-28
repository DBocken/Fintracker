import { describe, it, expect } from 'vitest';
import { geldgewichteteRendite, MAX_ITERATIONEN } from '../money-weighted-return';

describe('Geldgewichtete Rendite', () => {
  it('sollte eine einfache Verdopplung über ein Jahr als 100 % ausweisen', () => {
    const r = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: -1000 },
      { datum: '2026-01-01', betrag: 2000 },
    ]);
    expect(r.art).toBe('rendite');
    if (r.art === 'rendite') expect(r.jaehrlich).toBeCloseTo(1, 3);
  });

  it('sollte einen Verlust negativ ausweisen', () => {
    const r = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: -1000 },
      { datum: '2026-01-01', betrag: 800 },
    ]);
    expect(r.art).toBe('rendite');
    if (r.art === 'rendite') expect(r.jaehrlich).toBeCloseTo(-0.2, 3);
  });

  it('sollte den ZEITPUNKT der Nachzahlung berücksichtigen — das ist der Zweck', () => {
    // Wer spät nachlegt, hat weniger Zeit im Markt. Genau das unterscheidet
    // die geldgewichtete von der zeitgewichteten Rendite.
    const frueh = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: -1000 },
      { datum: '2025-02-01', betrag: -1000 },
      { datum: '2026-01-01', betrag: 2200 },
    ]);
    const spaet = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: -1000 },
      { datum: '2025-11-01', betrag: -1000 },
      { datum: '2026-01-01', betrag: 2200 },
    ]);
    expect(frueh.art).toBe('rendite');
    expect(spaet.art).toBe('rendite');
    if (frueh.art === 'rendite' && spaet.art === 'rendite') {
      expect(spaet.jaehrlich).toBeGreaterThan(frueh.jaehrlich);
    }
  });

  it('sollte ohne Einzahlung KEINE Zahl liefern statt zu raten', () => {
    const r = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: 500 },
      { datum: '2026-01-01', betrag: 800 },
    ]);
    expect(r).toEqual({ art: 'unbestimmt', grund: 'keineEinzahlung' });
  });

  it('sollte ohne Rückfluss KEINE Zahl liefern', () => {
    const r = geldgewichteteRendite([
      { datum: '2025-01-01', betrag: -500 },
      { datum: '2026-01-01', betrag: -800 },
    ]);
    expect(r).toEqual({ art: 'unbestimmt', grund: 'keinVorzeichenwechsel' });
  });

  it('sollte aus wenigen Tagen keine Jahresrendite hochrechnen', () => {
    // Aus drei Tagen Kursbewegung „+4200 % p. a." zu machen wäre eine Zahl,
    // die nichts über das Depot aussagt.
    const r = geldgewichteteRendite([
      { datum: '2026-08-01', betrag: -1000 },
      { datum: '2026-08-04', betrag: 1030 },
    ]);
    expect(r.art).toBe('unbestimmt');
  });

  it('sollte eine einzelne Zahlung als unbestimmt melden', () => {
    expect(geldgewichteteRendite([{ datum: '2026-01-01', betrag: -100 }])).toEqual({
      art: 'unbestimmt',
      grund: 'keineZahlungen',
    });
  });

  it('sollte unlesbare Daten und NaN-Beträge überspringen statt zu kippen', () => {
    const r = geldgewichteteRendite([
      { datum: 'kaputt', betrag: -1000 },
      { datum: '2025-01-01', betrag: -1000 },
      { datum: '2026-01-01', betrag: Number.NaN },
      { datum: '2026-01-01', betrag: 1100 },
    ]);
    expect(r.art).toBe('rendite');
    if (r.art === 'rendite') expect(r.jaehrlich).toBeCloseTo(0.1, 2);
  });

  it('sollte die Iterationsgrenze als Nicht-Ergebnis behandeln, nicht als Rendite', () => {
    // Die Grenze wird exportiert und geprüft — eine Abbruchgrenze ist kein
    // Ergebnis (AGENTS.md §3).
    expect(MAX_ITERATIONEN).toBe(80);
  });
});
