import { describe, it, expect, beforeEach } from 'vitest';
import { snapshotLocalCollections, restoreLocalCollections } from '../backup-service';
import { clearLocalKvStore } from '../idb-kv';
import {
  upsertHousehold,
  upsertHouseholdMember,
  upsertSharedExpenseSplit,
  getHouseholds,
  getHouseholdMembers,
  getSharedExpenseSplit,
  splitEqually,
} from '../household-service';

/**
 * Regressionsschutz für Issue #235: Haushaltsdaten dürfen bei Backup/Restore
 * nicht still verloren gehen. Das Backup deckt sie bereits generisch über die
 * `LOCAL_FINANCE_KEYS`-Registry ab (`snapshotLocalCollections`) — dieser Test
 * pinnt diese Abdeckung fest, damit sie nicht unbemerkt wegbricht.
 */
describe('Backup-Abdeckung Haushaltsdaten (Issue #235)', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
  });

  async function seedHousehold(): Promise<void> {
    const household = await upsertHousehold({ name: 'WG Beispiel' });
    const anna = await upsertHouseholdMember({ household_id: household.id, name: 'Anna' });
    const ben = await upsertHouseholdMember({ household_id: household.id, name: 'Ben' });
    await upsertSharedExpenseSplit({
      transaction_id: 'tx-1',
      household_id: household.id,
      shares: splitEqually(40, [anna.id, ben.id]),
    });
  }

  it('[REGRESSION] snapshotLocalCollections erfasst Haushalte, Mitglieder und Splits', async () => {
    await seedHousehold();

    const snapshot = await snapshotLocalCollections();

    expect(snapshot.households).toHaveLength(1);
    expect(snapshot.householdMembers).toHaveLength(2);
    expect(snapshot.sharedExpenseSplits).toHaveLength(1);
  });

  it('[REGRESSION] Restore auf einem leeren Gerät stellt Haushaltsdaten vollständig wieder her', async () => {
    await seedHousehold();
    const snapshot = await snapshotLocalCollections();

    // Frisches Gerät simulieren.
    await clearLocalKvStore();
    expect(await getHouseholds()).toHaveLength(0);

    await restoreLocalCollections(snapshot);

    expect(await getHouseholds()).toHaveLength(1);
    expect(await getHouseholdMembers()).toHaveLength(2);
    const split = await getSharedExpenseSplit('tx-1');
    expect(split).not.toBeNull();
    expect(split?.shares).toHaveLength(2);
  });
});
