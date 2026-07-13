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
 *
 * WP-C6 (Aufbau-Animationen): `applyLayout` setzt die Ziel-Transform/Opazität
 * NICHT mehr zwingend sofort, sondern startet (wenn `setAnimationsEnabled(true)`,
 * Default `false`) pro Box einen IST→ZIEL-Tween, den `advanceAnimations(nowMs)`
 * pro Frame fortschreibt — getickt vom BESTEHENDEN Render-Loop in
 * `CityCanvas.tsx` (Single-rAF-Invariante, siehe dortiger Kommentar), kein
 * eigener Timer. Zwei Tween-Arten: Höhen-Wachstum (`bar`/`floor`, fußpunkt-
 * verankert über `scale.y`/`position.y`) und Opazitäts-Fade (alle Kinds,
 * IMMER über eine PRO-MESH-Materialklon-Instanz — die geteilte
 * `materialRegistry`-Instanz darf während eines Tweens nie mutiert werden,
 * sonst faden alle anderen Boxen mit demselben `${color}|${opacity}|${bucket}`-
 * Schlüssel unbeabsichtigt mit).
 */

import * as THREE from 'three';
import type { CityLayout, LayoutBox, LayoutBoxKind } from '../domain/city-layout';
import type { Vec3 } from '../domain/city-model';
import { easeInOutCubic } from '../domain/camera-math';

export type CityCameraPose = { position: Vec3; target: Vec3 };

export type CitySceneHandle = {
  /**
   * Diff-arm: Meshes nach `box.id` wiederverwenden (Position/Scale/Material-
   * Update), neue anlegen, fehlende entsorgen. WP-C6: wenn Animationen aktiv
   * sind (`setAnimationsEnabled(true)`), wird die Ziel-Transform/-Opazität
   * NICHT sofort gesetzt, sondern ein Tween gestartet (IST → hier übergebenes
   * ZIEL) — `advanceAnimations` schreibt ihn fort. Bei deaktivierten
   * Animationen unverändert das bisherige Sofort-Verhalten.
   */
  applyLayout(layout: CityLayout): void;
  /**
   * WP-C6: vom BESTEHENDEN Render-Loop (`CityCanvas.tsx#tick`) pro Frame mit
   * injizierter Zeit aufgerufen (kein `Date.now()` hier, analog
   * `city-camera-controller.ts#tick`) — KEIN zweiter `requestAnimationFrame`/
   * `setInterval` (Single-rAF-Invariante). Interpoliert alle laufenden Höhen-
   * und Opazitäts-Tweens mit `easeInOutCubic` und wendet sie auf die Meshes
   * an. Liefert `true`, solange mindestens ein Tween noch läuft (Aufrufer
   * ORt das in `changed`/hält den Loop wach), sonst `false`. Der erste Aufruf
   * NACH dem Start eines Tweens definiert dessen `t=0` (Tween-lokal, nicht
   * global — mehrere zeitlich versetzt gestartete Tweens laufen unabhängig).
   */
  advanceAnimations(nowMs: number): boolean;
  /**
   * WP-C6: `false` (Default) = Sofort-Endzustand bei `applyLayout` (kein
   * Tween, `prefers-reduced-motion`). `true` = künftige `applyLayout`-Aufrufe
   * starten Tweens. Beim Umschalten auf `false` werden alle GERADE laufenden
   * Tweens sofort auf ihren Zielwert gesprungen (Mesh-Transform/-Opazität)
   * und die zugehörigen Klon-Materialien entsorgt — kein "eingefrorener"
   * Zwischenzustand.
   */
  setAnimationsEnabled(enabled: boolean): void;
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

  // --- WP-C6: Aufbau-Animationen ------------------------------------------
  // Default `false`: bewusst dasselbe Sofort-Verhalten wie vor WP-C6, bis
  // `CityCanvas` explizit `setAnimationsEnabled(!reducedMotion)` aufruft
  // (Mount-Reihenfolge dokumentiert dort) — hält alle bestehenden
  // `city-scene.test.ts`-Erwartungen (Sofort-Werte nach `applyLayout`) ohne
  // Änderung gültig.
  let animationsEnabled = false;

  /** Balken-/Etagen-Wachstum: `scale.y`/`position.y` fußpunkt-verankert. */
  const BAR_GROWTH_DURATION_MS = 500;
  /** Opazitäts-Fade (Hüllen-Ebenenwechsel, Balken-Opazitätsstufen etc.). */
  const OPACITY_FADE_DURATION_MS = 400;

  type HeightTween = {
    /** `null` = noch nicht getickt — der ERSTE `advanceAnimations`-Aufruf danach definiert `t=0` (wie `city-camera-controller.ts#tick`). */
    startMs: number | null;
    durationMs: number;
    fromHeight: number;
    toHeight: number;
    /** Fixer Ziel-Fußpunkt (`box.center.y - box.size.y / 2`) — bei einem Balken auf Bodenebene ist das exakt 0 ("Fuß bleibt bei y=0"), bei einer Etage die kumulierte Stapelhöhe darunter. NICHT selbst interpoliert (Scope-Cut, siehe Report): ändert sich der Fußpunkt zwischen zwei Layouts ausnahmsweise (z. B. Etagen-Reihenfolge), springt die Box beim Tween-Start auf den neuen Fuß. */
    foot: number;
  };
  const heightTweensById = new Map<string, HeightTween>();

  type OpacityTween = {
    startMs: number | null;
    durationMs: number;
    fromOpacity: number;
    toOpacity: number;
    /** EIGENE Klon-Instanz für die Tween-Dauer (Invariante 2: NIE die geteilte `materialRegistry`-Instanz mutieren — sonst faden alle Boxen mit demselben `${color}|${opacity}|${bucket}`-Schlüssel mit). */
    material: THREE.Material;
    /** Geteilte Ziel-Instanz aus `materialRegistry` (via `getMaterial`) — wird bei Tween-Ende wieder eingesetzt, der Klon oben wird disposed. */
    finalMaterial: THREE.Material;
  };
  const opacityTweensById = new Map<string, OpacityTween>();

  function isHeightAnimatableKind(kind: LayoutBoxKind): boolean {
    return kind === 'bar' || kind === 'floor';
  }

  /** `mesh.material` ist typisiert als `Material | Material[]` (three.js-Generics-Default) — hier werden aber nie Material-Arrays zugewiesen, nur einzelne Instanzen. */
  function materialOpacityOf(material: THREE.Material | THREE.Material[]): number {
    return Array.isArray(material) ? (material[0]?.opacity ?? 1) : material.opacity;
  }

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

  /**
   * Höhen-/Fußpunkt-Anteil von `applyLayout` (WP-C6). Nur `bar`/`floor`
   * wachsen fußpunkt-verankert; alle anderen Kinds (Hülle/Grundstück/Boden
   * haben ohnehin keine Höhen-Semantik) UND jeder Fall mit deaktivierten
   * Animationen setzen weiterhin sofort die Zielwerte (Alt-Verhalten).
   * x/z sind NIE Teil des Wachstums-Tweens (bewusster Scope-Cut, Report) —
   * Grid-Position/Footprint ändern sich für eine gegebene `box.id` in der
   * Praxis ohnehin nicht zwischen zwei Layouts derselben Box-Art.
   */
  function applyBoxHeight(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean): void {
    const targetFoot = box.center.y - box.size.y / 2;

    if (!animationsEnabled || !isHeightAnimatableKind(box.kind)) {
      mesh.position.set(box.center.x, box.center.y, box.center.z);
      mesh.scale.set(box.size.x, box.size.y, box.size.z);
      heightTweensById.delete(box.id);
      return;
    }

    mesh.scale.x = box.size.x;
    mesh.scale.z = box.size.z;
    mesh.position.x = box.center.x;
    mesh.position.z = box.center.z;

    if (isNewMesh) {
      // Startzustand VOR dem ersten `advanceAnimations`-Tick: Fuß auf
      // Zielposition, Höhe 0 — kein sichtbarer Sprung, weil das Mesh in
      // diesem Frame noch nicht gerendert wurde.
      mesh.scale.y = 0;
      mesh.position.y = targetFoot;
    }

    const fromHeight = isNewMesh ? 0 : mesh.scale.y;
    const currentFoot = isNewMesh ? targetFoot : mesh.position.y - mesh.scale.y / 2;
    const needsTween = fromHeight !== box.size.y || currentFoot !== targetFoot;

    if (!needsTween) {
      heightTweensById.delete(box.id);
      mesh.scale.y = box.size.y;
      mesh.position.y = targetFoot;
      return;
    }

    heightTweensById.set(box.id, {
      startMs: null,
      durationMs: BAR_GROWTH_DURATION_MS,
      fromHeight,
      toHeight: box.size.y,
      foot: targetFoot,
    });
  }

  /**
   * Opazitäts-Anteil von `applyLayout` (WP-C6) — gilt uniform für ALLE Kinds
   * (nicht nur Hüllen): deckt automatisch auch Balken-Opazitätsstufen
   * zwischen Ebenen ab (`city-layout.ts`: 0.35 → 0.6 → 1.0 etc.), ohne
   * separate Kind-Fallunterscheidung. Invariante 2 (KRITISCH): die geteilte
   * `materialRegistry`-Instanz wird NIE für einen Tween mutiert — jede
   * animierte Box bekommt eine EIGENE Klon-Instanz, die am Tween-Ende
   * disposed und durch die geteilte Ziel-Instanz ersetzt wird.
   */
  function applyBoxOpacity(mesh: THREE.Mesh, box: LayoutBox, isNewMesh: boolean): void {
    const targetMaterial = getMaterial(box);
    const pending = opacityTweensById.get(box.id);

    if (!animationsEnabled) {
      if (pending) {
        pending.material.dispose();
        opacityTweensById.delete(box.id);
      }
      mesh.material = targetMaterial;
      return;
    }

    if (isNewMesh) {
      // Neue Box: kein Opazitäts-"Sprung" beobachtbar (existierte vorher
      // nicht) — direkt Zielmaterial, kein Klon/Tween nötig.
      mesh.material = targetMaterial;
      return;
    }

    if (pending && pending.toOpacity === box.opacity) {
      // Bereits ein laufender Tween zu genau diesem Ziel — NICHT neu
      // starten (kein Timer-Reset bei wiederholtem `applyLayout` mit
      // unverändertem Ziel, z. B. React-Re-Render mit äquivalentem Layout).
      return;
    }

    const fromOpacity = materialOpacityOf(mesh.material);

    if (fromOpacity === box.opacity) {
      if (pending) {
        pending.material.dispose();
        opacityTweensById.delete(box.id);
      }
      mesh.material = targetMaterial;
      return;
    }

    // Ziel hat sich geändert (frischer Tween ODER Umlenkung eines laufenden
    // Tweens auf ein neues Ziel) — Klon-Instanz (neu oder wiederverwendet)
    // trägt IMMER `transparent = true`, auch wenn das Endziel `opacity === 1`
    // ist (Bar-Opazitätsstufe `district`-Level): sonst ignoriert three.js die
    // Zwischen-Opazität auf einem `transparent: false`-Material (Invariante-
    // 2-Konsequenz).
    const material = pending ? pending.material : targetMaterial.clone();
    if (!pending) material.opacity = fromOpacity;
    material.transparent = true;

    mesh.material = material;
    opacityTweensById.set(box.id, {
      startMs: null,
      durationMs: OPACITY_FADE_DURATION_MS,
      fromOpacity,
      toOpacity: box.opacity,
      material,
      finalMaterial: targetMaterial,
    });
  }

  function applyLayout(layout: CityLayout): void {
    const seenIds = new Set<string>();

    for (const box of layout.boxes) {
      seenIds.add(box.id);

      const isNewMesh = !meshesById.has(box.id);
      let mesh = meshesById.get(box.id);
      if (!mesh) {
        mesh = new THREE.Mesh(sharedBoxGeometry, getMaterial(box));
        mesh.userData.id = box.id;
        scene.add(mesh);
        meshesById.set(box.id, mesh);
      }

      mesh.userData.pickable = box.pickable;
      mesh.userData.kind = box.kind;
      mesh.renderOrder = renderOrderFor(box.kind);

      applyBoxHeight(mesh, box, isNewMesh);
      applyBoxOpacity(mesh, box, isNewMesh);

      // Degenerierte Nullbox (Distrikt ohne Unterkategorien, city-layout.ts
      // `buildHullBox`-Fallback) hat size 0 in jeder Achse — nicht rendern
      // statt eine unsichtbare, aber pickbare 0x0x0-Box im Raycast zu lassen.
      // Basiert bewusst auf dem ZIEL `box.size`, nicht der ggf. gerade
      // animierten `mesh.scale` (ein wachsender Balken mit `scale.y===0` im
      // ersten Frame bleibt trotzdem sichtbar, sein Ziel ist ja > 0).
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
    // Exit-Boxen werden bewusst HART entfernt (kein Fade-out): ein
    // laufender Opazitäts-Tween auf einer gerade entfernten Box würde sonst
    // gegen einen Pick-/Raycast-Konflikt laufen (die Box ist auf der neuen
    // Ebene nicht mehr Teil der Pickability-Matrix) — Priorität liegt laut
    // Auftrag ohnehin auf Wachstum + Hüllen-Fade, nicht auf Exit-Animation.
    for (const [id, mesh] of meshesById) {
      if (seenIds.has(id)) continue;
      scene.remove(mesh);
      meshesById.delete(id);
      const edgeLine = edgesById.get(id);
      if (edgeLine) {
        scene.remove(edgeLine);
        edgesById.delete(id);
      }
      heightTweensById.delete(id);
      const opacityTween = opacityTweensById.get(id);
      if (opacityTween) {
        opacityTween.material.dispose();
        opacityTweensById.delete(id);
      }
    }
  }

  function advanceAnimations(nowMs: number): boolean {
    let stillAnimating = false;

    for (const [id, tween] of heightTweensById) {
      const mesh = meshesById.get(id);
      if (!mesh) {
        heightTweensById.delete(id);
        continue;
      }
      if (tween.startMs === null) tween.startMs = nowMs;

      const elapsed = nowMs - tween.startMs;
      const rawT = tween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.durationMs));
      const eased = easeInOutCubic(rawT);
      const height = tween.fromHeight + (tween.toHeight - tween.fromHeight) * eased;
      mesh.scale.y = height;
      mesh.position.y = tween.foot + height / 2;

      if (rawT >= 1) heightTweensById.delete(id);
      else stillAnimating = true;
    }

    for (const [id, tween] of opacityTweensById) {
      const mesh = meshesById.get(id);
      if (!mesh) {
        tween.material.dispose();
        opacityTweensById.delete(id);
        continue;
      }
      if (tween.startMs === null) tween.startMs = nowMs;

      const elapsed = nowMs - tween.startMs;
      const rawT = tween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.durationMs));
      const eased = easeInOutCubic(rawT);
      tween.material.opacity = tween.fromOpacity + (tween.toOpacity - tween.fromOpacity) * eased;

      if (rawT >= 1) {
        // Invariante 2: Klon entsorgen, zurück auf die geteilte Ziel-Instanz
        // — kein dauerhafter Materialduplikat-Ballast nach Tween-Ende.
        mesh.material = tween.finalMaterial;
        tween.material.dispose();
        opacityTweensById.delete(id);
      } else {
        stillAnimating = true;
      }
    }

    return stillAnimating;
  }

  function setAnimationsEnabled(enabled: boolean): void {
    if (animationsEnabled === enabled) return;
    animationsEnabled = enabled;
    if (enabled) return; // Betrifft nur künftige `applyLayout`-Aufrufe, keine sofortige Wirkung.

    // Deaktivieren (`prefers-reduced-motion` griff zur Laufzeit): laufende
    // Tweens sofort auf ihren Zielwert springen lassen, kein "eingefrorener"
    // Zwischenzustand.
    for (const [id, tween] of heightTweensById) {
      const mesh = meshesById.get(id);
      if (mesh) {
        mesh.scale.y = tween.toHeight;
        mesh.position.y = tween.foot + tween.toHeight / 2;
      }
    }
    heightTweensById.clear();

    for (const [id, tween] of opacityTweensById) {
      const mesh = meshesById.get(id);
      if (mesh) mesh.material = tween.finalMaterial;
      tween.material.dispose();
    }
    opacityTweensById.clear();
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

    // WP-C6: laufende Tween-Klon-Materialien gehören NICHT der `materialRegistry`
    // (Invariante 2) — ohne diesen Schritt würden sie beim regulären
    // `materialRegistry`-Loop unten übersehen und geleakt.
    for (const tween of opacityTweensById.values()) tween.material.dispose();
    opacityTweensById.clear();
    heightTweensById.clear();

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
    advanceAnimations,
    setAnimationsEnabled,
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
