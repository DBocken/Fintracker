import { describe, it, expect, vi } from 'vitest';
import { createCityCameraController } from '../city-camera-controller';
import { sphericalPose, sphericalFromPose } from '../../domain/camera-math';
import type { CityLayout } from '../../domain/city-layout';
import type { Vec3 } from '../../domain/city-model';
import type { CityCameraIntent } from '../../application/city-view-model';

/**
 * `city-camera-controller.ts` ist Three-frei konstruierbar (alle Abhängigkeiten
 * sind Plain-Callbacks) — die Tests spionieren nur diese `deps` aus, ganz ohne
 * WebGL-Kontext oder React. Zeit kommt AUSSCHLIESSLICH über `tick(nowMs)` als
 * Parameter rein (kein `Date.now()` im Controller), deshalb steuern die Tests
 * die Uhr selbst.
 */

function makeCityLayout(overrides: Partial<CityLayout> = {}): CityLayout {
  return { boxes: [], center: { x: 0, y: 0, z: 0 }, boundingRadius: 20, ...overrides };
}

function makeDeps() {
  let pose: { position: Vec3; target: Vec3 } = {
    position: { x: 0, y: 10, z: 16 },
    target: { x: 0, y: 0, z: 0 },
  };
  return {
    getCameraPose: vi.fn(() => pose),
    applyCameraPose: vi.fn((next: { position: Vec3; target: Vec3 }) => {
      pose = next;
    }),
    setControlLimits: vi.fn(),
    setFog: vi.fn(),
    invalidate: vi.fn(),
    onZoomOutThreshold: vi.fn(),
  };
}

function fitCityIntent(seq: number): CityCameraIntent {
  return { seq, kind: 'fit-city', targetId: null };
}

describe('createCityCameraController', () => {
  describe('[Regel 1] expliziter Aktiv-Zustand der automatischen Kamerafahrt', () => {
    it('sollte den Flug-Aktivzustand über tick() explizit führen (false -> true -> false, injizierte Zeit)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();

      // Vor jedem Intent: kein Flug, tick() ist reines No-op.
      expect(controller.tick(0)).toBe(false);
      expect(deps.applyCameraPose).not.toHaveBeenCalled();

      controller.onIntent(fitCityIntent(1), { layout });

      // Erster tick() NACH dem Intent definiert t=0 -> Flug ist aktiv.
      expect(controller.tick(1000)).toBe(true);
      expect(deps.applyCameraPose).toHaveBeenCalledTimes(1);

      // Nach Ablauf der Flugdauer (>= 700ms später): Flug ist beendet.
      expect(controller.tick(1700)).toBe(false);
    });
  });

  describe('[Regel 2] cancelFlight beendet einen laufenden Flug sofort', () => {
    it('sollte cancelFlight einen laufenden Flug sofort beenden und die Pose einfrieren', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();

      controller.onIntent(fitCityIntent(1), { layout });
      controller.tick(0);
      controller.tick(350); // Flug auf halbem Weg.
      const callsBeforeCancel = deps.applyCameraPose.mock.calls.length;

      controller.cancelFlight();

      expect(controller.tick(9999)).toBe(false); // Kein Fortschritt mehr möglich.
      expect(deps.applyCameraPose).toHaveBeenCalledTimes(callsBeforeCancel); // keine neue Pose danach.
    });
  });

  describe('[Regel 3] keine Pose-Anwendung ohne aktiven Flug', () => {
    it('sollte ohne aktiven Flug NIE eine Pose anwenden (kein tick-Effekt ohne Flug)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);

      expect(controller.tick(0)).toBe(false);
      expect(controller.tick(1000)).toBe(false);
      expect(controller.tick(5000)).toBe(false);
      expect(deps.applyCameraPose).not.toHaveBeenCalled();
    });
  });

  describe('[Regel 4] [REGRESSION] dieselbe seq fliegt nie doppelt', () => {
    it('sollte denselben Intent (gleiche seq) nicht erneut fliegen, eine neue seq schon', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();
      const intent = fitCityIntent(5);

      controller.onIntent(intent, { layout });
      expect(controller.tick(0)).toBe(true);
      controller.tick(700); // Flug abgeschlossen.

      controller.onIntent(intent, { layout }); // Gleiche seq erneut übergeben.
      expect(controller.tick(800)).toBe(false); // Kein neuer Flug gestartet.

      controller.onIntent({ ...intent, seq: 6 }, { layout }); // Neue seq.
      expect(controller.tick(900)).toBe(true); // Neuer Flug gestartet.
    });
  });

  describe('[Regel 5] Zoom-out lerpt das Target Richtung Stadtmitte', () => {
    it('sollte onControlsChange das Target beim Herauszoomen sanft Richtung Stadtmitte lerpen', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout({ center: { x: 0, y: 0, z: 0 }, boundingRadius: 20 });
      const focusLayout = { center: { x: 8, y: 0, z: 0 }, radius: 2 };

      controller.onIntent(fitCityIntent(1), { layout });
      const maxDistance = deps.setControlLimits.mock.calls[0][0].maxDistance as number;
      expect(maxDistance).toBeGreaterThan(0);
      controller.cancelFlight();

      controller.onIntent({ seq: 2, kind: 'enter-district', targetId: 'leisure' }, { layout, focusLayout });
      controller.cancelFlight(); // Nutzer übernimmt manuell (Regel 2) -> onControlsChange darf wirken.

      // Nutzer ist manuell auf halbem Weg zwischen Fokus- und Stadt-Distanz herausgezoomt,
      // das Target zeigt noch auf den Fokus-Mittelpunkt.
      const zoomedOutRadius = maxDistance * 0.5;
      deps.getCameraPose.mockReturnValue({
        position: { x: focusLayout.center.x, y: focusLayout.center.y, z: focusLayout.center.z + zoomedOutRadius },
        target: { ...focusLayout.center },
      });

      controller.onControlsChange();

      expect(deps.applyCameraPose).toHaveBeenCalled();
      const appliedTarget = deps.applyCameraPose.mock.calls.at(-1)![0].target as Vec3;
      const distAfter = Math.hypot(appliedTarget.x, appliedTarget.y, appliedTarget.z);
      const distBefore = Math.hypot(focusLayout.center.x, focusLayout.center.y, focusLayout.center.z);
      expect(distAfter).toBeLessThan(distBefore); // näher an der Stadtmitte als zuvor.
      expect(distAfter).toBeGreaterThan(0); // aber noch nicht exakt dort ("sanft", t < 1).
    });
  });

  describe('[Regel 6] Zoom-out-Schwelle meldet zoomOutStep genau einmal', () => {
    it('sollte die Zoom-out-Schwelle genau EINMAL pro Intent melden (Entprellung bis zum nächsten Intent)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout({ center: { x: 0, y: 0, z: 0 }, boundingRadius: 20 });

      controller.onIntent(fitCityIntent(1), { layout });
      const maxDistance = deps.setControlLimits.mock.calls[0][0].maxDistance as number;
      controller.cancelFlight();

      const beyondThreshold = maxDistance * 0.95; // > 0.85 * maxDistance
      deps.getCameraPose.mockReturnValue({ position: { x: 0, y: 0, z: beyondThreshold }, target: { x: 0, y: 0, z: 0 } });

      controller.onControlsChange();
      controller.onControlsChange();
      controller.onControlsChange();
      expect(deps.onZoomOutThreshold).toHaveBeenCalledTimes(1);

      // Neuer Intent (neue seq) setzt die Entprellung zurück.
      controller.onIntent({ seq: 2, kind: 'reset', targetId: null }, { layout });
      controller.cancelFlight();
      deps.getCameraPose.mockReturnValue({ position: { x: 0, y: 0, z: beyondThreshold }, target: { x: 0, y: 0, z: 0 } });

      controller.onControlsChange();
      expect(deps.onZoomOutThreshold).toHaveBeenCalledTimes(2);
    });
  });

  describe('[Regel 7] Fog bleibt innerhalb der maximalen Kameradistanz aus', () => {
    it('sollte Fog-far über maxDistance + Stadtdurchmesser (2 * cityRadius) konfigurieren', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout({ center: { x: 0, y: 0, z: 0 }, boundingRadius: 20 });

      controller.onIntent(fitCityIntent(1), { layout });

      expect(deps.setFog).toHaveBeenCalledTimes(1);
      const [near, far] = deps.setFog.mock.calls[0] as [number, number];
      const maxDistance = deps.setControlLimits.mock.calls[0][0].maxDistance as number;

      expect(near).toBeCloseTo(maxDistance, 10); // nichts wird innerhalb maxDistance ausgeblendet.
      expect(far).toBeCloseTo(maxDistance + 2 * layout.boundingRadius, 10);
      expect(far).toBeGreaterThan(maxDistance + layout.boundingRadius);
    });
  });

  describe('enter-subcategory: Azimut-Drehung auf die nächste Seitenansicht', () => {
    it('sollte den Azimut auf die nächste Seitenansicht (kürzester Weg zu einem Vielfachen von 90°) drehen', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();
      const focusLayout = { center: { x: 2, y: 0, z: -1 }, radius: 1 };

      // Aktuelle Kamera-Pose: Azimut 20° -> nächstes Vielfaches von 90° ist 0°.
      const currentAzimuth = (20 * Math.PI) / 180;
      const currentPolar = (50 * Math.PI) / 180;
      deps.getCameraPose.mockReturnValue(sphericalPose({ x: 0, y: 0, z: 0 }, 15, currentAzimuth, currentPolar));

      controller.onIntent({ seq: 1, kind: 'enter-subcategory', targetId: 'streaming' }, { layout, focusLayout });
      controller.tick(0);
      controller.tick(1000); // Flug abgeschlossen.

      const finalPose = deps.applyCameraPose.mock.calls.at(-1)![0] as { position: Vec3; target: Vec3 };
      const { azimuthRad } = sphericalFromPose(finalPose.position, finalPose.target);
      expect(azimuthRad).toBeCloseTo(0, 5);
    });
  });

  describe('reducedMotion: Flüge als Sofort-Schnitt', () => {
    it('sollte reducedMotion-Flüge als Sofort-Schnitt ausführen (genau ein applyCameraPose, active bleibt false)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();

      controller.configure({ fovYDeg: 50, aspect: 16 / 9, chromeTopPx: 0, viewportHeightPx: 800, reducedMotion: true });
      controller.onIntent(fitCityIntent(1), { layout });

      expect(deps.applyCameraPose).toHaveBeenCalledTimes(1);
      expect(controller.tick(0)).toBe(false); // Nie aktiv geworden.
      expect(deps.applyCameraPose).toHaveBeenCalledTimes(1); // tick() hat nichts verändert.
    });
  });

  describe('Fokusflüge erhalten Azimut/Polar der aktuellen Pose', () => {
    it('sollte enter-district Azimut/Polar der aktuellen Kamera-Pose beibehalten', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();
      const focusLayout = { center: { x: 5, y: 0, z: 3 }, radius: 2 };

      const knownAzimuth = (110 * Math.PI) / 180;
      const knownPolar = (40 * Math.PI) / 180;
      deps.getCameraPose.mockReturnValue(sphericalPose({ x: 0, y: 0, z: 0 }, 25, knownAzimuth, knownPolar));

      controller.onIntent({ seq: 1, kind: 'enter-district', targetId: 'leisure' }, { layout, focusLayout });
      controller.tick(0);
      controller.tick(1000);

      const finalPose = deps.applyCameraPose.mock.calls.at(-1)![0] as { position: Vec3; target: Vec3 };
      const { azimuthRad, polarRad } = sphericalFromPose(finalPose.position, finalPose.target);
      expect(azimuthRad).toBeCloseTo(knownAzimuth, 5);
      expect(polarRad).toBeCloseTo(knownPolar, 5);
    });
  });

  describe('Edge Cases', () => {
    it('sollte focus-district/enter-district ohne focusLayout als No-op behandeln (keine Kamerabewegung)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();

      controller.onIntent({ seq: 1, kind: 'enter-district', targetId: 'unknown' }, { layout, focusLayout: null });

      expect(controller.tick(0)).toBe(false);
      expect(deps.applyCameraPose).not.toHaveBeenCalled();
    });

    it('sollte dispose() den internen Zustand zurücksetzen (kein Flug mehr aktiv)', () => {
      const deps = makeDeps();
      const controller = createCityCameraController(deps);
      const layout = makeCityLayout();

      controller.onIntent(fitCityIntent(1), { layout });
      controller.tick(0);
      controller.dispose();

      expect(controller.tick(1000)).toBe(false);
    });
  });
});
