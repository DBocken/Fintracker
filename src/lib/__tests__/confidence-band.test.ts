import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * WP-6.1 — Diffuse Konfidenzwolken.
 *
 * Geprüft wird hier die *Konstruktion* der Wolke, nicht ihr Aussehen. Ein
 * gerendertes Recharts-SVG lässt sich in jsdom nicht sinnvoll auf Deckkraft
 * abklopfen (`ResponsiveContainer` hat dort die Größe 0 und zeichnet nichts),
 * die tragenden Eigenschaften sind aber prüfbar:
 *
 * - Es gibt drei Ebenen, nicht eine.
 * - Sie werden von außen nach innen dichter — nur dadurch franst der Rand aus.
 * - Jede Ebene hat ihre EIGENE `stackId`. Teilten sie sich eine, stapelten
 *   sich die drei Bänder übereinander statt ineinander, und die Prognose
 *   zeigte das Dreifache ihrer echten Spannweite.
 */

const SOURCE = readFileSync(
  resolve(__dirname, '../../components/dashboard/LiquidityReport.tsx'),
  'utf8'
);

/** Liest die BAND_LAYERS-Konstante aus der Quelle. */
function bandLayers(): { key: string; opacityFactor: number }[] {
  const block = SOURCE.match(/const BAND_LAYERS = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error('BAND_LAYERS nicht gefunden');
  return [...block[1].matchAll(/key: '(\w+)',[\s\S]*?opacityFactor: ([\d.]+)/g)].map((match) => ({
    key: match[1],
    opacityFactor: Number(match[2]),
  }));
}

describe('Konfidenzwolke der Prognose (WP-6.1)', () => {
  it('sollte drei verschachtelte Ebenen haben statt einer harten Kante', () => {
    // Eine harte Kante liest sich als Zusage („darunter geht es nicht"),
    // obwohl P10 gerade heißt, dass jeder zehnte Durchlauf tiefer fällt.
    expect(bandLayers()).toHaveLength(3);
  });

  it('sollte nach innen dichter werden', () => {
    // Die Reihenfolge IST die Zeichenreihenfolge; weil sich die Flächen
    // überlagern, addiert sich die Deckkraft zur Mitte hin.
    const factors = bandLayers().map((layer) => layer.opacityFactor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThan(factors[i - 1]);
    }
    expect(factors[factors.length - 1]).toBe(1);
  });

  it('sollte je Ebene eine eigene stackId verwenden', () => {
    // Der Fehler, den das verhindert: mit gemeinsamer stackId stapelten sich
    // die drei Bänder übereinander statt ineinander — die Prognose zeigte
    // dann das Dreifache ihrer echten Spannweite.
    const keys = bandLayers().map((layer) => layer.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SOURCE).toContain('stackId={layer.key}');
  });

  it('sollte keine feste stackId mehr tragen', () => {
    // Rückstand der alten Ein-Band-Fassung.
    expect(SOURCE).not.toContain('stackId="mc"');
  });

  it('sollte die Ebenen aus echten Perzentilen speisen, nicht aus Interpolation', () => {
    // Die Wolke muss die Verteilung zeigen, die die Simulation gerechnet hat.
    // Aus P10/P50/P90 zusätzliche Ränder zu schätzen wäre Deko, die aussieht
    // wie eine Aussage.
    for (const key of ['p05', 'p25', 'p75', 'p95']) {
      expect(SOURCE).toMatch(new RegExp(`band\\??\\.${key}\\b`));
    }
  });

  it('sollte die Ferne ausduennen lassen (WP-6.2)', () => {
    // Eine Prognose ist am Tag 1 fast eine Tatsache und am Tag 365 eine
    // Vermutung. Bisher sah beides gleich aus — dieselbe Deckkraft ueber die
    // gesamte Breite behauptete die Ferne so fest wie die Naehe.
    expect(SOURCE).toContain('horizonMask');
    // Der Verlauf muss WAAGERECHT laufen (x1->x2). Senkrecht waere er eine
    // Aussage ueber den Betrag statt ueber die Zeit.
    expect(SOURCE).toMatch(/id=\{`\$\{horizonMaskId\}-gradient`\} x1="0" y1="0" x2="1" y2="0"/);
  });

  it('sollte die naechste Zeit voll darstellen (WP-6.2)', () => {
    // Der naechste Monat ist die Aussage, mit der man plant. Ihn vorzeitig
    // auszublenden waere Effekt statt Information.
    expect(SOURCE).toMatch(/offset="50%"[^>]*stopOpacity=\{1\}/);
  });

  it('sollte die Horizont-Maske auf alle Konfidenz-Ebenen legen (WP-6.2)', () => {
    // Als Maske und nicht als zweite Farbe: sonst verrechnete sie sich mit
    // der eigenen Deckkraft jeder Ebene, und die Ebenen duennten
    // unterschiedlich stark aus.
    expect(SOURCE).toContain('mask={`url(#${horizonMaskId})`}');
  });

  it('sollte den erklärenden Text übersetzt beziehen', () => {
    // Der Satz stand vorher hartkodiert auf Deutsch im JSX.
    expect(SOURCE).toContain("t(\"liquidityReport.bandCaption\")");
    expect(SOURCE).not.toContain('Wahrscheinlichkeitsband P10–P90 aus');
  });
});
