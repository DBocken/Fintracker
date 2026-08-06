import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { buildFlowLines } from '../../domain/city-flow-lines';
import { deriveCityQuality, type CityQualityTier } from '../../domain/city-quality';
import type { CityModel } from '../../domain/city-model';

/**
 * WP-5.1 — die Flusslinien müssen in der Szene ANKOMMEN und dort wieder
 * verschwinden. Die Geometrie selbst prüft `domain/__tests__/city-flow-lines.test.ts`.
 */
function createFakeRenderer() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
  } as unknown as THREE.WebGLRenderer;
}

function createFake2dContext(): CanvasRenderingContext2D {
  const makeGradient = () => ({ addColorStop: vi.fn() });
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(makeGradient),
    createRadialGradient: vi.fn(makeGradient),
  } as unknown as CanvasRenderingContext2D;
}

const MODEL: CityModel = {
  districts: [
    {
      id: 'living',
      label: 'Lebenshaltung',
      color: '#3b82f6',
      total: 400,
      subcategories: [
        { id: 'streaming', label: 'Streaming', amount: 40, recurringAmount: 40 },
        { id: 'insurance', label: 'Versicherung', amount: 60, recurringAmount: 20 },
        { id: 'food', label: 'Lebensmittel', amount: 300 },
      ],
    },
  ],
};

const VIEW = { level: 'city' } as const;

function sceneFor(tier: CityQualityTier) {
  const handle = createCityScene({
    canvas: document.createElement('canvas'),
    createRenderer: () => createFakeRenderer(),
    quality: deriveCityQuality({ devicePixelRatio: 2, viewportWidth: 1440 }, tier),
  });
  const scene = handle.camera.parent as THREE.Scene;
  handle.applyLayout(buildCityLayout(MODEL, VIEW));
  return { handle, scene };
}

function flowLinesOf(scene: THREE.Scene): THREE.Line[] {
  // `THREE.LineSegments` erbt von `THREE.Line` — die Kantenlinien der Boxen
  // müssen deshalb ausdrücklich ausgeschlossen werden.
  return scene.children.filter(
    (child): child is THREE.Line => child instanceof THREE.Line && !(child instanceof THREE.LineSegments),
  );
}

describe('[MOBILE] Flusslinien in der Szene (WP-5.1)', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => createFake2dContext()) as never;
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it('sollte je wiederkehrender Zahlung eine Linie anlegen', () => {
    const { handle, scene } = sceneFor('high');
    const lines = buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW));
    expect(lines).toHaveLength(2);

    handle.applyFlowLines(lines);

    expect(flowLinesOf(scene)).toHaveLength(2);
    handle.dispose();
  });

  it('sollte die Deckkraft nach dem Anteil abstufen', () => {
    const { handle, scene } = sceneFor('high');
    handle.applyFlowLines(buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW)));

    const opacities = flowLinesOf(scene).map((line) => (line.material as THREE.LineBasicMaterial).opacity);
    expect(new Set(opacities).size, 'Alle Linien gleich deckend — der Anteil ist nicht ablesbar').toBe(2);
    for (const opacity of opacities) {
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
    handle.dispose();
  });

  it('sollte Linien abräumen, die nicht mehr geliefert werden', () => {
    const { handle, scene } = sceneFor('high');
    handle.applyFlowLines(buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW)));
    expect(flowLinesOf(scene)).toHaveLength(2);

    handle.applyFlowLines([]);

    expect(flowLinesOf(scene)).toHaveLength(0);
    handle.dispose();
  });

  it('sollte dieselbe Linien-Instanz wiederverwenden (kein Neuaufbau je Frame)', () => {
    const { handle, scene } = sceneFor('high');
    const lines = buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW));
    handle.applyFlowLines(lines);
    const before = flowLinesOf(scene)[0];

    handle.applyFlowLines(lines);

    expect(Object.is(flowLinesOf(scene)[0], before)).toBe(true);
    handle.dispose();
  });

  it('[MOBILE] sollte auf der sparsamsten Stufe gar keine Linien anlegen', () => {
    const { handle, scene } = sceneFor('lean');

    handle.applyFlowLines(buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW)));

    expect(flowLinesOf(scene)).toHaveLength(0);
    handle.dispose();
  });

  it('sollte beim dispose keine Linie in der Szene lassen', () => {
    const { handle, scene } = sceneFor('high');
    handle.applyFlowLines(buildFlowLines(MODEL, buildCityLayout(MODEL, VIEW)));

    handle.dispose();

    expect(flowLinesOf(scene)).toHaveLength(0);
  });
});
