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

function makeLabel(id: string, x: number, y: number, z: number, priority = 1): CityLabel {
  return { id, text: `Label ${id}`, amount: priority, anchor: { x, y, z }, priority };
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
    const labels = [{ id: 'rent', text: 'Miete', amount: 980, anchor: { x: 0, y: 0, z: 0 }, priority: 980 }];
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

  describe('Label-Aufbau-Sync (WP-D1, C7-Review)', () => {
    it('sollte den Label-Container nach einem Wechsel der labels-Prop verzögert einblenden (Delay synchron zum Balkenwachstum)', () => {
      const labelsA = [makeLabel('a', 0, 0, 0, 5)];
      const labelsB = [makeLabel('b', 0, 0, 0, 5)];
      const ref = createRef<CityLabelsHandle>();
      const { getByTestId, rerender } = renderWithI18n(
        <CityLabels ref={ref} labels={labelsA} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />,
        locale,
      );

      rerender(
        <I18nProvider initialLocale={locale}>
          <CityLabels ref={ref} labels={labelsB} canvasSize={{ width: 800, height: 600 }} maxVisible={10} declutter />
        </I18nProvider>,
      );

      const layer = getByTestId('city-labels-layer');
      expect(layer.style.transitionProperty).toBe('opacity');
      expect(layer.style.transitionDelay).toBe('500ms');
      expect(layer.style.opacity).toBe('1');
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
