import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { createCityScene, type CitySceneHandle } from '../city-scene';
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

  describe('setTheme (WP-C9)', () => {
    it('sollte Hintergrund und Fog-Farbe auf das gewählte Theme umstellen', () => {
      // jsdom hat keine `dark`-Klasse -> Szene startet im Light-Theme.
      const { handle, scene } = createHandle();
      const lightBg = (scene.background as THREE.Color).getHex();

      handle.setTheme('dark');
      const darkBg = (scene.background as THREE.Color).getHex();
      expect(darkBg).not.toBe(lightBg);

      // Fog trägt die Hintergrundfarbe des aktiven Themes.
      handle.setFog(10, 20);
      expect((scene.fog as THREE.Fog).color.getHex()).toBe(darkBg);

      // Zurück auf Light stellt den Ausgangston wieder her (idempotent).
      handle.setTheme('light');
      expect((scene.background as THREE.Color).getHex()).toBe(lightBg);
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
});
