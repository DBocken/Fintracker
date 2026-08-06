import { describe, it, expect } from 'vitest';
import { describeSeries } from '../chart-summary';

/**
 * WP-6.10 — die Aussage einer Serie, nicht nur ihre Zahlen.
 *
 * Eine Tabelle macht die Werte zugänglich, aber nicht die Form der Kurve.
 * Wer 24 Zeilen vorgelesen bekommt, weiß am Ende nicht, ob es bergauf ging.
 */

describe('describeSeries', () => {
  it('sollte eine steigende Serie als steigend beschreiben', () => {
    expect(describeSeries([100, 200, 300, 400])?.trend).toBe('rising');
  });

  it('sollte eine fallende Serie als fallend beschreiben', () => {
    expect(describeSeries([400, 300, 200, 100])?.trend).toBe('falling');
  });

  it('sollte eine seitwärts laufende Serie als flach beschreiben', () => {
    // Anfang und Ende gleich, dazwischen Rauschen — im Diagramm ist das eine
    // waagerechte Linie und darf nicht „steigend" heißen.
    expect(describeSeries([200, 260, 180, 200])?.trend).toBe('flat');
  });

  it('sollte eine konstante Serie als flach beschreiben, ohne durch null zu teilen', () => {
    const shape = describeSeries([50, 50, 50]);
    expect(shape?.trend).toBe('flat');
    expect(Number.isNaN(shape!.min)).toBe(false);
  });

  it('sollte Extrempunkte mit ihrer Position liefern', () => {
    // Die Position ist der Unterschied zwischen „es gab einen Einbruch" und
    // „es gab einen Einbruch im März".
    const shape = describeSeries([300, 100, 500, 400])!;
    expect(shape.min).toBe(100);
    expect(shape.minIndex).toBe(1);
    expect(shape.max).toBe(500);
    expect(shape.maxIndex).toBe(2);
  });

  it('sollte Summe, Anfang und Ende liefern', () => {
    const shape = describeSeries([10, 20, 30])!;
    expect(shape.total).toBe(60);
    expect(shape.first).toBe(10);
    expect(shape.last).toBe(30);
    expect(shape.count).toBe(3);
  });

  it('sollte bei leerer Serie null liefern', () => {
    // „Keine Daten" ist eine andere Aussage als „flach bei null" und gehört
    // an der Aufrufstelle anders formuliert.
    expect(describeSeries([])).toBeNull();
  });

  it('[REGRESSION] sollte nicht-endliche Werte überspringen statt NaN zu liefern', () => {
    const shape = describeSeries([10, Number.NaN, Number.POSITIVE_INFINITY, 30])!;
    expect(shape.count).toBe(2);
    expect(shape.total).toBe(40);
    expect(Number.isFinite(shape.max)).toBe(true);
  });

  it('[REGRESSION] sollte bei ausschließlich unbrauchbaren Werten null liefern', () => {
    expect(describeSeries([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it('sollte negative Beträge korrekt einordnen', () => {
    // Schulden werden negativ geführt; „von -5000 auf -1000" ist steigend.
    expect(describeSeries([-5000, -3000, -1000])?.trend).toBe('rising');
  });
});
