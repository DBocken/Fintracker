import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContractRecords,
  upsertContractRecord,
  deleteContractRecord,
} from '../contract-record-service';
import { clearLocalKvStore } from '../idb-kv';

describe('Vertragsakte-Service (Issue #244)', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
  });

  it('sollte eine Akte anlegen, lesen und status=active als Default setzen', async () => {
    const created = await upsertContractRecord({
      name: 'Stromvertrag',
      provider: 'Stadtwerke',
      contract_start: '2025-01-01',
      min_term_months: 24,
      kuendigungsfrist_tage: 90,
    });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('active');

    const all = await getContractRecords();
    expect(all).toHaveLength(1);
    expect(all[0].provider).toBe('Stadtwerke');
  });

  it('sollte eine Akte auch ohne Transaktion/Fingerprint zulassen (z. B. Garantie eines Barkaufs)', async () => {
    const created = await upsertContractRecord({ name: 'Waschmaschine Garantie' });
    expect(created.id).toBeTruthy();
    expect(created.fingerprint).toBeUndefined();
  });

  it('[INTEGRITY] sollte eine ungültige Akte am Boundary abweisen', async () => {
    await expect(upsertContractRecord({ name: '' })).rejects.toThrow();
    await expect(
      upsertContractRecord({ name: 'X', min_term_months: -1 }),
    ).rejects.toThrow();
  });

  it('sollte eine Akte löschen', async () => {
    const created = await upsertContractRecord({ name: 'Handyvertrag' });
    await deleteContractRecord(created.id);
    expect(await getContractRecords()).toHaveLength(0);
  });
});
