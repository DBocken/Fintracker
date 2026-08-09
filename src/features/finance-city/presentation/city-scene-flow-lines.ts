/**
 * Flusslinien für wiederkehrende Zahlungen (WP-5.1, herausgelöst aus
 * `city-scene.ts` in WP 6.4).
 *
 * Eine `THREE.Line` je Linie, Deckkraft nach Anteil. **Statisch: KEINE
 * „fließende" Animation** — die liefe endlos und widerspräche der
 * Render-on-Demand-Vorgabe (README), ohne eine einzige zusätzliche Zahl zu
 * zeigen. Lebenszyklus wie bei den Boxen: Diff über die id.
 */

import * as THREE from 'three';
import type { CityFlowLine } from '../domain/city-flow-lines';
import type { CityQualitySettings } from '../domain/city-quality';
import { CONTACT_SHADOW_RENDER_ORDER } from './city-scene-boxes';

/** Deckkraft-Fenster: auch die schwächste Linie bleibt sichtbar, die stärkste sticht nicht heraus wie eine Kante. */
const FLOW_LINE_MIN_OPACITY = 0.25;
const FLOW_LINE_MAX_OPACITY = 0.75;

export type CityFlowLines = {
  apply(lines: CityFlowLine[]): void;
  dispose(): void;
};

export function createCityFlowLines(deps: { scene: THREE.Scene; quality: CityQualitySettings }): CityFlowLines {
  const linesById = new Map<string, THREE.Line>();

  function disposeAll(): void {
    for (const object of linesById.values()) {
      deps.scene.remove(object);
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
    linesById.clear();
  }

  return {
    apply(lines) {
      if (!deps.quality.flowLines) {
        // Stufe kann sie nicht tragen: eventuell vorhandene abräumen (die Stufe
        // steht zwar fest, aber ein Aufrufer darf sich darauf nicht verlassen).
        if (linesById.size > 0) disposeAll();
        return;
      }

      const seen = new Set<string>();
      for (const line of lines) {
        seen.add(line.id);
        let object = linesById.get(line.id);
        if (!object) {
          const geometry = new THREE.BufferGeometry();
          const material = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
          object = new THREE.Line(geometry, material);
          object.renderOrder = CONTACT_SHADOW_RENDER_ORDER; // unter den Baukörpern, über dem Boden.
          deps.scene.add(object);
          linesById.set(line.id, object);
        }

        (object.geometry as THREE.BufferGeometry).setFromPoints([
          new THREE.Vector3(line.from.x, line.from.y, line.from.z),
          new THREE.Vector3(line.to.x, line.to.y, line.to.z),
        ]);
        const material = object.material as THREE.LineBasicMaterial;
        material.color.set(line.color);
        material.opacity =
          FLOW_LINE_MIN_OPACITY +
          (FLOW_LINE_MAX_OPACITY - FLOW_LINE_MIN_OPACITY) * Math.min(1, Math.max(0, line.share));
      }

      for (const [id, object] of linesById) {
        if (seen.has(id)) continue;
        deps.scene.remove(object);
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
        linesById.delete(id);
      }
    },

    dispose: disposeAll,
  };
}
