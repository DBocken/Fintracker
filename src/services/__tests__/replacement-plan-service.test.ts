import { describe, it, expect, beforeEach } from 'vitest';
import {
  getReplacementPlans,
  upsertReplacementPlan,
  deleteReplacementPlan,
} from '../replacement-plan-service';
import { writeLocalFinanceList } from '../local-finance-store';
import { clearLocalKvStore } from '../idb-kv';

describe('Ersatzplan-Service (Issue #239)', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
  });

  it('sollte einen Plan anlegen, lesen und Defaults anwenden', async () => {
    const created = await upsertReplacementPlan({
      name: 'Kühlschrank',
      replacement_cost_minor: 45000,
      lifespan_months: 144,
    });

    expect(created.id).toBeTruthy();
    expect(created.price_mode).toBe('inflation'); // Default
    expect(created.reserve_minor).toBe(0); // Default

    const all = await getReplacementPlans();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Kühlschrank');
  });

  it('sollte einen bestehenden Plan aktualisieren statt zu duplizieren', async () => {
    const created = await upsertReplacementPlan({
      name: 'Laptop',
      replacement_cost_minor: 120000,
      lifespan_months: 60,
    });
    await upsertReplacementPlan({ ...created, replacement_cost_minor: 130000 });

    const all = await getReplacementPlans();
    expect(all).toHaveLength(1);
    expect(all[0].replacement_cost_minor).toBe(130000);
  });

  it('[INTEGRITY] sollte einen ungültigen Plan am Schreib-Boundary abweisen', async () => {
    await expect(
      upsertReplacementPlan({ name: 'Kaputt', replacement_cost_minor: -1, lifespan_months: 120 }),
    ).rejects.toThrow();

    await expect(
      upsertReplacementPlan({ name: '', replacement_cost_minor: 1000, lifespan_months: 120 }),
    ).rejects.toThrow();
  });

  it('[INTEGRITY] sollte korrupte Einzelsätze beim Lesen überspringen statt die Liste zu sprengen', async () => {
    // Direkt einen gültigen + einen korrupten Satz in den Store schreiben.
    await writeLocalFinanceList('replacementPlans', [
      { id: 'ok', name: 'Gut', replacement_cost_minor: 1000, lifespan_months: 12 },
      { id: 'bad', replacement_cost_minor: 'viel' }, // ungültig
    ] as unknown as never[]);

    const all = await getReplacementPlans();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('ok');
  });

  it('sollte einen Plan löschen', async () => {
    const created = await upsertReplacementPlan({
      name: 'Fahrrad',
      replacement_cost_minor: 80000,
      lifespan_months: 96,
    });
    await deleteReplacementPlan(created.id);
    expect(await getReplacementPlans()).toHaveLength(0);
  });
});
