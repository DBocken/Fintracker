import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import { renderWithI18n } from '@/test-utils/render';
import CityPage from '../CityPage';

// jsdom kennt weder ResizeObserver noch requestAnimationFrame standardmäßig
// (Präzedenzfall: CityCanvas.test.tsx) — CityPage misst die Canvas-Fläche
// selbst über einen eigenen ResizeObserver (Label-`canvasSize`).
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
}

// jsdom hat keinen echten WebGL-Kontext — `CityCanvas` würde ohnehin auf
// seinen eigenen "unavailable"-Fallback zurückfallen (siehe CityCanvas.tsx).
// Für den `onFrame`-Verdrahtungstest wird hier ein schlanker Stub verwendet,
// der `onFrame` über einen Button gezielt auslösbar macht (deterministisch,
// ohne echten WebGL-Kontext).
let capturedOnFrame: ((camera: THREE.PerspectiveCamera) => void) | undefined;
vi.mock('@/features/finance-city/presentation/CityCanvas', () => ({
  CityCanvas: (props: { onFrame?: (camera: THREE.PerspectiveCamera) => void }) => {
    capturedOnFrame = props.onFrame;
    return <div data-testid="city-canvas-stub" />;
  },
}));

/** Deterministischer Fake-Kamera-Stub (Präzedenzfall CityLabels.test.tsx): Identitätsmatrizen -> NDC === anchor; `position` für die Welt-Distanz des Label-Fadings (nah -> volle Opazität). */
function identityCamera(): THREE.PerspectiveCamera {
  return {
    position: new THREE.Vector3(0, 0, 5),
    matrixWorldInverse: new THREE.Matrix4(),
    projectionMatrix: new THREE.Matrix4(),
  } as unknown as THREE.PerspectiveCamera;
}

beforeEach(() => {
  // jsdom liefert für `getBoundingClientRect()` ohne echtes Layout immer
  // 0x0 — `CityPage` misst darüber aber die reale Canvas-Fläche
  // (`canvasSize` für die Label-Reprojektion). Fester Stub macht die Größe
  // in Tests deterministisch verfügbar, ohne ein echtes Layout zu brauchen.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  capturedOnFrame = undefined;
});

describe.each(['de', 'en'] as const)('CityPage (%s)', (locale) => {
  it('sollte den Listen-Toggle aktivieren und zwischen Canvas- und Listenansicht umschalten (aria-pressed spiegelt den Zustand)', async () => {
    const user = userEvent.setup();
    renderWithI18n(<CityPage />, locale);

    const toggle = screen.getByRole('button', { name: /list|liste/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('city-accessible-list')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('city-accessible-list')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('city-accessible-list')).not.toBeInTheDocument();
  });

  it('sollte den aktuellen (letzten) Breadcrumb-Eintrag mit aria-current="page" markieren', () => {
    renderWithI18n(<CityPage />, locale);

    const nav = screen.getByRole('navigation', { name: locale === 'de' ? 'Stadt-Navigation' : 'City navigation' });
    const current = nav.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toMatch(locale === 'de' ? /Stadt/ : /City/);
  });

  it('sollte im Vertrags-Sheet den prozentualen Anteil des Vertrags an seiner Unterkategorie anzeigen', async () => {
    const user = userEvent.setup();
    renderWithI18n(<CityPage />, locale);

    // Über die Listenansicht navigieren (teilt denselben nav-State wie der
    // Canvas) bis zu einem Vertrag mit `contracts` (Streaming in "Freizeit").
    // Scoped auf die Liste: der Breadcrumb im Header zeigt nach dem ersten
    // Fokus-Tap ebenfalls einen "Freizeit"-Eintrag (eigener Button) — ohne
    // Scoping wäre die Query mehrdeutig.
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit|Leisure/ })); // 1. Tap: Fokus
    await user.click(list().getByRole('button', { name: /Freizeit|Leisure/ })); // 2. Tap: Eintauchen
    await user.click(list().getByRole('button', { name: /Streaming/ }));
    await user.click(list().getByRole('button', { name: /Netflix/ }));

    // Sheet ist offen -> Prozentanteil sichtbar (Netflix 17.99 von Streaming-Summe).
    const percentText = locale === 'de' ? /von Streaming/ : /of Streaming/;
    expect(await screen.findByText(percentText)).toBeInTheDocument();
  });

  it('sollte onFrame von CityCanvas an die Label-Reprojektion weiterreichen (kein eigener Timer)', async () => {
    renderWithI18n(<CityPage />, locale);

    expect(capturedOnFrame).toBeInstanceOf(Function);
    // Direkter Aufruf simuliert exakt das, was `CityCanvas`s Render-on-Demand-
    // Loop pro tatsächlich gerendertem Frame tut (siehe CityCanvas.tsx `tick()`).
    capturedOnFrame?.(identityCamera());

    // Mindestens ein Distrikt-Label sollte nach der Reprojektion sichtbar sein.
    const labels = await screen.findAllByTestId('city-label');
    expect(labels.length).toBeGreaterThan(0);
  });
});
