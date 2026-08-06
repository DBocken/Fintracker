import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as THREE from 'three';
import { CityCanvas } from '../CityCanvas';
import type { CitySceneHandle } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { cityDemoModel } from '../../data/city-demo-data';

/**
 * WP-5.7 — Fehlerzustände der 3D-Fläche.
 *
 * Zwei Fälle, die vorher beide in einer stummen Fläche endeten:
 *
 * 1. **Kein WebGL** — `createCityScene` wirft. Bisher: ein leeres `<div>`, also
 *    ein grauer Kasten ohne Erklärung und ohne Weg zu den Daten.
 * 2. **Kontextverlust** — der Treiber zieht den WebGL-Kontext ein (auf Mobil
 *    Alltag: Speicherdruck, App im Hintergrund, GPU-Reset). Bisher gar nicht
 *    behandelt: der Canvas friert auf dem letzten Frame ein und zeigt
 *    unbegrenzt weiter veraltete Zahlen — schlimmer als ein Fehler, weil nichts
 *    darauf hindeutet.
 *
 * `CityCanvas` meldet beides nur; was der Nutzer sieht, entscheidet die Seite
 * (`CityPage`) — sie kennt die Listenansicht als vollwertige Alternative.
 */
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

const { createCityScene } = vi.hoisted(() => ({ createCityScene: vi.fn() }));
vi.mock('../city-scene', async () => {
  const actual = await vi.importActual<typeof import('../city-scene')>('../city-scene');
  return { ...actual, createCityScene };
});

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

function createFakeHandle(canvas: HTMLCanvasElement): CitySceneHandle {
  return {
    applyLayout: vi.fn(),
    advanceAnimations: vi.fn(() => false),
    setAnimationsEnabled: vi.fn(),
    setTheme: vi.fn(),
    setAtmospherePreset: vi.fn(),
    pick: vi.fn(() => null),
    setHighlight: vi.fn(),
    setSize: vi.fn(),
    setFog: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    applyCameraPose: vi.fn(),
    target: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(),
    domElement: canvas,
  } as unknown as CitySceneHandle;
}

const LAYOUT = buildCityLayout(cityDemoModel, { level: 'city' });

describe('CityCanvas — Fehlerzustände (WP-5.7)', () => {
  beforeEach(() => {
    createCityScene.mockReset();
    createCityScene.mockImplementation((options: { canvas: HTMLCanvasElement }) => createFakeHandle(options.canvas));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sollte melden, wenn kein WebGL-Kontext erzeugt werden kann', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createCityScene.mockImplementation(() => {
      throw new Error('WebGL nicht verfügbar');
    });
    const onUnavailable = vi.fn();

    render(<CityCanvas layout={LAYOUT} onTapBox={() => {}} onUnavailable={onUnavailable} />);

    expect(onUnavailable).toHaveBeenCalledWith('unsupported');
  });

  it('[REGRESSION] sollte einen Kontextverlust melden statt stumm einzufrieren', () => {
    const onUnavailable = vi.fn();
    const { container } = render(<CityCanvas layout={LAYOUT} onTapBox={() => {}} onUnavailable={onUnavailable} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

    expect(onUnavailable).toHaveBeenCalledWith('context-lost');
  });

  it('sollte das Standardverhalten des Kontextverlusts unterdrücken', () => {
    // Ohne `preventDefault()` gibt der Browser den Kontext endgültig auf und
    // feuert nie ein `webglcontextrestored` — die Fläche wäre dann auch nach
    // einem Neuaufbau-Versuch tot.
    render(<CityCanvas layout={LAYOUT} onTapBox={() => {}} onUnavailable={vi.fn()} />);
    const canvas = document.querySelector('canvas')!;
    const event = new Event('webglcontextlost', { cancelable: true });

    canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('sollte nach Wiederherstellung des Kontexts Entwarnung geben', () => {
    const onUnavailable = vi.fn();
    render(<CityCanvas layout={LAYOUT} onTapBox={() => {}} onUnavailable={onUnavailable} />);
    const canvas = document.querySelector('canvas')!;

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(onUnavailable).toHaveBeenLastCalledWith(null);
  });

  it('sollte den Render-Loop bei verlorenem Kontext nicht weiterlaufen lassen', () => {
    // Auf einem verlorenen Kontext ist jeder `render()`-Aufruf verlorene Arbeit
    // (und je nach Treiber eine Fehlerflut in der Konsole).
    const onUnavailable = vi.fn();
    render(<CityCanvas layout={LAYOUT} onTapBox={() => {}} onUnavailable={onUnavailable} />);
    const handle = createCityScene.mock.results.at(-1)?.value as CitySceneHandle;
    const canvas = document.querySelector('canvas')!;

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    const callsAfterLoss = (handle.render as ReturnType<typeof vi.fn>).mock.calls.length;

    window.dispatchEvent(new Event('resize'));

    expect((handle.render as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterLoss);
  });
});
