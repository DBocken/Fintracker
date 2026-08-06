import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import type { CityModel } from '../../domain/city-model';

/**
 * WP-5.4 — die Aktivitätsstufe muss auf der Fassade ANKOMMEN.
 *
 * Vorher trugen ALLE Baukörper dieselbe Fassadentextur. Wenn die Stufe zwar
 * berechnet, aber nicht bis ins Material durchgereicht würde, wäre das genau
 * die Art blinder Zusicherung, die AGENTS.md §6 als wiederkehrende Falle führt:
 * die Domain-Tests wären grün und auf dem Bildschirm hätte sich nichts geändert.
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

/** Zwei Gebäude derselben Farbe im selben Distrikt — nur die Aktivität unterscheidet sie. */
const MODEL: CityModel = {
  districts: [
    {
      id: 'living',
      label: 'Lebenshaltung',
      color: '#3b82f6',
      total: 600,
      subcategories: [
        { id: 'rent', label: 'Miete', amount: 300, activity: 'quiet' },
        { id: 'groceries', label: 'Lebensmittel', amount: 300, activity: 'busy' },
      ],
    },
  ],
};

const VIEW = { level: 'district', focusDistrictId: 'living' } as const;

function createHandle() {
  const handle = createCityScene({
    canvas: document.createElement('canvas'),
    createRenderer: () => createFakeRenderer(),
  });
  const scene = handle.camera.parent as THREE.Scene;
  return { handle, scene };
}

function materialOf(scene: THREE.Scene, id: string): THREE.MeshLambertMaterial {
  const mesh = scene.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.userData.id === id,
  );
  return mesh!.material as THREE.MeshLambertMaterial;
}

describe('Fassaden-Aktivität in der Szene (WP-5.4)', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => createFake2dContext()) as never;
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it('[REGRESSION] sollte gleichfarbigen Gebäuden verschiedener Aktivität verschiedene Fassaden geben', () => {
    // Der Registry-Schlüssel war `color|opacity|bucket|texture` — ohne die
    // Aktivität darin teilten sich zwei gleichfarbige Gebäude eine
    // Materialinstanz und damit zwangsläufig dieselbe Fassade.
    const { handle, scene } = createHandle();
    handle.applyLayout(buildCityLayout(MODEL, VIEW));

    const quiet = materialOf(scene, 'living/rent');
    const busy = materialOf(scene, 'living/groceries');

    expect(quiet.color.getHex()).toBe(busy.color.getHex()); // gleiche Distriktfarbe …
    expect(quiet.map).not.toBe(busy.map); // … aber nicht dieselbe Fassade.
    expect(Object.is(quiet, busy)).toBe(false);
  });

  it('sollte Gebäuden gleicher Aktivität weiterhin dieselbe Materialinstanz geben', () => {
    // Die Registry ist der Grund, warum die Stadt mit wenigen Draw-Calls
    // auskommt — drei Fassaden dürfen daraus nicht drei Instanzen JE GEBÄUDE
    // machen.
    const sameActivity: CityModel = {
      districts: [
        {
          ...MODEL.districts[0],
          subcategories: [
            { id: 'a', label: 'A', amount: 100, activity: 'busy' },
            { id: 'b', label: 'B', amount: 100, activity: 'busy' },
          ],
        },
      ],
    };
    const { handle, scene } = createHandle();
    handle.applyLayout(buildCityLayout(sameActivity, VIEW));

    expect(Object.is(materialOf(scene, 'living/a'), materialOf(scene, 'living/b'))).toBe(true);
    handle.dispose();
  });

  it('sollte ohne Aktivitätsangabe die mittlere Stufe verwenden (Verhalten wie vor WP-5.4)', () => {
    const withoutActivity: CityModel = {
      districts: [
        {
          ...MODEL.districts[0],
          subcategories: [
            { id: 'a', label: 'A', amount: 100 },
            { id: 'b', label: 'B', amount: 100, activity: 'steady' },
          ],
        },
      ],
    };
    const { handle, scene } = createHandle();
    handle.applyLayout(buildCityLayout(withoutActivity, VIEW));

    expect(Object.is(materialOf(scene, 'living/a'), materialOf(scene, 'living/b'))).toBe(true);
    handle.dispose();
  });

  it('sollte auf Stufen ohne Fassadentextur gar keine Textur setzen', () => {
    const handle = createCityScene({
      canvas: document.createElement('canvas'),
      createRenderer: () => createFakeRenderer(),
      quality: {
        tier: 'lean',
        maxPixelRatio: 1,
        antialias: false,
        contactShadows: false,
        facadeTexture: false,
        rimLight: false,
        edges: false,
        buildCascade: false,
        flowLines: false,
      },
    });
    const scene = handle.camera.parent as THREE.Scene;
    handle.applyLayout(buildCityLayout(MODEL, VIEW));

    expect(materialOf(scene, 'living/rent').map).toBeNull();
    expect(materialOf(scene, 'living/groceries').map).toBeNull();
    handle.dispose();
  });
});
