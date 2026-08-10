import { describe, it, expect } from 'vitest';

/**
 * Wächter für die Aufteilung aus WP 6.6 (ARCH-6): Die acht Kategorien-
 * Migrationen sind reine Funktionen und liegen in `src/lib/`, nicht mehr im
 * I/O-Service (AGENTS.md §3).
 *
 * Bewusst nur ein Existenz-/Export-Nachweis — die Fachprüfungen je Migration
 * stehen unverändert in den Tests daneben. Was dieser Test allein sieht: einen
 * stillen Re-Export unter dem alten Service-Pfad, der die Trennung wieder
 * einebnet, ohne dass ein Fachtest davon etwas merkt.
 */
describe('lib/category-migrations — Modulzuschnitt', () => {
  const NAMEN = [
    'migrateParentIds',
    'backfillCategoryNameKeys',
    'backfillAusgabenklasse',
    'migrateIncomeTaxonomy',
    'backfillTaxDefaults',
    'migrateInsuranceTaxSplit',
    'migrateCategoryPack2026',
    'migrateEssentialHealthClasses',
  ] as const;

  it('sollte alle acht Migrationen aus @/lib/category-migrations exportieren', async () => {
    const mod = (await import('../category-migrations')) as Record<string, unknown>;
    for (const name of NAMEN) {
      expect(typeof mod[name], name).toBe('function');
    }
  });

  it('sollte sie NICHT mehr aus dem Service exportieren (kein stiller Re-Export)', async () => {
    const service = (await import('@/services/local-settings-service')) as Record<string, unknown>;
    for (const name of NAMEN) {
      expect(name in service, name).toBe(false);
    }
  });

  it('sollte die Standard-Kategorien lib-seitig anbieten, ohne I/O beim Import', async () => {
    const mod = await import('../default-categories');
    expect(Array.isArray(mod.DEFAULT_LOCAL_CATEGORIES)).toBe(true);
    expect(mod.DEFAULT_LOCAL_CATEGORIES.length).toBeGreaterThan(0);
  });
});
