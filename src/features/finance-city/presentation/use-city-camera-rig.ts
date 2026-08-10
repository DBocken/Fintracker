/**
 * Lebenszyklus des Kamera-Controllers (WP-C4, herausgelöst aus `CityPage.tsx`
 * in WP 6.4): erzeugen, an die Szene anschließen, vermessen, bei
 * `prefers-reduced-motion` nachkonfigurieren, Intents weiterreichen, aufräumen.
 *
 * **Warum `presentation/` und nicht `application/`.** Der Plan zu WP 6.4 nennt
 * `application/` als Ziel der Kamera-Logik. Die *Mathematik* liegt dort schon
 * richtig — sie steht rein in `domain/camera-math.ts`, die Zustandsmaschine in
 * `city-camera-controller.ts`. Dieser Hook ist der Rest: er misst DOM
 * (`getBoundingClientRect`, `ResizeObserver`) und hält die three.js-Handles
 * (`CitySceneHandle`, `CityControlsApi`). Beides gehört laut
 * README-Architekturtabelle in `presentation/`, und `check:layers` (Regel
 * `feature-application-ohne-presentation`) verbietet der `application`-Schicht
 * den Import von `createCityCameraController` ohnehin. Was hier bleibt, ist
 * Verdrahtung ohne eigene Entscheidungen — die prüfbaren Entscheidungen sind
 * unten in `camera-math.ts`/`city-camera-controller.ts` und dort getestet.
 *
 * **[REGRESSION] StrictMode-/Remount-Robustheit.** Alle an den Controller
 * gereichten Callbacks lösen die Refs LIVE beim Aufruf auf, statt die aktuelle
 * Instanz einmalig zu capturen. Grund (Dev-Befund, rAF-Sonde): React-StrictMode
 * remountet `CityCanvas` (Mount A → Cleanup → Mount B) NACH diesem Effekt —
 * eine gecapturte Instanz A wäre danach tot: ihr Loop-Closure behält ein
 * gecanceltes rafHandle, `invalidate()` dort ist für immer ein No-op, und kein
 * Kamera-Intent (Fokus/Eintauchen/Reset) weckt den lebenden Loop B. Flüge
 * starten nie, die Szene friert auf dem alten Frame ein.
 */

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { CityLayout } from '../domain/city-layout';
import type { CityCameraIntent } from '../application/city-view-model';
import {
  createCityCameraController,
  type CityCameraController,
  type CityCameraControllerConfig,
  type CityFocusBounds,
} from './city-camera-controller';
import { CAMERA_FOV_Y_DEG, type CitySceneHandle } from './city-scene';
import type { CityControlsApi } from './CityCanvas';

/** Fallback-Seitenverhältnis, solange die Canvas-Größe noch nicht messbar ist (0 Höhe während Layout-Übergängen). */
const FALLBACK_ASPECT = 16 / 9;

/**
 * Plain-`Vec3`-Kopie einer three.js-`Vector3` (o. ä. `{x,y,z}`-Quelle) — der
 * Kamera-Controller ist bewusst three.js-frei und bekommt nie eine echte
 * `THREE.Vector3`-Instanz gereicht.
 */
function toVec3(v: { x: number; y: number; z: number }) {
  return { x: v.x, y: v.y, z: v.z };
}

export function useCityCameraRig(args: {
  /** Erst mit gemountetem Canvas sind `sceneRef`/`controlsApiRef` befüllt (WP-C8). */
  active: boolean;
  sceneRef: MutableRefObject<CitySceneHandle | null>;
  controlsApiRef: MutableRefObject<CityControlsApi | null>;
  /** Header + Tabs oberhalb der Canvas — ihre Höhe ist die Sichtzentrums-Korrektur (`camera-math.ts#visualCenterOffset`). */
  chromeRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  cameraIntent: CityCameraIntent;
  layout: CityLayout;
  focusLayout: CityFocusBounds | null;
  /** Heraus-Zoomen über die Schwelle → eine Ebene hoch (`nav.actions.zoomOutStep`). */
  onZoomOutThreshold: () => void;
}): CityCameraController | null {
  const { active, sceneRef, controlsApiRef, chromeRef, reducedMotion, cameraIntent, layout, focusLayout } = args;

  const [controller, setController] = useState<CityCameraController | null>(null);

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const onZoomOutThresholdRef = useRef(args.onZoomOutThreshold);
  onZoomOutThresholdRef.current = args.onZoomOutThreshold;
  // Letzte per DOM-Messung ermittelte (Nicht-reducedMotion-)Konfiguration —
  // der reducedMotion-Effekt unten braucht sie, um bei einer System-
  // Einstellungsänderung erneut zu konfigurieren, ohne selbst neu zu messen.
  const lastMeasuredConfigRef = useRef<Omit<CityCameraControllerConfig, 'reducedMotion'> | null>(null);

  // Läuft NACH `CityCanvas`s eigenem Mount-Effekt im selben Commit
  // (Kind-Effekte vor Eltern-Effekten, React-Garantie) — die Refs sind beim
  // ersten Durchlauf bereits befüllt. `setController` propagiert die Instanz
  // als Prop nach unten. Zur Ref-Auflösung siehe den Modulkopf.
  useEffect(() => {
    if (!sceneRef.current || !controlsApiRef.current) return;

    const instance = createCityCameraController({
      getCameraPose: () => {
        const scene = sceneRef.current;
        if (!scene) return { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
        return { position: toVec3(scene.camera.position), target: toVec3(scene.target) };
      },
      applyCameraPose: (pose) => sceneRef.current?.applyCameraPose(pose),
      setControlLimits: (opts) => controlsApiRef.current?.setLimits(opts.minDistance, opts.maxDistance),
      setFog: (near, far) => sceneRef.current?.setFog(near, far),
      invalidate: () => controlsApiRef.current?.invalidate(),
      onZoomOutThreshold: () => onZoomOutThresholdRef.current(),
    });

    const measure = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      const chromeTopPx = chromeRef.current?.getBoundingClientRect().height ?? 0;
      const canvasRect = scene.domElement.getBoundingClientRect();
      const aspect = canvasRect.height > 0 ? canvasRect.width / canvasRect.height : FALLBACK_ASPECT;
      const viewportHeightPx = chromeTopPx + canvasRect.height;
      lastMeasuredConfigRef.current = { fovYDeg: CAMERA_FOV_Y_DEG, aspect, chromeTopPx, viewportHeightPx };
      instance.configure({ ...lastMeasuredConfigRef.current, reducedMotion: reducedMotionRef.current });
    };

    measure();
    setController(instance);

    // Reagiert auf Resize/Orientierungswechsel UND Chrome-Höhenänderungen
    // (z. B. Breadcrumb-Umbruch auf schmalen Viewports).
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(sceneRef.current.domElement);
    if (chromeRef.current) resizeObserver.observe(chromeRef.current);

    return () => {
      resizeObserver.disconnect();
      instance.dispose();
      setController(null);
    };
    // `active` ist die einzige echte Dependency: die Refs sind für die
    // Lebensdauer EINES `CityCanvas`-Mounts stabil, `reducedMotion` und der
    // Zoom-out-Melder werden über Refs nachgeführt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // `prefers-reduced-motion` kann sich zur Laufzeit ändern — ohne neu zu
  // messen mit der zuletzt gemessenen Konfiguration erneut konfigurieren
  // (gleiches Muster wie `CityCanvas`s eigener reducedMotion-Effekt).
  useEffect(() => {
    if (!controller || !lastMeasuredConfigRef.current) return;
    controller.configure({ ...lastMeasuredConfigRef.current, reducedMotion });
  }, [controller, reducedMotion]);

  // WP-C4 Regel 4: NUR Fokuswechsel/Eintauchen und Reset (= `cameraIntent.seq`-
  // Änderung) starten eine neue Kamerafahrt — der Controller entscheidet per
  // `seq`-Vergleich, ob ein Intent bereits geflogen wurde.
  useEffect(() => {
    if (!controller) return;
    controller.onIntent(cameraIntent, { layout, focusLayout });
  }, [controller, cameraIntent, layout, focusLayout]);

  return controller;
}
