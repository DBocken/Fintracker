/**
 * Reine Kamera-Mathematik der 3D-Finanzstadt (WP-C1). Keine three.js-Typen
 * (z. B. `Vector3`/`Spherical`) — nur Zahlen und `Vec3` (README-Architektur-
 * tabelle, `domain/` bleibt framework-frei). `presentation/` (WP-C3) bildet
 * diese reinen Werte auf echte three.js-Kamera-/Controls-Aufrufe ab.
 *
 * Deckt die Kamera-Regeln 1/3/5/6 aus `README.md` ab: Auto-Frame (1),
 * Zoom-Grenzen (3, hier nur die Distanzberechnung — Clamping selbst ist
 * `presentation/`-Sache), gedämpfte Fokusflüge (5, Easing + azimut-erhaltende
 * Positionsberechnung), Damping (6, Easing-Baustein).
 */

import type { Vec3 } from './city-model';

/**
 * Kameradistanz, bei der eine Bounding-Sphere (Radius `boundingRadius`) in
 * BEIDE Field-of-Views (vertikal `fovYDeg`, horizontal daraus über `aspect`
 * abgeleitet) passt: `r / sin(min(fovY, fovX) / 2) * margin`.
 *
 * `fovX` folgt aus `fovY` und `aspect` über die Standard-Tangens-Formel
 * (`tan(fovX/2) = aspect * tan(fovY/2)`) — bei schmalen Viewports (aspect < 1)
 * ist `fovX` der engere (limitierende) Winkel, die Kamera muss weiter weg,
 * damit die Szene nicht seitlich abgeschnitten wird.
 *
 * `margin` (Default 1.15) gibt zusätzlichen Randabstand, damit die
 * Bounding-Sphere nicht exakt am Bildrand klebt.
 */
export function fitCameraDistance(
  boundingRadius: number,
  fovYDeg: number,
  aspect: number,
  margin = 1.15,
): number {
  if (boundingRadius <= 0) return 0;

  const fovYRad = (fovYDeg * Math.PI) / 180;
  const fovXRad = 2 * Math.atan(aspect * Math.tan(fovYRad / 2));
  const minFovRad = Math.min(fovYRad, fovXRad);

  return (boundingRadius / Math.sin(minFovRad / 2)) * margin;
}

/**
 * Vertikaler Anteil `[0..1]` (relativ zur Viewport-Höhe), um den das
 * VISUELLE Zentrum der nutzbaren Canvas-Fläche unter der geometrischen
 * Bildmitte liegt, weil oberes Chrome (Header/Breadcrumb) Fläche wegnimmt.
 * Reine 2D-Rechnung — dient als Verschiebung für das Kamera-Target, damit
 * die Stadt in der TATSÄCHLICH sichtbaren Fläche zentriert wirkt statt in
 * der vollen Viewport-Höhe inklusive verdecktem Bereich.
 *
 * `chromeTopPx = 0` (kein oberes Chrome) ergibt immer 0.
 */
export function visualCenterOffset(
  usableHeightPx: number,
  chromeTopPx: number,
  viewportHeightPx: number,
): number {
  if (viewportHeightPx <= 0) return 0;
  const visualCenterPx = chromeTopPx + usableHeightPx / 2;
  const geometricCenterPx = viewportHeightPx / 2;
  return (visualCenterPx - geometricCenterPx) / viewportHeightPx;
}

/** Kubisches Ease-In-Out (0 -> 0, 1 -> 1, 0.5 -> 0.5, punktsymmetrisch). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Kameraposition aus Orbit-Winkeln (Kugelkoordinaten, three.js-Konvention:
 * `polarRad` = Winkel von der Welt-Oben-Achse (+Y), `azimuthRad` = Winkel um
 * die Y-Achse). Für azimut-erhaltende Fokusflüge (Kamera-Regel 5): nur
 * `target` und `radius` ändern sich, die Blickwinkel (`azimuthRad`/`polarRad`)
 * bleiben erhalten, damit der Nutzer beim Rein-/Rauszoomen nicht die
 * Orientierung verliert (Kamera-Regel 4, kein Roll).
 */
export function sphericalPose(
  target: Vec3,
  radius: number,
  azimuthRad: number,
  polarRad: number,
): { position: Vec3; target: Vec3 } {
  const sinPolar = Math.sin(polarRad);
  const position: Vec3 = {
    x: target.x + radius * sinPolar * Math.sin(azimuthRad),
    y: target.y + radius * Math.cos(polarRad),
    z: target.z + radius * sinPolar * Math.cos(azimuthRad),
  };
  return { position, target };
}

/**
 * Kehrfunktion zu `sphericalPose`: leitet Radius/Azimut/Polar aus einer
 * bestehenden Kamera-Pose (Position + Target) ab. WP-C4-Baustein für
 * azimut-/polar-erhaltende Fokusflüge (Kamera-Controller,
 * `presentation/city-camera-controller.ts`): der Controller darf die
 * aktuellen Blickwinkel NICHT selbst aus den Vektor-Komponenten neu
 * herleiten (Parallel-Mathematik zu `sphericalPose`) — er ruft stattdessen
 * diese Funktion. `radius/azimuthRad/polarRad` folgen exakt der Umkehrung
 * der in `sphericalPose` dokumentierten Formel (three.js-Konvention:
 * `polarRad` = Winkel von +Y, `azimuthRad` = Winkel um Y via `atan2(x, z)`).
 * Degenerierter Fall (Position == Target, Radius 0): liefert alle Winkel 0
 * statt NaN.
 */
export function sphericalFromPose(
  position: Vec3,
  target: Vec3,
): { radius: number; azimuthRad: number; polarRad: number } {
  const dx = position.x - target.x;
  const dy = position.y - target.y;
  const dz = position.z - target.z;
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (radius === 0) return { radius: 0, azimuthRad: 0, polarRad: 0 };

  const polarRad = Math.acos(Math.max(-1, Math.min(1, dy / radius)));
  const azimuthRad = Math.atan2(dx, dz);
  return { radius, azimuthRad, polarRad };
}

/**
 * Kamera-Regel 5 / README-Zoom-Verhalten: Beim Herauszoomen wandert das
 * Orbit-Target sanft (proportional zum aktuellen Radius zwischen
 * `focusRadius` und `cityRadius`) von `currentTarget` zur Stadtmitte
 * (`cityCenter`) — bei `focusRadius` bleibt das Target unverändert, ab
 * `cityRadius` (oder darüber) ist es exakt die Stadtmitte. `t` wird immer
 * auf `[0..1]` geclampt, auch wenn `currentRadius` außerhalb von
 * `[focusRadius, cityRadius]` liegt.
 */
export function zoomOutTargetLerp(
  currentTarget: Vec3,
  cityCenter: Vec3,
  currentRadius: number,
  focusRadius: number,
  cityRadius: number,
): Vec3 {
  const span = cityRadius - focusRadius;
  let t = span > 0 ? (currentRadius - focusRadius) / span : 1;
  t = Math.max(0, Math.min(1, t));

  if (t === 0) return currentTarget;
  if (t === 1) return cityCenter;

  return {
    x: currentTarget.x + (cityCenter.x - currentTarget.x) * t,
    y: currentTarget.y + (cityCenter.y - currentTarget.y) * t,
    z: currentTarget.z + (cityCenter.z - currentTarget.z) * t,
  };
}
