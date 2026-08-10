import { describe, it, expect } from 'vitest';

/**
 * Wächter für die Aufteilung aus WP 6.6 (ARCH-6): Der Diagramm-Aufbau liegt in
 * eigenen `lib/chart-data/`-Modulen, `analysis-data.ts` bleibt der schmale Kern.
 *
 * Bewusst nur ein Existenz-/Export-Nachweis je Modul — die Fachprüfungen stehen
 * unverändert in den Modul-Tests daneben. Was dieser Test allein sieht: dass
 * jemand ein Modul zurückfaltet oder eine Kernfunktion in den Kern zurückzieht,
 * ohne dass ein Fachtest davon etwas merkt (er importiert dann einfach anders).
 */
describe('lib/chart-data — Modulzuschnitt', () => {
  it('sollte den Sankey-Aufbau aus @/lib/chart-data/sankey exportieren', async () => {
    const mod = await import('../sankey');
    expect(typeof mod.buildSankeyData).toBe('function');
    expect(typeof mod.buildSankeyDataByKlasse).toBe('function');
  });

  it('sollte den Sunburst-Aufbau aus @/lib/chart-data/sunburst exportieren', async () => {
    const mod = await import('../sunburst');
    expect(typeof mod.buildSpendingSunburst).toBe('function');
    expect(typeof mod.buildSunburstBreakdown).toBe('function');
    expect(typeof mod.buildSunburstTree).toBe('function');
    expect(mod.SUNBURST_SUPER_LABEL.essenziell).toBeTruthy();
  });

  it('sollte die Einnahmen-Aufschlüsselung aus @/lib/chart-data/income-breakdown exportieren', async () => {
    const mod = await import('../income-breakdown');
    expect(typeof mod.buildIncomeBreakdown).toBe('function');
    expect(typeof mod.buildIncomeOverTime).toBe('function');
  });

  it('sollte das Wochenmuster aus @/lib/chart-data/weekday-pattern exportieren', async () => {
    const mod = await import('../weekday-pattern');
    expect(typeof mod.buildWeekdayPattern).toBe('function');
  });

  it('sollte den Kern (sumIncome/sumExpenses, AGENTS.md §8) in @/lib/analysis-data belassen', async () => {
    const kern = await import('@/lib/analysis-data');
    expect(typeof kern.sumIncome).toBe('function');
    expect(typeof kern.sumExpenses).toBe('function');
    // Der Diagramm-Aufbau ist dort ausgezogen — kein stiller Re-Export.
    expect('buildSankeyData' in kern).toBe(false);
    expect('buildSpendingSunburst' in kern).toBe(false);
    expect('buildIncomeBreakdown' in kern).toBe(false);
    expect('buildWeekdayPattern' in kern).toBe(false);
  });
});
