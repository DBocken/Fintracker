import { describe, it, expect } from 'vitest';
import { buildCityModelFromMilestones } from '../city-goals-adapter';
import type { MilestoneStatus, MilestoneProgress } from '@/lib/milestone-types';

function status(
  key: string,
  overrides: Partial<Omit<MilestoneStatus, 'definition' | 'progress'>> & {
    progress?: MilestoneProgress | null;
    title?: string;
    icon?: string;
  } = {},
): MilestoneStatus {
  return {
    definition: {
      key,
      title: overrides.title ?? `Ziel ${key}`,
      description: '',
      icon: overrides.icon ?? '🌱',
      isAchieved: () => false,
    },
    achieved: overrides.achieved ?? false,
    justAchieved: false,
    progress: overrides.progress ?? null,
  };
}

describe('buildCityModelFromMilestones', () => {
  it('sollte je quantifizierbarem Ziel einen Distrikt mit normierter Hülle (Soll=1) und Fortschritts-Balken bauen', () => {
    const model = buildCityModelFromMilestones([
      status('notgroschen', { progress: { amount: 650, target: 1000, unit: 'euro' } }),
    ]);

    expect(model.valueKind).toBe('progress');
    expect(model.districts).toHaveLength(1);
    const goal = model.districts[0];
    expect(goal).toMatchObject({ id: 'goal:notgroschen', targetAmount: 1, achieved: false });
    expect(goal.total).toBeCloseTo(0.65, 10); // Anzeige-Bruch.
    expect(goal.subcategories).toHaveLength(1);
    expect(goal.subcategories[0].amount).toBeCloseTo(0.65, 10); // Balken = Ist.
    expect(goal.label).toContain('Ziel notgroschen');
    expect(goal.label).toContain('🌱'); // Icon der Definition im Label.
  });

  it('sollte nicht quantifizierbare Meilensteine (progress null) überspringen', () => {
    const model = buildCityModelFromMilestones([
      status('ohne-zahlen', { progress: null }),
      status('mit-zahlen', { progress: { amount: 1, target: 2, unit: 'count' } }),
    ]);
    expect(model.districts.map((d) => d.id)).toEqual(['goal:mit-zahlen']);
  });

  it('sollte laufende Ziele nach Fortschritt absteigend sortieren und erreichte als goldene Trophäen ans Ende stellen', () => {
    const model = buildCityModelFromMilestones([
      status('fast', { progress: { amount: 900, target: 1000, unit: 'euro' } }),
      status('erreicht', { achieved: true, progress: { amount: 1200, target: 1000, unit: 'euro' } }),
      status('anfang', { progress: { amount: 100, target: 1000, unit: 'euro' } }),
    ]);

    expect(model.districts.map((d) => d.id)).toEqual(['goal:fast', 'goal:anfang', 'goal:erreicht']);
    const achievedGoal = model.districts[2];
    expect(achievedGoal.achieved).toBe(true);
    expect(achievedGoal.color).toBe('#f0b429'); // Gold.
    // WP-5.3: Die Farbe der laufenden Ziele kommt aus der FORTSCHRITTS-STUFE,
    // nicht mehr aus dem Sortier-Index. „fast" (90 %) und „anfang" (10 %)
    // liegen in verschiedenen Stufen und unterscheiden sich deshalb — zwei
    // Ziele in derselben Stufe teilen sich dagegen bewusst eine Farbe (die
    // Farbe sagt „wie weit", nicht „welches").
    expect(model.districts[0].color).not.toBe('#f0b429');
    expect(model.districts[0].stage).toBe('nearly');
    expect(model.districts[1].stage).toBe('started');
    expect(model.districts[0].color).not.toBe(model.districts[1].color);
  });

  it('sollte zwei gleich weit fortgeschrittenen Zielen dieselbe Farbe geben (WP-5.3)', () => {
    // Die Umkehrung der Regel oben, ausdrücklich festgehalten: Farbe = Stufe.
    // Vorher hätte der Sortier-Index hier zwei verschiedene Farben erzeugt und
    // damit einen Unterschied behauptet, den es in den Daten nicht gibt.
    const model = buildCityModelFromMilestones([
      status('a', { progress: { amount: 500, target: 1000, unit: 'euro' } }),
      status('b', { progress: { amount: 550, target: 1000, unit: 'euro' } }),
    ]);

    expect(model.districts.map((d) => d.stage)).toEqual(['underway', 'underway']);
    expect(model.districts[0].color).toBe(model.districts[1].color);
  });

  it('sollte die Stufe bei leichtem Rückfall halten (Hysterese, WP-5.3)', () => {
    const before = buildCityModelFromMilestones([
      status('puffer', { progress: { amount: 760, target: 1000, unit: 'euro' } }),
    ]);
    expect(before.districts[0].stage).toBe('nearly');

    const previousStages = new Map([['goal:puffer', before.districts[0].stage!]]);
    const after = buildCityModelFromMilestones(
      [status('puffer', { progress: { amount: 745, target: 1000, unit: 'euro' } })],
      previousStages,
    );

    // 74,5 % liegt unter der 75-%-Schwelle, aber im Hysterese-Band — ohne das
    // würde die Farbe bei jeder Buchung hin- und herspringen.
    expect(after.districts[0].stage).toBe('nearly');
    expect(after.districts[0].color).toBe(before.districts[0].color);
  });

  it('sollte die Stufe bei echtem Rückfall doch senken (WP-5.3)', () => {
    const after = buildCityModelFromMilestones(
      [status('puffer', { progress: { amount: 600, target: 1000, unit: 'euro' } })],
      new Map([['goal:puffer', 'nearly' as const]]),
    );
    expect(after.districts[0].stage).toBe('underway');
  });

  it('sollte den Balken auf die Hülle deckeln (Übererfüllung), den Anzeige-Bruch aber ungedeckelt lassen', () => {
    const model = buildCityModelFromMilestones([
      status('uebererfuellt', { progress: { amount: 1120, target: 1000, unit: 'euro' } }),
    ]);
    const goal = model.districts[0];
    expect(goal.total).toBeCloseTo(1.12, 10); // "112 %" in der Anzeige.
    expect(goal.subcategories[0].amount).toBe(1); // Balken sprengt die Hülle nicht.
  });

  it('sollte ein persistiert erreichtes Ziel voll gefüllt lassen, auch wenn der aktuelle Bruch unter 1 liegt (Trophäe, kein Rückbau)', () => {
    const model = buildCityModelFromMilestones([
      status('frueher-erreicht', { achieved: true, progress: { amount: 700, target: 1000, unit: 'euro' } }),
    ]);
    expect(model.districts[0].subcategories[0].amount).toBe(1);
    expect(model.districts[0].total).toBeCloseTo(0.7, 10); // Ehrlicher Ist-Bruch in der Anzeige.
  });

  it('sollte ohne quantifizierbare Ziele ein leeres progress-Modell liefern (Empty-State der Page)', () => {
    expect(buildCityModelFromMilestones([status('a'), status('b')])).toEqual({
      districts: [],
      valueKind: 'progress',
    });
  });
});
