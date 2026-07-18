import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createRef } from 'react';
import * as THREE from 'three';
import { renderWithI18n } from '@/test-utils/render';
import { I18nProvider } from '@/i18n/I18nProvider';
import { CityLabels, type CityLabelsHandle } from '../CityLabels';
import type { CityLabel } from '../../domain/city-labels';

// WP-D1: `useReducedMotion` kontrollierbar mocken (Präzedenzfall
// CityCanvas.test.tsx) — der Label-Aufbau-Sync (verzögerter Fade vs.
// Sofort-Sichtbarkeit bei reduced-motion) muss deterministisch testbar sein,
// unabhängig vom (in jsdom ohnehin nicht vorhandenen) echten
// `matchMedia`-Verhalten.
const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

beforeEach(() => {
  useReducedMotionMock.mockReturnValue(false);
});

/**
 * Deterministischer Fake-Kamera-Stub: `THREE.Vector3.project(camera)` liest
 * NUR `camera.matrixWorldInverse`/`camera.projectionMatrix` — mit zwei
 * Identitätsmatrizen ist die projizierte NDC-Position exakt der `anchor`
 * (kein echter WebGL-Kontext/keine Renderer-Instanz nötig).
 */
function identityCamera(): THREE.PerspectiveCamera {
  return {
    // `position` wird für die Welt-Distanz des Fadings gebraucht (nah genug
    // -> volle Opazität); Identitätsmatrizen halten NDC == anchor.
    position: new THREE.Vector3(0, 0, 5),
    matrixWorldInverse: new THREE.Matrix4(),
    projectionMatrix: new THREE.Matrix4(),
  } as unknown as THREE.PerspectiveCamera;
}

function makeLabel(id: string, x: number, y: number, z: number, priority = 1, color = '#1d5c54'): CityLabel {
  return { id, text: `Label ${id}`, amount: priority, anchor: { x, y, z }, color, priority };
}

describe.each(['de', 'en'] as const)('CityLabels (%s)', (locale) => {
  it('sollte die projizierten Labels rendern', () => {
    const labels = [makeLabel('a', 0, 0, 0, 3), makeLabel('b', 0.6, 0, 0, 2)];
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(2);
  });

  it('[REGRESSION] sollte Labels bei realer Perspektiv-Projektion sichtbar lassen (Fade über Welt-Distanz, nicht über NDC-Tiefe)', () => {
    // Reproduktion des WP-C5-Bugs „keine Labels an Vierteln/Gebäuden/Etagen":
    // Eine echte PerspectiveCamera in typischer Stadt-Distanz projiziert JEDEN
    // Anker auf ndc.z ~ 0.99 (nichtlineare Tiefe). Der frühere Fade über ndc.z
    // blendete dadurch ALLE Labels aus. Der Fade läuft jetzt über die
    // Welt-Distanz -> in dieser Distanz voll sichtbar.
    const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
    camera.position.set(0, 10, 30);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true); // aktualisiert matrixWorldInverse (Camera-Override) — sonst projiziert project() falsch.

    // Sanity: die perspektivische NDC-Tiefe liegt tatsächlich im „alten Fade
    // hätte alles ausgeblendet"-Bereich.
    const ndc = new THREE.Vector3(0, 0, 0).project(camera);
    expect(ndc.z).toBeGreaterThan(0.98);

    const labels = [makeLabel('rent', 0, 0, 0, 5)];
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(camera));

    const rendered = container.querySelectorAll('[data-testid="city-label"]');
    expect(rendered).toHaveLength(1);
    expect((rendered[0] as HTMLElement).style.opacity).toBe('1');
  });

  it('sollte Labels hinter der Kamera (NDC z > 1) NICHT rendern', () => {
    const labels = [makeLabel('front', 0, 0, 0, 5), makeLabel('behind', 0, 0, 2, 5)];
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    const rendered = [...container.querySelectorAll('[data-testid="city-label"]')].map((el) =>
      el.getAttribute('data-label-id'),
    );
    expect(rendered).toEqual(['front']);
  });

  it('sollte bei declutter=true maxVisible als harte Obergrenze respektieren (bisheriges Verhalten)', () => {
    const labels = Array.from({ length: 5 }, (_, i) => makeLabel(`l${i}`, -0.9 + i * 0.5, 0, 0, 5 - i));
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={2} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(2);
  });

  it('sollte bei declutter=false ALLE projizierten Labels rendern, auch bei Overlap über maxVisible hinaus (WP-D1, Stadt-Ebene)', () => {
    // Identischer Anker -> alle Screen-Rects überlappen vollständig; unter
    // declutter=true würde `resolveLabelCollisions` das auf `maxVisible`
    // ausdünnen (siehe Kontrast-Test unten). Reproduziert den Nutzer-Befund
    // ("wo würde Abos & Streaming auftauchen?") in umgekehrter Richtung: auf
    // Stadt-Ebene darf KEIN Distrikt-Label durchs Culling verschwinden.
    const labels = Array.from({ length: 5 }, (_, i) => makeLabel(`d${i}`, 0, 0, 0, 5 - i));
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels
        ref={ref}
        labels={labels}
        canvasSize={{ width: 800, height: 600 }}
        maxVisible={2}
        declutter={false}
      />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(5);
  });

  it('sollte dieselben überlappenden Labels bei declutter=true weiterhin ausdünnen (Kontrast zu declutter=false)', () => {
    // Identische Anker -> jedes Rect überlappt JEDES andere vollständig, also
    // akzeptiert `resolveLabelCollisions` nach dem höchstprioren Label kein
    // weiteres mehr (unabhängig vom `maxVisible`-Wert) — bewusst der
    // Extremfall, um den Kontrast zu declutter=false (oben: alle 5 sichtbar)
    // maximal deutlich zu machen.
    const labels = Array.from({ length: 5 }, (_, i) => makeLabel(`d${i}`, 0, 0, 0, 5 - i));
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={2} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(1);
  });

  it('sollte den Namen und den formatierten Betrag anzeigen', () => {
    const labels = [{ id: 'rent', text: 'Miete', amount: 980, anchor: { x: 0, y: 0, z: 0 }, color: '#1d5c54', priority: 980 }];
    const ref = createRef<CityLabelsHandle>();
    const { getByTestId } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(getByTestId('city-label').textContent).toContain('Miete');
    expect(getByTestId('city-label').textContent).toContain('980,00');
  });

  it('sollte den Label-Container mit pointer-events-none rendern (Taps fallen durch auf den Canvas)', () => {
    const ref = createRef<CityLabelsHandle>();
    const { getByTestId } = renderWithI18n(
      <CityLabels ref={ref} labels={[]} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
      locale,
    );

    expect(getByTestId('city-labels-layer')).toHaveClass('pointer-events-none');
  });

  describe('Connector-Modus (WP-D2, Etagen-/Einzelansicht)', () => {
    it('sollte je sichtbarem Label eine Führungslinie in der Farbe der jeweiligen Etage rendern', () => {
      const labels = [
        makeLabel('netflix', 0, 0.3, 0, 5, '#123456'),
        makeLabel('spotify', 0, 0.1, 0, 3, '#abcdef'),
      ];
      const ref = createRef<CityLabelsHandle>();
      const { container } = renderWithI18n(
        <CityLabels
          ref={ref}
          labels={labels}
          canvasSize={{ width: 800, height: 600 }}
          maxVisible={10}
          declutter
          connectors
        />,
        locale,
      );

      act(() => ref.current?.reproject(identityCamera()));

      const connectors = container.querySelectorAll('[data-testid="city-label-connector"]');
      expect(connectors).toHaveLength(2);
      const netflix = container.querySelector(
        '[data-testid="city-label-connector"][data-label-id="netflix"]',
      )!;
      expect(netflix.getAttribute('stroke')).toBe('#123456');
      // Geometrie wird imperativ gesetzt (Draw-on übernimmt Framer Motion) und
      // endet am projizierten Anker (Canvasmitte 400,300 bei Identitätskamera).
      const d = netflix.getAttribute('d') ?? '';
      expect(d).toMatch(/^M /);
      // Endpunkt = projizierter Anker: x=400 (Canvasmitte), y=((1-0.3)/2)*600=210.
      expect(d).toContain('L 400 210');
    });

    it('sollte die Labels seitlich neben den Balken versetzen, statt mittig auf den Anker', () => {
      const labels = [makeLabel('netflix', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId } = renderWithI18n(
        <CityLabels
          ref={ref}
          labels={labels}
          canvasSize={{ width: 800, height: 600 }}
          maxVisible={10}
          declutter
          connectors
        />,
        locale,
      );

      act(() => ref.current?.reproject(identityCamera()));

      const label = getByTestId('city-label') as HTMLElement;
      // Anker projiziert auf die Canvasmitte (x=400). Das Label ist horizontal
      // deutlich versetzt (>= 100 px), verdeckt den Balken also nicht mehr.
      const match = /translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\)/.exec(label.style.transform);
      expect(match).not.toBeNull();
      expect(Math.abs(Number(match![1]) - 400)).toBeGreaterThanOrEqual(100);
    });

    it('sollte alle Etagen-Labels behalten (kein Kollisions-Culling) und dicht gestapelte vertikal entstapeln', () => {
      // Identische Anker -> ohne Connector würde declutter das auf 1 ausdünnen
      // (siehe declutter=true-Kontrasttest oben). Im Connector-Modus behält
      // JEDE Etage ihr Label, vertikal entstapelt.
      const labels = Array.from({ length: 4 }, (_, i) => makeLabel(`f${i}`, 0, 0, 0, 4 - i));
      const ref = createRef<CityLabelsHandle>();
      const { container } = renderWithI18n(
        <CityLabels
          ref={ref}
          labels={labels}
          canvasSize={{ width: 800, height: 600 }}
          maxVisible={2}
          declutter
          connectors
        />,
        locale,
      );

      act(() => ref.current?.reproject(identityCamera()));

      const rendered = [...container.querySelectorAll('[data-testid="city-label"]')] as HTMLElement[];
      expect(rendered).toHaveLength(4);

      // Entstapelung: die vertikalen Versätze (zweiter translate-Y) sind paarweise
      // verschieden, keine zwei Labels liegen aufeinander.
      const ys = rendered.map((el) => {
        const m = /translate\(-?\d+(?:\.\d+)?px, (-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform);
        return Number(m![1]);
      });
      const uniqueYs = new Set(ys);
      expect(uniqueYs.size).toBe(4);
    });

    it('sollte ohne connectors keine Führungslinien-Ebene rendern (Default-Verhalten)', () => {
      const labels = [makeLabel('a', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { container } = renderWithI18n(
        <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      act(() => ref.current?.reproject(identityCamera()));

      expect(container.querySelector('[data-testid="city-labels-connectors"]')).toBeNull();
      expect(container.querySelectorAll('[data-testid="city-label-connector"]')).toHaveLength(0);
    });
  });

  describe('Label-Aufbau-Sync (WP-D1, C7-Review)', () => {
    it('sollte den Label-Container nach einem Ebenenwechsel (fadeKey) verzögert einblenden (Delay synchron zum Balkenwachstum)', () => {
      const labelsA = [makeLabel('a', 0, 0, 0, 5)];
      const labelsB = [makeLabel('b', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId, rerender } = renderWithI18n(
        <CityLabels ref={ref} labels={labelsA} fadeKey="city" canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      // Ebenenwechsel Stadt -> Distrikt: neue Balken wachsen, Label-Container
      // blendet verzögert ein.
      rerender(
        <I18nProvider initialLocale={locale}>
          <CityLabels ref={ref} labels={labelsB} fadeKey="district" canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />
        </I18nProvider>,
      );

      const layer = getByTestId('city-labels-layer');
      expect(layer.style.transitionProperty).toBe('opacity');
      expect(layer.style.transitionDelay).toBe('500ms');
      expect(layer.style.opacity).toBe('1');
    });

    it('[REGRESSION] sollte bei reinem Daten-Refetch (neue labels-Identität, GLEICHE Ebene) NICHT neu einblenden', () => {
      // Nutzeranforderung "Kategorie zuweisen -> Stadt erkennt automatisch"
      // löst einen Query-Refetch aus. `labels` wird in CityPage aus `model`
      // abgeleitet und bekommt bei JEDEM Refetch eine neue Array-Identität —
      // auch ohne Ebenenwechsel. Früher setzte der Fade-Effekt (Dependency
      // `[labels]`) den gesamten Container dadurch sichtbar auf 0 zurück und
      // wieder ein: ALLE Labels flackerten bei jedem Refetch/Fensterfokus,
      // ohne dass der Nutzer navigiert hat. Der Fade hängt jetzt an `fadeKey`
      // (= Navigations-Ebene), nicht mehr an der labels-Identität.
      const labelsA = [makeLabel('a', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId, rerender } = renderWithI18n(
        <CityLabels ref={ref} labels={labelsA} fadeKey="city" canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      const layer = getByTestId('city-labels-layer');
      expect(layer.style.opacity).toBe('1');
      // Sentinel: läuft der Fade-Effekt erneut, überschreibt er die Opazität.
      layer.style.opacity = '0.42';

      // Refetch: neue labels-Array-Identität (anderer Betrag), gleiche Ebene.
      const labelsB = [makeLabel('a', 0, 0, 0, 9)];
      rerender(
        <I18nProvider initialLocale={locale}>
          <CityLabels ref={ref} labels={labelsB} fadeKey="city" canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />
        </I18nProvider>,
      );

      // Kein erneuter Fade -> Sentinel unangetastet.
      expect(layer.style.opacity).toBe('0.42');
    });

    it('sollte bei prefers-reduced-motion sofort sichtbar sein, ohne Transition/Delay (konsistent zum Sofort-Verhalten der Balken)', () => {
      useReducedMotionMock.mockReturnValue(true);
      const labels = [makeLabel('a', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId } = renderWithI18n(
        <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      const layer = getByTestId('city-labels-layer');
      expect(layer.style.transitionProperty).toBe('none');
      expect(layer.style.transitionDelay).toBe('0s');
      expect(layer.style.opacity).toBe('1');
    });

    it('sollte den Label-Container NICHT erneut ausblenden, wenn nur reproject() (Kamera-Tick) läuft und sich labels nicht ändert', () => {
      const labels = [makeLabel('a', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId } = renderWithI18n(
        <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      const layer = getByTestId('city-labels-layer');
      expect(layer.style.opacity).toBe('1');

      act(() => ref.current?.reproject(identityCamera()));

      // `reproject()` ändert nur `visibleIds`/Positionen (imperativ), NICHT
      // die `labels`-Prop-Referenz — der Fade-Effekt (Dependency `[labels,
      // reducedMotion]`) darf dadurch NICHT erneut auf 0 zurückspringen.
      expect(layer.style.opacity).toBe('1');
    });
  });
});
