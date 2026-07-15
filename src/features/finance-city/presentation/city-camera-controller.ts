/**
 * Imperativer Kamera-Controller der Finanzstadt (WP-C4, `README.md`
 * "Kamera-Regeln" + die 7 WP-C4-Spec-Regeln der Aufgabenstellung). Reine
 * Zustandsmaschine + Mathematik-Orchestrierung, KEIN React, KEIN three.js —
 * alle Abhängigkeiten (Kamera lesen/schreiben, Fog/Control-Limits setzen,
 * Render-Loop wecken, Zoom-out melden) kommen als Plain-Callbacks (`deps`),
 * damit der Controller ohne WebGL-Kontext voll testbar bleibt
 * (`presentation/__tests__/city-camera-controller.test.ts`).
 *
 * Nutzt AUSSCHLIESSLICH die Mathematik aus `domain/camera-math.ts`
 * (`fitCameraDistance`, `sphericalPose`, `sphericalFromPose`,
 * `easeInOutCubic`, `zoomOutTargetLerp`, `visualCenterOffset`) — keine
 * Parallel-Mathematik hier. `domain/city-layout.ts#computeFocusBounds`
 * liefert die Fokus-Bounding-Sphere für Distrikt-/Unterkategorie-Ziele.
 */

import { fitCameraDistance, sphericalPose, sphericalFromPose, easeInOutCubic, zoomOutTargetLerp, visualCenterOffset } from '../domain/camera-math';
import type { Vec3 } from '../domain/city-model';
import type { CityLayout } from '../domain/city-layout';
import type { CityCameraIntent } from '../application/city-view-model';
import { CAMERA_FOV_Y_DEG } from './city-scene';

/**
 * Regel 1: „Automatische Kamerabewegung hat einen expliziten Aktiv-
 * Zustand." — der Controller hält diese Struktur intern als EINE
 * Wahrheitsquelle statt verstreuter Flags; extern beobachtbar über den
 * Rückgabewert von `tick()` (true, solange der Flug läuft).
 */
export type CameraFlight = {
  active: boolean;
  /** `null` = noch nicht gestartet — der ERSTE `tick(nowMs)`-Aufruf danach definiert `t=0` (kein `Date.now()` im Controller, Zeit kommt ausschließlich als Parameter). */
  startMs: number | null;
  durationMs: number;
  from: { position: Vec3; target: Vec3 };
  to: { position: Vec3; target: Vec3 };
};

export type CityFocusBounds = { center: Vec3; radius: number };

export type CityCameraControllerConfig = {
  fovYDeg: number;
  aspect: number;
  /** Höhe des oberen Chromes (Header/Breadcrumb/Tabs) in px — für die Sichtzentrums-Korrektur der Stadt-Framing-Pose (`visualCenterOffset`). */
  chromeTopPx: number;
  viewportHeightPx: number;
  reducedMotion: boolean;
};

export type CityCameraController = {
  /**
   * Startet einen Flug NUR bei neuer `intent.seq` (Regel 4) — dieselbe `seq`
   * erneut zu übergeben ist ein No-op, auch wenn ein vorheriger Flug bereits
   * abgeschlossen ist (Regression: kein "erneutes Losfliegen" bei Re-Renders
   * mit unverändertem Intent).
   */
  onIntent(intent: CityCameraIntent, ctx: { layout: CityLayout; focusLayout?: CityFocusBounds | null }): void;
  /**
   * Von der Render-Loop pro Frame aufgerufen (injizierte Zeit, KEIN
   * `Date.now()` im Controller). Interpoliert Position UND Target
   * (Easing `easeInOutCubic`) und ruft `deps.applyCameraPose`. Liefert
   * `true`, solange der Flug danach noch aktiv ist (Regel 1) — die
   * Aufrufer-Loop nutzt das als "weiter rendern"-Signal.
   */
  tick(nowMs: number): boolean;
  /** Regel 2: beendet einen laufenden Flug sofort; die zuletzt angewandte Pose bleibt unverändert stehen ("eingefroren"), kein weiterer `applyCameraPose`-Aufruf. */
  cancelFlight(): void;
  /**
   * Regel 5/6: außerhalb eines aktiven Fluges (sonst würde die manuelle
   * Zoom-out-Korrektur gegen den Flug-Tween kämpfen) misst den aktuellen
   * Radius, schiebt das Orbit-Target per `zoomOutTargetLerp` Richtung
   * Stadtmitte und meldet einmalig (entprellt bis zum nächsten Intent) das
   * Überschreiten der Zoom-out-Schwelle.
   */
  onControlsChange(): void;
  configure(opts: CityCameraControllerConfig): void;
  dispose(): void;
};

export type CityCameraControllerDeps = {
  getCameraPose(): { position: Vec3; target: Vec3 };
  applyCameraPose(pose: { position: Vec3; target: Vec3 }): void;
  setControlLimits(opts: { minDistance: number; maxDistance: number }): void;
  setFog(near: number, far: number): void;
  invalidate(): void;
  onZoomOutThreshold(): void;
};

/** Flugdauer (README/Spec: "~700 ms"), gilt für Positions- UND Target-Interpolation gleichermaßen. */
const FLIGHT_DURATION_MS = 700;

/**
 * Startpose der Stadt-Übersicht (Kamera-Regel 1 im README, "Auto-Frame"):
 * 45°-Azimut vermeidet einen Blick exakt entlang einer Distrikt-Grenze,
 * 62° Polar liest die Balkenhöhen (= Beträge) schon in der Stadt-Übersicht
 * gut ab und bleibt dabei klar eine Vogelperspektive innerhalb der erlaubten
 * Halbraum-Spanne (Kamera-Regel 2, 15°–80°). Der Polarwinkel bleibt jetzt
 * über ALLE Zoom-Ebenen hinweg konstant (siehe `focus-district`/
 * `enter-district`/`enter-subcategory` unten) — Nutzer-Befund „Balken werden
 * beim Reinzoomen kleiner" kam vom Kamera-Kippen, nicht von der Balkenhöhe
 * selbst (die ist modellweit ohnehin immer gleich, `city-layout.ts`).
 */
const CITY_DEFAULT_AZIMUTH_RAD = Math.PI / 4;
const CITY_DEFAULT_POLAR_RAD = (62 * Math.PI) / 180;

/** Fallback-Aspect, bevor `configure()` je aufgerufen wurde (Startwert, seltener Pfad). */
const DEFAULT_ASPECT = 16 / 9;

/**
 * Marge für den harten Zoom-out-Anschlag (Regel 6, `maxDistance`): etwas
 * großzügiger als die Standard-Rahmen-Marge (`fitCameraDistance`-Default
 * 1.15), damit der Nutzer noch minimal über die exakte Stadt-Passung hinaus
 * herauszoomen kann, bevor OrbitControls hart clamped.
 */
const CITY_MAX_DISTANCE_MARGIN = 1.25;

/** Gleich `CityCanvas.MIN_DISTANCE` (Kamera-Regel 3, README) — hier dupliziert, weil `CityCanvas.tsx` laut WP-C4-Auftrag nur MINIMAL angefasst werden soll (keine neue geteilte Konstanten-Datei) und die Zahl ohnehin nur als Startwert dient, den `setControlLimits` sofort überschreibt. */
const MIN_DISTANCE = 1.5;

/** Marge für Distrikt-Fokusflüge — abhängig davon, ob nur fokussiert (Stadt-Ebene, soll noch Kontext der Nachbar-Distrikte zeigen) oder bereits eingetaucht (enger, dedizierte Distrikt-Ansicht). */
const DISTRICT_FOCUS_MARGIN: Record<'focus-district' | 'enter-district', number> = {
  'focus-district': 1.6,
  'enter-district': 1.25,
};

/** Marge für den Unterkategorie-Fokusflug (Etagen sind klein — näher heranfahren als bei einem ganzen Distrikt). */
const SUBCATEGORY_FIT_MARGIN = 1.8;

/** Regel 6: Zoom-out-Schwelle als Anteil der maximalen Kameradistanz (z. B. 0.85 * cityFitDistance). */
const ZOOM_OUT_THRESHOLD_RATIO = 0.85;

/** Regel 7: `fog.far = maxDistance + FOG_DIAMETER_MARGIN * cityRadius` (Stadtdurchmesser = 2 * Radius). */
const FOG_DIAMETER_MARGIN = 2;

const EPSILON = 1e-6;

function lerpVec3(from: Vec3, to: Vec3, t: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

function approxEqualVec3(a: Vec3, b: Vec3): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON && Math.abs(a.z - b.z) < EPSILON;
}

/** Kürzester Weg zur nächsten Seitenansicht: rundet den Azimut auf das nächste Vielfache von 90° (PI/2). */
function nearestQuarterTurnAzimuth(azimuthRad: number): number {
  const quarter = Math.PI / 2;
  return Math.round(azimuthRad / quarter) * quarter;
}

export function createCityCameraController(deps: CityCameraControllerDeps): CityCameraController {
  let config: CityCameraControllerConfig = {
    fovYDeg: CAMERA_FOV_Y_DEG,
    aspect: DEFAULT_ASPECT,
    chromeTopPx: 0,
    viewportHeightPx: 0,
    reducedMotion: false,
  };

  let flight: CameraFlight | null = null;
  let lastSeq: number | null = null;

  /** Zuletzt aus einem 'fit-city'/'reset'-Intent übernommene Stadt-Bounding-Sphere (README: `ctx.layout` ist bei diesen Intents IMMER die volle Stadt, da `nav.level` dabei stets 'city' ist). */
  let cityContext: CityFocusBounds | null = null;
  /** Distanz des harten Zoom-out-Anschlags (Regel 6) — aus `cityContext` + `config` abgeleitet, für `onControlsChange` (Schwellenwert) und `zoomOutTargetLerp` (obere Lerp-Grenze) gecacht. */
  let cityFitMaxDistance = 0;
  /** Distanz des zuletzt gestarteten Fokusflugs (Distrikt/Unterkategorie) — untere Lerp-Grenze für `zoomOutTargetLerp` in `onControlsChange`. `null` = kein aktiver Fokus (Stadt-Ebene). */
  let lastFocusDistance: number | null = null;
  /** Anker des aktiven Fokus (Viertel-/Balken-Zentrum) — Ausgangspunkt der Zoom-out-Target-Abbildung. Ohne Fokus greift Regel 5 nicht (auf Stadt-Ebene darf keine Controls-Interaktion das Target verschieben — sonst würde die Silhouetten-Y-Korrektur der Fit-Pose beim ersten Drag weggezogen). */
  let lastFocusCenter: Vec3 | null = null;
  /** Regel 6: Entprellung der Zoom-out-Schwellenmeldung bis zum nächsten Intent. */
  let thresholdReported = false;

  function applyCityControlLimitsAndFog(): void {
    if (!cityContext) return;
    cityFitMaxDistance = fitCameraDistance(cityContext.radius, config.fovYDeg, config.aspect, CITY_MAX_DISTANCE_MARGIN);
    deps.setControlLimits({ minDistance: MIN_DISTANCE, maxDistance: cityFitMaxDistance });

    // Regel 7: Fog darf INNERHALB der maximalen Kameradistanz nichts
    // ausblenden -> `near` beginnt erst GENAU am Zoom-out-Anschlag; `far`
    // liegt eine ganze Stadt-Durchmesser-Länge dahinter (weicher Ausklang
    // statt hartem Abschnitt am Rand).
    const far = cityFitMaxDistance + FOG_DIAMETER_MARGIN * cityContext.radius;
    deps.setFog(cityFitMaxDistance, far);
  }

  /**
   * Stadt-Framing-Pose (Ziele der Intents 'fit-city'/'reset'): Target =
   * Stadtzentrum, EIN Korrekturschritt für die Sichtzentrums-Verschiebung
   * (`visualCenterOffset`) wird direkt in die Ziel-Pose eingerechnet, statt
   * als separater Nachbearbeitungsschritt NACH Abschluss des Fluges
   * (dokumentierte Vereinfachung — siehe Abschnitt "Abweichungen" im
   * Auftrags-Report: die Korrektur ist bei fester Ziel-Pose ein
   * geschlossener Ausdruck, keine Iteration nötig, und vermeidet einen
   * zweiten sichtbaren Sprung nach Ende des Tweens).
   */
  function computeFitCityPose(): { position: Vec3; target: Vec3 } {
    const cityCenter = cityContext!.center;
    const distance = fitCameraDistance(cityContext!.radius, config.fovYDeg, config.aspect);

    const fovYRad = (config.fovYDeg * Math.PI) / 180;
    const visibleWorldHeight = 2 * distance * Math.tan(fovYRad / 2);
    const usableHeightPx = Math.max(0, config.viewportHeightPx - config.chromeTopPx);
    const offsetRatio = visualCenterOffset(usableHeightPx, config.chromeTopPx, config.viewportHeightPx);

    // Positiver offsetRatio: das visuelle Zentrum der nutzbaren Fläche liegt
    // UNTER der geometrischen Bildmitte (oberes Chrome frisst Fläche) -> das
    // Kamera-Target muss nach OBEN wandern (+Y), damit die Stadt beim
    // Blick entlang `target` in der tatsächlich sichtbaren (unteren) Fläche
    // zentriert erscheint.
    const adjustedTarget: Vec3 = { ...cityCenter, y: cityCenter.y + offsetRatio * visibleWorldHeight };

    return sphericalPose(adjustedTarget, distance, CITY_DEFAULT_AZIMUTH_RAD, CITY_DEFAULT_POLAR_RAD);
  }

  function startFlight(toPose: { position: Vec3; target: Vec3 }): void {
    const fromPose = deps.getCameraPose();

    if (config.reducedMotion) {
      // Reduzierte Bewegung: Sofort-Schnitt statt Tween — Regel-Semantik
      // bleibt (Ziel-Pose ist identisch), nur ohne Zwischenschritte/`tick`.
      flight = null;
      deps.applyCameraPose(toPose);
      deps.invalidate();
      return;
    }

    flight = {
      active: true,
      startMs: null,
      durationMs: FLIGHT_DURATION_MS,
      from: { position: { ...fromPose.position }, target: { ...fromPose.target } },
      to: { position: { ...toPose.position }, target: { ...toPose.target } },
    };
    deps.invalidate();
  }

  function onIntent(intent: CityCameraIntent, ctx: { layout: CityLayout; focusLayout?: CityFocusBounds | null }): void {
    if (intent.seq === lastSeq) return; // Regel 4: keine Doppel-Flüge für dieselbe seq.
    lastSeq = intent.seq;
    thresholdReported = false; // Regel 6: neue Entprellungs-Runde ab jedem neuen Intent.

    switch (intent.kind) {
      case 'fit-city':
      case 'reset': {
        if (ctx.layout.boundingRadius <= 0) return; // Leeres Modell — kein sinnvolles Ziel.
        cityContext = { center: ctx.layout.center, radius: ctx.layout.boundingRadius };
        lastFocusDistance = null; // Kein aktiver Fokus mehr.
        lastFocusCenter = null;
        applyCityControlLimitsAndFog();
        startFlight(computeFitCityPose());
        return;
      }

      case 'focus-district':
      case 'enter-district': {
        if (!ctx.focusLayout) return;
        const current = deps.getCameraPose();
        const { azimuthRad, polarRad } = sphericalFromPose(current.position, current.target);
        const margin = DISTRICT_FOCUS_MARGIN[intent.kind];
        const distance = fitCameraDistance(ctx.focusLayout.radius, config.fovYDeg, config.aspect, margin);
        lastFocusDistance = distance;
        lastFocusCenter = { ...ctx.focusLayout.center };
        // Azimut UND Polarwinkel bleiben bei BEIDEN Intents erhalten (Regel 3)
        // — nur die Distanz ändert sich. Der Blickwinkel ist damit über alle
        // Zoom-Ebenen konstant, die (modellweit gleich hohen) Balken behalten
        // beim Rein-/Rauszoomen eine konsistente Silhouette (Nutzer-Befund
        // „Balken werden beim Klick aufs Viertel kleiner" kam vom Kamera-
        // Kippen, nicht von der tatsächlichen Balkenhöhe).
        const polar = polarRad;
        startFlight(sphericalPose(ctx.focusLayout.center, distance, azimuthRad, polar));
        return;
      }

      case 'enter-subcategory': {
        if (!ctx.focusLayout) return;
        const current = deps.getCameraPose();
        const { azimuthRad, polarRad } = sphericalFromPose(current.position, current.target);
        // Azimut snappt auf die nächste Vierteldrehung (saubere Etagen-
        // Seitenansicht) — der Polarwinkel bleibt dagegen unverändert (kein
        // Drop mehr), damit die Balken-/Etagen-Silhouette konsistent mit den
        // anderen Zoom-Ebenen bleibt.
        const snappedAzimuth = nearestQuarterTurnAzimuth(azimuthRad);
        const polar = polarRad;
        const distance = fitCameraDistance(ctx.focusLayout.radius, config.fovYDeg, config.aspect, SUBCATEGORY_FIT_MARGIN);
        lastFocusDistance = distance;
        lastFocusCenter = { ...ctx.focusLayout.center };
        startFlight(sphericalPose(ctx.focusLayout.center, distance, snappedAzimuth, polar));
        return;
      }

      default:
        return;
    }
  }

  function tick(nowMs: number): boolean {
    if (!flight || !flight.active) return false;
    if (flight.startMs === null) flight.startMs = nowMs;

    const elapsed = nowMs - flight.startMs;
    const rawT = flight.durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / flight.durationMs));
    const easedT = easeInOutCubic(rawT);

    deps.applyCameraPose({
      position: lerpVec3(flight.from.position, flight.to.position, easedT),
      target: lerpVec3(flight.from.target, flight.to.target, easedT),
    });
    deps.invalidate();

    if (rawT >= 1) {
      flight.active = false;
      return false;
    }
    return true;
  }

  function cancelFlight(): void {
    // Bewusst KEIN weiterer `applyCameraPose`-Aufruf: die zuletzt per `tick()`
    // angewandte Pose bleibt exakt so stehen, wie sie ist ("eingefroren") —
    // OrbitControls übernimmt ab hier nahtlos die manuelle Kontrolle.
    if (flight) flight.active = false;
  }

  function onControlsChange(): void {
    if (flight?.active) return; // Während eines Fluges nicht gegen den Tween arbeiten.
    if (!cityContext || cityFitMaxDistance <= 0) return;

    const pose = deps.getCameraPose();
    const { radius } = sphericalFromPose(pose.position, pose.target);

    // Regel 5 greift NUR mit aktivem Fokus: die Abbildung geht idempotent vom
    // Fokus-ANKER aus (nicht vom aktuellen Target), ist damit eine reine
    // Funktion des Radius — rein wie raus konsistent ("vorwärts und rückwärts"),
    // keine pfadabhängige Konvergenz, und Rotation bei konstantem Radius
    // verschiebt nichts. Ohne Fokus (Stadt-Ebene) bleibt das Target komplett
    // unter manueller Kontrolle (kein Kampf gegen OrbitControls).
    if (lastFocusCenter && lastFocusDistance !== null) {
      const newTarget = zoomOutTargetLerp(lastFocusCenter, cityContext.center, radius, lastFocusDistance, cityFitMaxDistance);
      if (!approxEqualVec3(newTarget, pose.target)) {
        deps.applyCameraPose({ position: pose.position, target: newTarget });
        deps.invalidate();
      }
    }

    if (!thresholdReported && radius >= ZOOM_OUT_THRESHOLD_RATIO * cityFitMaxDistance) {
      thresholdReported = true;
      deps.onZoomOutThreshold();
    }
  }

  function configure(opts: CityCameraControllerConfig): void {
    config = { ...opts };
    // Resize/Chrome-Änderung: hält maxDistance/Fog konsistent mit dem neuen
    // Seitenverhältnis, ohne auf den nächsten Intent zu warten.
    if (cityContext) applyCityControlLimitsAndFog();
  }

  function dispose(): void {
    flight = null;
    cityContext = null;
    lastFocusDistance = null;
  }

  return { onIntent, tick, cancelFlight, onControlsChange, configure, dispose };
}
