import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene, type CitySceneHandle } from '../city-scene';
import { buildCityLayout } from '../../domain/city-layout';
import { cityDemoModel } from '../../data/city-demo-data';

/**
 * `city-scene.ts` ist reiner Szenengraph-Code (three.js braucht dafür KEINEN
 * echten WebGL-Kontext, nur die Mathe-/Objektgraph-Schicht) — die Tests
 * injizieren einen Fake-Renderer (`createRenderer`) statt eines echten
 * `THREE.WebGLRenderer`, der in jsdom ohnehin nicht erzeugbar wäre.
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

function createHandle() {
  const canvas = document.createElement('canvas');
  const renderer = createFakeRenderer();
  const handle = createCityScene({ canvas, createRenderer: () => renderer });
  // Die Kamera ist absichtlich ein Szenen-Kind (`city-scene.ts`-Kommentar),
  // damit Tests über `camera.parent` an den Szenengraphen kommen, ohne dass
  // `CitySceneHandle` eine zusätzliche Debug-only-API braucht.
  const scene = handle.camera.parent as THREE.Scene;
  return { handle, renderer, scene, canvas };
}

function meshesOf(scene: THREE.Scene): THREE.Mesh[] {
  return scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
}

function lineSegmentsOf(scene: THREE.Scene): THREE.LineSegments[] {
  return scene.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCityScene', () => {
  describe('applyLayout', () => {
    it('sollte für jede LayoutBox aus buildCityLayout genau ein Mesh mit passender Position/Skalierung anlegen', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });

      handle.applyLayout(layout);

      const meshes = meshesOf(scene);
      expect(meshes).toHaveLength(layout.boxes.length);

      const rentBox = layout.boxes.find((b) => b.id === 'housing/rent')!;
      const rentMesh = meshes.find((m) => m.userData.id === 'housing/rent')!;
      expect(rentMesh).toBeDefined();
      expect(rentMesh.position.x).toBeCloseTo(rentBox.center.x, 10);
      expect(rentMesh.position.y).toBeCloseTo(rentBox.center.y, 10);
      expect(rentMesh.position.z).toBeCloseTo(rentBox.center.z, 10);
      expect(rentMesh.scale.x).toBeCloseTo(rentBox.size.x, 10);
      expect(rentMesh.scale.y).toBeCloseTo(rentBox.size.y, 10);
      expect(rentMesh.scale.z).toBeCloseTo(rentBox.size.z, 10);
      expect(rentMesh.userData.pickable).toBe(rentBox.pickable);
    });

    it('sollte nur für Boxen mit edges=true eine LineSegments-Kante anlegen (Hüllen)', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });

      handle.applyLayout(layout);

      const hullCount = layout.boxes.filter((b) => b.edges).length;
      expect(hullCount).toBeGreaterThan(0);
      expect(lineSegmentsOf(scene)).toHaveLength(hullCount);
    });

    it('sollte bei zweitem applyLayout mit denselben ids dieselbe Mesh-Instanz wiederverwenden (Object.is)', () => {
      const { handle, scene } = createHandle();
      const layout1 = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout1);
      const meshBefore = meshesOf(scene).find((m) => m.userData.id === 'housing')!;
      expect(meshBefore).toBeDefined();

      const layout2 = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout2);
      const meshAfter = meshesOf(scene).find((m) => m.userData.id === 'housing')!;

      expect(Object.is(meshBefore, meshAfter)).toBe(true);
      // Gesamtzahl bleibt gleich (kein Duplikat angelegt).
      expect(meshesOf(scene)).toHaveLength(layout2.boxes.length);
    });

    it('sollte Meshes entsorgen, deren id im neuen Layout nicht mehr vorkommt (Ebenenwechsel)', () => {
      const { handle, scene } = createHandle();
      const cityLayout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(cityLayout);
      expect(meshesOf(scene).some((m) => m.userData.id === 'housing')).toBe(true);

      const districtLayout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'leisure' });
      handle.applyLayout(districtLayout);

      const meshes = meshesOf(scene);
      // Die Stadt-Hülle "housing" existiert auf district-Ebene nicht mehr.
      expect(meshes.some((m) => m.userData.id === 'housing')).toBe(false);
      expect(meshes).toHaveLength(districtLayout.boxes.length);
      for (const box of districtLayout.boxes) {
        expect(meshes.some((m) => m.userData.id === box.id)).toBe(true);
      }
    });

    it('sollte eine degenerierte Nullbox (Distrikt ohne Unterkategorien) unsichtbar, aber ohne Absturz anlegen', () => {
      const { handle, scene } = createHandle();
      const emptyModel = { districts: [{ id: 'empty', label: 'Leer', color: '#000000', total: 0, subcategories: [] }] };
      const layout = buildCityLayout(emptyModel, { level: 'city' });

      expect(() => handle.applyLayout(layout)).not.toThrow();
      const hullMesh = meshesOf(scene).find((m) => m.userData.id === 'empty');
      expect(hullMesh).toBeDefined();
      expect(hullMesh!.visible).toBe(false);
    });
  });

  describe('pick', () => {
    it('sollte nur pickable Meshes an den Raycaster übergeben und dessen erste Trefferid liefern', () => {
      const { handle, canvas } = createHandle();
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      let capturedObjects: THREE.Object3D[] = [];
      vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockImplementation((objects) => {
        capturedObjects = objects as THREE.Object3D[];
        const target = capturedObjects.find((o) => o.userData.id === 'leisure');
        return target ? [{ object: target, distance: 1, point: new THREE.Vector3() }] : [];
      });

      const id = handle.pick(50, 50);

      expect(id).toBe('leisure');
      // Auf city-Ebene sind nur Hüllen pickable (city-layout.ts-Matrix).
      expect(capturedObjects.length).toBeGreaterThan(0);
      expect(capturedObjects.every((o) => o.userData.pickable === true)).toBe(true);
      expect(capturedObjects.every((o) => o.userData.kind === 'hull')).toBe(true);
    });

    it('sollte null liefern, wenn der Raycaster keine Treffer findet (Boden/Leere)', () => {
      const { handle, canvas } = createHandle();
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
      vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([]);

      expect(handle.pick(50, 50)).toBeNull();
    });

    it('sollte null liefern, wenn die Canvas-Größe 0 ist (kein sinnvoller NDC-Raum)', () => {
      const { handle, canvas } = createHandle();
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      expect(handle.pick(10, 10)).toBeNull();
    });
  });

  describe('setSize / render', () => {
    it('sollte DPR/Größe an den Renderer weiterreichen und das Kamera-Seitenverhältnis aktualisieren', () => {
      const { handle, renderer } = createHandle();
      handle.setSize(800, 400, 2);

      expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
      expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
      expect(handle.camera.aspect).toBeCloseTo(2, 10);
    });

    it('sollte bei 0-Größe ein No-op sein (kein Renderer-Aufruf)', () => {
      const { handle, renderer } = createHandle();
      handle.setSize(0, 0, 2);
      expect(renderer.setSize).not.toHaveBeenCalled();
    });

    it('sollte render() an renderer.render(scene, camera) durchreichen', () => {
      const { handle, renderer, scene } = createHandle();
      handle.render();
      expect(renderer.render).toHaveBeenCalledWith(scene, handle.camera);
    });
  });

  describe('applyCameraPose', () => {
    it('sollte Kamera-Position und Orbit-Target setzen', () => {
      const { handle } = createHandle();
      handle.applyCameraPose({ position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 } });

      expect(handle.camera.position.x).toBeCloseTo(1, 10);
      expect(handle.camera.position.y).toBeCloseTo(2, 10);
      expect(handle.camera.position.z).toBeCloseTo(3, 10);
      expect(handle.target.x).toBeCloseTo(4, 10);
      expect(handle.target.y).toBeCloseTo(5, 10);
      expect(handle.target.z).toBeCloseTo(6, 10);
    });
  });

  describe('dispose', () => {
    it('sollte geteilte Geometrien, alle Materialien und den Renderer aufräumen sowie Meshes/Kanten aus der Szene entfernen', () => {
      const boxDisposeSpy = vi.spyOn(THREE.BoxGeometry.prototype, 'dispose');
      const edgesDisposeSpy = vi.spyOn(THREE.EdgesGeometry.prototype, 'dispose');
      const lambertDisposeSpy = vi.spyOn(THREE.MeshLambertMaterial.prototype, 'dispose');
      const basicDisposeSpy = vi.spyOn(THREE.MeshBasicMaterial.prototype, 'dispose');
      const lineDisposeSpy = vi.spyOn(THREE.LineBasicMaterial.prototype, 'dispose');

      const { handle, renderer, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));

      handle.dispose();

      expect(boxDisposeSpy).toHaveBeenCalledTimes(1);
      expect(edgesDisposeSpy).toHaveBeenCalledTimes(1);
      expect(lambertDisposeSpy).toHaveBeenCalled();
      expect(basicDisposeSpy).toHaveBeenCalled();
      expect(lineDisposeSpy).toHaveBeenCalled();
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(meshesOf(scene)).toHaveLength(0);
      expect(lineSegmentsOf(scene)).toHaveLength(0);
    });
  });

  describe('setFog', () => {
    it('sollte bei nicht-endlichen Werten Fog deaktivieren (no-op-fähig)', () => {
      const { handle } = createHandle();
      expect(() => handle.setFog(NaN, NaN)).not.toThrow();
    });
  });

  it('sollte createCityScene ohne createRenderer-Option nicht direkt aufgerufen werden müssen — TypeScript-Vertragstest via Handle-Form', () => {
    // Reiner Struktur-Check: alle laut CitySceneHandle geforderten Mitglieder existieren.
    const { handle } = createHandle();
    const required: (keyof CitySceneHandle)[] = [
      'applyLayout',
      'pick',
      'setSize',
      'setFog',
      'render',
      'dispose',
      'applyCameraPose',
      'target',
      'camera',
      'domElement',
    ];
    for (const key of required) {
      expect(handle[key]).toBeDefined();
    }
  });
});
