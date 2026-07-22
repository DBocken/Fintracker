import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHouseholdSettlements,
  upsertHouseholdSettlement,
  deleteHouseholdSettlement,
} from '../household-settlement-service';
import { clearLocalKvStore } from '../idb-kv';

describe('Ausgleichsbuchungs-Service (Issue #248)', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
  });

  it('sollte eine Ausgleichsbuchung anlegen und lesen', async () => {
    const created = await upsertHouseholdSettlement({
      household_id: 'h1',
      from_member_id: 'b',
      to_member_id: 'a',
      amount_minor: 2000,
      date: '2026-07-19',
    });
    expect(created.id).toBeTruthy();

    const all = await getHouseholdSettlements('h1');
    expect(all).toHaveLength(1);
    expect(all[0].amount_minor).toBe(2000);
  });

  it('sollte Teilzahlungen als mehrere Buchungen zulassen', async () => {
    await upsertHouseholdSettlement({ household_id: 'h1', from_member_id: 'b', to_member_id: 'a', amount_minor: 1000, date: '2026-07-01' });
    await upsertHouseholdSettlement({ household_id: 'h1', from_member_id: 'b', to_member_id: 'a', amount_minor: 1000, date: '2026-07-15' });
    expect(await getHouseholdSettlements('h1')).toHaveLength(2);
  });

  it('sollte nach Haushalt filtern', async () => {
    await upsertHouseholdSettlement({ household_id: 'h1', from_member_id: 'b', to_member_id: 'a', amount_minor: 500, date: '2026-07-01' });
    await upsertHouseholdSettlement({ household_id: 'h2', from_member_id: 'd', to_member_id: 'c', amount_minor: 700, date: '2026-07-01' });
    expect(await getHouseholdSettlements('h1')).toHaveLength(1);
    expect(await getHouseholdSettlements()).toHaveLength(2);
  });

  it('[INTEGRITY] sollte eine ungültige Ausgleichsbuchung am Boundary abweisen', async () => {
    await expect(
      upsertHouseholdSettlement({
        household_id: 'h1',
        from_member_id: 'b',
        to_member_id: 'a',
        amount_minor: 15.5, // kein ganzzahliger Cent-Betrag
        date: '2026-07-19',
      }),
    ).rejects.toThrow();
  });

  it('sollte eine Ausgleichsbuchung löschen', async () => {
    const created = await upsertHouseholdSettlement({ household_id: 'h1', from_member_id: 'b', to_member_id: 'a', amount_minor: 2000, date: '2026-07-19' });
    await deleteHouseholdSettlement(created.id);
    expect(await getHouseholdSettlements()).toHaveLength(0);
  });
});
