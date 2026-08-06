import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { cityDemoModel } from '../../data/city-demo-data';
import { deriveCityQuality, type CityQualityTier } from '../../domain/city-quality';

/**
 * WP-5.6 — die Qualitätsstufe muss in der Szene ANKOMMEN.
 *
 * Der Domain-Test (`domain/__tests__/city-quality.test.ts`) prüft nur die
 * Ableitung der Stufe. Hier geht es um das, was daran teuer ist: dass auf einer
 * sparsameren Stufe tatsächlich weniger Objekte, Lichter und Draw-Calls
 * entstehen. Ohne diesen Test wäre eine korrekt abgeleitete, aber nirgends
 * ausgewertete Stufe genau die Art blinder Zusicherung, die AGENTS.md §6 als
 * wiederkehrende Falle führt.
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

const DEVICE = { devicePixelRatio: 2, viewportWidth: 1440 };

function sceneForTier(tier: CityQualityTier) {
  const canvas = document.createElement('canvas');
  const renderer = createFakeRenderer();
  const handle = createCityScene({
    canvas,
    createRenderer: () => renderer,
    quality: deriveCityQuality(DEVICE, tier),
  });
  const scene = handle.camera.parent as THREE.Scene;
  handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
  return { handle, renderer, scene };
}

function countLights(scene: THREE.Scene): number {
  return scene.children.filter((child) => child instanceof THREE.Light).length;
}

function countContactShadows(scene: THREE.Scene): number {
  return scene.children.filter(
    (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
  ).length;
}

function countEdges(scene: THREE.Scene): number {
  return scene.children.filter((child) => child instanceof THREE.LineSegments).length;
}

describe('[MOBILE] Qualitätsstufen der Stadt-Szene (WP-5.6)', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((kind: string) => (kind === '2d' ? createFake2dContext() : null)) as never;
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it('sollte ohne Angabe unverändert die höchste Stufe fahren', () => {
    // Rückwärtskompatibilität: alle bestehenden Szenen-Tests konstruieren ohne
    // `quality` und dürfen sich nicht verhalten wie ein Sparmodus.
    const canvas = document.createElement('canvas');
    const handle = createCityScene({ canvas, createRenderer: () => createFakeRenderer() });
    const scene = handle.camera.parent as THREE.Scene;
    handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));

    expect(countContactShadows(scene)).toBeGreaterThan(0);
    expect(countEdges(scene)).toBeGreaterThan(0);
    expect(countLights(scene)).toBe(3);
    handle.dispose();
  });

  it('sollte auf der sparsamsten Stufe keine Kontaktschatten erzeugen', () => {
    const lean = sceneForTier('lean');
    expect(countContactShadows(lean.scene)).toBe(0);
    lean.handle.dispose();
  });

  it('sollte auf der sparsamsten Stufe keine Kantenlinien erzeugen', () => {
    const lean = sceneForTier('lean');
    expect(countEdges(lean.scene)).toBe(0);
    lean.handle.dispose();
  });

  it('sollte das Gegenlicht ab der mittleren Stufe weglassen', () => {
    // Eine dritte Lichtquelle kostet Fragment-Last auf JEDEM Material — der
    // erste Effekt, der beim Sparen fällt.
    const high = sceneForTier('high');
    const balanced = sceneForTier('balanced');
    expect(countLights(high.scene)).toBe(3);
    expect(countLights(balanced.scene)).toBe(2);
    high.handle.dispose();
    balanced.handle.dispose();
  });

  it('sollte die Fassadentextur nur auf den oberen Stufen auf die Baukörper legen', () => {
    // Die Fassadentextur liegt auf ALLEN `solid`-Materialien — sie ist der
    // Textur-Posten, der mit der Zahl der Gebäude wächst. Die Straßentextur
    // des Bodens bleibt bewusst auch auf der Sparstufe: EINE Textur auf EINEM
    // Material, kein Overdraw — und ohne sie steht die Stadt auf einer leeren
    // grauen Platte statt an einem Ort (WP-E1-Ziel).
    const high = sceneForTier('high');
    const lean = sceneForTier('lean');

    const texturedMeshes = (scene: THREE.Scene) =>
      scene.children
        .filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)
        .filter((mesh) => Boolean((mesh.material as THREE.MeshLambertMaterial).map));

    expect(texturedMeshes(high.scene).length, 'Auf der höchsten Stufe fehlt die Fassadentextur').toBeGreaterThan(1);
    expect(
      texturedMeshes(lean.scene).length,
      'Sparstufe texturiert weiterhin Baukörper (erwartet: nur der Boden)',
    ).toBe(1);
    high.handle.dispose();
    lean.handle.dispose();
  });

  it('sollte einen zu hohen Pixel-Ratio auf den Deckel der Stufe kappen', () => {
    // `setSize` bekommt den DPR vom Aufrufer (`CityCanvas`, FPS-Kaskade). Die
    // Szene kappt trotzdem selbst: die Stufe ist eine Obergrenze, kein
    // Vorschlag — sonst hinge die Zusicherung an genau einem Aufrufer.
    const lean = sceneForTier('lean');
    lean.handle.setSize(800, 600, 3);
    expect(lean.renderer.setPixelRatio).toHaveBeenCalledWith(1);
    lean.handle.dispose();
  });

  it('sollte einen niedrigeren Pixel-Ratio des Aufrufers unangetastet lassen', () => {
    // Die FPS-Kaskade darf weiter NACH UNTEN nachjustieren — gekappt wird nur
    // nach oben.
    const high = sceneForTier('high');
    high.handle.setSize(800, 600, 1.25);
    expect(high.renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    high.handle.dispose();
  });

  it('[REGRESSION] sollte auf jeder Stufe dieselbe Anzahl Baukörper liefern', () => {
    // Sparen darf Effekte kosten, aber NIE Daten: jede Unterkategorie bleibt
    // als Gebäude sichtbar, sonst zeigt die Sparstufe eine andere Stadt.
    const boxCount = (scene: THREE.Scene) =>
      scene.children.filter(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry,
      ).length;

    const high = sceneForTier('high');
    const lean = sceneForTier('lean');
    expect(boxCount(lean.scene)).toBe(boxCount(high.scene));
    high.handle.dispose();
    lean.handle.dispose();
  });
});
