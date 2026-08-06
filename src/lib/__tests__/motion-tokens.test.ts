import { describe, it, expect } from 'vitest';
import {
  MOTION_EASINGS,
  MOTION_EASINGS_CHART,
  MOTION_EASINGS_BEZIER,
  MOTION_DURATIONS,
  resolveDuration,
} from '../motion-tokens';

describe('MOTION_EASINGS_CHART', () => {
  /**
   * Recharts typisiert `animationEasing` als Template-Literal OHNE Leerzeichen
   * (`cubic-bezier(${number},${number},${number},${number})`), die CSS-Fassung
   * in MOTION_EASINGS traegt sie mit. Beide beschreiben dieselbe Kurve — dieser
   * Test verhindert, dass daraus zwei driftende Wahrheiten werden.
   */
  it('[REGRESSION] sollte dieselbe Kurve wie MOTION_EASINGS beschreiben, nur ohne Leerzeichen', () => {
    expect(MOTION_EASINGS_CHART.build).toBe(MOTION_EASINGS.build.replace(/\s+/g, ''));
  });

  it('sollte der Recharts-Schreibweise ohne Leerzeichen entsprechen', () => {
    expect(MOTION_EASINGS_CHART.build).toMatch(/^cubic-bezier\((-?[\d.]+,){3}-?[\d.]+\)$/);
    expect(MOTION_EASINGS_CHART.build).not.toContain(' ');
  });
});

describe('MOTION_EASINGS_BEZIER', () => {
  /**
   * Framer Motion nimmt keine CSS-Strings, sondern das Bezier-Tupel. Vor
   * WP-6.6 stand dieses Tupel an fuenf Stellen von Hand abgeschrieben im Code
   * — eine Aenderung an MOTION_EASINGS haette sie nicht erreicht.
   */
  it('[REGRESSION] sollte fuer jede Kurve dieselben Kontrollpunkte wie MOTION_EASINGS tragen', () => {
    for (const [name, css] of Object.entries(MOTION_EASINGS)) {
      const fromCss = css
        .replace(/^cubic-bezier\(|\)$/g, '')
        .split(',')
        .map((part) => Number(part.trim()));
      expect(fromCss, name).toHaveLength(4);
      expect([...MOTION_EASINGS_BEZIER[name as keyof typeof MOTION_EASINGS_BEZIER]], name).toEqual(
        fromCss,
      );
    }
  });

  it('sollte genau dieselben Kurvennamen fuehren wie MOTION_EASINGS', () => {
    expect(Object.keys(MOTION_EASINGS_BEZIER).sort()).toEqual(Object.keys(MOTION_EASINGS).sort());
  });
});

describe('MOTION_EASINGS', () => {
  it('sollte genau 5 Kurven mit korrekten Namen definieren', () => {
    const keys = Object.keys(MOTION_EASINGS).sort();
    expect(keys).toEqual(['build', 'confirm', 'precision', 'spatial', 'warn']);
  });

  it('sollte precision als gültigen cubic-bezier-String mit expo-out-Charakter liefern', () => {
    expect(MOTION_EASINGS.precision).toMatch(/^cubic-bezier\(/);
    // expo-out: Kontrollpunkte 0.22, 1, 0.36, 1
    expect(MOTION_EASINGS.precision).toContain('0.22');
    expect(MOTION_EASINGS.precision).toContain('0.36');
  });

  it('sollte build als gültigen cubic-bezier-String mit easeOutCubic-Charakter liefern', () => {
    expect(MOTION_EASINGS.build).toMatch(/^cubic-bezier\(/);
    // easeOutCubic ~ cubic-bezier(0.33, 1, 0.68, 1)
    expect(MOTION_EASINGS.build).toContain('0.33');
    expect(MOTION_EASINGS.build).toContain('0.68');
  });

  it('sollte spatial als gültigen cubic-bezier-String mit easeInOutCubic-Charakter liefern', () => {
    expect(MOTION_EASINGS.spatial).toMatch(/^cubic-bezier\(/);
    // easeInOutCubic ~ cubic-bezier(0.65, 0, 0.35, 1)
    expect(MOTION_EASINGS.spatial).toContain('0.65');
    expect(MOTION_EASINGS.spatial).toContain('0.35');
  });

  it('sollte confirm als gültigen cubic-bezier-String mit overshoot liefern', () => {
    expect(MOTION_EASINGS.confirm).toMatch(/^cubic-bezier\(/);
    // Overshoot: ein Kontrollpunkt > 1 oder < 0
    expect(MOTION_EASINGS.confirm).toContain('1.56');
  });

  it('sollte warn als gültigen cubic-bezier-String mit harter easeInOutExpo liefern', () => {
    expect(MOTION_EASINGS.warn).toMatch(/^cubic-bezier\(/);
    // easeInOutExpo ~ cubic-bezier(0.87, 0, 0.13, 1)
    expect(MOTION_EASINGS.warn).toContain('0.87');
    expect(MOTION_EASINGS.warn).toContain('0.13');
  });

  it('sollte jeder Wert ein gültiger cubic-bezier-String sein', () => {
    for (const value of Object.values(MOTION_EASINGS)) {
      expect(value).toMatch(
        /^cubic-bezier\(-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*\)$/,
      );
    }
  });
});

describe('MOTION_DURATIONS', () => {
  it('sollte genau 4 Stufen mit korrekten Namen definieren', () => {
    const keys = Object.keys(MOTION_DURATIONS).sort();
    expect(keys).toEqual(['default', 'fast', 'signature', 'slow']);
  });

  it('sollte fast 150ms sein', () => {
    expect(MOTION_DURATIONS.fast).toBe(150);
  });

  it('sollte default 300ms sein', () => {
    expect(MOTION_DURATIONS.default).toBe(300);
  });

  it('sollte slow 600ms sein', () => {
    expect(MOTION_DURATIONS.slow).toBe(600);
  });

  it('sollte signature 1200ms sein', () => {
    expect(MOTION_DURATIONS.signature).toBe(1200);
  });

  it('[VB-2] sollte keine Non-Signature-Dauer 600ms überschreiten', () => {
    expect(MOTION_DURATIONS.fast).toBeLessThanOrEqual(600);
    expect(MOTION_DURATIONS.default).toBeLessThanOrEqual(600);
    expect(MOTION_DURATIONS.slow).toBeLessThanOrEqual(600);
    // signature darf > 600 sein
    expect(MOTION_DURATIONS.signature).toBeGreaterThan(600);
  });
});

describe('resolveDuration', () => {
  it('sollte bei reduced=false die unveränderte Dauer liefern', () => {
    expect(resolveDuration(300, false)).toBe(300);
    expect(resolveDuration(600, false)).toBe(600);
    expect(resolveDuration(0, false)).toBe(0);
  });

  it('sollte bei reduced=true null liefern (nicht 0.001)', () => {
    expect(resolveDuration(300, true)).toBe(0);
    expect(resolveDuration(1200, true)).toBe(0);
  });

  it('sollte bei reduced=true für jede Eingabe null liefern', () => {
    expect(resolveDuration(150, true)).toBe(0);
    expect(resolveDuration(50, true)).toBe(0);
    expect(resolveDuration(5000, true)).toBe(0);
  });
});
