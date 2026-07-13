/**
 * Imperativer three.js-Szenengraph der Finanzstadt (WP-C3). Reine
 * Fabrikfunktion + Handle-Objekt, KEIN React — der Lifecycle wird komplett
 * von `CityCanvas.tsx` (ein einziger `useEffect`) verwaltet, nicht vom
 * React-Renderzyklus (README-Architekturtabelle, `presentation/`-Zeile).
 *
 * Liest AUSSCHLIESSLICH `LayoutBox[]` aus `domain/city-layout.ts#buildCityLayout`
 * — hier wird KEINE Geometrie-Entscheidung neu getroffen, nur auf three.js-
 * Primitive abgebildet (Position/Skalierung/Farbe/Opazität/Pickability kommen
 * 1:1 aus der Box).
 */

import * as THREE from 'three';
import type { CityLayout, LayoutBox, LayoutBoxKind } from '../domain/city-layout';
import type { Vec3 } from '../domain/city-model';

export type CityCameraPose = { position: Vec3; target: Vec3 };

export type CitySceneHandle = {
  /** Diff-arm: Meshes nach `box.id` wiederverwenden (Position/Scale/Material-Update), neue anlegen, fehlende entsorgen. */
  applyLayout(layout: CityLayout): void;
  /** Raycast auf pickable Boxen → `box.id`, oder `null` bei Boden/Leere. */
  pick(clientX: number, clientY: number): string | null;
  setSize(width: number, height: number, dpr: number): void;
  /** Erst ab WP-C4 mit echten Werten befüllt — hier no-op-fähig (near/far nicht endlich → Fog aus). */
  setFog(near: number, far: number): void;
  render(): void;
  /** Räumt ALLES auf: geteilte Geometrien, Material-/Edge-Material-Registry, Renderer. */
  dispose(): void;
  /**
   * WP-C4-Andockpunkt: setzt Kamera-Position + Orbit-Target direkt (kein
   * Easing/Flug — das übernimmt der Kamera-Controller in WP-C4). `CityCanvas`
   * nutzt das nur für die statische Startpose (WP-C3); C4 ruft dieselbe
   * Methode pro Animationsframe mit interpolierten Werten auf, ohne
   * `CityCanvas.tsx` anzufassen.
   */
  applyCameraPose(pose: CityCameraPose): void;
  /**
   * Live-Referenz auf das aktuelle Orbit-Target (von `applyCameraPose`
   * mutiert, NICHT neu zugewiesen). `CityCanvas` bindet `OrbitControls.target`
   * an dieselbe Instanz, damit Controls und Szene nie auseinanderlaufen.
   */
  readonly target: THREE.Vector3;
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLCanvasElement;
};

export type CreateCitySceneOptions = {
  canvas: HTMLCanvasElement;
  /** Tests injizieren einen Fake-Renderer (setSize/render/dispose/domElement-Stubs), damit der Szenengraph ohne echten WebGL-Kontext (jsdom) testbar bleibt. */
  createRenderer?: (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;
};

/** Vertikales FOV der Stadt-Kamera — von `CityCanvas`/`CityPage` für `fitCameraDistance` wiederverwendet, damit Kamera-FOV und Distanz-Mathematik nie auseinanderlaufen. */
export const CAMERA_FOV_Y_DEG = 50;

/**
 * Hintergrundfarbe: fester neutraler Ton passend zum Dark-Theme der App
 * (`src/index.css`, `.dark { --background: 190 22% 8%; }` → als Hex). Die
 * Domain-/Presentation-Schicht hat keinen Zugriff auf CSS-Variablen (three.js
 * rendert außerhalb des DOM-Stylesheet-Kontexts) — deshalb ein bewusst
 * dokumentierter fester Wert statt eines Theming-Mechanismus.
 */
const BACKGROUND_COLOR = 0x101719;

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

/** Dezente Kanten-Opazität für Hüllen-Wireframes (Kamera-Regel-neutral, reiner Stil-Wert). */
const EDGE_OPACITY = 0.35;

/**
 * Zwei Material-„Buckets": undurchsichtige Baukörper (Balken/Etagen/Boden)
 * nutzen `MeshLambertMaterial` (reagiert auf Licht, `flatShading` bewusst
 * NICHT gesetzt = glatte Flächen), Hüllen/Grundstücke sind `MeshBasicMaterial`
 * mit `transparent`+`depthWrite=false` (Balken dahinter bleiben sichtbar).
 */
function materialBucketFor(kind: LayoutBoxKind): 'solid' | 'transparent' {
  return kind === 'hull' || kind === 'plot' ? 'transparent' : 'solid';
}

/**
 * Zeichenreihenfolge: Boden zuerst, dann Grundstücke, dann Balken/Etagen,
 * Hüllen zuletzt ("Hüllen NACH Balken" — sonst würde die transparente Hülle
 * Balken dahinter beim Alpha-Blending verdecken können).
 */
function renderOrderFor(kind: LayoutBoxKind): number {
  switch (kind) {
    case 'ground':
      return -1;
    case 'plot':
      return 0;
    case 'bar':
    case 'floor':
      return 1;
    case 'hull':
      return 2;
    default:
      return 0;
  }
}

export function createCityScene(opts: CreateCitySceneOptions): CitySceneHandle {
  const { canvas } = opts;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_Y_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 10, 16);
  const target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);
  // Kamera als Szenen-Kind: nicht renderrelevant (`renderer.render(scene,
  // camera)` funktioniert unabhängig von der Parent-Beziehung), gibt Tests
  // aber über `camera.parent` einen Weg, den Szenengraphen zu inspizieren,
  // ohne eine zusätzliche Debug-only-API auf `CitySceneHandle` zu brauchen.
  scene.add(camera);

  // Kein Schatten (README/Akzeptanzkriterium: Render-on-Demand + Mobil-Akku
  // — Schatten-Maps kosten zusätzliche Passes, die hier nicht nötig sind).
  const hemisphereLight = new THREE.HemisphereLight(0xdfe8ea, 0x14181b, 1.15);
  scene.add(hemisphereLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(8, 14, 6);
  scene.add(directionalLight);

  // DPR bei Renderer-Erstellung: Antialiasing nur, wenn der (gedeckelte)
  // Device-Pixel-Ratio niedrig genug ist (hohe DPR + MSAA verdoppelt die
  // Fragment-Last unnötig, das eigentliche Downsampling durch die Pixeldichte
  // übernimmt dort schon einen Teil der Kantenglättung).
  const initialDpr =
    typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
      ? Math.min(window.devicePixelRatio, 2)
      : 1;
  const renderer =
    opts.createRenderer?.(canvas) ??
    new THREE.WebGLRenderer({
      canvas,
      antialias: initialDpr <= 1.5,
      alpha: false,
      // 'high-performance': die Stadt ist eine dedizierte 3D-Vollflächen-
      // Ansicht — auf Dual-GPU-Geräten soll der schnelle Chip ran. Den
      // Akku schont bereits der Render-on-Demand-Loop (CityCanvas.tsx),
      // nicht die GPU-Wahl.
      powerPreference: 'high-performance',
    });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // EINE geteilte Box-Geometrie für ALLE Boxen (Balken/Etagen/Hüllen/
  // Grundstücke/Boden) — Größe kommt ausschließlich über `mesh.scale`
  // (LayoutBox.size), Position über `mesh.position` (LayoutBox.center).
  const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sharedEdgesGeometry = new THREE.EdgesGeometry(sharedBoxGeometry);

  const materialRegistry = new Map<string, THREE.Material>();
  const edgeMaterialRegistry = new Map<string, THREE.LineBasicMaterial>();
  const meshesById = new Map<string, THREE.Mesh>();
  const edgesById = new Map<string, THREE.LineSegments>();

  function getMaterial(box: LayoutBox): THREE.Material {
    const bucket = materialBucketFor(box.kind);
    const key = `${box.color}|${box.opacity}|${bucket}`;
    const cached = materialRegistry.get(key);
    if (cached) return cached;

    const material: THREE.Material =
      bucket === 'transparent'
        ? new THREE.MeshBasicMaterial({
            color: box.color,
            transparent: true,
            opacity: box.opacity,
            depthWrite: false, // Balken hinter einer Hülle/über einem Grundstück bleiben sichtbar.
          })
        : new THREE.MeshLambertMaterial({
            color: box.color,
            transparent: box.opacity < 1,
            opacity: box.opacity,
          });

    materialRegistry.set(key, material);
    return material;
  }

  function getEdgeMaterial(color: string): THREE.LineBasicMaterial {
    const cached = edgeMaterialRegistry.get(color);
    if (cached) return cached;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: EDGE_OPACITY });
    edgeMaterialRegistry.set(color, material);
    return material;
  }

  function applyLayout(layout: CityLayout): void {
    const seenIds = new Set<string>();

    for (const box of layout.boxes) {
      seenIds.add(box.id);

      let mesh = meshesById.get(box.id);
      if (!mesh) {
        mesh = new THREE.Mesh(sharedBoxGeometry, getMaterial(box));
        mesh.userData.id = box.id;
        scene.add(mesh);
        meshesById.set(box.id, mesh);
      } else {
        mesh.material = getMaterial(box);
      }

      mesh.position.set(box.center.x, box.center.y, box.center.z);
      mesh.scale.set(box.size.x, box.size.y, box.size.z);
      mesh.userData.pickable = box.pickable;
      mesh.userData.kind = box.kind;
      mesh.renderOrder = renderOrderFor(box.kind);
      // Degenerierte Nullbox (Distrikt ohne Unterkategorien, city-layout.ts
      // `buildHullBox`-Fallback) hat size 0 in jeder Achse — nicht rendern
      // statt eine unsichtbare, aber pickbare 0x0x0-Box im Raycast zu lassen.
      mesh.visible = box.size.x > 0 && box.size.y > 0 && box.size.z > 0;

      let edgeLine = edgesById.get(box.id);
      if (box.edges) {
        if (!edgeLine) {
          edgeLine = new THREE.LineSegments(sharedEdgesGeometry, getEdgeMaterial(box.color));
          scene.add(edgeLine);
          edgesById.set(box.id, edgeLine);
        } else {
          edgeLine.material = getEdgeMaterial(box.color);
        }
        edgeLine.position.copy(mesh.position);
        edgeLine.scale.copy(mesh.scale);
        edgeLine.visible = mesh.visible;
        edgeLine.renderOrder = renderOrderFor(box.kind);
      } else if (edgeLine) {
        scene.remove(edgeLine);
        edgesById.delete(box.id);
      }
    }

    // Entsorgung: Meshes/Edges, deren id in diesem Layout nicht mehr
    // vorkommt (Ebenenwechsel), aus der Szene entfernen. Materialien/
    // Geometrien bleiben in der Registry (könnten von einer anderen id
    // wiederverwendet werden) — vollständig geräumt wird nur in `dispose()`.
    for (const [id, mesh] of meshesById) {
      if (seenIds.has(id)) continue;
      scene.remove(mesh);
      meshesById.delete(id);
      const edgeLine = edgesById.get(id);
      if (edgeLine) {
        scene.remove(edgeLine);
        edgesById.delete(id);
      }
    }
  }

  function pick(clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);

    const pickableMeshes: THREE.Mesh[] = [];
    for (const mesh of meshesById.values()) {
      if (mesh.visible && mesh.userData.pickable) pickableMeshes.push(mesh);
    }
    if (pickableMeshes.length === 0) return null;

    const hits = raycaster.intersectObjects(pickableMeshes, false);
    if (hits.length === 0) return null;

    const id = hits[0].object.userData.id;
    return typeof id === 'string' ? id : null;
  }

  function setSize(width: number, height: number, dpr: number): void {
    if (width <= 0 || height <= 0) return; // ResizeObserver kann während Layout-Übergängen kurzzeitig 0 liefern.
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false); // false: kein CSS-Style-Override — der Container steuert die Canvas-Größe.
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setFog(near: number, far: number): void {
    // WP-C4 konfiguriert Fog passend zur jeweiligen Ebene. Nicht-endliche
    // Werte (NaN/Infinity) schalten Fog aus — no-op-fähig, wie gefordert.
    if (!Number.isFinite(near) || !Number.isFinite(far)) {
      scene.fog = null;
      return;
    }
    scene.fog = new THREE.Fog(BACKGROUND_COLOR, near, far);
  }

  function render(): void {
    renderer.render(scene, camera);
  }

  function applyCameraPose(pose: CityCameraPose): void {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    target.set(pose.target.x, pose.target.y, pose.target.z);
    camera.lookAt(target);
  }

  function dispose(): void {
    for (const mesh of meshesById.values()) scene.remove(mesh);
    meshesById.clear();
    for (const edgeLine of edgesById.values()) scene.remove(edgeLine);
    edgesById.clear();

    sharedBoxGeometry.dispose();
    sharedEdgesGeometry.dispose();

    for (const material of materialRegistry.values()) material.dispose();
    materialRegistry.clear();
    for (const material of edgeMaterialRegistry.values()) material.dispose();
    edgeMaterialRegistry.clear();

    renderer.dispose();
  }

  return {
    applyLayout,
    pick,
    setSize,
    setFog,
    render,
    dispose,
    applyCameraPose,
    target,
    camera,
    domElement: canvas,
  };
}
