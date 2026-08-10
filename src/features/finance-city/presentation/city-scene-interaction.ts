/**
 * Teilschritt „Interaktion" von `createCityScene` (herausgelöst in WP 6.4):
 * Raycast auf die Baukörper und das Hover-Highlight.
 *
 * Beides liest dieselbe Mesh-Tabelle wie der Layout-Diff, entscheidet aber
 * nichts über sie — `pick` liefert nur die getroffene `box.id` nach oben, wo
 * `domain/city-tap-target.ts` sie fachlich deutet.
 *
 * **Invariante:** Das Highlight läuft IMMER über eine eigene Klon-Instanz.
 * Würde die geteilte Registry-Instanz mutiert, glühten alle Boxen mit
 * demselben Materialschlüssel mit.
 */

import * as THREE from 'three';
import type { CitySceneStage } from './city-scene-stage';

/** WP-D3: Glüh-Intensität für Lambert-Baukörper im Hover — WEISS und deutlich über dem farbigen Grund-Eigenleuchten. */
const HIGHLIGHT_EMISSIVE_INTENSITY = 0.5;
/** Opazitäts-Schub für transparente Hüllen im Hover (geclamped auf 1). */
const HIGHLIGHT_OPACITY_BOOST = 0.15;

export type CityInteraction = {
  pick(clientX: number, clientY: number): string | null;
  setHighlight(id: string | null): void;
  /** Die Box verschwindet aus dem Layout — ein Highlight darauf aufheben, damit sein Klon nicht leakt. */
  forget(id: string): void;
  dispose(): void;
};

export function createCityInteraction(deps: {
  stage: CitySceneStage;
  meshes: ReadonlyMap<string, THREE.Mesh>;
}): CityInteraction {
  const { stage, meshes } = deps;

  let highlightedId: string | null = null;
  /** Material der Box VOR dem Highlight — wird bei Aufhebung wieder eingesetzt. */
  let restoreMaterial: THREE.Material | null = null;
  /** Eigene Klon-Instanz für die Highlight-Dauer. */
  let highlightMaterial: THREE.Material | null = null;

  function clearHighlight(): void {
    if (highlightedId) {
      const mesh = meshes.get(highlightedId);
      // Nur zurücksetzen, wenn das Highlight-Material noch aktiv ist — ein
      // zwischenzeitliches applyLayout/Opazitäts-Tween darf nicht überschrieben
      // werden (das Highlight ist dann ohnehin schon visuell weg).
      if (mesh && restoreMaterial && mesh.material === highlightMaterial) mesh.material = restoreMaterial;
      highlightMaterial?.dispose();
    }
    highlightedId = null;
    restoreMaterial = null;
    highlightMaterial = null;
  }

  return {
    pick(clientX, clientY) {
      const rect = stage.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      stage.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      stage.raycaster.setFromCamera(stage.ndc, stage.camera);

      const pickable: THREE.Mesh[] = [];
      for (const mesh of meshes.values()) {
        if (mesh.visible && mesh.userData.pickable) pickable.push(mesh);
      }
      if (pickable.length === 0) return null;

      const hits = stage.raycaster.intersectObjects(pickable, false);
      if (hits.length === 0) return null;
      const id = hits[0].object.userData.id;
      return typeof id === 'string' ? id : null;
    },

    setHighlight(id) {
      if (id === highlightedId) return;
      clearHighlight();
      if (id === null) return;

      const mesh = meshes.get(id);
      if (!mesh) return; // Unbekannte/gerade entsorgte id: stilles No-op.

      const base = mesh.material as THREE.Material;
      const clone = base.clone();
      if (clone instanceof THREE.MeshLambertMaterial) {
        clone.emissive = new THREE.Color(0xffffff);
        clone.emissiveIntensity = HIGHLIGHT_EMISSIVE_INTENSITY;
      } else {
        clone.transparent = true;
        clone.opacity = Math.min(1, clone.opacity + HIGHLIGHT_OPACITY_BOOST);
      }

      highlightedId = id;
      restoreMaterial = base;
      highlightMaterial = clone;
      mesh.material = clone;
    },

    forget(id) {
      if (highlightedId === id) clearHighlight();
    },

    // Der Highlight-Klon gehört (wie die Tween-Klone) NICHT der Registry —
    // ohne diesen Schritt würde er dort übersehen und geleakt.
    dispose: clearHighlight,
  };
}
