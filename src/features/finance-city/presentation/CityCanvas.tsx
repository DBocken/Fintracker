import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCityScene, type CitySceneHandle } from './city-scene';
import type { CityCameraController } from './city-camera-controller';
import type { CityLayout } from '../domain/city-layout';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isDarkMode, subscribeToDarkModeChanges } from '@/lib/chart-theme';

/**
 * WP-C4: kleine imperative API, über die der (außerhalb von `CityCanvas`
 * lebende, `CityPage.tsx`-verwaltete) Kamera-Controller die OrbitControls-
 * Zoom-Grenzen setzt (Regel 6, `maxDistance` aus `fitCameraDistance` der
 * Gesamt-Stadt) und den Render-on-Demand-Loop weckt (`invalidate`), ohne
 * dass `CityCanvas` selbst etwas über den Controller wissen muss.
 */
export type CityControlsApi = {
  setLimits(minDistance: number, maxDistance: number): void;
  invalidate(): void;
};

export type CityCanvasProps = {
  /** Aus `useMemo(() => buildCityLayout(...), [...])` der Page — die EINZIGE Geometrie-Quelle (README). */
  layout: CityLayout;
  /** Tap-Raycast-Ergebnis; `null` = Boden/Leere (kein pickbares Objekt getroffen). */
  onTapBox: (id: string | null) => void;
  /** WP-C4: feuert, wenn der Nutzer manuell zu orbiten beginnt (Kamera-Controller bricht dann laufende Auto-Flüge ab, Regel 2). */
  onControlsStart?: () => void;
  /** WP-C4: feuert bei jeder OrbitControls-'change' (Kamera-Controller lerpt darauf das Zoom-out-Target, Regel 5/6). */
  onControlsChange?: () => void;
  /** WP-C4: pro Render-Frame getickter Kamera-Controller (`presentation/city-camera-controller.ts`) — `CityPage.tsx` erzeugt ihn erst NACH dem Mount (braucht `sceneRef`/`controlsApiRef`), deshalb optional/nachträglich befüllbar. */
  cameraController?: CityCameraController | null;
  /**
   * WP-C5: feuert am Ende von `tick()`, aber NUR in Frames, in denen
   * tatsächlich gerendert wurde (`needsRender` war `true`) — genau der Pfad,
   * den Kameraflug UND Orbit-Geste beide durchlaufen. KEINE zweite
   * rAF-Schleife für Labels: sie reprojizieren sich exakt einmal pro
   * tatsächlich gerendertem Frame über diesen Callback (README/Perf-Vorgabe,
   * `[REGRESSION]`-Test WP-C4.1 bleibt dadurch unangetastet).
   */
  onFrame?: (camera: THREE.PerspectiveCamera) => void;
  /** WP-C4-Andockpunkt für den Kamera-Controller (Zoom-Grenzen setzen, Loop wecken). */
  controlsApiRef?: MutableRefObject<CityControlsApi | null>;
  /** WP-C4/Debug-Zugriff auf das rohe Szenen-Handle (`applyCameraPose`, `camera`, `target`, …) ohne `CityCanvas` selbst umzubauen. */
  sceneRef?: MutableRefObject<CitySceneHandle | null>;
  className?: string;
};

/** Kamera-Regel 2 (README): Rotation auf einen Halbraum begrenzt — nie unter den Boden, nie reine Top-Down-Draufsicht. */
const MIN_POLAR_ANGLE = (15 * Math.PI) / 180;
const MAX_POLAR_ANGLE = (80 * Math.PI) / 180; // < PI/2 (90°) — bleibt zusätzlich unter der reinen Seitenansicht.

/** Kamera-Regel 3: großzügige Zoom-Grenzen — WP-C4 verfeinert sie pro Ebene anhand von `layout.boundingRadius`. */
const MIN_DISTANCE = 1.5;
const MAX_DISTANCE = 300;

const DAMPING_FACTOR = 0.08;

/**
 * DPR-Kaskade (Mobile-Entscheidung, README): startet beim gedeckelten
 * `devicePixelRatio` (max. 2) und schaltet bei anhaltend niedriger FPS EINE
 * Stufe herunter — NIE wieder hoch innerhalb der Session. Grund: ohne diese
 * Einbahnstraße würde die App bei FPS nahe der Schwelle zwischen zwei Stufen
 * oszillieren (DPR rauf → Last steigt → FPS fällt → DPR wieder runter → …),
 * was sichtbar ruckelt statt sich zu stabilisieren.
 */
const DPR_STEPS = [2, 1.5, 1.25, 1] as const;
const MIN_FPS_THRESHOLD = 45;
const FPS_SAMPLE_WINDOW_MS = 1000;
const FPS_MIN_SAMPLES = 10;

const TAP_MAX_DISTANCE_PX = 8;
const TAP_MAX_DURATION_MS = 300;

function initialDprStepIndex(): number {
  const capped = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const index = DPR_STEPS.findIndex((step) => step <= capped);
  return index === -1 ? DPR_STEPS.length - 1 : index;
}

/**
 * Canvas + three.js-Lifecycle der Finanzstadt (WP-C3). Der gesamte
 * WebGL-Lifecycle (Szene/Renderer/Kamera/Controls) lebt AUSSERHALB des
 * React-Renderzyklus in einem einzigen Mount/Unmount-`useEffect` — React
 * besitzt nur den Container/Canvas-DOM-Knoten plus Resize-/Visibility-
 * Observer (README-Architekturtabelle, `presentation/`-Zeile).
 */
export function CityCanvas({
  layout,
  onTapBox,
  onControlsStart,
  onControlsChange,
  cameraController,
  onFrame,
  controlsApiRef,
  sceneRef,
  className,
}: CityCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<CitySceneHandle | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const reducedMotion = useReducedMotion();

  // „Aktuellster Callback"-Ref-Muster: vermeidet, dass eine neue Funktions-
  // Identität von `onTapBox`/`onControlsStart`/`onControlsChange`/
  // `cameraController` bei jedem Elternrender den teuren WebGL-Mount-Effekt
  // (Szene/Renderer/Controls neu aufbauen) auslöst. Wichtig zusätzlich für
  // `cameraController`: `CityPage` erzeugt ihn ERST NACH dem ersten Commit
  // (braucht `sceneRef`/`controlsApiRef`) — ohne Ref-Spiegelung würde der auf
  // `[]` gemountete Loop für immer den anfänglichen `null`-Wert sehen.
  const onTapBoxRef = useRef(onTapBox);
  onTapBoxRef.current = onTapBox;
  const onControlsStartRef = useRef(onControlsStart);
  onControlsStartRef.current = onControlsStart;
  const onControlsChangeRef = useRef(onControlsChange);
  onControlsChangeRef.current = onControlsChange;
  const cameraControllerRef = useRef(cameraController);
  cameraControllerRef.current = cameraController;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // Mount/Unmount: EIN Effekt für den kompletten WebGL-Lifecycle.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let handle: CitySceneHandle;
    try {
      handle = createCityScene({ canvas });
    } catch (error) {
      // jsdom-Guard / echte Grafiktreiber-Fehler: leerer Fallback-Container
      // statt eines geworfenen Fehlers, der die ganze Seite abreißt.
      console.error('[CityCanvas] WebGL-Kontext konnte nicht erstellt werden.', error);
      setWebglUnavailable(true);
      return;
    }

    handleRef.current = handle;
    if (sceneRef) sceneRef.current = handle;

    // WP-C6: MUSS hier (im Mount-Effekt) gesetzt werden, NICHT erst im
    // separaten `reducedMotion`-Sync-Effekt weiter unten — Effekte laufen
    // beim initialen Mount in Deklarationsreihenfolge, und der Layout-Effekt
    // (`[layout]`, unten) ruft direkt danach den ERSTEN `applyLayout()`-Aufruf
    // auf. Ohne diese Zeile hier würde die Startszene je nach Default in
    // `city-scene.ts` entweder fälschlich durchanimieren (Balken wachsen von
    // 0 hoch, obwohl `prefers-reduced-motion` aktiv ist) oder nie animieren
    // (Default `false`). Schließt bewusst über den aktuellen `reducedMotion`-
    // Wert beim Mount (wie `controls.enableDamping` unten) — spätere System-
    // Einstellungsänderungen pflegt der dedizierte Effekt weiter unten.
    handle.setAnimationsEnabled(!reducedMotion);

    const controls = new OrbitControls(handle.camera, handle.domElement);
    controls.target = handle.target; // Gleiche Vector3-Instanz wie die Szene — Controls und Szene laufen nie auseinander.
    controls.enableDamping = !reducedMotion; // Kamera-Regel 6: Damping komplett aus bei prefers-reduced-motion.
    controls.dampingFactor = DAMPING_FACTOR;
    controls.enablePan = false;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.minPolarAngle = MIN_POLAR_ANGLE;
    controls.maxPolarAngle = MAX_POLAR_ANGLE;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controlsRef.current = controls;

    // WP-C4: kleine imperative API für den (extern in `CityPage.tsx`
    // verwalteten) Kamera-Controller — Zoom-Grenzen setzen (Regel 6) und den
    // Render-on-Demand-Loop wecken (`invalidate` unten, per Referenz erst
    // NACH ihrer Definition zugewiesen, siehe unten).
    if (controlsApiRef) {
      controlsApiRef.current = {
        setLimits: (minDistance, maxDistance) => {
          controls.minDistance = minDistance;
          controls.maxDistance = maxDistance;
        },
        invalidate: () => invalidate(),
      };
    }

    // --- Render-on-Demand-Loop -------------------------------------------
    // Läuft NUR, solange (a) der Nutzer aktiv interagiert, (b) Damping noch
    // ausklingt (`controls.update()` gibt bei JEDEM Aufruf zurück, ob sich
    // Kamera/Target seit dem letzten Aufruf messbar verändert haben — bei
    // aktivem Damping bleibt das nach Loslassen so lange `true`, bis die
    // Trägheit unter die interne Epsilon-Schwelle abgeklungen ist; kein
    // zusätzliches Zeitfenster nötig), oder (c) `invalidate()` von außen
    // (Resize, Layout-Wechsel, DPR-Stufenwechsel) einen einzelnen Frame anfordert.
    let rafHandle: number | null = null;
    let needsRender = true;
    let isInteracting = false;
    const fpsSamples: number[] = [];
    let dprStepIndex = initialDprStepIndex();
    let lastWidth = 0;
    let lastHeight = 0;

    function applyCurrentDpr() {
      if (lastWidth <= 0 || lastHeight <= 0) return;
      handle.setSize(lastWidth, lastHeight, DPR_STEPS[dprStepIndex]);
    }

    function trackFps(timestamp: number) {
      fpsSamples.push(timestamp);
      while (fpsSamples.length > 0 && timestamp - fpsSamples[0] > FPS_SAMPLE_WINDOW_MS) {
        fpsSamples.shift();
      }
      if (fpsSamples.length < FPS_MIN_SAMPLES) return;

      const elapsedS = (timestamp - fpsSamples[0]) / 1000;
      if (elapsedS <= 0) return;
      const fps = (fpsSamples.length - 1) / elapsedS;

      if (fps < MIN_FPS_THRESHOLD && dprStepIndex < DPR_STEPS.length - 1) {
        dprStepIndex += 1; // Einbahnstraße — siehe Kommentar bei `DPR_STEPS`.
        applyCurrentDpr();
        fpsSamples.length = 0;
      }
    }

    function invalidate() {
      needsRender = true;
      startLoopIfNeeded();
    }

    function startLoopIfNeeded() {
      if (rafHandle !== null) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      rafHandle = requestAnimationFrame(tick);
    }

    function tick(timestamp: number) {
      // `rafHandle` bleibt während des GESAMTEN Ticks gesetzt („Loop läuft"):
      // `invalidate()`-Aufrufe, die INNERHALB dieses Frames landen (Controller-
      // Flug ruft `deps.invalidate` pro Tick, OrbitControls' 'change'-Event
      // feuert aus `controls.update()` heraus), dürfen keinen parallelen rAF
      // planen. [REGRESSION] WP-C4.1: vorher wurde `rafHandle` hier sofort
      // genullt — jeder Mid-Tick-invalidate plante einen ZWEITEN Callback,
      // dessen Handle das Loop-Ende ohne cancel überschrieb → die Callback-
      // Zahl verdoppelte sich pro Frame (exponentieller Render-Sturm, spürbar
      // als massiver FPS-Einbruch bei jedem Flug/jeder Orbit-Geste).
      //
      // WP-C4: der Kamera-Controller tickt ZUERST (wendet ggf. eine
      // interpolierte Auto-Flug-Pose für diesen Frame an), DANACH liest
      // `controls.update()` die (evtl. gerade von ihm gesetzte) Kamera-/
      // Target-Position ein — vermeidet einen 1-Frame-Lag zwischen
      // Flug-Tween und OrbitControls' internem Zustand.
      const controllerActive = cameraControllerRef.current?.tick(timestamp) ?? false;
      const controlsChanged = controls.update();
      // WP-C6: Aufbau-Animationen (Balkenwachstum/Hüllen-Fade/Etagen-Split)
      // laufen über DIESEN bestehenden Loop — kein zweiter rAF/Timer (Single-
      // rAF-Invariante, REGRESSION-Test WP-C4.1 oben). Muss vor `render()`
      // laufen (unten), damit ein in diesem Frame fortgeschriebener Tween
      // auch tatsächlich mitgerendert wird.
      const sceneAnimating = handle.advanceAnimations(timestamp);
      const changed = controllerActive || controlsChanged || sceneAnimating;
      if (changed) needsRender = true;
      if (isInteracting) trackFps(timestamp);

      if (needsRender) {
        handle.render();
        needsRender = false;
        // WP-C5: NUR hier (tatsächlich gerendertes Frame) — kein separater
        // Timer/rAF für Labels, siehe Prop-Dokumentation oben.
        onFrameRef.current?.(handle.camera);
      }

      // Erst JETZT freigeben und GENAU EINE Stelle plant den Folgeframe.
      // Loop läuft weiter, solange (a) der automatische Flug noch aktiv ist,
      // (b) `controls.update()` noch Änderung meldet (Damping-Ausklang),
      // (c) der Nutzer aktiv interagiert, oder (d) ein Mid-Tick-invalidate
      // NACH dem Render oben einen weiteren Frame angefordert hat.
      rafHandle = null;
      if (changed || isInteracting || needsRender) {
        startLoopIfNeeded();
      }
    }

    const handleControlsStart = () => {
      isInteracting = true;
      onControlsStartRef.current?.();
      invalidate();
    };
    const handleControlsEnd = () => {
      isInteracting = false;
      // Loop läuft weiter, solange `controls.update()` noch `true` liefert
      // (Damping-Ausklang) — kein separates Zeitfenster nötig.
      invalidate();
    };
    const handleControlsChange = () => {
      onControlsChangeRef.current?.();
      invalidate();
    };

    controls.addEventListener('start', handleControlsStart);
    controls.addEventListener('end', handleControlsEnd);
    controls.addEventListener('change', handleControlsChange);

    // --- Resize -------------------------------------------------------
    const applySize = () => {
      const rect = container.getBoundingClientRect();
      lastWidth = rect.width;
      lastHeight = rect.height;
      handle.setSize(rect.width, rect.height, DPR_STEPS[dprStepIndex]);
      invalidate();
    };
    applySize();
    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    // --- Visibility (Akku: Loop pausiert im Hintergrund-Tab) ----------
    const handleVisibilityChange = () => {
      if (!document.hidden) invalidate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- Tap-Erkennung (pointerdown/up, kein Drag) ---------------------
    let pointerDown: { x: number; y: number; t: number } | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    };
    const handlePointerUp = (event: PointerEvent) => {
      const start = pointerDown;
      pointerDown = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const distance = Math.hypot(dx, dy);
      const duration = event.timeStamp - start.t;
      if (distance < TAP_MAX_DISTANCE_PX && duration < TAP_MAX_DURATION_MS) {
        const id = handle.pick(event.clientX, event.clientY);
        onTapBoxRef.current(id);
      }
    };
    const handlePointerCancel = () => {
      pointerDown = null;
    };
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);

    invalidate();

    return () => {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('end', handleControlsEnd);
      controls.removeEventListener('change', handleControlsChange);
      controls.dispose();
      controlsRef.current = null;
      if (controlsApiRef) controlsApiRef.current = null;
      handle.dispose();
      handleRef.current = null;
      if (sceneRef) sceneRef.current = null;
    };
    // Bewusst `[]`: `layout` wird über einen eigenen Effekt (unten) reaktiv
    // angewendet (`applyLayout`, KEIN Szenen-Neuaufbau); `reducedMotion` wird
    // über den Effekt darunter reaktiv auf `controls.enableDamping` gespiegelt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layout-Änderung: diff-arm anwenden, KEIN React-Re-Render der Szene.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.applyLayout(layout);
  }, [layout]);

  // `prefers-reduced-motion` kann sich zur Laufzeit ändern (System-Setting) —
  // ohne den ganzen Mount-Effekt neu zu triggern, einfach auf den Controls
  // UND die Szene (WP-C6) gespiegelt. Läuft auch beim initialen Mount (dritter
  // Effekt in Deklarationsreihenfolge) — dann redundant zum Aufruf im
  // Mount-Effekt oben (derselbe Wert, kein sichtbarer Unterschied), relevant
  // wird dieser Effekt erst bei SPÄTEREN Änderungen der System-Einstellung.
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enableDamping = !reducedMotion;
    if (handleRef.current) handleRef.current.setAnimationsEnabled(!reducedMotion);
  }, [reducedMotion]);

  // WP-C9: Light/Dark zur Laufzeit spiegeln. Die Szene liest ihr Start-Theme
  // bei der Erstellung selbst aus der `dark`-Klasse (`initialTheme` in
  // `city-scene.ts`); dieser Effekt hält es bei späteren Theme-Wechseln (App-
  // Toggle/System) synchron und fordert einen Frame an. Eigener Effekt statt
  // im `[]`-Mount-Effekt, weil das Abo über die gesamte Mount-Lebensdauer aktiv
  // bleiben muss; `handleRef`/`controlsApiRef` sind dann bereits gesetzt.
  useEffect(() => {
    const apply = (dark: boolean) => {
      handleRef.current?.setTheme(dark ? 'dark' : 'light');
      controlsApiRef?.current?.invalidate();
    };
    const unsubscribe = subscribeToDarkModeChanges(apply);
    // Einmal angleichen, falls sich das Theme zwischen Szenen-Erstellung und
    // diesem Effekt-Lauf geändert hat (selten, aber deterministisch abgedeckt).
    apply(isDarkMode());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (webglUnavailable) {
    return <div data-testid="city-canvas-unavailable" className={className} ref={containerRef} />;
  }

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none overscroll-contain"
        style={{ touchAction: 'none' }}
        data-testid="city-canvas"
      />
    </div>
  );
}
