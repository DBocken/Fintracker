import { describe, it, expect, beforeEach } from 'vitest';
import type { SpecialCategory, SpecialCategoryAssignment } from '@/types';
import { localEncryption } from '../local-crypto';
import { readLocalFinanceList, writeLocalFinanceList } from '../local-finance-store';
import { ENCRYPTED_STORAGE_KEYS, LOCAL_FINANCE_KEYS } from '../local-storage-keys';
import { snapshotLocalCollections, restoreLocalCollections } from '../backup-service';

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit', start_date: '2026-09-01' },
];

const assignments: SpecialCategoryAssignment[] = [
  { id: 'a1', special_category_id: 'flitter', transaction_id: 't1', amount_minor: 2000, source: 'manual' },
  { id: 'a2', special_category_id: 'hochzeit', transaction_id: 't2', amount_minor: null, source: 'manual' },
];

beforeEach(() => {
  localStorage.clear();
  window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  localEncryption.lock();
});

describe('[INTEGRITY] Backup-Roundtrip für Anlässe (S12)', () => {
  it('sollte Anlässe und Zuordnungen registriert haben (Backup/Verschlüsselung deckt sie ab)', () => {
    // Ohne Registrierung fielen sie still aus Backup, Verschlüsselung und Reset.
    expect(LOCAL_FINANCE_KEYS.specialCategories).toBeTruthy();
    expect(LOCAL_FINANCE_KEYS.specialCategoryAssignments).toBeTruthy();
    expect(ENCRYPTED_STORAGE_KEYS).toContain(LOCAL_FINANCE_KEYS.specialCategories);
    expect(ENCRYPTED_STORAGE_KEYS).toContain(LOCAL_FINANCE_KEYS.specialCategoryAssignments);
  });

  it('sollte Baum und Teilbetrags-Zuordnungen verlustfrei sichern und wiederherstellen', async () => {
    await writeLocalFinanceList('specialCategories', cats);
    await writeLocalFinanceList('specialCategoryAssignments', assignments);

    const snapshot = await snapshotLocalCollections();
    expect(snapshot.specialCategories).toEqual(cats);
    expect(snapshot.specialCategoryAssignments).toEqual(assignments);

    // Store leeren und aus dem Snapshot wiederherstellen.
    await writeLocalFinanceList('specialCategories', []);
    await writeLocalFinanceList('specialCategoryAssignments', []);
    await restoreLocalCollections(snapshot);

    expect(await readLocalFinanceList<SpecialCategory>('specialCategories')).toEqual(cats);
    expect(await readLocalFinanceList<SpecialCategoryAssignment>('specialCategoryAssignments')).toEqual(
      assignments,
    );
  });

  it('sollte idempotent sein (erneuter Restore erzeugt keine Duplikate)', async () => {
    await writeLocalFinanceList('specialCategories', cats);
    await writeLocalFinanceList('specialCategoryAssignments', assignments);
    const snapshot = await snapshotLocalCollections();

    await restoreLocalCollections(snapshot);
    await restoreLocalCollections(snapshot);

    expect(await readLocalFinanceList<SpecialCategory>('specialCategories')).toHaveLength(cats.length);
    expect(
      await readLocalFinanceList<SpecialCategoryAssignment>('specialCategoryAssignments'),
    ).toHaveLength(assignments.length);
  });
});
