import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHouseholds,
  upsertHousehold,
  deleteHousehold,
  getHouseholdMembers,
  upsertHouseholdMember,
  deleteHouseholdMember,
  getSharedExpenseSplit,
  upsertSharedExpenseSplit,
  deleteSharedExpenseSplit,
  splitEqually,
} from '../household-service';
import { writeLocalFinanceList } from '../local-finance-store';

beforeEach(async () => {
  await writeLocalFinanceList('households', []);
  await writeLocalFinanceList('householdMembers', []);
  await writeLocalFinanceList('sharedExpenseSplits', []);
});

describe('household-service (local)', () => {
  it('creates and reads households', async () => {
    const hh = await upsertHousehold({ name: 'WG Hauptstraße' });
    expect(hh.id).toBeTruthy();
    const all = await getHouseholds();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('WG Hauptstraße');
  });

  it('updates a household in place', async () => {
    const hh = await upsertHousehold({ name: 'A' });
    await upsertHousehold({ id: hh.id, name: 'B' });
    const all = await getHouseholds();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('B');
  });

  it('manages members and filters by household', async () => {
    const hh = await upsertHousehold({ name: 'Paar' });
    await upsertHouseholdMember({ household_id: hh.id, name: 'Alex' });
    await upsertHouseholdMember({ household_id: hh.id, name: 'Sam' });
    await upsertHouseholdMember({ household_id: 'other', name: 'Extern' });

    const members = await getHouseholdMembers(hh.id);
    expect(members.map((m) => m.name).sort()).toEqual(['Alex', 'Sam']);
  });

  it('deletes a household and cascades its members', async () => {
    const hh = await upsertHousehold({ name: 'Paar' });
    await upsertHouseholdMember({ household_id: hh.id, name: 'Alex' });
    await deleteHousehold(hh.id);

    expect(await getHouseholds()).toHaveLength(0);
    expect(await getHouseholdMembers(hh.id)).toHaveLength(0);
  });

  it('deletes a single member', async () => {
    const hh = await upsertHousehold({ name: 'Paar' });
    const m = await upsertHouseholdMember({ household_id: hh.id, name: 'Alex' });
    await deleteHouseholdMember(m.id);
    expect(await getHouseholdMembers(hh.id)).toHaveLength(0);
  });

  it('stores at most one split per transaction', async () => {
    const shares = [
      { member_id: 'a', amount: 5 },
      { member_id: 'b', amount: 5 },
    ];
    await upsertSharedExpenseSplit({ transaction_id: 'tx-1', household_id: 'hh', shares });
    await upsertSharedExpenseSplit({
      transaction_id: 'tx-1',
      household_id: 'hh',
      shares: [{ member_id: 'a', amount: 10 }],
    });

    const split = await getSharedExpenseSplit('tx-1');
    expect(split).not.toBeNull();
    expect(split!.shares).toHaveLength(1);
    expect(split!.shares[0].amount).toBe(10);
  });

  it('deletes a split by transaction id', async () => {
    await upsertSharedExpenseSplit({ transaction_id: 'tx-1', household_id: 'hh', shares: [] });
    await deleteSharedExpenseSplit('tx-1');
    expect(await getSharedExpenseSplit('tx-1')).toBeNull();
  });

  describe('splitEqually', () => {
    it('splits evenly when divisible', () => {
      const shares = splitEqually(10, ['a', 'b']);
      expect(shares).toEqual([
        { member_id: 'a', amount: 5 },
        { member_id: 'b', amount: 5 },
      ]);
    });

    it('assigns rounding remainder to the first member and sums exactly', () => {
      const shares = splitEqually(10, ['a', 'b', 'c']);
      const sum = shares.reduce((acc, s) => acc + s.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(10);
      // 10/3 = 3.34 + 3.33 + 3.33
      expect(shares[0].amount).toBeCloseTo(3.34);
      expect(shares[1].amount).toBeCloseTo(3.33);
    });

    it('returns empty for no members', () => {
      expect(splitEqually(10, [])).toEqual([]);
    });
  });
});
