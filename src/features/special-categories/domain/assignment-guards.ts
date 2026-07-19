import type { SpecialCategory, SpecialCategoryAssignment } from '@/types';
import { getAncestorIds, getDescendantIds } from './hierarchy';

/**
 * Reine Zuordnungs-Invarianten (I2/I3). Kein I/O, kein React – der Service
 * lädt die Daten und ruft {@link validateAssignment} auf.
 */

export type AssignmentRejection =
  | { code: 'duplicateAssignment' }
  | { code: 'subtreeConflict'; conflictEventId: string }
  | { code: 'exceedsAmount'; freeMinor: number };

export interface ValidateAssignmentInput {
  specialCategories: SpecialCategory[];
  existingAssignments: SpecialCategoryAssignment[];
  targetEventId: string;
  transactionId: string;
  /** Betrag der Buchung als positiver Cent-Betrag (|amount|). */
  txAbsMinor: number;
  /** Teilbetrag in Cent (positiv), oder null/undefined = ganze Buchung. */
  amountMinor?: number | null;
}

/**
 * Summe der bereits vergebenen Teilbeträge (Cent) einer Buchung – nur echte
 * Teil-Zuordnungen (`amount_minor` gesetzt) zählen. Ganze-Buchung-Zuordnungen
 * (z. B. an Geschwister-Anlässe) bleiben außen vor (I2 erlaubt sie bewusst).
 */
export function assignedPartialMinor(
  assignments: SpecialCategoryAssignment[],
  transactionId: string,
): number {
  return assignments
    .filter((a) => a.transaction_id === transactionId && a.amount_minor != null)
    .reduce((sum, a) => sum + Math.abs(a.amount_minor as number), 0);
}

/**
 * Prüft I2 (keine Doppelzählung im Teilbaum) und I3 (Teilbetrags-Deckel).
 * Gibt bei Verstoß eine {@link AssignmentRejection} zurück, sonst `null`.
 */
export function validateAssignment(input: ValidateAssignmentInput): AssignmentRejection | null {
  const { specialCategories, existingAssignments, targetEventId, transactionId, txAbsMinor, amountMinor } = input;

  const assignmentsForTx = existingAssignments.filter((a) => a.transaction_id === transactionId);

  // I2: derselbe Beleg darf nicht zugleich an den Anlass UND einen seiner
  // Vorfahren/Nachfahren hängen (Geschwister sind erlaubt).
  const ancestors = new Set(getAncestorIds(specialCategories, targetEventId));
  const descendants = new Set(getDescendantIds(specialCategories, targetEventId));
  for (const existing of assignmentsForTx) {
    const eventId = existing.special_category_id;
    if (eventId === targetEventId) return { code: 'duplicateAssignment' };
    if (ancestors.has(eventId) || descendants.has(eventId)) {
      return { code: 'subtreeConflict', conflictEventId: eventId };
    }
  }

  // I3: Teilbeträge einer Buchung dürfen ihren Betrag nicht übersteigen.
  if (amountMinor != null) {
    const free = txAbsMinor - assignedPartialMinor(existingAssignments, transactionId);
    if (amountMinor <= 0 || amountMinor > free) {
      return { code: 'exceedsAmount', freeMinor: Math.max(0, free) };
    }
  }

  return null;
}
