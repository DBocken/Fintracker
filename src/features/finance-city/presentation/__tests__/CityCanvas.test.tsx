import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { createRef } from 'react';
import { CityCanvas } from '../CityCanvas';
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

function createFakeHandle(canvas: HTMLCanvasElement, overrides: Partial<CitySceneHandle> = {}): CitySceneHandle {
  return {
    applyLayout: vi.fn(),
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
});
