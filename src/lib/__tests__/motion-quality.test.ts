import { describe, it, expect } from 'vitest';
import {
  deriveMotionQuality,
  stepDownMotionQuality,
  resolveMotionDuration,
  MOTION_TIERS,
  type MotionQualitySettings,
} from '../motion-quality';
import { MOTION_DURATIONS } from '../motion-tokens';
import type { DeviceProfile } from '../device-profile';

/**
 * WP-7.7 — Motion: Performance-Grenzen & Degradation.
 *
 * Nach dem Muster von WP-5.6 (Finanzstadt): die Stufe wird VOR dem ersten
 * Frame aus dem Geräteprofil abgeleitet, nicht reaktiv aus gemessener
 * Bildrate. Eine reaktive Kaskade sieht der Nutzer erst, NACHDEM es geruckelt
 * hat — auf schwachen Geräten ist der erste Eindruck dann systematisch der
 * schlechteste.
 */
const DESKTOP: DeviceProfile = {
  devicePixelRatio: 1,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
  coarsePointer: false,
  viewportWidth: 1440,
};

const PHONE: DeviceProfile = {
  devicePixelRatio: 3,
  hardwareConcurrency: 8,
  deviceMemoryGb: 6,
  coarsePointer: true,
  viewportWidth: 390,
};

const WEAK_PHONE: DeviceProfile = {
  devicePixelRatio: 2,
  hardwareConcurrency: 4,
  deviceMemoryGb: 2,
  coarsePointer: true,
  viewportWidth: 360,
};

describe('deriveMotionQuality', () => {
  it('sollte auf einem kräftigen Desktop die volle Stufe wählen', () => {
    expect(deriveMotionQuality(DESKTOP).tier).toBe('full');
  });

  it('sollte auf einem Telefon höchstens die mittlere Stufe wählen', () => {
    expect(deriveMotionQuality(PHONE).tier).toBe('balanced');
  });

  it('sollte auf einem schwachen Gerät die sparsamste Stufe wählen', () => {
    expect(deriveMotionQuality(WEAK_PHONE).tier).toBe('minimal');
  });

  it('sollte prefers-reduced-motion über jede Geräteeinstufung stellen', () => {
    // Barrierefreiheit ist keine Performance-Frage: die Nutzeraussage gewinnt
    // auch auf der stärksten Hardware.
    const settings = deriveMotionQuality(DESKTOP, { reducedMotion: true });
    expect(settings.tier).toBe('minimal');
    expect(settings.durationScale).toBe(0);
  });

  it('sollte nur bei reduced-motion die Dauer auf null setzen', () => {
    // Ein schwaches Gerät bewegt sich sparsamer, aber es bewegt sich: die
    // Objektkontinuität geht sonst verloren (Design-Prinzip 2).
    expect(deriveMotionQuality(WEAK_PHONE).durationScale).toBeGreaterThan(0);
  });

  it('sollte eine erzwungene Stufe übernehmen', () => {
    expect(deriveMotionQuality(DESKTOP, { forceTier: 'minimal' }).tier).toBe('minimal');
  });

  it('sollte auf der sparsamsten Stufe die teuren Effekte abschalten', () => {
    const minimal = deriveMotionQuality(WEAK_PHONE);
    expect(minimal.parallax).toBe(false);
    expect(minimal.blur).toBe(false);
    expect(minimal.stagger).toBe(false);
  });

  it('sollte Signature Moments auf der sparsamsten Stufe verkürzen statt zu streichen', () => {
    // Ein erreichtes Ziel bleibt ein erreichtes Ziel — die Rückmeldung
    // entfällt nicht, sie wird kürzer. Nur reduced-motion streicht sie.
    const minimal = deriveMotionQuality(WEAK_PHONE);
    expect(minimal.signatureMoments).toBe(true);
    expect(minimal.durationScale).toBeLessThan(1);
    expect(deriveMotionQuality(DESKTOP, { reducedMotion: true }).signatureMoments).toBe(false);
  });
});

describe('Monotonie der Stufen', () => {
  it('sollte jeden Effekt monoton abschalten — was einmal aus ist, bleibt aus', () => {
    // Ohne Monotonie wäre „eine Stufe runter" keine verlässliche Entlastung.
    const flags = ['stagger', 'parallax', 'blur', 'signatureMoments'] as const;
    const settingsByTier = MOTION_TIERS.map((tier) =>
      deriveMotionQuality(DESKTOP, { forceTier: tier })
    );

    for (const flag of flags) {
      for (let i = 1; i < settingsByTier.length; i++) {
        const previous = settingsByTier[i - 1][flag];
        const current = settingsByTier[i][flag];
        if (!previous) expect(current).toBe(false);
      }
    }
  });

  it('sollte die Dauer und die Zahl gleichzeitig animierter Elemente monoton senken', () => {
    const settingsByTier = MOTION_TIERS.map((tier) =>
      deriveMotionQuality(DESKTOP, { forceTier: tier })
    );

    for (let i = 1; i < settingsByTier.length; i++) {
      expect(settingsByTier[i].durationScale).toBeLessThanOrEqual(settingsByTier[i - 1].durationScale);
      expect(settingsByTier[i].maxAnimatedItems).toBeLessThanOrEqual(
        settingsByTier[i - 1].maxAnimatedItems
      );
    }
  });
});

describe('stepDownMotionQuality', () => {
  it('sollte genau eine Stufe heruntergehen', () => {
    const full = deriveMotionQuality(DESKTOP);
    expect(stepDownMotionQuality(full).tier).toBe('balanced');
    expect(stepDownMotionQuality(stepDownMotionQuality(full)).tier).toBe('minimal');
  });

  it('sollte auf der untersten Stufe dieselbe Instanz zurückgeben', () => {
    // Identitätsvergleich signalisiert dem Aufrufer: hier geht nichts mehr.
    const minimal = deriveMotionQuality(DESKTOP, { forceTier: 'minimal' });
    expect(stepDownMotionQuality(minimal)).toBe(minimal);
  });

  it('sollte reduced-motion nicht durch Herunterstufen aufheben', () => {
    const reduced = deriveMotionQuality(DESKTOP, { reducedMotion: true });
    expect(stepDownMotionQuality(reduced).durationScale).toBe(0);
  });
});

describe('resolveMotionDuration', () => {
  it('sollte auf voller Stufe die unveränderte Token-Dauer liefern', () => {
    const full = deriveMotionQuality(DESKTOP);
    expect(resolveMotionDuration(MOTION_DURATIONS.slow, full)).toBe(MOTION_DURATIONS.slow);
  });

  it('sollte bei reduced-motion immer 0 liefern', () => {
    const reduced = deriveMotionQuality(DESKTOP, { reducedMotion: true });
    expect(resolveMotionDuration(MOTION_DURATIONS.signature, reduced)).toBe(0);
  });

  it('sollte auf sparsamen Stufen skalieren und ganzzahlig bleiben', () => {
    const minimal = deriveMotionQuality(WEAK_PHONE);
    const resolved = resolveMotionDuration(MOTION_DURATIONS.signature, minimal);
    expect(resolved).toBeLessThan(MOTION_DURATIONS.signature);
    expect(resolved).toBeGreaterThan(0);
    expect(Number.isInteger(resolved)).toBe(true);
  });

  it('[REGRESSION] sollte eine Dauer von 0 nicht negativ oder NaN werden lassen', () => {
    const settingsList: MotionQualitySettings[] = MOTION_TIERS.map((tier) =>
      deriveMotionQuality(DESKTOP, { forceTier: tier })
    );
    for (const settings of settingsList) {
      expect(resolveMotionDuration(0, settings)).toBe(0);
    }
  });
});
