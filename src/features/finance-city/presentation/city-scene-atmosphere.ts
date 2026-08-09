/**
 * Atmosphäre-Preset der Szene (WP-4.3, herausgelöst aus `city-scene.ts` in
 * WP 6.4): subtile Lichtmodulation, höchstens 5 % Abweichung vom Vorgabewert.
 *
 * Der Übergang läuft als eigener Tween im BESTEHENDEN Render-Loop; bei
 * deaktivierten Animationen (`prefers-reduced-motion`) wird sofort gesetzt.
 */

import type * as THREE from 'three';
import { easeInOutCubic } from '../domain/camera-math';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';
import type { CityThemeState } from './city-scene-theme';

export type CityAtmospherePreset = 'stable' | 'neutral' | 'risk';

/** Lichtintensitäts-Multiplikatoren je Preset. */
const ATMOSPHERE_LIGHT_MULTIPLIER: Record<CityAtmospherePreset, number> = {
  stable: 1.03,
  neutral: 1.0,
  risk: 0.97,
};

type LightTween = {
  startMs: number | null;
  durationMs: number;
  fromHemiIntensity: number;
  toHemiIntensity: number;
  fromDirIntensity: number;
  toDirIntensity: number;
};

export type CityAtmosphere = {
  setPreset(preset: CityAtmospherePreset, animated: boolean): void;
  /** Schreibt einen laufenden Licht-Tween fort. `true`, solange er läuft. */
  advance(nowMs: number): boolean;
};

export function createCityAtmosphere(deps: {
  hemisphereLight: THREE.HemisphereLight;
  directionalLight: THREE.DirectionalLight;
  theme: CityThemeState;
}): CityAtmosphere {
  let currentPreset: CityAtmospherePreset = 'neutral';
  let tween: LightTween | null = null;

  const targetsFor = (preset: CityAtmospherePreset) => {
    const mult = ATMOSPHERE_LIGHT_MULTIPLIER[preset];
    return { hemi: deps.theme.palette.hemiIntensity * mult, dir: deps.theme.palette.dirIntensity * mult };
  };

  return {
    setPreset(preset, animated) {
      if (preset === currentPreset && tween === null) return;

      const targets = targetsFor(preset);
      if (!animated) {
        deps.hemisphereLight.intensity = targets.hemi;
        deps.directionalLight.intensity = targets.dir;
        currentPreset = preset;
        tween = null;
        return;
      }

      tween = {
        startMs: null,
        durationMs: MOTION_DURATIONS.slow,
        fromHemiIntensity: deps.hemisphereLight.intensity,
        toHemiIntensity: targets.hemi,
        fromDirIntensity: deps.directionalLight.intensity,
        toDirIntensity: targets.dir,
      };
      currentPreset = preset;
    },

    advance(nowMs) {
      if (!tween) return false;
      if (tween.startMs === null) tween.startMs = nowMs;
      const elapsed = nowMs - tween.startMs;
      const rawT = tween.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / tween.durationMs));
      const eased = easeInOutCubic(rawT);
      deps.hemisphereLight.intensity =
        tween.fromHemiIntensity + (tween.toHemiIntensity - tween.fromHemiIntensity) * eased;
      deps.directionalLight.intensity =
        tween.fromDirIntensity + (tween.toDirIntensity - tween.fromDirIntensity) * eased;
      if (rawT >= 1) {
        tween = null;
        return false;
      }
      return true;
    },
  };
}
