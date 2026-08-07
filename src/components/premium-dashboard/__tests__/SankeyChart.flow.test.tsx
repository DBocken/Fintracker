import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderWithProviders } from '@/test-utils/render';
import { deriveMotionQuality } from '@/lib/motion-quality';
import type { DeviceProfile } from '@/lib/device-profile';

/**
 * WP-6.3 — Sankey: Fluss-Animation & Textur.
 *
 * Ein Sankey zeigt Geldströme, stand aber völlig still: Die Richtung war nur
 * aus der Anordnung zu erschließen, nicht zu sehen.
 *
 * Geprüft wird die Konstruktion, nicht die Bewegung. Recharts misst in jsdom
 * nichts (`ResponsiveContainer` hat dort die Größe 0 und zeichnet keine
 * Links), eine CSS-Animation läuft dort ohnehin nicht. Die tragenden
 * Eigenschaften sind aber prüfbar — und es sind genau die, bei denen ein
 * Fehler unsichtbar bliebe.
 */

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

const SOURCE = readFileSync(resolve(__dirname, '../SankeyChart.tsx'), 'utf8');
const CSS = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');

const WEAK: DeviceProfile = {
  devicePixelRatio: 2,
  viewportWidth: 360,
  hardwareConcurrency: 4,
  deviceMemoryGb: 2,
  coarsePointer: true,
};
const DESKTOP: DeviceProfile = {
  devicePixelRatio: 1,
  viewportWidth: 1440,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
};

beforeEach(() => reduceMock.mockReturnValue(false));

describe('Sankey-Fluss (WP-6.3)', () => {
  it('sollte die Textur ÜBER das Band legen, nicht hineinschneiden', () => {
    // Ein stroke-dasharray direkt auf dem Band wuerde den Strom in Stuecke
    // schneiden — das saehe nach Unterbrechung aus, nicht nach Fluss. Deshalb
    // zwei Pfade je Strom: volles Band, animierte Textur darueber.
    expect(SOURCE).toContain('className="sankey-flow"');
    // Das volle Band bleibt ohne Strichmuster.
    expect(SOURCE).toMatch(/strokeOpacity=\{0\.35\}/);
  });

  it('sollte die Textur nicht klickbar machen', () => {
    // Klicks und Tooltips gehoeren dem Band darunter — eine daruebergelegte
    // Schicht wuerde sie sonst abfangen und der Drilldown waere tot.
    expect(CSS).toMatch(/\.sankey-flow\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('sollte die Schleife nahtlos schliessen', () => {
    // Die Verschiebung muss exakt eine Musterlaenge betragen (12 + 20 = 32).
    // Jede andere Zahl ergaebe bei jeder Wiederholung einen sichtbaren Sprung.
    const pattern = CSS.match(/\.sankey-flow\s*\{[^}]*stroke-dasharray:\s*(\d+)\s+(\d+)/s);
    expect(pattern).not.toBeNull();
    const patternLength = Number(pattern![1]) + Number(pattern![2]);
    expect(CSS).toMatch(
      new RegExp(`@keyframes sankey-flow-drift\\s*\\{[^}]*stroke-dashoffset:\\s*-${patternLength}`, 's'),
    );
  });

  it('sollte gleichmaessig laufen statt zu beschleunigen', () => {
    // Ein Strom, der beschleunigt und abbremst, waere kein Strom.
    expect(CSS).toMatch(/animation:\s*sankey-flow-drift[^;]*linear/);
  });

  it('sollte auf der sparsamsten Bewegungsstufe entfallen', () => {
    // Eine endlose Animation hat keinen Moment, in dem sie fertig waere —
    // auf schwacher Hardware der teuerste Dauerposten.
    expect(deriveMotionQuality(WEAK).tier).toBe('minimal');
    expect(deriveMotionQuality(DESKTOP).tier).toBe('full');
    expect(SOURCE).toContain("motionQuality.tier !== 'minimal'");
  });

  it('sollte bei reduced-motion entfallen', () => {
    expect(deriveMotionQuality(DESKTOP, { reducedMotion: true }).durationScale).toBe(0);
    expect(SOURCE).toContain('motionQuality.durationScale > 0');
  });

  it('sollte das Band auch ohne Bewegung behalten', async () => {
    // Der Inhalt darf nicht an der Bewegung haengen: wer reduzierte Bewegung
    // verlangt, bekommt kein leeres Diagramm.
    reduceMock.mockReturnValue(true);
    const { SankeyChart } = await import('../SankeyChart');
    const { container } = renderWithProviders(
      <SankeyChart
        data={{
          nodes: [
            { id: 'in', name: 'Einnahmen', type: 'income' },
            { id: 'acc', name: 'Konto', type: 'account' },
          ],
          links: [{ source: 'in', target: 'acc', value: 1000 }],
          mainCategories: [],
        } as never}
      />,
      // SankeyChart navigiert bei Klick auf Kategorie-Knoten — ohne Router
       // wirft `useNavigate` bereits beim Rendern.
      { router: true },
    );
    expect(container.textContent).toBeTruthy();
  });
});
