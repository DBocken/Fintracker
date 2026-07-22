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

  it('sollte Belege, Garantie, Preisverlauf und Objekt-Verknüpfung persistieren (#245)', async () => {
    const created = await upsertContractRecord({
      name: 'Kühlschrank',
      purchase_date: '2025-03-10',
      warranty_months: 24,
      documents: [{ id: 'd1', filename: 'rechnung.pdf', kind: 'invoice', extracted_text: 'Summe 499,00' }],
      price_history: [{ date: '2025-03-10', amount_minor: 49900 }],
      linked_object: { kind: 'replacement_plan', id: 'rp-1' },
    });

    const all = await getContractRecords();
    expect(all[0].documents?.[0].filename).toBe('rechnung.pdf');
    expect(all[0].warranty_months).toBe(24);
    expect(all[0].linked_object).toEqual({ kind: 'replacement_plan', id: 'rp-1' });
    expect(created.linked_object?.kind).toBe('replacement_plan');
  });

  it('[INTEGRITY] sollte eine EntityRef mit unbekanntem kind am Boundary abweisen', async () => {
    await expect(
      upsertContractRecord({
        name: 'X',
        // @ts-expect-error absichtlich ungültiges kind
        linked_object: { kind: 'auto', id: 'x' },
      }),
    ).rejects.toThrow();
  });

  it('sollte eine Akte löschen', async () => {
    const created = await upsertContractRecord({ name: 'Handyvertrag' });
    await deleteContractRecord(created.id);
    expect(await getContractRecords()).toHaveLength(0);
  });
});
