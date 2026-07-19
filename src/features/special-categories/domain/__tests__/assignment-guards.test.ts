import { describe, it, expect } from 'vitest';
import type { SpecialCategory, SpecialCategoryAssignment } from '@/types';
import { assignedPartialMinor, validateAssignment } from '../assignment-guards';

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit' },
  { id: 'feier', name: 'Feier', parent_id: 'hochzeit' },
];

function asg(
  special_category_id: string,
  transaction_id: string,
  amount_minor: number | null = null,
): SpecialCategoryAssignment {
  return { id: `${special_category_id}-${transaction_id}`, special_category_id, transaction_id, amount_minor, source: 'manual' };
}

describe('Zuordnungs-Guards', () => {
  it('sollte eine gültige Erst-Zuordnung durchlassen', () => {
    const result = validateAssignment({
      specialCategories: cats,
      existingAssignments: [],
      targetEventId: 'flitter',
      transactionId: 't1',
      txAbsMinor: 4500,
    });
    expect(result).toBeNull();
  });

  describe('I2: keine Doppelzählung im Teilbaum (S8)', () => {
    it('sollte eine erneute Zuordnung an denselben Anlass ablehnen', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('flitter', 't1')],
        targetEventId: 'flitter',
        transactionId: 't1',
        txAbsMinor: 4500,
      });
      expect(result).toEqual({ code: 'duplicateAssignment' });
    });

    it('sollte die Zuordnung an den Parent ablehnen, wenn schon am Kind (S8)', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('flitter', 't1')],
        targetEventId: 'hochzeit',
        transactionId: 't1',
        txAbsMinor: 4500,
      });
      expect(result).toEqual({ code: 'subtreeConflict', conflictEventId: 'flitter' });
    });

    it('sollte die Zuordnung an ein Kind ablehnen, wenn schon am Parent', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('hochzeit', 't1')],
        targetEventId: 'flitter',
        transactionId: 't1',
        txAbsMinor: 4500,
      });
      expect(result).toEqual({ code: 'subtreeConflict', conflictEventId: 'hochzeit' });
    });

    it('sollte die Zuordnung an ein Geschwister erlauben (bewusste Doppelzählung)', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('flitter', 't1')],
        targetEventId: 'feier',
        transactionId: 't1',
        txAbsMinor: 4500,
      });
      expect(result).toBeNull();
    });
  });

  describe('I3: Teilbetrags-Deckel (S9)', () => {
    it('sollte einen Teilbetrag über dem freien Rest ablehnen', () => {
      // 100 € Buchung, bereits 80 € teilzugeordnet → nur 20 € frei.
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('feier', 't1', 8000)],
        targetEventId: 'flitter',
        transactionId: 't1',
        txAbsMinor: 10000,
        amountMinor: 3000,
      });
      expect(result).toEqual({ code: 'exceedsAmount', freeMinor: 2000 });
    });

    it('sollte einen Teilbetrag genau bis zum freien Rest erlauben', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [asg('feier', 't1', 8000)],
        targetEventId: 'flitter',
        transactionId: 't1',
        txAbsMinor: 10000,
        amountMinor: 2000,
      });
      expect(result).toBeNull();
    });

    it('sollte einen nicht-positiven Teilbetrag ablehnen', () => {
      const result = validateAssignment({
        specialCategories: cats,
        existingAssignments: [],
        targetEventId: 'flitter',
        transactionId: 't1',
        txAbsMinor: 10000,
        amountMinor: 0,
      });
      expect(result).toEqual({ code: 'exceedsAmount', freeMinor: 10000 });
    });

    it('sollte ganze-Buchung-Zuordnungen nicht auf den Teilbetrags-Deckel anrechnen', () => {
      // Ganze Zuordnung am Geschwister zählt NICHT gegen den Teilbetrags-Rest.
      expect(assignedPartialMinor([asg('feier', 't1', null)], 't1')).toBe(0);
      expect(assignedPartialMinor([asg('feier', 't1', 3000)], 't1')).toBe(3000);
    });
  });
});
