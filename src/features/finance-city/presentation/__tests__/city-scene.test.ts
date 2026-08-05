import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene, THEME_PALETTES, type CitySceneHandle } from '../city-scene';
import { buildCityLayout, type CityLayout, type LayoutBox } from '../../domain/city-layout';
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

/**
 * jsdom liefert ohne node-canvas `null` für `getContext('2d')` — die WP-E1-
 * Canvas-Texturen (Himmel/Boden/Fassade/Kontaktschatten) brauchen aber einen
 * minimalen 2D-Kontext. Dieser Stub bildet exakt die API ab, die
 * `city-scene.ts` nutzt (`fillRect`, `create*Gradient` mit `addColorStop`,
 * `fillStyle`); die Szene selbst degradiert ohne ihn still auf un-texturierte
 * Materialien/Farben.
 */
function createFake2dContext(): CanvasRenderingContext2D {
  const makeGradient = () => ({ addColorStop: vi.fn() });
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(makeGradient),
    createRadialGradient: vi.fn(makeGradient),
  } as unknown as CanvasRenderingContext2D;
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
  // WP-E1: Kontaktschatten-Ebenen sind ebenfalls Mesh-Kinder der Szene (sie
  // nutzen als einzige die PlaneGeometry) — für die Layout-Box-Assertions
  // dieser Suite zählen nur die Box-Meshes (geteilte Einheits-BoxGeometry).
  return scene.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && !(child.geometry instanceof THREE.PlaneGeometry),
  );
}

/** WP-E1: die Kontaktschatten-Ebenen (einzige PlaneGeometry-Meshes der Szene). */
function shadowPlanesOf(scene: THREE.Scene): THREE.Mesh[] {
  return scene.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
  );
}

function lineSegmentsOf(scene: THREE.Scene): THREE.LineSegments[] {
  return scene.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments);
}

beforeEach(() => {
  // Siehe Kommentar an `createFake2dContext` — ohne diesen Stub hätten die
  // WP-E1-Texturen in jsdom keinen 2D-Kontext.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    createFake2dContext()) as unknown as HTMLCanvasElement['getContext']);
});

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

    it('sollte nur für Boxen mit edges=true eine LineSegments-Kante anlegen (Hüllen und seit WP-E1 Grundstücke)', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });

      handle.applyLayout(layout);

      const edgedCount = layout.boxes.filter((b) => b.edges).length;
      expect(edgedCount).toBeGreaterThan(0);
      expect(lineSegmentsOf(scene)).toHaveLength(edgedCount);
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

  describe('setTheme (WP-C9/WP-E1)', () => {
    it('sollte Himmel-Textur und Fog-Farbe auf das gewählte Theme umstellen', () => {
      // WP-E1 (bewusste Visual-Contract-Änderung): der Hintergrund ist keine
      // flache Farbe mehr, sondern eine je Theme vorgebaute Himmel-Textur;
      // der Fog trägt den HORIZONT-Ton (nicht mehr die alte Flächenfarbe).
      // jsdom hat keine `dark`-Klasse -> Szene startet im Light-Theme.
      const { handle, scene } = createHandle();
      const lightBackground = scene.background;

      handle.setTheme('dark');
      expect(Object.is(scene.background, lightBackground)).toBe(false);

      // Fog trägt den Horizontton des aktiven Themes.
      handle.setFog(10, 20);
      expect((scene.fog as THREE.Fog).color.getHex()).toBe(THEME_PALETTES.dark.skyHorizon);

      // Zurück auf Light stellt Ausgangs-Textur und -ton wieder her (idempotent).
      handle.setTheme('light');
      expect(Object.is(scene.background, lightBackground)).toBe(true);
      expect((scene.fog as THREE.Fog).color.getHex()).toBe(THEME_PALETTES.light.skyHorizon);
    });

    it('sollte die Beleuchtungs-Intensität je Theme anpassen', () => {
      const { handle, scene } = createHandle();
      const dirLight = scene.children.find((c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight)!;
      handle.setTheme('light');
      const lightIntensity = dirLight.intensity;
      handle.setTheme('dark');
      expect(dirLight.intensity).not.toBe(lightIntensity);
    });
  });

  describe('Aufbau-Animationen (WP-C6)', () => {
    it('sollte OHNE setAnimationsEnabled(true) weiterhin sofort die Zielwerte setzen (Default-Verhalten unverändert)', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });

      handle.applyLayout(layout);

      const barBox = layout.boxes.find((b) => b.kind === 'bar')!;
      const barMesh = meshesOf(scene).find((m) => m.userData.id === barBox.id)!;
      expect(barMesh.scale.y).toBeCloseTo(barBox.size.y, 10);
      expect(barMesh.position.y).toBeCloseTo(barBox.center.y, 10);
      expect(handle.advanceAnimations(0)).toBe(false);
    });

    it('sollte einen neuen Balken bei aktiven Animationen fußpunkt-verankert von 0 auf die Zielhöhe wachsen lassen', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });

      handle.applyLayout(layout);

      const barBox = layout.boxes.find((b) => b.kind === 'bar')!;
      const barMesh = meshesOf(scene).find((m) => m.userData.id === barBox.id)!;
      // Fuß bleibt bei y=0 (GROUND_LEVEL, city-layout.ts): Höhe startet bei 0.
      expect(barMesh.scale.y).toBeCloseTo(0, 10);
      expect(barMesh.position.y).toBeCloseTo(0, 10);

      // Mitten im Tween: 0 < scale.y < Ziel, Fuß synchron (position.y ≈ scale.y / 2).
      expect(handle.advanceAnimations(1000)).toBe(true);
      expect(handle.advanceAnimations(1100)).toBe(true);
      expect(barMesh.scale.y).toBeGreaterThan(0);
      expect(barMesh.scale.y).toBeLessThan(barBox.size.y);
      expect(barMesh.position.y).toBeCloseTo(barMesh.scale.y / 2, 10);

      // Tween-Ende: exakte Zielwerte, Rückgabe `false` (kein Tween mehr aktiv).
      const stillAnimating = handle.advanceAnimations(1000 + 2000);
      expect(barMesh.scale.y).toBeCloseTo(barBox.size.y, 10);
      expect(barMesh.position.y).toBeCloseTo(barBox.size.y / 2, 10);
      expect(stillAnimating).toBe(false);
    });

    it('[REGRESSION] sollte einen Balken bei erneutem applyLayout mit unveränderter Höhe (Refetch/Re-Render) fußpunkt-verankert auf der Bodenplatte lassen (nicht zur Balkenmitte absinken)', () => {
      // Bug (Stadtansicht): bei aktiven Animationen setzte der `!needsTween`-
      // Zweig von `applyBoxHeight` die Mesh-Position (= Box-MITTE) fälschlich
      // auf den FUSSPUNKT (targetFoot). Ein zweites applyLayout mit gleicher
      // Höhe (Hintergrund-Refetch/äquivalentes Re-Render) ließ jeden Balken so
      // um die halbe Höhe unter die Bodenplatte sacken.
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });

      handle.applyLayout(layout);
      const barBox = layout.boxes.find((b) => b.kind === 'bar')!;
      const barMesh = meshesOf(scene).find((m) => m.userData.id === barBox.id)!;

      // Wachstums-Tween abschließen: Balken steht korrekt (Fuß auf y=0, Mitte bei size.y/2).
      handle.advanceAnimations(1000);
      handle.advanceAnimations(1000 + 2000);
      expect(barMesh.position.y).toBeCloseTo(barBox.center.y, 10);

      // Erneutes, geometrisch identisches Layout -> `!needsTween`-Zweig.
      const sameLayout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
      handle.applyLayout(sameLayout);

      // Der Balken darf NICHT absinken: Mitte bleibt bei size.y/2, Fuß bei 0.
      expect(barMesh.position.y).toBeCloseTo(barBox.center.y, 10);
      expect(barMesh.position.y - barMesh.scale.y / 2).toBeCloseTo(0, 10);
    });

    it('sollte bei setAnimationsEnabled(false) (reduced-motion) sofort Zielwerte setzen und laufende Tweens sofort auf ihr Ziel springen lassen', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
      handle.applyLayout(layout);

      const barBox = layout.boxes.find((b) => b.kind === 'bar')!;
      const barMesh = meshesOf(scene).find((m) => m.userData.id === barBox.id)!;
      expect(barMesh.scale.y).toBeCloseTo(0, 10); // Tween noch nicht getickt.

      // System schaltet mitten im Wachstum auf reduced-motion um: sofortiger Endzustand.
      handle.setAnimationsEnabled(false);
      expect(barMesh.scale.y).toBeCloseTo(barBox.size.y, 10);
      expect(barMesh.position.y).toBeCloseTo(barBox.center.y, 10);
      expect(handle.advanceAnimations(0)).toBe(false);

      // Ein NEUES applyLayout bei weiterhin deaktivierten Animationen bleibt Sofort-Verhalten.
      const districtLayout2 = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'leisure' });
      handle.applyLayout(districtLayout2);
      const anyBarBox2 = districtLayout2.boxes.find((b) => b.kind === 'bar')!;
      const anyBarMesh2 = meshesOf(scene).find((m) => m.userData.id === anyBarBox2.id)!;
      expect(anyBarMesh2.scale.y).toBeCloseTo(anyBarBox2.size.y, 10);
      expect(handle.advanceAnimations(0)).toBe(false);
    });

    it('sollte beim Opazitäts-Tween NICHT die geteilte Material-Instanz anderer Boxen mit demselben Schlüssel mitverändern (kein Material-Bleed)', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);

      const boxA: LayoutBox = {
        id: 'district-a',
        kind: 'hull',
        center: { x: 0, y: 1, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: '#336699',
        opacity: 0.2,
        edges: false,
        pickable: false,
      };
      const boxB: LayoutBox = { ...boxA, id: 'district-b', center: { x: 5, y: 1, z: 0 } };
      const initialLayout: CityLayout = { boxes: [boxA, boxB], center: { x: 0, y: 0, z: 0 }, boundingRadius: 5 };
      handle.applyLayout(initialLayout);

      const meshA = meshesOf(scene).find((m) => m.userData.id === 'district-a')!;
      const meshB = meshesOf(scene).find((m) => m.userData.id === 'district-b')!;
      // Vor der Animation: identischer Materialschlüssel (`color|opacity|bucket`) -> geteilte Instanz.
      expect(Object.is(meshA.material, meshB.material)).toBe(true);

      // NUR Box A ändert die Ziel-Opazität (Hüllen-Fade), Box B bleibt unverändert.
      const boxA2 = { ...boxA, opacity: 0.8 };
      handle.applyLayout({ boxes: [boxA2, boxB], center: { x: 0, y: 0, z: 0 }, boundingRadius: 5 });

      expect(Object.is(meshA.material, meshB.material)).toBe(false); // A hat jetzt eine eigene Klon-Instanz.
      expect((meshB.material as THREE.Material).opacity).toBeCloseTo(0.2, 10); // B unverändert.

      handle.advanceAnimations(1000);
      handle.advanceAnimations(1100); // mitten im Tween.
      expect((meshB.material as THREE.Material).opacity).toBeCloseTo(0.2, 10); // weiterhin kein Bleed.
      const midOpacityA = (meshA.material as THREE.Material).opacity;
      expect(midOpacityA).toBeGreaterThan(0.2);
      expect(midOpacityA).toBeLessThan(0.8);

      const stillAnimating = handle.advanceAnimations(1000 + 2000);
      expect((meshA.material as THREE.Material).opacity).toBeCloseTo(0.8, 10);
      expect((meshB.material as THREE.Material).opacity).toBeCloseTo(0.2, 10); // B am Ende unverändert.
      expect(stillAnimating).toBe(false);
    });

    it('sollte eine Hülle beim Ebenenwechsel (Fokus) zwischen den Opazitätsstufen faden, statt sofort zu springen', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);

      const cityLayout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(cityLayout);
      const hullMesh = meshesOf(scene).find((m) => m.userData.id === 'housing')!;
      const startOpacity = (hullMesh.material as THREE.Material).opacity;

      const focusedLayout = buildCityLayout(cityDemoModel, { level: 'city', focusDistrictId: 'housing' });
      handle.applyLayout(focusedLayout);
      const focusedHullBox = focusedLayout.boxes.find((b) => b.id === 'housing')!;
      expect(focusedHullBox.opacity).not.toBe(startOpacity); // Voraussetzung: Ebenenwechsel ändert die Ziel-Opazität wirklich.

      // Direkt nach applyLayout (vor dem ersten Tick) noch NICHT am Ziel — sonst wäre es ein Sprung, kein Fade.
      expect((hullMesh.material as THREE.Material).opacity).toBeCloseTo(startOpacity, 10);

      // Erster Tick definiert t=0 (noch kein sichtbarer Fortschritt, wie
      // `city-camera-controller.ts#tick`) — erst der ZWEITE Tick liegt
      // innerhalb des Tweens.
      expect(handle.advanceAnimations(2000)).toBe(true);
      expect(handle.advanceAnimations(2100)).toBe(true);
      const midOpacity = (hullMesh.material as THREE.Material).opacity;
      expect(midOpacity).not.toBeCloseTo(startOpacity, 2);

      expect(handle.advanceAnimations(2000 + 2000)).toBe(false);
      expect((hullMesh.material as THREE.Material).opacity).toBeCloseTo(focusedHullBox.opacity, 10);
    });
  });

  describe('Premium-Look (WP-D6)', () => {
    it('sollte filmisches ACES-Tone-Mapping mit angehobener Exposure am Renderer setzen (keine zusätzlichen Render-Passes)', () => {
      const { renderer } = createHandle();
      expect((renderer as unknown as { toneMapping: THREE.ToneMapping }).toneMapping).toBe(THREE.ACESFilmicToneMapping);
      expect((renderer as unknown as { toneMappingExposure: number }).toneMappingExposure).toBeGreaterThan(1);
    });

    it('sollte zusätzlich zum Hauptlicht ein Gegen-/Kantenlicht enthalten (zwei gerichtete Lichter, ohne Schatten)', () => {
      const { scene } = createHandle();
      const directionals = scene.children.filter(
        (c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight,
      );
      expect(directionals).toHaveLength(2);
      for (const light of directionals) {
        expect(light.castShadow).toBe(false); // Akku-/Render-on-Demand-Vorgabe: keine Schatten-Maps.
      }
    });

    it('sollte soliden Baukörpern ein dezentes Eigenleuchten in der EIGENEN Farbe geben (Emissive-Tint, kein weißes Glühen)', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' }));

      const barMesh = meshesOf(scene).find((m) => m.userData.kind === 'bar')!;
      const material = barMesh.material as THREE.MeshLambertMaterial;
      expect(material.emissiveIntensity).toBeGreaterThan(0);
      // Emissive == Grundfarbe (Tint), nicht Weiß — Weiß ist dem Hover-Highlight vorbehalten.
      expect(material.emissive.getHex()).toBe(material.color.getHex());
    });
  });

  describe('Himmel & Horizont (WP-E1)', () => {
    it('sollte den Szenen-Hintergrund als vertikale Himmel-Textur (CanvasTexture) statt einer flachen Farbe anlegen', () => {
      const { scene } = createHandle();
      expect(scene.background).toBeInstanceOf(THREE.CanvasTexture);
    });

    it('sollte je Theme eine eigene, vorgebaute Himmel-Textur bereithalten (setTheme tauscht nur die Referenz)', () => {
      // jsdom hat keine `dark`-Klasse -> Szene startet im Light-Theme.
      const { handle, scene } = createHandle();
      const lightSky = scene.background;
      expect(lightSky).toBeInstanceOf(THREE.CanvasTexture);

      handle.setTheme('dark');
      const darkSky = scene.background;
      expect(darkSky).toBeInstanceOf(THREE.CanvasTexture);
      expect(Object.is(darkSky, lightSky)).toBe(false);

      // Idempotent zurück — dieselbe Instanz, kein Neuaufbau.
      handle.setTheme('light');
      expect(Object.is(scene.background, lightSky)).toBe(true);
    });

    it('sollte Fog auf den Horizontton des aktiven Themes einfärben (Stadtrand löst sich in den Himmel auf)', () => {
      const { handle, scene } = createHandle();
      handle.setFog(10, 20);
      expect((scene.fog as THREE.Fog).color.getHex()).toBe(THEME_PALETTES.light.skyHorizon);
      handle.setTheme('dark');
      expect((scene.fog as THREE.Fog).color.getHex()).toBe(THEME_PALETTES.dark.skyHorizon);
    });

    it('sollte bei nicht-endlichen Fog-Werten weiterhin keinen Fog setzen (Off-Pfad unverändert)', () => {
      const { handle, scene } = createHandle();
      handle.setFog(10, 20);
      expect(scene.fog).not.toBeNull();
      handle.setFog(NaN, Infinity);
      expect(scene.fog).toBeNull();
    });

    it('sollte das Hauptlicht warm einfärben und das Gegenlicht kühl belassen (WP-E1)', () => {
      const { scene } = createHandle();
      const directionals = scene.children.filter(
        (c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight,
      );
      expect(directionals).toHaveLength(2);
      const [keyLight, rimLight] = directionals;
      expect(keyLight.color.getHex()).toBe(THEME_PALETTES.light.dirColor);
      // Bewusst KEIN neutrales Weiß mehr (warmes Key-Light), Rim bleibt kühl.
      expect(keyLight.color.getHex()).not.toBe(0xffffff);
      expect(rimLight.color.getHex()).toBe(0xbfd8ff);
    });
  });

  describe('Boden- & Fassaden-Texturen (WP-E1)', () => {
    it('sollte dem Boden-Material eine Straßen-Raster-Textur (map) geben — Grundstücke/Hüllen bleiben un-texturiert, Farbmapping bleibt 1:1', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      const groundMesh = meshesOf(scene).find((m) => m.userData.kind === 'ground')!;
      const groundMaterial = groundMesh.material as THREE.MeshLambertMaterial;
      expect(groundMaterial.map).toBeInstanceOf(THREE.CanvasTexture);
      // material.color trägt weiterhin exakt die Domain-Farbe (Textur multipliziert nur).
      const groundBox = layout.boxes.find((b) => b.kind === 'ground')!;
      expect(groundMaterial.color.getHexString()).toBe(groundBox.color.replace('#', ''));

      const plotMesh = meshesOf(scene).find((m) => m.userData.kind === 'plot')!;
      expect((plotMesh.material as THREE.MeshBasicMaterial).map).toBeNull();
      const hullMesh = meshesOf(scene).find((m) => m.userData.kind === 'hull')!;
      expect((hullMesh.material as THREE.MeshBasicMaterial).map).toBeNull();
    });

    it('sollte die Boden-Textur-Repeat an die Bodengröße koppeln (kleinere Ebene -> weniger Kacheln, gleiche Straßen-Dichte)', () => {
      const { handle, scene } = createHandle();
      const cityLayout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(cityLayout);
      const groundMesh = meshesOf(scene).find((m) => m.userData.kind === 'ground')!;
      const map = (groundMesh.material as THREE.MeshLambertMaterial).map!;
      const cityRepeatX = map.repeat.x;
      expect(cityRepeatX).toBeGreaterThanOrEqual(1);

      const districtLayout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
      handle.applyLayout(districtLayout);
      const districtGroundBox = districtLayout.boxes.find((b) => b.kind === 'ground')!;
      const cityGroundBox = cityLayout.boxes.find((b) => b.kind === 'ground')!;
      // Voraussetzung: der Boden der district-Ebene ist wirklich kleiner.
      expect(districtGroundBox.size.x).toBeLessThan(cityGroundBox.size.x);
      expect(map.repeat.x).toBeLessThan(cityRepeatX);
    });

    it('sollte bei setTheme NUR die Boden-Textur-Referenz tauschen (gleiche Material-Instanz, kein Registry-Neuaufbau)', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
      const groundMesh = meshesOf(scene).find((m) => m.userData.kind === 'ground')!;
      const materialBefore = groundMesh.material as THREE.MeshLambertMaterial;
      const lightMap = materialBefore.map;

      handle.setTheme('dark');
      const materialAfter = groundMesh.material as THREE.MeshLambertMaterial;
      expect(Object.is(materialAfter, materialBefore)).toBe(true);
      expect(Object.is(materialAfter.map, lightMap)).toBe(false);

      handle.setTheme('light');
      expect(Object.is((groundMesh.material as THREE.MeshLambertMaterial).map, lightMap)).toBe(true);
    });

    it('sollte allen soliden Baukörpern (Balken, Caps) über alle Distriktfarben hinweg dieselbe Fassaden-Textur-Instanz geben (Tint via material.color)', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));

      const solidMeshes = meshesOf(scene).filter((m) => m.userData.kind === 'bar' || m.userData.kind === 'cap');
      expect(solidMeshes.length).toBeGreaterThan(2);
      const materials = [...new Set(solidMeshes.map((m) => m.material as THREE.MeshLambertMaterial))];
      // Verschiedene Distriktfarben -> verschiedene Material-Instanzen (Registry-Sharing unverändert) ...
      expect(materials.length).toBeGreaterThan(1);
      // ... aber genau EINE geteilte Fassaden-Textur über alle Farben.
      const maps = new Set(materials.map((m) => m.map));
      expect(maps.size).toBe(1);
      expect(materials[0].map).toBeInstanceOf(THREE.CanvasTexture);
    });

    it('sollte auch Etagen mit derselben Fassaden-Textur-Instanz wie die Balken belegen', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(
        buildCityLayout(cityDemoModel, {
          level: 'subcategory',
          focusDistrictId: 'leisure',
          focusSubcategoryId: 'streaming',
        }),
      );

      const floorMaterials = meshesOf(scene)
        .filter((m) => m.userData.kind === 'floor')
        .map((m) => m.material as THREE.MeshLambertMaterial);
      expect(floorMaterials.length).toBeGreaterThan(1);
      for (const material of floorMaterials) {
        expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
      }
      const barMaterial = meshesOf(scene).find((m) => m.userData.kind === 'bar')!
        .material as THREE.MeshLambertMaterial;
      expect(Object.is(floorMaterials[0].map, barMaterial.map)).toBe(true);
    });
  });

  describe('Kontaktschatten (WP-E1)', () => {
    it('sollte je Grundstück und je Balkenfuß genau eine Schatten-Ebene anlegen (Hüllen/Caps/Boden ohne eigenen Schatten)', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      const expected = layout.boxes.filter((b) => b.kind === 'plot' || b.kind === 'bar').length;
      expect(expected).toBeGreaterThan(0);
      expect(shadowPlanesOf(scene)).toHaveLength(expected);
    });

    it('sollte die Schatten knapp ÜBER den Grundstücken staffeln (Plot-Schatten tiefer als Balken-Schatten), transparent und ohne depthWrite', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      const plotBox = layout.boxes.find((b) => b.kind === 'plot')!;
      const plotShadow = shadowPlanesOf(scene).find(
        (s) => s.position.x === plotBox.center.x && s.position.z === plotBox.center.z,
      )!;
      expect(plotShadow).toBeDefined();
      const barBox = layout.boxes.find((b) => b.kind === 'bar')!;
      const barShadow = shadowPlanesOf(scene).find(
        (s) => s.position.x === barBox.center.x && s.position.z === barBox.center.z,
      )!;
      expect(barShadow).toBeDefined();

      // Grundstücks-Oberkante liegt bei 0.05 (PLOT_THICKNESS, city-layout.ts).
      expect(plotShadow.position.y).toBeGreaterThan(0.05);
      expect(barShadow.position.y).toBeGreaterThan(plotShadow.position.y);

      // Weiche Ausdehnung: Plot-Schatten ~15 % größer als das Grundstück,
      // Balken-Schatten mit festem Margin um den Footprint.
      expect(plotShadow.scale.x).toBeCloseTo(plotBox.size.x * 1.15, 10);
      expect(barShadow.scale.x).toBeCloseTo(barBox.size.x + 0.5, 10);

      const material = plotShadow.material as THREE.MeshBasicMaterial;
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.map).toBeInstanceOf(THREE.CanvasTexture);

      // Zeichenreihenfolge zwischen Grundstück (0) und Balken (1).
      expect(plotShadow.renderOrder).toBeGreaterThan(0);
      expect(plotShadow.renderOrder).toBeLessThan(1);
    });

    it('sollte auf subcategory-Ebene nur EINEN Schatten je Etagen-Stapel anlegen (unterste Etage), nicht je Etage', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });
      handle.applyLayout(layout);

      const plots = layout.boxes.filter((b) => b.kind === 'plot').length; // 1
      const bars = layout.boxes.filter((b) => b.kind === 'bar').length; // 4 gedimmte Nachbarn
      const floorStacks = 1; // der aufgelöste streaming-Stapel = genau 1 Schatten
      expect(shadowPlanesOf(scene)).toHaveLength(plots + bars + floorStacks);
    });

    it('sollte Schatten-Ebenen beim Ebenenwechsel mit ihren Boxen entsorgen (Diff-Lebenszyklus)', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
      expect(shadowPlanesOf(scene).length).toBeGreaterThan(0);

      const districtLayout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'leisure' });
      handle.applyLayout(districtLayout);
      const expected = districtLayout.boxes.filter((b) => b.kind === 'plot' || b.kind === 'bar').length;
      expect(shadowPlanesOf(scene)).toHaveLength(expected);
    });

    it('sollte geteilte Schatten-/Textur-Ressourcen bei dispose() aufräumen und alle Ebenen aus der Szene entfernen', () => {
      const planeDisposeSpy = vi.spyOn(THREE.PlaneGeometry.prototype, 'dispose');
      const textureDisposeSpy = vi.spyOn(THREE.Texture.prototype, 'dispose');
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
      expect(shadowPlanesOf(scene).length).toBeGreaterThan(0);

      handle.dispose();

      expect(shadowPlanesOf(scene)).toHaveLength(0);
      expect(planeDisposeSpy).toHaveBeenCalledTimes(1);
      // Himmel (2) + Boden (2) + Fassade (1) + Kontaktschatten (1) = 6 CanvasTexturen.
      expect(textureDisposeSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe('Setback-Caps in der Szene (WP-E1)', () => {
    it('sollte Caps als solide, nicht-pickbare Lambert-Meshes mit Balken-Zeichenreihenfolge und geteilter Fassaden-Textur abbilden', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));

      const capMesh = meshesOf(scene).find((m) => m.userData.id === 'housing/rent:cap');
      expect(capMesh).toBeDefined();
      expect(capMesh!.userData.kind).toBe('cap');
      expect(capMesh!.userData.pickable).toBe(false);

      const barMesh = meshesOf(scene).find((m) => m.userData.id === 'housing/rent')!;
      expect(capMesh!.renderOrder).toBe(barMesh.renderOrder);

      const capMaterial = capMesh!.material as THREE.MeshLambertMaterial;
      expect(capMaterial).toBeInstanceOf(THREE.MeshLambertMaterial);
      const barMaterial = barMesh.material as THREE.MeshLambertMaterial;
      expect(Object.is(capMaterial.map, barMaterial.map)).toBe(true);
      // Eigene Material-Instanz (abgedunkelte Cap-Farbe), aber geteilte Textur.
      expect(Object.is(capMaterial, barMaterial)).toBe(false);
    });

    it('sollte Caps in das Höhen-Wachstums-Tween einbeziehen (Fußpunkt auf der Balken-Oberkante)', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      const capBox = layout.boxes.find((b) => b.id === 'housing/rent:cap')!;
      const barBox = layout.boxes.find((b) => b.id === 'housing/rent')!;
      const capMesh = meshesOf(scene).find((m) => m.userData.id === 'housing/rent:cap')!;

      // Vor dem ersten Tick: Höhe 0, Fuß auf der Balken-Oberkante.
      expect(capMesh.scale.y).toBeCloseTo(0, 10);
      const barTop = barBox.center.y + barBox.size.y / 2;
      expect(capMesh.position.y).toBeCloseTo(barTop, 10);

      // Nach Abschluss aller Tweens: volle Höhe, Mitte auf Ziel.
      handle.advanceAnimations(1000);
      expect(handle.advanceAnimations(5000)).toBe(false);
      expect(capMesh.scale.y).toBeCloseTo(capBox.size.y, 10);
      expect(capMesh.position.y).toBeCloseTo(capBox.center.y, 10);
    });
  });

  describe('Staffel-Kaskade des Aufbaus (WP-E1)', () => {
    it('sollte Höhen-Tweens gestaffelt starten (jeder weitere Baukörper wächst einen Staffelschritt später)', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
      handle.applyLayout(layout);

      const meshOf = (id: string) => meshesOf(scene).find((m) => m.userData.id === id)!;

      // Erster Tick definiert die Startzeitpunkte (Reihenfolge = Layout-
      // Reihenfolge: rent, rent:cap, utilities, insurance, furniture).
      expect(handle.advanceAnimations(1000)).toBe(true);
      // rent (Index 0) startet sofort; utilities (Index 2) und furniture
      // (Index 4) stehen 100 ms nach dem Basistick noch bei Höhe 0.
      expect(handle.advanceAnimations(1100)).toBe(true);
      expect(meshOf('housing/rent').scale.y).toBeGreaterThan(0);
      expect(meshOf('housing/utilities').scale.y).toBe(0);
      expect(meshOf('housing/furniture').scale.y).toBe(0);

      // Weitere 100 ms: Cap (Index 1) und utilities (Index 2) wachsen bereits,
      // furniture (Index 4 -> Start genau jetzt) noch nicht.
      expect(handle.advanceAnimations(1200)).toBe(true);
      expect(meshOf('housing/rent:cap').scale.y).toBeGreaterThan(0);
      expect(meshOf('housing/utilities').scale.y).toBeGreaterThan(0);
      expect(meshOf('housing/furniture').scale.y).toBe(0);

      // Nach genügend Zeit: alle exakt am Ziel, kein Tween mehr aktiv.
      expect(handle.advanceAnimations(3000)).toBe(false);
      for (const box of layout.boxes.filter((b) => b.kind === 'bar' || b.kind === 'cap')) {
        expect(meshOf(box.id).scale.y).toBeCloseTo(box.size.y, 10);
        expect(meshOf(box.id).position.y).toBeCloseTo(box.center.y, 10);
      }
    });

    it('sollte bei deaktivierten Animationen (reduced-motion) weiterhin alles sofort setzen — die Staffelung greift nie im Sofort-Pfad', () => {
      const { handle, scene } = createHandle();
      const layout = buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' });
      handle.applyLayout(layout);

      for (const box of layout.boxes.filter((b) => b.kind === 'bar' || b.kind === 'cap')) {
        const mesh = meshesOf(scene).find((m) => m.userData.id === box.id)!;
        expect(mesh.scale.y).toBeCloseTo(box.size.y, 10);
        expect(mesh.position.y).toBeCloseTo(box.center.y, 10);
      }
      expect(handle.advanceAnimations(0)).toBe(false);
    });
  });

  describe('setHighlight (WP-D3, Hover-Kopplung)', () => {
    it('sollte einen Lambert-Baukörper mit eigener Klon-Instanz (Emissive) hervorheben und bei null die geteilte Instanz wiederherstellen', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' }));

      const barMesh = meshesOf(scene).find((m) => m.userData.kind === 'bar')!;
      const sharedMaterial = barMesh.material as THREE.Material;

      handle.setHighlight(barMesh.userData.id as string);
      const highlighted = barMesh.material as THREE.MeshLambertMaterial;
      // EIGENE Instanz (Invariante 2: geteilte Registry-Instanz nie mutieren) …
      expect(Object.is(highlighted, sharedMaterial)).toBe(false);
      // … mit dezentem Glühen.
      expect(highlighted.emissiveIntensity).toBeGreaterThan(0);
      // Die geteilte Instanz selbst bleibt unangetastet.
      expect((sharedMaterial as THREE.MeshLambertMaterial).emissiveIntensity ?? 1).not.toBe(highlighted.emissiveIntensity);

      handle.setHighlight(null);
      expect(Object.is(barMesh.material, sharedMaterial)).toBe(true);
    });

    it('sollte eine transparente Hülle über einen Opazitäts-Schub hervorheben (kein Emissive auf MeshBasicMaterial)', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));

      const hullMesh = meshesOf(scene).find((m) => m.userData.kind === 'hull')!;
      const baseOpacity = (hullMesh.material as THREE.Material).opacity;

      handle.setHighlight(hullMesh.userData.id as string);
      expect((hullMesh.material as THREE.Material).opacity).toBeGreaterThan(baseOpacity);

      handle.setHighlight(null);
      expect((hullMesh.material as THREE.Material).opacity).toBeCloseTo(baseOpacity, 10);
    });

    it('sollte beim Wechsel des Highlights die vorherige Box zurücksetzen und unbekannte Ids still ignorieren', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'housing' }));

      const meshes = meshesOf(scene).filter((m) => m.userData.kind === 'bar');
      const [first, second] = meshes;
      const firstShared = first.material as THREE.Material;
      const secondShared = second.material as THREE.Material;

      handle.setHighlight(first.userData.id as string);
      handle.setHighlight(second.userData.id as string);
      // Erste Box wieder auf der geteilten Instanz, zweite hervorgehoben (Klon).
      expect(Object.is(first.material, firstShared)).toBe(true);
      expect(Object.is(second.material, secondShared)).toBe(false);

      expect(() => handle.setHighlight('gibt-es-nicht')).not.toThrow();
      // Unbekannte Id hebt das vorherige Highlight auf (zurück zur geteilten Instanz).
      expect(Object.is(second.material, secondShared)).toBe(true);
    });

    it('sollte ein Highlight auf einer beim Ebenenwechsel entsorgten Box aufheben, ohne abzustürzen', () => {
      const { handle, scene } = createHandle();
      handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'city' }));
      const hullMesh = meshesOf(scene).find((m) => m.userData.kind === 'hull')!;
      handle.setHighlight(hullMesh.userData.id as string);

      // Ebenenwechsel: die Stadt-Hülle verschwindet aus dem Layout.
      expect(() =>
        handle.applyLayout(buildCityLayout(cityDemoModel, { level: 'district', focusDistrictId: 'leisure' })),
      ).not.toThrow();
      expect(() => handle.setHighlight(null)).not.toThrow();
    });
  });

  it('sollte createCityScene ohne createRenderer-Option nicht direkt aufgerufen werden müssen — TypeScript-Vertragstest via Handle-Form', () => {
    // Reiner Struktur-Check: alle laut CitySceneHandle geforderten Mitglieder existieren.
    const { handle } = createHandle();
    const required: (keyof CitySceneHandle)[] = [
      'applyLayout',
      'advanceAnimations',
      'setAnimationsEnabled',
      'pick',
      'setHighlight',
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

  describe('Atmosphäre-Preset (WP-4.3)', () => {
    it('sollte setAtmospherePreset auf dem Handle verfügbar haben', () => {
      const { handle } = createHandle();
      expect(typeof handle.setAtmospherePreset).toBe('function');
    });

    it('sollte nach setAtmospherePreset("risk") advanceAnimations true liefern (Animation läuft)', () => {
      const { handle } = createHandle();
      handle.setAnimationsEnabled(true);
      handle.setAtmospherePreset('risk');

      // Erster Tick: definiert Startzeit, Tween läuft → true
      expect(handle.advanceAnimations(1000)).toBe(true);

      // Nach ausreichend Zeit: Tween abgeschlossen → false
      expect(handle.advanceAnimations(5000)).toBe(false);
    });

    it('sollte bei "risk" die Lichtintensität subtil verringern (≤ 5%)', () => {
      const { handle } = createHandle();
      handle.setAnimationsEnabled(true);
      const scene = handle.camera.parent as THREE.Scene;
      const hemiLight = scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight;

      const baseIntensity = hemiLight.intensity;
      handle.setAtmospherePreset('risk');
      // Animation abschließen
      handle.advanceAnimations(1000);
      handle.advanceAnimations(5000);

      // Intensität sollte leicht verringert sein
      expect(hemiLight.intensity).toBeLessThan(baseIntensity);
      // Aber nicht drastisch (≤ 5% Abweichung)
      const deviation = Math.abs(hemiLight.intensity - baseIntensity) / baseIntensity;
      expect(deviation).toBeLessThanOrEqual(0.05);
    });

    it('sollte bei "stable" die Lichtintensität subtil erhöhen (≤ 5%)', () => {
      const { handle } = createHandle();
      handle.setAnimationsEnabled(true);
      const scene = handle.camera.parent as THREE.Scene;
      const hemiLight = scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight;

      const baseIntensity = hemiLight.intensity;
      handle.setAtmospherePreset('stable');
      handle.advanceAnimations(1000);
      handle.advanceAnimations(5000);

      expect(hemiLight.intensity).toBeGreaterThan(baseIntensity);
      const deviation = Math.abs(hemiLight.intensity - baseIntensity) / baseIntensity;
      expect(deviation).toBeLessThanOrEqual(0.05);
    });

    it('sollte bei "neutral" die Standard-Intensität beibehalten', () => {
      const { handle } = createHandle();
      handle.setAnimationsEnabled(true);
      const scene = handle.camera.parent as THREE.Scene;
      const hemiLight = scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight;

      const baseIntensity = hemiLight.intensity;
      handle.setAtmospherePreset('neutral');
      handle.advanceAnimations(1000);
      handle.advanceAnimations(5000);

      expect(hemiLight.intensity).toBeCloseTo(baseIntensity, 5);
    });

    it('[VB-2] sollte die Geometrie nicht verändern', () => {
      const { handle, scene } = createHandle();
      handle.setAnimationsEnabled(true);
      const layout = buildCityLayout(cityDemoModel, { level: 'city' });
      handle.applyLayout(layout);

      // Positionen/Höhen vor dem Preset-Wechsel
      const bars = meshesOf(scene).filter((m) => m.userData.kind === 'bar');
      const positionsBefore = bars.map((m) => ({ x: m.position.x, y: m.position.y, z: m.position.z, sy: m.scale.y }));

      handle.setAtmospherePreset('risk');
      handle.advanceAnimations(5000);

      const positionsAfter = bars.map((m) => ({ x: m.position.x, y: m.position.y, z: m.position.z, sy: m.scale.y }));
      expect(positionsAfter).toEqual(positionsBefore);
    });

    it('sollte bei deaktivierten Animationen sofort angewendet werden (reduced-motion)', () => {
      const { handle } = createHandle();
      // animationsEnabled bleibt false (default)
      const scene = handle.camera.parent as THREE.Scene;
      const hemiLight = scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight;

      const baseIntensity = hemiLight.intensity;
      handle.setAtmospherePreset('risk');

      // Ohne advanceAnimations-Aufruf sollte die Intensität sofort angepasst sein
      expect(hemiLight.intensity).toBeLessThan(baseIntensity);
      expect(handle.advanceAnimations(0)).toBe(false);
    });
  });
});
