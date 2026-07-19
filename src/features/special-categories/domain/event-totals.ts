import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { toMinor } from '@/lib/money';
import { getDescendantIds } from './hierarchy';
import type { SpecialCategoryTotal } from './special-category-types';

/**
 * Reine Aggregation der Anlass-Kosten in Integer-Cent. Kein I/O, kein React.
 *
 * Kosten sind vorzeichenbehaftet als „Geld raus": eine zugeordnete Ausgabe
 * (Transaction.amount < 0) erhöht die Summe, eine zugeordnete Erstattung/
 * Gutschrift (amount > 0) mindert sie (I4). Teil-Zuordnungen (`amount_minor`)
 * tragen ihren Teilbetrag mit dem Vorzeichen der zugrunde liegenden Buchung bei.
 */

/** Cent-Betrag einer Buchung, vorzeichenbehaftet (negativ = Ausgabe). */
function txMinor(tx: Transaction): number {
  return toMinor(tx.amount);
}

/**
 * Vorzeichenbehafteter Kostenbeitrag einer einzelnen Zuordnung. Fehlt die
 * Buchung, ist der Beitrag 0 (defensiv – Cleanup entfernt verwaiste
 * Zuordnungen, aber die Aggregation bleibt robust).
 */
export function assignmentCostMinor(
  assignment: SpecialCategoryAssignment,
  txById: Map<string, Transaction>,
): number {
  const tx = txById.get(assignment.transaction_id);
  if (!tx) return 0;
  const signed = txMinor(tx);
  const isExpense = signed < 0;
  const magnitude =
    assignment.amount_minor != null ? Math.abs(assignment.amount_minor) : Math.abs(signed);
  return isExpense ? magnitude : -magnitude;
}

/**
 * Berechnet je Anlass die direkt zugeordneten Kosten (`ownMinor`) und die
 * Teilbaum-Kosten (`subtreeMinor`, inkl. aller Kind-Anlässe). Die
 * Teilbaum-Summe setzt die Invariante I2 voraus (dieselbe Buchung ist nicht
 * zugleich einem Anlass und einem seiner Vorfahren zugeordnet) – diese wird
 * beim Schreiben im Service erzwungen.
 */
export function computeEventTotals(
  specialCategories: SpecialCategory[],
  assignments: SpecialCategoryAssignment[],
  transactions: Transaction[],
): Map<string, SpecialCategoryTotal> {
  const txById = new Map<string, Transaction>();
  for (const tx of transactions) {
    if (tx.id) txById.set(tx.id, tx);
  }

  const own = new Map<string, number>();
  const txSet = new Map<string, Set<string>>();
  for (const cat of specialCategories) {
    own.set(cat.id, 0);
    txSet.set(cat.id, new Set());
  }

  for (const assignment of assignments) {
    const catId = assignment.special_category_id;
    if (!own.has(catId)) continue; // Zuordnung zu unbekanntem Anlass ignorieren.
    own.set(catId, own.get(catId)! + assignmentCostMinor(assignment, txById));
    txSet.get(catId)!.add(assignment.transaction_id);
  }

  const totals = new Map<string, SpecialCategoryTotal>();
  for (const cat of specialCategories) {
    const subtreeIds = [cat.id, ...getDescendantIds(specialCategories, cat.id)];
    const subtreeMinor = subtreeIds.reduce((sum, id) => sum + (own.get(id) ?? 0), 0);
    totals.set(cat.id, {
      specialCategoryId: cat.id,
      ownMinor: own.get(cat.id)!,
      subtreeMinor,
      transactionCount: txSet.get(cat.id)!.size,
    });
  }
  return totals;
}
