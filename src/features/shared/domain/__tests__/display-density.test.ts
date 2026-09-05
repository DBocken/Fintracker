/**
 * Die Dichte-Entscheidung, ohne DOM.
 *
 * Grundlage: `docs/architecture/darstellungsdichte.md`. Die Fälle sind nicht
 * ausgedacht, sondern stehen dort als Tabelle — inklusive der Zahlen, an denen
 * der Wert 768 hängt.
 */

import { describe, it, expect } from 'vitest';
import {
  DENSITY_THRESHOLD_PX,
  resolveDensity,
  type DisplayDensity,
} from '../display-density';

const imBrowser = (viewportWidthPx: number | null): DisplayDensity =>
  resolveDensity({ isNativeApp: false, viewportWidthPx });

describe('Darstellungsdichte', () => {
  it('sollte genau eine Schwelle kennen, und zwar 768', () => {
    // Die Zahl ist begründet (Ersatz-Viewport „Desktopseite anfordern" ~980).
    // Sie zu ändern heisst, diese Begründung zu ändern — deshalb steht sie im
    // Test und nicht nur im Kommentar.
    expect(DENSITY_THRESHOLD_PX).toBe(768);
  });

  it('sollte die App IMMER fokussiert zeigen — auch auf einem breiten Tablet', () => {
    // Der Fall, den die Breite allein falsch beantwortet hätte: Ein
    // Android-Tablet im Querformat meldet weit über 768 CSS-Pixel.
    expect(resolveDensity({ isNativeApp: true, viewportWidthPx: 1280 })).toBe('fokussiert');
    expect(resolveDensity({ isNativeApp: true, viewportWidthPx: 411 })).toBe('fokussiert');
  });

  it('sollte im Browser an der Schwelle umschalten', () => {
    expect(imBrowser(767)).toBe('fokussiert');
    expect(imBrowser(768)).toBe('kompakt');
  });

  it('sollte ein hochauflösendes Telefon nach CSS-Pixeln beurteilen, nicht nach Geräte-Pixeln', () => {
    // Sony Xperia 1: 1644 physische Pixel, DPR 4 -> 411 CSS-Pixel.
    // Ein 4K-Telefon ist damit schmaler als jeder Laptop; der Daumen wird
    // nicht kleiner, weil das Display feiner ist.
    expect(imBrowser(411)).toBe('fokussiert');
    expect(imBrowser(430)).toBe('fokussiert'); // iPhone 15 Pro Max
    expect(imBrowser(1920)).toBe('kompakt'); // Laptop 1080p, DPR 1
  });

  it('sollte „Desktopseite anfordern" wirksam lassen', () => {
    // Ohne `width=device-width` fällt der Browser auf ~980 CSS-Pixel zurück.
    // Genau dieser Fall ist der Grund, warum die Schwelle nicht bei 1024
    // liegt: Dort wäre der Ausweg wirkungslos gewesen.
    expect(imBrowser(980)).toBe('kompakt');
  });

  it('sollte starken Browser-Zoom als Wunsch nach weniger Dichte lesen', () => {
    // 200 % auf 1440 px ergeben effektiv 720 CSS-Pixel.
    expect(imBrowser(720)).toBe('fokussiert');
  });

  it('sollte ohne bekannte Breite fokussiert wählen — die sichere Richtung', () => {
    // Fokussiert ist auf jedem Bildschirm bedienbar, nur weniger dicht.
    // Kompakt auf einem Telefon ist es nicht.
    expect(imBrowser(null)).toBe('fokussiert');
  });
});
