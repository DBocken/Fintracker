import { describe, it, expect } from 'vitest';
import { areaProportionalRadius, volumeSegments } from '../volume-scale';

/**
 * WP-6.4 — Vermögen als Volumen.
 *
 * Der Kern dieser Tests ist eine einzige Regel, an der solche Darstellungen
 * meistens scheitern: Die **Fläche** muss proportional zum Wert sein, nicht
 * der Radius. Wer den Radius linear skaliert, lässt einen doppelt so großen
 * Betrag viermal so groß aussehen — eine Falschaussage über Geld, die
 * niemandem auffällt, weil die Grafik „irgendwie stimmig" wirkt.
 */

const OPTIONS = { maxRadius: 100, minRadius: 0 };

describe('areaProportionalRadius', () => {
  it('sollte den groessten Wert auf den vollen Radius legen', () => {
    expect(areaProportionalRadius(1000, 1000, OPTIONS)).toBe(100);
  });

  it('[REGRESSION] sollte die FLAECHE proportional halten, nicht den Radius', () => {
    // Der eigentliche Befund: Bei linearer Radius-Skalierung waere der Radius
    // fuer den halben Wert 50. Richtig sind ~70,7 — dann ist die FLAECHE halb
    // so gross (pi*70,7^2 = pi*100^2 / 2).
    const half = areaProportionalRadius(500, 1000, OPTIONS);
    expect(half).toBeCloseTo(70.71, 1);
    expect(half).not.toBeCloseTo(50, 1);

    const fullArea = Math.PI * 100 ** 2;
    const halfArea = Math.PI * half ** 2;
    expect(halfArea / fullArea).toBeCloseTo(0.5, 3);
  });

  it('sollte ein Viertel des Werts auf die halbe Kantenlaenge legen', () => {
    // Gegenprobe von der anderen Seite: Viertel-Wert -> halber Radius.
    expect(areaProportionalRadius(250, 1000, OPTIONS)).toBeCloseTo(50, 5);
  });

  it('sollte kleine Posten sichtbar halten', () => {
    // Ohne Untergrenze verschwindet ein 12-Euro-Posten neben 120.000 Euro
    // vollstaendig. "Nicht vorhanden" und "sehr klein" sind verschiedene
    // Aussagen, und nur eine davon stimmt.
    const radius = areaProportionalRadius(12, 120_000, { maxRadius: 100, minRadius: 6 });
    expect(radius).toBe(6);
  });

  it('sollte nicht vorhandene Posten gar nicht darstellen', () => {
    // Die Untergrenze gilt NUR fuer Werte > 0 — sonst bekaeme ein Posten,
    // den es nicht gibt, trotzdem einen Punkt.
    expect(areaProportionalRadius(0, 1000, { maxRadius: 100, minRadius: 6 })).toBe(0);
    expect(areaProportionalRadius(-500, 1000, { maxRadius: 100, minRadius: 6 })).toBe(0);
  });

  it('[REGRESSION] sollte bei unbrauchbaren Eingaben 0 statt NaN liefern', () => {
    expect(areaProportionalRadius(Number.NaN, 1000, OPTIONS)).toBe(0);
    expect(areaProportionalRadius(500, 0, OPTIONS)).toBe(0);
    expect(areaProportionalRadius(500, Number.NaN, OPTIONS)).toBe(0);
  });
});

describe('volumeSegments', () => {
  const ITEMS = [
    { key: 'cash', value: 2_000 },
    { key: 'investments', value: 8_000 },
    { key: 'receivables', value: 0 },
  ];

  it('sollte nicht vorhandene Posten weglassen', () => {
    const segments = volumeSegments(ITEMS, OPTIONS);
    expect(segments.map((s) => s.key)).toEqual(['investments', 'cash']);
  });

  it('sollte absteigend sortieren', () => {
    // Das Groesste zuerst — es traegt die Aussage.
    const segments = volumeSegments(ITEMS, OPTIONS);
    expect(segments[0].key).toBe('investments');
  });

  it('sollte Anteile liefern, die sich zu 1 summieren', () => {
    const segments = volumeSegments(ITEMS, OPTIONS);
    const sum = segments.reduce((total, s) => total + s.share, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('sollte den Anteil aus dem GESAMTwert rechnen, nicht aus dem groessten', () => {
    // Sonst haette der groesste Posten immer 100 Prozent.
    const segments = volumeSegments(ITEMS, OPTIONS);
    expect(segments.find((s) => s.key === 'cash')!.share).toBeCloseTo(0.2, 5);
  });

  it('sollte bei leerer oder unbrauchbarer Liste nichts liefern', () => {
    expect(volumeSegments([], OPTIONS)).toEqual([]);
    expect(volumeSegments([{ key: 'a', value: 0 }], OPTIONS)).toEqual([]);
    expect(volumeSegments([{ key: 'a', value: Number.NaN }], OPTIONS)).toEqual([]);
  });
});
