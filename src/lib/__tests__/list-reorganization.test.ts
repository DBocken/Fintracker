import { describe, it, expect } from 'vitest';
import { planListReorganization } from '../list-reorganization';
import { deriveMotionQuality } from '../motion-quality';
import { MOTION_DURATIONS } from '../motion-tokens';
import type { DeviceProfile } from '../device-profile';

/**
 * WP-6.6 — Live-Reorganisation bei Filterwechsel.
 *
 * Geprüft wird die Rangfolge der drei Gründe, aus denen eine Liste NICHT
 * animieren darf. Sie ist keine Formalie: jede Vertauschung opfert entweder
 * die Barrierefreiheit oder die Bildrate.
 */
const DESKTOP: DeviceProfile = {
  devicePixelRatio: 1,
  viewportWidth: 1440,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
};

const WEAK: DeviceProfile = {
  devicePixelRatio: 2,
  viewportWidth: 360,
  hardwareConcurrency: 4,
  deviceMemoryGb: 2,
  coarsePointer: true,
};

describe('planListReorganization', () => {
  it('sollte eine kurze Liste auf starker Hardware umsortieren lassen', () => {
    const plan = planListReorganization({
      itemCount: 20,
      virtualized: false,
      settings: deriveMotionQuality(DESKTOP),
    });
    expect(plan.animate).toBe(true);
    expect(plan.reason).toBe('ok');
    expect(plan.durationMs).toBe(MOTION_DURATIONS.default);
  });

  it('sollte bei reduced-motion nicht animieren', () => {
    const plan = planListReorganization({
      itemCount: 3,
      virtualized: false,
      settings: deriveMotionQuality(DESKTOP, { reducedMotion: true }),
    });
    expect(plan.animate).toBe(false);
    expect(plan.reason).toBe('reduced-motion');
  });

  it('sollte reduced-motion über die Virtualisierung stellen', () => {
    // Rangfolge: die Nutzeraussage ist der erste Grund, nicht der dritte.
    // Andernfalls stünde in der Begründung „virtualisiert", wo eine
    // Barrierefreiheits-Einstellung gemeint ist — und der nächste Umbau der
    // Virtualisierung würde die Einstellung versehentlich aushebeln.
    const plan = planListReorganization({
      itemCount: 3,
      virtualized: true,
      settings: deriveMotionQuality(DESKTOP, { reducedMotion: true }),
    });
    expect(plan.reason).toBe('reduced-motion');
  });

  it('sollte in einer virtualisierten Liste nicht animieren', () => {
    // Der Virtualizer positioniert jede Zeile per transform; eine
    // Layout-Animation arbeitet gegen ihn und zappelt beim Scrollen.
    const plan = planListReorganization({
      itemCount: 5,
      virtualized: true,
      settings: deriveMotionQuality(DESKTOP),
    });
    expect(plan.animate).toBe(false);
    expect(plan.reason).toBe('virtualized');
  });

  it('sollte die Virtualisierung über die Mengenfrage stellen', () => {
    // Auch bei wenigen sichtbaren Zeilen bleibt die Virtualisierung der
    // ausschlaggebende Grund.
    const plan = planListReorganization({
      itemCount: 2,
      virtualized: true,
      settings: deriveMotionQuality(DESKTOP),
    });
    expect(plan.reason).toBe('virtualized');
  });

  it('sollte oberhalb der Stufen-Obergrenze nicht animieren', () => {
    const settings = deriveMotionQuality(DESKTOP);
    const plan = planListReorganization({
      itemCount: settings.maxAnimatedItems + 1,
      virtualized: false,
      settings,
    });
    expect(plan.animate).toBe(false);
    expect(plan.reason).toBe('too-many');
  });

  it('sollte genau an der Obergrenze noch animieren', () => {
    // Grenzwert-Gegenprobe: sonst wäre „<=" gegen "<" unbemerkt vertauschbar.
    const settings = deriveMotionQuality(DESKTOP);
    const plan = planListReorganization({
      itemCount: settings.maxAnimatedItems,
      virtualized: false,
      settings,
    });
    expect(plan.animate).toBe(true);
  });

  it('sollte auf schwacher Hardware früher aufgeben und kürzer animieren', () => {
    const weak = deriveMotionQuality(WEAK);
    const strong = deriveMotionQuality(DESKTOP);
    expect(weak.maxAnimatedItems).toBeLessThan(strong.maxAnimatedItems);

    const plan = planListReorganization({ itemCount: 5, virtualized: false, settings: weak });
    expect(plan.animate).toBe(true);
    expect(plan.durationMs).toBeLessThan(MOTION_DURATIONS.default);
    expect(plan.durationMs).toBeGreaterThan(0);
  });

  it('[REGRESSION] sollte bei animate=false immer die Dauer 0 melden', () => {
    // Eine Dauer > 0 bei animate=false wäre eine Falle für Aufrufstellen, die
    // nur die Dauer durchreichen und das Flag übersehen.
    const cases = [
      { itemCount: 3, virtualized: true, settings: deriveMotionQuality(DESKTOP) },
      { itemCount: 999, virtualized: false, settings: deriveMotionQuality(DESKTOP) },
      {
        itemCount: 3,
        virtualized: false,
        settings: deriveMotionQuality(DESKTOP, { reducedMotion: true }),
      },
    ];
    for (const options of cases) {
      const plan = planListReorganization(options);
      expect(plan.animate).toBe(false);
      expect(plan.durationMs).toBe(0);
    }
  });
});
