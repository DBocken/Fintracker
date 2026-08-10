/**
 * Teilschritt „Aufbau" von `createCityScene` (herausgelöst in WP 6.4): der
 * three.js-Grundaufbau, den alle anderen Teilschritte voraussetzen — Szene,
 * Kamera, Licht, Renderer, Raycaster und die GETEILTEN Geometrien.
 *
 * Kein Schatten-Pass (README/Akzeptanzkriterium: Render-on-Demand + Mobil-Akku
 * — Schatten-Maps kosten zusätzliche Passes, die hier nicht nötig sind).
 * Farben/Intensitäten kommen aus der Theme-Palette (WP-C9).
 */

import * as THREE from 'three';
import type { CityQualitySettings } from '../domain/city-quality';
import type { CityThemeState } from './city-scene-theme';
import type { CityTextures } from './city-scene-textures';

/** Vertikales FOV der Stadt-Kamera — von `CityCanvas`/`CityStage` für `fitCameraDistance` wiederverwendet, damit Kamera-FOV und Distanz-Mathematik nie auseinanderlaufen. */
export const CAMERA_FOV_Y_DEG = 50;

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

export type CitySceneStage = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Live-Referenz auf das Orbit-Target — wird mutiert, NIE neu zugewiesen. */
  target: THREE.Vector3;
  raycaster: THREE.Raycaster;
  ndc: THREE.Vector2;
  hemisphereLight: THREE.HemisphereLight;
  directionalLight: THREE.DirectionalLight;
  /** EINE geteilte Box-Geometrie für ALLE Boxen — Größe kommt über `mesh.scale`, Position über `mesh.position`. */
  boxGeometry: THREE.BoxGeometry;
  edgesGeometry: THREE.EdgesGeometry;
  dispose(): void;
};

export function createCitySceneStage(opts: {
  canvas: HTMLCanvasElement;
  createRenderer?: (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;
  quality: CityQualitySettings;
  theme: CityThemeState;
  textures: CityTextures;
}): CitySceneStage {
  const { canvas, quality, theme, textures } = opts;

  const scene = new THREE.Scene();
  scene.background = textures.sky[theme.theme] ?? new THREE.Color(theme.horizonColor);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_Y_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 10, 16);
  const target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);
  // Kamera als Szenen-Kind: nicht renderrelevant, gibt Tests aber über
  // `camera.parent` einen Weg, den Szenengraphen zu inspizieren, ohne eine
  // zusätzliche Debug-only-API auf `CitySceneHandle` zu brauchen.
  scene.add(camera);

  const hemisphereLight = new THREE.HemisphereLight(
    theme.palette.hemiSky,
    theme.palette.hemiGround,
    theme.palette.hemiIntensity,
  );
  scene.add(hemisphereLight);
  const directionalLight = new THREE.DirectionalLight(theme.palette.dirColor, theme.palette.dirIntensity);
  directionalLight.position.set(8, 14, 6);
  scene.add(directionalLight);
  // WP-D6: kühles Gegen-/Kantenlicht von schräg hinten — modelliert die dem
  // Hauptlicht abgewandten Baukörper-Kanten (mehr Tiefe), bewusst OHNE
  // Schatten-Maps. WP-5.6: Eine dritte Lichtquelle kostet Fragment-Last auf
  // JEDEM Material — der erste Effekt, der beim Sparen fällt.
  if (quality.rimLight) {
    const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.35);
    rimLight.position.set(-8, 10, -10);
    scene.add(rimLight);
  }

  // Antialiasing nur, wenn der (gedeckelte) Device-Pixel-Ratio niedrig genug
  // ist — hohe DPR + MSAA verdoppelt die Fragment-Last unnötig. Seit WP-5.6
  // entscheidet das die Qualitätsstufe (`city-quality.ts`).
  const renderer =
    opts.createRenderer?.(canvas) ??
    new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      alpha: false,
      // 'high-performance': die Stadt ist eine dedizierte 3D-Vollflächen-
      // Ansicht — auf Dual-GPU-Geräten soll der schnelle Chip ran. Den Akku
      // schont bereits der Render-on-Demand-Loop, nicht die GPU-Wahl.
      powerPreference: 'high-performance',
    });

  // WP-D6: filmisches ACES-Tone-Mapping — tiefere Kontraste und sattere Farben
  // OHNE zusätzliche Render-Passes. Exposure leicht angehoben, weil ACES die
  // Mitten sonst etwas absenkt.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);

  return {
    canvas,
    renderer,
    scene,
    camera,
    target,
    raycaster: new THREE.Raycaster(),
    ndc: new THREE.Vector2(),
    hemisphereLight,
    directionalLight,
    boxGeometry,
    edgesGeometry,
    dispose() {
      boxGeometry.dispose();
      edgesGeometry.dispose();
      renderer.dispose();
    },
  };
}
