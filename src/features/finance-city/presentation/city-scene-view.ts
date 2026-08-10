/**
 * Teilschritt „Rendering" von `createCityScene` (herausgelöst in WP 6.4):
 * Bildgröße, Fog, Theme-Wechsel, Kamerapose und der eine `render()`-Aufruf.
 *
 * Der Fog trägt den HORIZONT-Ton des aktiven Themes — der Stadtrand löst sich
 * im Himmel auf, statt gegen eine flache Wand aus Farbe zu laufen (WP-E1).
 * Deshalb muss ein Theme-Wechsel den Fog mit denselben Grenzen neu setzen.
 */

import * as THREE from 'three';
import type { Vec3 } from '../domain/city-model';
import type { CityQualitySettings } from '../domain/city-quality';
import type { CityMaterials } from './city-scene-materials';
import type { CitySceneStage } from './city-scene-stage';
import type { CityTheme, CityThemeState } from './city-scene-theme';
import type { CityTextures } from './city-scene-textures';

export type CityCameraPose = { position: Vec3; target: Vec3 };

export type CitySceneView = {
  setSize(width: number, height: number, dpr: number): void;
  setFog(near: number, far: number): void;
  setTheme(next: CityTheme): void;
  applyCameraPose(pose: CityCameraPose): void;
  render(): void;
};

export function createCitySceneView(deps: {
  stage: CitySceneStage;
  theme: CityThemeState;
  textures: CityTextures;
  materials: CityMaterials;
  quality: CityQualitySettings;
}): CitySceneView {
  const { stage, theme, textures, materials, quality } = deps;

  /** Zuletzt gesetzte Fog-Grenzen — für die Neu-Einfärbung beim Theme-Wechsel gemerkt. `null` = Fog aus. */
  let fogRange: { near: number; far: number } | null = null;

  return {
    setSize(width, height, dpr) {
      if (width <= 0 || height <= 0) return; // ResizeObserver liefert während Layout-Übergängen kurzzeitig 0.
      // WP-5.6: Die Stufe ist eine Obergrenze, kein Vorschlag — nach unten darf
      // der Aufrufer (FPS-Kaskade in `CityCanvas`) weiter nachjustieren, nach
      // oben nicht. Sonst hinge die Zusicherung an genau einem Aufrufer.
      stage.renderer.setPixelRatio(Math.min(dpr, quality.maxPixelRatio));
      stage.renderer.setSize(width, height, false); // false: kein CSS-Style-Override — der Container steuert die Canvas-Größe.
      stage.camera.aspect = width / height;
      stage.camera.updateProjectionMatrix();
    },

    setFog(near, far) {
      // Nicht-endliche Werte (NaN/Infinity) schalten Fog aus — no-op-fähig.
      if (!Number.isFinite(near) || !Number.isFinite(far)) {
        fogRange = null;
        stage.scene.fog = null;
        return;
      }
      fogRange = { near, far };
      stage.scene.fog = new THREE.Fog(theme.horizonColor, near, far);
    },

    setTheme(next) {
      if (!theme.set(next)) return;

      // Himmel-Textur tauschen (Referenz auf die vorgebaute Textur des Themes
      // — kein Neuaufbau, kein Registry-Rebuild).
      stage.scene.background = textures.sky[theme.theme] ?? new THREE.Color(theme.horizonColor);
      materials.remapGroundTexture(theme.theme);

      stage.hemisphereLight.color.set(theme.palette.hemiSky);
      stage.hemisphereLight.groundColor.set(theme.palette.hemiGround);
      stage.hemisphereLight.intensity = theme.palette.hemiIntensity;
      stage.directionalLight.color.set(theme.palette.dirColor);
      stage.directionalLight.intensity = theme.palette.dirIntensity;
      if (fogRange) stage.scene.fog = new THREE.Fog(theme.horizonColor, fogRange.near, fogRange.far);
    },

    applyCameraPose(pose) {
      stage.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      stage.target.set(pose.target.x, pose.target.y, pose.target.z);
      stage.camera.lookAt(stage.target);
    },

    render() {
      stage.renderer.render(stage.scene, stage.camera);
    },
  };
}
