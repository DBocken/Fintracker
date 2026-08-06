import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as THREE from 'three';
import { CityCanvas } from '../CityCanvas';
import type { CitySceneHandle } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { cityDemoModel } from '../../data/city-demo-data';

/**
 * WP-5.6 — `CityCanvas` liest das Geräteprofil und gibt die abgeleitete Stufe
 * an die Szene weiter. Geprüft wird genau diese Übergabe: die Ableitung selbst
 * gehört `domain/city-quality.ts` (dort getestet), die Wirkung in der Szene
 * `city-scene-quality.test.ts`.
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
    applyFlowLines: vi.fn(),
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
    domElement: canvas, // OrbitControls braucht ein echtes Element.
  } as unknown as CitySceneHandle;
}

/** Setzt die Browser-Signale, aus denen `CityCanvas` das Geräteprofil liest. */
function stubDevice(profile: {
  devicePixelRatio: number;
  innerWidth: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  coarsePointer: boolean;
}) {
  vi.stubGlobal('devicePixelRatio', profile.devicePixelRatio);
  Object.defineProperty(window, 'innerWidth', { value: profile.innerWidth, configurable: true });
  Object.defineProperty(window.navigator, 'hardwareConcurrency', {
    value: profile.hardwareConcurrency,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'deviceMemory', { value: profile.deviceMemory, configurable: true });
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('pointer: coarse') ? profile.coarsePointer : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

function renderCanvas() {
  return render(<CityCanvas layout={buildCityLayout(cityDemoModel, { level: 'city' })} onTapBox={() => {}} />);
}

function passedQuality() {
  return createCityScene.mock.calls.at(-1)?.[0]?.quality;
}

describe('[MOBILE] CityCanvas — Qualitätsstufe (WP-5.6)', () => {
  beforeEach(() => {
    createCityScene.mockReset();
    createCityScene.mockImplementation((options: { canvas: HTMLCanvasElement }) => createFakeHandle(options.canvas));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sollte der Szene auf einem kräftigen Desktop die höchste Stufe übergeben', () => {
    stubDevice({ devicePixelRatio: 1, innerWidth: 1440, hardwareConcurrency: 12, deviceMemory: 16, coarsePointer: false });
    renderCanvas();
    expect(passedQuality()?.tier).toBe('high');
  });

  it('sollte auf einem Telefon eine sparsamere Stufe übergeben', () => {
    stubDevice({ devicePixelRatio: 3, innerWidth: 390, hardwareConcurrency: 8, deviceMemory: 6, coarsePointer: true });
    renderCanvas();
    expect(passedQuality()?.tier).toBe('balanced');
  });

  it('sollte auf einem schwachen Gerät die sparsamste Stufe übergeben', () => {
    stubDevice({ devicePixelRatio: 2, innerWidth: 360, hardwareConcurrency: 2, deviceMemory: 2, coarsePointer: true });
    renderCanvas();
    expect(passedQuality()?.tier).toBe('lean');
  });

  it('[REGRESSION] sollte den ersten Frame nie oberhalb des Stufen-Deckels rendern', () => {
    // Der eigentliche Fehler vor WP-5.6: die DPR-Kaskade startete IMMER bei
    // min(devicePixelRatio, 2) und fiel erst nach gemessenem Ruckeln. Auf einem
    // schwachen Telefon war der erste Eindruck damit systematisch der
    // schlechteste. Jetzt startet sie auf dem Deckel der Stufe.
    stubDevice({ devicePixelRatio: 3, innerWidth: 360, hardwareConcurrency: 2, deviceMemory: 2, coarsePointer: true });
    const { container } = renderCanvas();
    const handle = createCityScene.mock.results.at(-1)?.value as CitySceneHandle;

    // Resize simulieren (der ResizeObserver-Stub feuert nicht von selbst).
    const div = container.querySelector('div');
    Object.defineProperty(div, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    window.dispatchEvent(new Event('resize'));

    const dprCalls = (handle.setSize as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[2]);
    for (const dpr of dprCalls) {
      expect(dpr, `setSize mit DPR ${dpr} über dem Deckel der Sparstufe`).toBeLessThanOrEqual(1);
    }
  });
});
