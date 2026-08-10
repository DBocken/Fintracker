/**
 * Material-Registry der Stadt-Szene (Teilschritt „Aufbau" von
 * `createCityScene`, herausgelöst in WP 6.4).
 *
 * **Invariante:** Eine Registry-Instanz wird NIE für einen Tween oder ein
 * Highlight mutiert — wer eine Box vorübergehend anders aussehen lassen will,
 * arbeitet auf einem Klon. Sonst faden bzw. glühen alle Boxen mit demselben
 * Schlüssel `${color}|${opacity}|${bucket}|${texture}` unbeabsichtigt mit.
 */

import * as THREE from 'three';
import type { LayoutBox, LayoutBoxKind } from '../domain/city-layout';
import type { CityTheme } from './city-scene-theme';
import type { CityTextures } from './city-scene-textures';

/** Dezente Kanten-Opazität für Hüllen-Wireframes (Kamera-Regel-neutral, reiner Stil-Wert). */
const EDGE_OPACITY = 0.35;

/**
 * WP-D6: dezentes Eigenleuchten der soliden Baukörper in ihrer EIGENEN Farbe —
 * hebt Sättigung/Präsenz auf der dunklen Szene, ohne Bloom/Post-Processing.
 */
const SOLID_EMISSIVE_INTENSITY = 0.16;

/**
 * Zwei Material-„Buckets": undurchsichtige Baukörper (Balken/Etagen/Boden)
 * nutzen `MeshLambertMaterial` (reagiert auf Licht, `flatShading` bewusst
 * NICHT gesetzt = glatte Flächen), Hüllen/Grundstücke sind `MeshBasicMaterial`
 * mit `transparent`+`depthWrite=false` (Balken dahinter bleiben sichtbar).
 */
export function materialBucketFor(kind: LayoutBoxKind): 'solid' | 'transparent' {
  return kind === 'hull' || kind === 'plot' ? 'transparent' : 'solid';
}

/**
 * Zeichenreihenfolge: Boden zuerst, dann Grundstücke, dann Balken/Etagen/
 * Caps, Hüllen zuletzt („Hüllen NACH Balken" — sonst würde die transparente
 * Hülle Balken dahinter beim Alpha-Blending verdecken können).
 */
export function renderOrderFor(kind: LayoutBoxKind): number {
  switch (kind) {
    case 'ground':
      return -1;
    case 'plot':
      return 0;
    case 'bar':
    case 'floor':
    case 'cap':
      return 1;
    case 'hull':
      return 2;
    default:
      return 0;
  }
}

export type CityMaterials = {
  forBox(box: LayoutBox): THREE.Material;
  forEdge(color: string): THREE.LineBasicMaterial;
  /** Theme-Wechsel: gezielt NUR die `map`-Referenz der Boden-Materialien tauschen. */
  remapGroundTexture(theme: CityTheme): void;
  dispose(): void;
};

export function createCityMaterials(deps: { textures: CityTextures; getTheme: () => CityTheme }): CityMaterials {
  const registry = new Map<string, THREE.Material>();
  const edgeRegistry = new Map<string, THREE.LineBasicMaterial>();

  return {
    forBox(box) {
      const bucket = materialBucketFor(box.kind);
      // WP-E1: Boden bekommt die (theme-abhängige) Straßen-Textur, alle anderen
      // soliden Baukörper die (theme-tolerante) Fassaden-Textur — beide
      // multiplizieren `material.color`, das 1:1-Farbmapping aus der Domain
      // bleibt erhalten. Die Textur-Art ist Teil des Schlüssels, damit Boden und
      // ein zufällig gleichfarbiger Balken nie dieselbe Instanz teilen.
      // WP-5.4: Auch die Aktivitätsstufe gehört in den Schlüssel — sonst teilten
      // sich ein ruhiges und ein belebtes Gebäude derselben Farbe eine Instanz
      // und damit dieselbe Fassade.
      const activity = box.activity ?? 'steady';
      const textureKey = box.kind === 'ground' ? 'ground' : bucket === 'solid' ? `facade:${activity}` : 'none';
      const key = `${box.color}|${box.opacity}|${bucket}|${textureKey}`;
      const cached = registry.get(key);
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
              map: box.kind === 'ground' ? deps.textures.ground[deps.getTheme()] : deps.textures.facade[activity],
              // WP-D6: Eigenleuchten in der Boxfarbe — das Hover-Highlight glüht
              // dagegen WEISS und bleibt dadurch klar unterscheidbar.
              emissive: box.color,
              emissiveIntensity: SOLID_EMISSIVE_INTENSITY,
              transparent: box.opacity < 1,
              opacity: box.opacity,
            });

      registry.set(key, material);
      return material;
    },

    forEdge(color) {
      const cached = edgeRegistry.get(color);
      if (cached) return cached;
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: EDGE_OPACITY });
      edgeRegistry.set(color, material);
      return material;
    },

    remapGroundTexture(theme) {
      const groundTexture = deps.textures.ground[theme];
      for (const [key, material] of registry) {
        if (!key.endsWith('|ground')) continue;
        (material as THREE.MeshLambertMaterial).map = groundTexture;
        material.needsUpdate = true;
      }
    },

    dispose() {
      for (const material of registry.values()) material.dispose();
      registry.clear();
      for (const material of edgeRegistry.values()) material.dispose();
      edgeRegistry.clear();
    },
  };
}
