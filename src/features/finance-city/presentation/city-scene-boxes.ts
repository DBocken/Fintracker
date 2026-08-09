/**
 * Teilschritt „Layout" von `createCityScene` (herausgelöst in WP 6.4): der
 * Diff zwischen `LayoutBox[]` und dem Szenengraphen.
 *
 * Meshes werden nach `box.id` wiederverwendet, neue angelegt, fehlende
 * entsorgt. HIER wird keine Geometrie-Entscheidung getroffen — Position,
 * Skalierung, Farbe, Opazität und Pickability kommen 1:1 aus der Box
 * (`domain/city-layout.ts` ist die einzige Geometrie-Quelle).
 *
 * Kontaktschatten (WP-E1) sind fake Grounding, KEIN Shadow-Pass: eine geteilte
 * Radial-Gradient-Textur auf einer geteilten `PlaneGeometry`, eine Ebene pro
 * Grundstück und pro Balken-/Etagen-Stapel-FUSS. Ihr Lebenszyklus folgt dem
 * Diff hier.
 */

import * as THREE from 'three';
import type { CityLayout, LayoutBox } from '../domain/city-layout';
import type { CityQualitySettings } from '../domain/city-quality';
import type { CityMaterials } from './city-scene-materials';
import { renderOrderFor } from './city-scene-materials';
import type { CityTextures } from './city-scene-textures';
import type { CityTweens } from './city-scene-tweens';
import type { CitySceneStage } from './city-scene-stage';

/** Kontaktschatten-Ausdehnung: Grundstück × Faktor, Balken-Footprint + fester Margin. */
const CONTACT_SHADOW_PLOT_SCALE = 1.15;
const CONTACT_SHADOW_BAR_MARGIN = 0.25;
/**
 * y-Offsets knapp ÜBER der Grundstücks-Oberkante (PLOT_THICKNESS = 0.05,
 * `city-layout.ts`) — gestaffelt (Balken-Schatten über Plot-Schatten), damit
 * sich überlappende Ebenen nicht beißen (kein Z-Fighting trotz `depthWrite: false`).
 */
const CONTACT_SHADOW_PLOT_Y = 0.058;
const CONTACT_SHADOW_BAR_Y = 0.072;
/** Zeichenreihenfolge zwischen Grundstück (0) und Balken (1). */
export const CONTACT_SHADOW_RENDER_ORDER = 0.5;
/** Fußpunkt-Toleranz: nur Baukörper, die auf dem Boden stehen (nicht Etagen auf Etagen oder Caps auf Dächern), werfen einen Schatten. */
const CONTACT_SHADOW_FOOT_EPSILON = 0.001;

type ContactShadowSpec = { width: number; depth: number; y: number };

/**
 * Welche Box bekommt eine Schatten-Ebene und in welcher Ausdehnung/Höhe?
 * Obere Etagen und Caps (Fuß auf einer Box darunter) werfen keinen eigenen
 * Schatten — ein Schatten je Stapel, nicht je Etage.
 */
function contactShadowSpecFor(box: LayoutBox): ContactShadowSpec | null {
  if (box.kind === 'plot') {
    return {
      width: box.size.x * CONTACT_SHADOW_PLOT_SCALE,
      depth: box.size.z * CONTACT_SHADOW_PLOT_SCALE,
      y: CONTACT_SHADOW_PLOT_Y,
    };
  }
  if (box.kind === 'bar' || box.kind === 'floor') {
    const foot = box.center.y - box.size.y / 2;
    if (foot > CONTACT_SHADOW_FOOT_EPSILON) return null;
    return {
      width: box.size.x + 2 * CONTACT_SHADOW_BAR_MARGIN,
      depth: box.size.z + 2 * CONTACT_SHADOW_BAR_MARGIN,
      y: CONTACT_SHADOW_BAR_Y,
    };
  }
  return null;
}

type ContactShadows = {
  sync(box: LayoutBox, visible: boolean): void;
  forget(id: string): void;
  dispose(): void;
};

/**
 * Eine Schatten-Ebene je Grundstück und je Baukörper-FUSS, alle auf EINER
 * geteilten Geometrie und EINEM geteilten Material. Ohne 2D-Canvas (jsdom)
 * fehlt die Textur — dann gibt es schlicht keine Schatten, der Rest bleibt
 * unverändert.
 */
function createContactShadows(deps: { scene: THREE.Scene; texture: THREE.CanvasTexture | null }): ContactShadows {
  const byId = new Map<string, THREE.Mesh>();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = deps.texture
    ? new THREE.MeshBasicMaterial({ map: deps.texture, transparent: true, depthWrite: false })
    : null;

  return {
    sync(box, visible) {
      let shadow = byId.get(box.id);
      const spec = material ? contactShadowSpecFor(box) : null;
      if (spec && material) {
        if (!shadow) {
          shadow = new THREE.Mesh(geometry, material);
          // PlaneGeometry liegt in der XY-Ebene → auf den Boden (XZ) drehen;
          // Skalierung wirkt in lokalem Raum: x → Welt-X, y → Welt-Z.
          shadow.rotation.x = -Math.PI / 2;
          shadow.renderOrder = CONTACT_SHADOW_RENDER_ORDER;
          deps.scene.add(shadow);
          byId.set(box.id, shadow);
        }
        shadow.position.set(box.center.x, spec.y, box.center.z);
        shadow.scale.set(spec.width, spec.depth, 1);
        shadow.visible = visible;
      } else if (shadow) {
        deps.scene.remove(shadow);
        byId.delete(box.id);
      }
    },
    forget(id) {
      const shadow = byId.get(id);
      if (!shadow) return;
      deps.scene.remove(shadow);
      byId.delete(id);
    },
    dispose() {
      for (const shadow of byId.values()) deps.scene.remove(shadow);
      byId.clear();
      geometry.dispose();
      material?.dispose();
    },
  };
}

type BoxEdges = {
  sync(box: LayoutBox, mesh: THREE.Mesh): void;
  forget(id: string): void;
  dispose(): void;
};

/**
 * Farbige Kantenlinien um Hüllen und Grundstücke (`box.edges` aus der Domain).
 * WP-5.6: ein zusätzlicher Draw-Call JE Box — auf der sparsamsten
 * Qualitätsstufe der größte Posten bei vielen Baukörpern, deshalb dort aus.
 * Geometrie und Materialien sind geteilt; hier lebt nur die `LineSegments`.
 */
function createBoxEdges(deps: {
  scene: THREE.Scene;
  geometry: THREE.BufferGeometry;
  materials: CityMaterials;
  enabled: boolean;
}): BoxEdges {
  const byId = new Map<string, THREE.LineSegments>();

  return {
    sync(box, mesh) {
      let edgeLine = byId.get(box.id);
      if (box.edges && deps.enabled) {
        if (!edgeLine) {
          edgeLine = new THREE.LineSegments(deps.geometry, deps.materials.forEdge(box.color));
          deps.scene.add(edgeLine);
          byId.set(box.id, edgeLine);
        } else {
          edgeLine.material = deps.materials.forEdge(box.color);
        }
        edgeLine.position.copy(mesh.position);
        edgeLine.scale.copy(mesh.scale);
        edgeLine.visible = mesh.visible;
        edgeLine.renderOrder = renderOrderFor(box.kind);
      } else if (edgeLine) {
        deps.scene.remove(edgeLine);
        byId.delete(box.id);
      }
    },
    forget(id) {
      const edgeLine = byId.get(id);
      if (!edgeLine) return;
      deps.scene.remove(edgeLine);
      byId.delete(id);
    },
    dispose() {
      for (const edgeLine of byId.values()) deps.scene.remove(edgeLine);
      byId.clear();
    },
  };
}

export type CityBoxes = {
  /** Lebende Tabelle aller Baukörper — `city-scene-interaction.ts` liest sie für Raycast und Highlight. */
  readonly meshes: ReadonlyMap<string, THREE.Mesh>;
  applyLayout(layout: CityLayout): void;
  dispose(): void;
};

export function createCityBoxes(deps: {
  stage: CitySceneStage;
  materials: CityMaterials;
  textures: CityTextures;
  tweens: CityTweens;
  quality: CityQualitySettings;
  /** Verschwindet eine Box, muss ein Highlight darauf aufgehoben werden (sonst leakt der Klon). */
  onBoxRemoved: (id: string) => void;
}): CityBoxes {
  const { stage, materials, textures, tweens, quality } = deps;
  const { scene } = stage;

  const meshesById = new Map<string, THREE.Mesh>();
  const contactShadows = createContactShadows({ scene, texture: textures.contactShadow });
  const edges = createBoxEdges({ scene, geometry: stage.edgesGeometry, materials, enabled: quality.edges });

  /** Eine Box einpflegen. Liefert `true`, wenn dabei ein Höhen-Tween startete (Kaskaden-Zähler). */
  function syncBox(box: LayoutBox, staggerIndex: number): boolean {
    const isNewMesh = !meshesById.has(box.id);
    let mesh = meshesById.get(box.id);
    if (!mesh) {
      mesh = new THREE.Mesh(stage.boxGeometry, materials.forBox(box));
      mesh.userData.id = box.id;
      scene.add(mesh);
      meshesById.set(box.id, mesh);
    }

    mesh.userData.pickable = box.pickable;
    mesh.userData.kind = box.kind;
    mesh.renderOrder = renderOrderFor(box.kind);

    const startedTween = tweens.applyHeight(mesh, box, isNewMesh, staggerIndex);
    tweens.applyOpacity(mesh, box, isNewMesh, materials.forBox(box));

    // Degenerierte Nullbox (Distrikt ohne Unterkategorien) hat size 0 in jeder
    // Achse — nicht rendern statt eine unsichtbare, aber pickbare 0×0×0-Box im
    // Raycast zu lassen. Basiert bewusst auf dem ZIEL `box.size`, nicht der
    // ggf. gerade animierten `mesh.scale`.
    mesh.visible = box.size.x > 0 && box.size.y > 0 && box.size.z > 0;

    if (box.kind === 'ground') textures.syncGroundRepeat(box.size.x, box.size.z);
    contactShadows.sync(box, mesh.visible);
    edges.sync(box, mesh);
    return startedTween;
  }

  /**
   * Boxen entsorgen, deren id im neuen Layout nicht mehr vorkommt. Bewusst
   * HART (kein Fade-out): ein Opazitäts-Tween auf einer gerade entfernten Box
   * liefe gegen einen Pick-/Raycast-Konflikt — sie ist auf der neuen Ebene
   * nicht mehr Teil der Pickability-Matrix.
   */
  function removeUnseen(seenIds: Set<string>): void {
    for (const [id, mesh] of meshesById) {
      if (seenIds.has(id)) continue;
      // WP-D3: ein Highlight auf einer gerade entsorgten Box aufheben (ihr
      // Klon-Material würde sonst leaken; Restore entfällt, Mesh geht weg).
      deps.onBoxRemoved(id);
      scene.remove(mesh);
      meshesById.delete(id);

      edges.forget(id);
      contactShadows.forget(id);
      tweens.forget(id);
    }
  }

  return {
    meshes: meshesById,

    applyLayout(layout) {
      const seenIds = new Set<string>();
      // Kaskaden-Zähler: Startversatz für jeden in DIESEM Batch frisch
      // gestarteten Höhen-Tween (Layout-Reihenfolge).
      let staggerCursor = 0;
      for (const box of layout.boxes) {
        seenIds.add(box.id);
        if (syncBox(box, staggerCursor)) staggerCursor += 1;
      }
      removeUnseen(seenIds);
    },

    dispose() {
      for (const mesh of meshesById.values()) scene.remove(mesh);
      meshesById.clear();
      edges.dispose();
      contactShadows.dispose();
    },
  };
}
