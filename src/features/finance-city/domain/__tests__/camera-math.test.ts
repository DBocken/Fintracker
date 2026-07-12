import { describe, it, expect } from 'vitest';
import {
  fitCameraDistance,
  visualCenterOffset,
  easeInOutCubic,
  sphericalPose,
  zoomOutTargetLerp,
} from '../camera-math';

describe('fitCameraDistance', () => {
  describe('Happy Path', () => {
    it('sollte für fovY 50°, aspect 1, margin 1 die handgerechnete Distanz liefern', () => {
      // fovX == fovY bei aspect 1 (quadratischer Viewport) -> minFov = 50°.
      // r / sin(25°) * 1
      const r = 10;
      const expected = r / Math.sin((25 * Math.PI) / 180);
      expect(fitCameraDistance(r, 50, 1, 1)).toBeCloseTo(expected, 10);
    });

    it('sollte den Default-margin 1.15 anwenden, wenn keiner übergeben wird', () => {
      const r = 10;
      const withDefault = fitCameraDistance(r, 50, 1);
      const withExplicit = fitCameraDistance(r, 50, 1, 1.15);
      expect(withDefault).toBeCloseTo(withExplicit, 10);
    });

    it('sollte bei schmalem Viewport (aspect < 1) eine GRÖSSERE Distanz liefern als bei aspect 1', () => {
      const r = 10;
      const square = fitCameraDistance(r, 50, 1, 1);
      const narrow = fitCameraDistance(r, 50, 0.5, 1);
      expect(narrow).toBeGreaterThan(square);
    });

    it('sollte bei breitem Viewport (aspect > 1) dieselbe Distanz wie bei aspect 1 liefern, wenn fovY der limitierende Faktor bleibt', () => {
      // Bei aspect > 1 ist fovX > fovY, also bleibt fovY der kleinere (limitierende) Winkel.
      const r = 10;
      const square = fitCameraDistance(r, 50, 1, 1);
      const wide = fitCameraDistance(r, 50, 2, 1);
      expect(wide).toBeCloseTo(square, 10);
    });
  });

  describe('Edge Cases / Monotonie', () => {
    it('sollte streng monoton steigend in boundingRadius sein', () => {
      const d1 = fitCameraDistance(5, 50, 1);
      const d2 = fitCameraDistance(10, 50, 1);
      const d3 = fitCameraDistance(20, 50, 1);
      expect(d2).toBeGreaterThan(d1);
      expect(d3).toBeGreaterThan(d2);
    });

    it('sollte 0 liefern, wenn boundingRadius 0 ist', () => {
      expect(fitCameraDistance(0, 50, 1)).toBe(0);
    });
  });
});

describe('visualCenterOffset', () => {
  describe('Happy Path', () => {
    it('sollte 0 liefern, wenn chromeTopPx 0 ist (kein oberes Chrome)', () => {
      expect(visualCenterOffset(800, 0, 800)).toBe(0);
    });

    it('sollte einen positiven Anteil liefern, wenn oberes Chrome Fläche frisst', () => {
      // 800px Viewport, 100px oberes Chrome -> nutzbare Fläche beginnt bei 100.
      // Visuelles Zentrum der nutzbaren Fläche liegt bei 100 + usableHeight/2.
      const offset = visualCenterOffset(700, 100, 800);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(1);
    });

    it('sollte proportional zum Chrome-Anteil wachsen', () => {
      const small = visualCenterOffset(750, 50, 800);
      const large = visualCenterOffset(600, 200, 800);
      expect(large).toBeGreaterThan(small);
    });
  });
});

describe('easeInOutCubic', () => {
  it('sollte easeInOutCubic(0) = 0 liefern', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 10);
  });

  it('sollte easeInOutCubic(1) = 1 liefern', () => {
    expect(easeInOutCubic(1)).toBeCloseTo(1, 10);
  });

  it('sollte easeInOutCubic(0.5) = 0.5 liefern', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it('sollte punktsymmetrisch um (0.5, 0.5) sein', () => {
    for (const t of [0.1, 0.25, 0.4]) {
      const a = easeInOutCubic(t) - 0.5;
      const b = 0.5 - easeInOutCubic(1 - t);
      expect(a).toBeCloseTo(b, 10);
    }
  });

  it('sollte monoton steigend sein', () => {
    const samples = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1].map(easeInOutCubic);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });
});

describe('sphericalPose', () => {
  describe('Happy Path', () => {
    it('sollte bei polarRad = 90° (Äquator) und azimuthRad = 0 eine Position auf der +x/+z-Ebene relativ zum Target liefern', () => {
      const target = { x: 0, y: 0, z: 0 };
      const pose = sphericalPose(target, 10, 0, Math.PI / 2);
      expect(pose.target).toEqual(target);
      // Radius muss stimmen.
      const dx = pose.position.x - target.x;
      const dy = pose.position.y - target.y;
      const dz = pose.position.z - target.z;
      const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(radius).toBeCloseTo(10, 10);
      expect(pose.position.y).toBeCloseTo(0, 10);
    });

    it('sollte Roundtrip mit Winkeln konsistent sein (Position-Richtung entspricht Azimut/Polar, Radius stimmt)', () => {
      const target = { x: 3, y: 1, z: -2 };
      const radius = 7;
      const azimuth = Math.PI / 4;
      const polar = Math.PI / 3;
      const pose = sphericalPose(target, radius, azimuth, polar);

      const dx = pose.position.x - target.x;
      const dy = pose.position.y - target.y;
      const dz = pose.position.z - target.z;
      const actualRadius = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(actualRadius).toBeCloseTo(radius, 10);

      // polar = Winkel von der +y-Achse (three.js-Konvention): y = r*cos(polar)
      expect(dy).toBeCloseTo(radius * Math.cos(polar), 10);
    });

    it('sollte bei polarRad nahe 0 die Position fast direkt über dem Target platzieren', () => {
      const target = { x: 0, y: 0, z: 0 };
      const pose = sphericalPose(target, 10, 1.234, 0.0001);
      expect(pose.position.y).toBeCloseTo(10, 2);
      expect(Math.abs(pose.position.x)).toBeLessThan(0.1);
      expect(Math.abs(pose.position.z)).toBeLessThan(0.1);
    });
  });
});

describe('zoomOutTargetLerp', () => {
  const cityCenter = { x: 0, y: 0, z: 0 };
  const focusTarget = { x: 5, y: 2, z: -3 };
  const focusRadius = 5;
  const cityRadius = 50;

  describe('Happy Path', () => {
    it('sollte bei currentRadius === focusRadius das aktuelle Target unverändert liefern', () => {
      const result = zoomOutTargetLerp(focusTarget, cityCenter, focusRadius, focusRadius, cityRadius);
      expect(result.x).toBeCloseTo(focusTarget.x, 10);
      expect(result.y).toBeCloseTo(focusTarget.y, 10);
      expect(result.z).toBeCloseTo(focusTarget.z, 10);
    });

    it('sollte bei currentRadius >= cityRadius das Stadtzentrum liefern', () => {
      const atCity = zoomOutTargetLerp(focusTarget, cityCenter, cityRadius, focusRadius, cityRadius);
      expect(atCity).toEqual(cityCenter);

      const beyondCity = zoomOutTargetLerp(focusTarget, cityCenter, cityRadius * 2, focusRadius, cityRadius);
      expect(beyondCity).toEqual(cityCenter);
    });

    it('sollte dazwischen monoton von focusTarget zu cityCenter wandern', () => {
      const radii = [focusRadius, 15, 25, 35, cityRadius];
      const results = radii.map((r) => zoomOutTargetLerp(focusTarget, cityCenter, r, focusRadius, cityRadius));

      // Distanz zum cityCenter soll mit wachsendem Radius monoton fallen.
      const distances = results.map((p) => Math.hypot(p.x - cityCenter.x, p.y - cityCenter.y, p.z - cityCenter.z));
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeLessThanOrEqual(distances[i - 1] + 1e-9);
      }
    });
  });

  describe('Edge Cases', () => {
    it('sollte currentRadius < focusRadius auf [0..1] clampen (Ergebnis bleibt focusTarget)', () => {
      const result = zoomOutTargetLerp(focusTarget, cityCenter, focusRadius - 10, focusRadius, cityRadius);
      expect(result.x).toBeCloseTo(focusTarget.x, 10);
      expect(result.y).toBeCloseTo(focusTarget.y, 10);
      expect(result.z).toBeCloseTo(focusTarget.z, 10);
    });
  });
});
