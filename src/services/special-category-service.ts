import type {
  SpecialCategory,
  SpecialCategoryAssignment,
  SpecialCategoryAssignmentSource,
} from '@/types';
import { t } from '@/i18n/serviceT';
import { toMinor } from '@/lib/money';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from './local-finance-store';
import { getTransactions } from './transaction-service';
import { getSubtreeIds, wouldCreateCycle } from '@/features/special-categories/domain/hierarchy';
import {
  validateAssignment,
  type AssignmentRejection,
} from '@/features/special-categories/domain/assignment-guards';

const KEY_CATS = 'specialCategories' as const;
const KEY_ASG = 'specialCategoryAssignments' as const;

/** Typisierter Service-Fehler; `code` mappt auf einen i18n-Key, `meta` trägt Zusatzdaten (z. B. freeMinor). */
export class SpecialCategoryError extends Error {
  constructor(
    public readonly code: string,
    public readonly meta?: Record<string, number>,
  ) {
    super(t(`specialCategories.service.${code}`, code));
    this.name = 'SpecialCategoryError';
  }
}

// --- Anlässe (CRUD) ---------------------------------------------------------

export async function getSpecialCategories(): Promise<SpecialCategory[]> {
  const cats = await readLocalFinanceList<SpecialCategory>(KEY_CATS);
  return cats.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export async function replaceSpecialCategories(cats: SpecialCategory[]): Promise<void> {
  return writeLocalFinanceList<SpecialCategory>(KEY_CATS, cats);
}

/**
 * Legt einen Anlass an oder aktualisiert ihn. Validiert Namen und schützt vor
 * Zyklen (I1): ein Anlass darf nicht sein eigener Vorfahr werden.
 */
export async function saveSpecialCategory(
  input: Partial<SpecialCategory>,
): Promise<SpecialCategory> {
  const name = input.name?.trim();
  if (!name) throw new SpecialCategoryError('nameRequired');

  if (input.parent_id && input.id) {
    const cats = await getSpecialCategories();
    if (wouldCreateCycle(cats, input.id, input.parent_id)) {
      throw new SpecialCategoryError('cycle');
    }
  }

  return upsertLocalFinanceItem<SpecialCategory>(KEY_CATS, { ...input, name } as SpecialCategory);
}

export interface SpecialCategoryDeletionResult {
  /** IDs der entfernten Anlässe. */
  deletedIds: string[];
  /** Anzahl entfernter Zuordnungen. */
  removedAssignments: number;
  /** IDs von Kind-Anlässen, die zum Großelternteil umgehängt wurden. */
  reparentedIds: string[];
}

/**
 * Löscht einen Anlass (S10/I6). Standard: direkte Kinder wandern zum
 * Großelternteil (Reparent), nur der Anlass selbst verschwindet. Mit
 * `deleteChildren` wird der ganze Teilbaum entfernt. Zuordnungen der
 * gelöschten Anlässe werden immer mitentfernt.
 */
export async function deleteSpecialCategory(
  id: string,
  options: { deleteChildren?: boolean } = {},
): Promise<SpecialCategoryDeletionResult> {
  const cats = await getSpecialCategories();
  const target = cats.find((c) => c.id === id);
  if (!target) throw new SpecialCategoryError('notFound');

  const deletedIds = options.deleteChildren ? getSubtreeIds(cats, id) : [id];
  const deletedSet = new Set(deletedIds);
  const reparentedIds: string[] = [];

  const next = cats
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => {
      // Direkte Kinder des gelöschten Anlasses zum Großelternteil hochziehen.
      if (!options.deleteChildren && c.parent_id === id) {
        reparentedIds.push(c.id);
        return { ...c, parent_id: target.parent_id ?? null };
      }
      return c;
    });
  await replaceSpecialCategories(next);

  const assignments = await getSpecialCategoryAssignments();
  const keptAssignments = assignments.filter((a) => !deletedSet.has(a.special_category_id));
  const removedAssignments = assignments.length - keptAssignments.length;
  if (removedAssignments > 0) {
    await writeLocalFinanceList<SpecialCategoryAssignment>(KEY_ASG, keptAssignments);
  }

  return { deletedIds, removedAssignments, reparentedIds };
}

// --- Zuordnungen ------------------------------------------------------------

export async function getSpecialCategoryAssignments(): Promise<SpecialCategoryAssignment[]> {
  return readLocalFinanceList<SpecialCategoryAssignment>(KEY_ASG);
}

export interface AssignTransactionInput {
  specialCategoryId: string;
  transactionId: string;
  /** Teilbetrag in Cent (positiv). Fehlt = ganze Buchung. */
  amountMinor?: number | null;
  allocationId?: string | null;
  source?: SpecialCategoryAssignmentSource;
  note?: string | null;
}

/**
 * Ordnet eine Buchung (oder einen Teilbetrag) einem Anlass zu. Erzwingt I2
 * (keine Doppelzählung im Teilbaum) und I3 (Teilbetrags-Deckel) über den puren
 * {@link validateAssignment}-Guard.
 */
export async function assignTransaction(
  input: AssignTransactionInput,
): Promise<SpecialCategoryAssignment> {
  const [cats, existingAssignments, transactions] = await Promise.all([
    getSpecialCategories(),
    getSpecialCategoryAssignments(),
    getTransactions(5000),
  ]);

  if (!cats.some((c) => c.id === input.specialCategoryId)) {
    throw new SpecialCategoryError('notFound');
  }

  const tx = transactions.find((t) => t.id === input.transactionId);
  const txAbsMinor = tx ? Math.abs(toMinor(tx.amount)) : 0;

  const rejection: AssignmentRejection | null = validateAssignment({
    specialCategories: cats,
    existingAssignments,
    targetEventId: input.specialCategoryId,
    transactionId: input.transactionId,
    txAbsMinor,
    amountMinor: input.amountMinor,
  });
  if (rejection) {
    const meta = 'freeMinor' in rejection ? { freeMinor: rejection.freeMinor } : undefined;
    throw new SpecialCategoryError(rejection.code, meta);
  }

  return upsertLocalFinanceItem<SpecialCategoryAssignment>(KEY_ASG, {
    special_category_id: input.specialCategoryId,
    transaction_id: input.transactionId,
    amount_minor: input.amountMinor ?? null,
    allocation_id: input.allocationId ?? null,
    source: input.source ?? 'manual',
    note: input.note ?? null,
  } as SpecialCategoryAssignment);
}

export async function unassign(assignmentId: string): Promise<void> {
  return deleteLocalFinanceItem<SpecialCategoryAssignment>(KEY_ASG, assignmentId);
}

/**
 * Cascade-Löschung: entfernt alle Anlass-Zuordnungen der genannten Buchungen.
 * Aufgerufen beim Löschen von Transaktionen, damit keine verwaisten
 * Zuordnungen zurückbleiben (analog zu den Transaktions-Aufteilungen).
 */
export async function deleteAssignmentsForTransactions(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const idSet = new Set(transactionIds);
  const all = await getSpecialCategoryAssignments();
  const kept = all.filter((a) => !idSet.has(a.transaction_id));
  if (kept.length !== all.length) {
    await writeLocalFinanceList<SpecialCategoryAssignment>(KEY_ASG, kept);
  }
}
