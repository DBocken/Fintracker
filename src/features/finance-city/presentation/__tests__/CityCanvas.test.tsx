import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { createRef } from 'react';
import { CityCanvas, type CityControlsApi } from '../CityCanvas';
import type { CitySceneHandle } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { cityDemoModel } from '../../data/city-demo-data';

// jsdom kennt weder ResizeObserver noch requestAnimationFrame standardmäßig
// (Präzedenzfall: EtoroCandlestickChart.test.tsx) — CityCanvas braucht beide
// für Resize-Handling bzw. den Render-on-Demand-Loop.
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

// WP-C6: `useReducedMotion` kontrollierbar mocken, um die Mount-Reihenfolge
// (`setAnimationsEnabled` VOR dem ersten `applyLayout`) unabhängig vom
// tatsächlichen `matchMedia`-Verhalten in jsdom zu testen.
const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

function createFakeHandle(canvas: HTMLCanvasElement, overrides: Partial<CitySceneHandle> = {}): CitySceneHandle {
  return {
    applyLayout: vi.fn(),
    // WP-C6: Default `false` — der Fake verhält sich wie eine Szene ohne
    // laufende Aufbau-Animation, damit bestehende Tests (die nur Kamera-
    // Controller-Aktivität prüfen) unverändert bleiben.
    advanceAnimations: vi.fn(() => false),
    setAnimationsEnabled: vi.fn(),
    pick: vi.fn(() => null),
    setSize: vi.fn(),
    setFog: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    applyCameraPose: vi.fn(),
    target: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(),
    domElement: canvas,
    ...overrides,
  };
}

const LAYOUT = buildCityLayout(cityDemoModel, { level: 'city' });

function firePointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
}

beforeEach(() => {
  createCityScene.mockReset();
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CityCanvas', () => {
  it('sollte bei WebGL-Erstellungsfehler einen leeren Fallback-Container statt eines Absturzes rendern', () => {
    createCityScene.mockImplementation(() => {
      throw new Error('WebGL nicht verfügbar (jsdom)');
    });

    const { getByTestId, queryByTestId } = render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} />);

    expect(getByTestId('city-canvas-unavailable')).toBeInTheDocument();
    expect(queryByTestId('city-canvas')).not.toBeInTheDocument();
  });

  it('sollte beim Mount die Szene mit dem aktuellen Layout befüllen und beim Unmount dispose() aufrufen', async () => {
    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });

    const { unmount } = render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} />);

    await waitFor(() => expect(handle).not.toBeNull());
    await waitFor(() => expect(handle!.applyLayout).toHaveBeenCalledWith(LAYOUT));

    unmount();
    expect(handle!.dispose).toHaveBeenCalledTimes(1);
  });

  it('sollte bei Layout-Prop-Wechsel applyLayout erneut aufrufen, OHNE die Szene neu zu erstellen', async () => {
    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });

    const { rerender } = render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} />);
    await waitFor(() => expect(handle).not.toBeNull());

    const districtLayout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
    rerender(<CityCanvas layout={districtLayout} onTapBox={vi.fn()} />);

    await waitFor(() => expect(handle!.applyLayout).toHaveBeenCalledWith(districtLayout));
    expect(createCityScene).toHaveBeenCalledTimes(1);
  });

  it('sollte sceneRef beim Mount mit dem Handle befüllen und beim Unmount wieder auf null setzen', async () => {
    const handle = createFakeHandle(document.createElement('canvas'));
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => ({ ...handle, domElement: canvas }));

    const sceneRef = createRef<CitySceneHandle | null>();
    const { unmount } = render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} sceneRef={sceneRef} />);

    await waitFor(() => expect(sceneRef.current).not.toBeNull());

    unmount();
    expect(sceneRef.current).toBeNull();
  });

  it('sollte bei einem Tap (kurzer Pointer-Down/Up ohne nennenswerten Versatz) pick() aufrufen und onTapBox benachrichtigen', async () => {
    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas, { pick: vi.fn(() => 'leisure') });
      return handle;
    });
    const onTapBox = vi.fn();

    const { getByTestId } = render(<CityCanvas layout={LAYOUT} onTapBox={onTapBox} />);
    await waitFor(() => expect(handle).not.toBeNull());

    const canvas = getByTestId('city-canvas');
    firePointer(canvas, 'pointerdown', 100, 100);
    firePointer(canvas, 'pointerup', 102, 101); // < 8px Versatz

    expect(handle!.pick).toHaveBeenCalledWith(102, 101);
    expect(onTapBox).toHaveBeenCalledWith('leisure');
  });

  it('[REGRESSION] sollte pro Frame höchstens einen requestAnimationFrame planen (kein Verdoppeln durch invalidate() während des Ticks)', async () => {
    // Nachgestellter Produktions-Bug (WP-C4.1): Während eines Kamera-Flugs ruft
    // der Controller in JEDEM tick() deps.invalidate() auf (city-camera-
    // controller.ts) — landete das mitten im Loop-Tick, wurde ZUSÄTZLICH zum
    // Reschedule am Tick-Ende ein zweiter Callback geplant und dessen Handle
    // ohne cancel überschrieben → Callback-Zahl verdoppelte sich pro Frame
    // (exponentieller Render-Sturm, „Performance sehr schlecht" auf Mobile).
    const queue = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue.delete(id);
    });

    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });

    const controlsApiRef = createRef<CityControlsApi | null>();
    // Dauer-aktiver Fake-Flug: verhält sich wie der echte Controller-Tick
    // (invalidate() pro Frame, Rückgabe true = „Flug läuft noch").
    const cameraController = {
      onIntent: vi.fn(),
      tick: vi.fn(() => {
        controlsApiRef.current?.invalidate();
        return true;
      }),
      cancelFlight: vi.fn(),
      onControlsChange: vi.fn(),
      configure: vi.fn(),
      dispose: vi.fn(),
    };

    const { unmount } = render(
      <CityCanvas
        layout={LAYOUT}
        onTapBox={vi.fn()}
        cameraController={cameraController}
        controlsApiRef={controlsApiRef}
      />,
    );
    await waitFor(() => expect(handle).not.toBeNull());
    expect(queue.size).toBe(1); // Mount-invalidate plant genau den ersten Frame.

    const flushFrame = (nowMs: number) => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(nowMs);
    };

    const FRAMES = 6;
    for (let frame = 0; frame < FRAMES; frame += 1) {
      flushFrame(1000 + frame * 16);
      // Kern-Assertion: der Loop plant sich GENAU EINMAL neu — nicht
      // zusätzlich über den verschachtelten invalidate()-Pfad.
      expect(queue.size).toBeLessThanOrEqual(1);
    }
    // Genau ein Szenen-Render pro Frame — nicht 2^n durch verdoppelte Callbacks.
    expect(handle!.render).toHaveBeenCalledTimes(FRAMES);

    unmount();
    expect(queue.size).toBe(0); // Unmount cancelt den ausstehenden Frame.
  });

  it('sollte bei einem Drag (> 8px Versatz zwischen Pointer-Down/Up) NICHT als Tap werten', async () => {
    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });
    const onTapBox = vi.fn();

    const { getByTestId } = render(<CityCanvas layout={LAYOUT} onTapBox={onTapBox} />);
    await waitFor(() => expect(handle).not.toBeNull());

    const canvas = getByTestId('city-canvas');
    firePointer(canvas, 'pointerdown', 0, 0);
    firePointer(canvas, 'pointerup', 200, 200); // deutlich > 8px

    expect(handle!.pick).not.toHaveBeenCalled();
    expect(onTapBox).not.toHaveBeenCalled();
  });

  it('sollte onFrame nach dem initialen Render-Tick genau einmal mit der aktuellen Kamera aufrufen (WP-C5)', async () => {
    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });
    const onFrame = vi.fn();

    render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} onFrame={onFrame} />);
    await waitFor(() => expect(handle).not.toBeNull());
    await waitFor(() => expect(handle!.render).toHaveBeenCalledTimes(1));

    // Kein weiterer Tick wird geplant (nichts hat sich geändert) -> onFrame
    // feuert exakt einmal, mit derselben Kamera-Instanz wie das Szenen-Handle.
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledWith(handle!.camera);
  });

  it('[REGRESSION] sollte onFrame NUR bei Frames feuern, in denen tatsächlich gerendert wurde (keine zweite rAF-Schleife, kein Feuern bei No-Op-Ticks)', async () => {
    const queue = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue.delete(id);
    });

    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });

    const onFrame = vi.fn();
    const controlsApiRef = createRef<CityControlsApi | null>();
    // Fake-Controller: Frame 1+2 "in Flug" (Änderung, Render nötig), danach
    // beendet (keine Änderung mehr) -> Loop stoppt von selbst.
    let ticksRemaining = 2;
    const cameraController = {
      onIntent: vi.fn(),
      tick: vi.fn(() => {
        if (ticksRemaining > 0) {
          ticksRemaining -= 1;
          return true;
        }
        return false;
      }),
      cancelFlight: vi.fn(),
      onControlsChange: vi.fn(),
      configure: vi.fn(),
      dispose: vi.fn(),
    };

    render(
      <CityCanvas
        layout={LAYOUT}
        onTapBox={vi.fn()}
        onFrame={onFrame}
        cameraController={cameraController}
        controlsApiRef={controlsApiRef}
      />,
    );
    await waitFor(() => expect(handle).not.toBeNull());

    const flushFrame = (nowMs: number) => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(nowMs);
    };

    // Frame 1: Mount-invalidate + controllerActive=true -> Render + onFrame.
    flushFrame(1000);
    // Frame 2: controllerActive=true (zweiter Tick) -> Render + onFrame.
    flushFrame(1016);
    // Frame 3: controllerActive=false, controls.update() ebenfalls false
    // (Fake-Renderer/-Canvas ohne echte Interaktion) -> KEIN Render, KEIN onFrame,
    // Loop stoppt (queue bleibt leer).
    flushFrame(1032);

    expect(handle!.render).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it('sollte beim Mount setAnimationsEnabled mit dem aktuellen reducedMotion-Wert aufrufen, BEVOR das erste applyLayout passiert (WP-C6-Mount-Reihenfolge)', async () => {
    useReducedMotionMock.mockReturnValue(true);

    let handle: CitySceneHandle | null = null;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas);
      return handle;
    });

    render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} />);
    await waitFor(() => expect(handle).not.toBeNull());
    await waitFor(() => expect(handle!.applyLayout).toHaveBeenCalled());

    // reducedMotion=true -> setAnimationsEnabled(false). Muss VOR applyLayout
    // passiert sein, sonst würde das allererste Layout mit dem falschen
    // (default) Animations-Zustand angewendet.
    expect(handle!.setAnimationsEnabled).toHaveBeenCalledWith(false);
    const enabledCallOrder = (handle!.setAnimationsEnabled as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const layoutCallOrder = (handle!.applyLayout as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(enabledCallOrder).toBeLessThan(layoutCallOrder);
  });

  it('sollte advanceAnimations() der Szene pro Frame ticken und bei laufender Animation den Loop am Laufen halten (Single-rAF-Invariante bleibt erhalten)', async () => {
    const queue = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      queue.delete(id);
    });

    let handle: CitySceneHandle | null = null;
    // Fake-Szene: "in Animation" für die ersten beiden Ticks (Balken wächst
    // noch), danach abgeschlossen — kein Kamera-Controller beteiligt, damit
    // ausschließlich `advanceAnimations()` den Loop am Laufen hält.
    let ticksRemaining = 2;
    createCityScene.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      handle = createFakeHandle(canvas, {
        advanceAnimations: vi.fn(() => {
          if (ticksRemaining > 0) {
            ticksRemaining -= 1;
            return true;
          }
          return false;
        }),
      });
      return handle;
    });

    render(<CityCanvas layout={LAYOUT} onTapBox={vi.fn()} />);
    await waitFor(() => expect(handle).not.toBeNull());
    expect(queue.size).toBe(1); // Mount-invalidate plant genau den ersten Frame.

    const flushFrame = (nowMs: number) => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(nowMs);
    };

    // Frame 1+2: advanceAnimations() liefert true -> Render, Loop läuft weiter.
    flushFrame(1000);
    expect(queue.size).toBeLessThanOrEqual(1);
    flushFrame(1016);
    expect(queue.size).toBeLessThanOrEqual(1);
    // Frame 3: advanceAnimations() liefert false, keine sonstige Aktivität -> Loop stoppt.
    flushFrame(1032);

    expect(handle!.advanceAnimations).toHaveBeenCalledTimes(3);
    expect(handle!.render).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });
});
