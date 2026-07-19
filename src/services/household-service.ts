import {
  readLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';

/**
 * Lokales Haushalts-/Paarmodell für geteilte Ausgaben. Bewusst als vertikaler
 * Mini-Slice: validiert das Datenmodell (Haushalt, Mitglieder, Splits pro
 * Transaktion), bevor es ausgebaut wird. Alles **strikt lokal** (IndexedDB via
 * local-finance-store, optional verschlüsselt) – kein Server, kein Teilen von Daten.
 */

export interface Household {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  name: string;
  /** Optionaler Standard-Anteil (Gewicht) für Splits; Default gleichmäßig. */
  share?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SharedExpenseShare {
  member_id: string;
  amount: number;
}

export interface SharedExpenseSplit {
  id: string;
  transaction_id: string;
  household_id: string;
  shares: SharedExpenseShare[];
  /**
   * Wer die Ausgabe tatsächlich bezahlt hat (Ist-Zahler). Nur Splits mit
   * `paid_by_member_id` gehen in die Salden-/Ausgleichsberechnung ein (#247);
   * ohne diesen Wert ist der Split reine Kostenaufteilung ohne Schuldwirkung.
   */
  paid_by_member_id?: string;
  created_at?: string;
  updated_at?: string;
}

// --- Households ---------------------------------------------------------------

export async function getHouseholds(): Promise<Household[]> {
  return readLocalFinanceList<Household>('households');
}

export async function upsertHousehold(household: Partial<Household> & { name: string }): Promise<Household> {
  return upsertLocalFinanceItem<Household>('households', household as Household);
}

export async function deleteHousehold(id: string): Promise<void> {
  await deleteLocalFinanceItem<Household>('households', id);
  // Verwaiste Mitglieder mit aufräumen (lokal, keine Fremdschlüssel-DB).
  const members = await readLocalFinanceList<HouseholdMember>('householdMembers');
  for (const member of members.filter((m) => m.household_id === id)) {
    await deleteLocalFinanceItem<HouseholdMember>('householdMembers', member.id);
  }
}

// --- Members ------------------------------------------------------------------

export async function getHouseholdMembers(householdId?: string): Promise<HouseholdMember[]> {
  const all = await readLocalFinanceList<HouseholdMember>('householdMembers');
  return householdId ? all.filter((m) => m.household_id === householdId) : all;
}

export async function upsertHouseholdMember(
  member: Partial<HouseholdMember> & { household_id: string; name: string },
): Promise<HouseholdMember> {
  return upsertLocalFinanceItem<HouseholdMember>('householdMembers', member as HouseholdMember);
}

export async function deleteHouseholdMember(id: string): Promise<void> {
  await deleteLocalFinanceItem<HouseholdMember>('householdMembers', id);
}

// --- Splits -------------------------------------------------------------------

export async function getSharedExpenseSplit(transactionId: string): Promise<SharedExpenseSplit | null> {
  const all = await readLocalFinanceList<SharedExpenseSplit>('sharedExpenseSplits');
  return all.find((s) => s.transaction_id === transactionId) ?? null;
}

export async function upsertSharedExpenseSplit(
  split: Partial<SharedExpenseSplit> & {
    transaction_id: string;
    household_id: string;
    shares: SharedExpenseShare[];
  },
): Promise<SharedExpenseSplit> {
  // Pro transaction_id existiert höchstens ein Split – vorhandenen wiederverwenden.
  const existing = await getSharedExpenseSplit(split.transaction_id);
  const merged = existing ? { ...split, id: existing.id } : split;
  return upsertLocalFinanceItem<SharedExpenseSplit>('sharedExpenseSplits', merged as SharedExpenseSplit);
}

export async function deleteSharedExpenseSplit(transactionId: string): Promise<void> {
  const existing = await getSharedExpenseSplit(transactionId);
  if (existing) {
    await deleteLocalFinanceItem<SharedExpenseSplit>('sharedExpenseSplits', existing.id);
  }
}

/**
 * Teilt einen Betrag gleichmäßig auf die Mitglieder auf. Rundungsdifferenzen
 * landen cent-genau beim ersten Mitglied, damit die Summe exakt `amount` ergibt.
 */
export function splitEqually(amount: number, memberIds: string[]): SharedExpenseShare[] {
  if (memberIds.length === 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / memberIds.length);
  const remainder = cents - base * memberIds.length;
  return memberIds.map((member_id, index) => ({
    member_id,
    amount: (base + (index === 0 ? remainder : 0)) / 100,
  }));
}

/**
 * Teilt einen Betrag GEWICHTET nach `HouseholdMember.share` auf (Default-Gewicht 1,
 * wenn kein Anteil gesetzt ist). Rundungsdifferenzen werden nach dem
 * Largest-Remainder-Verfahren cent-genau verteilt, sodass die Summe der Anteile
 * exakt `amount` ergibt (Invariante 6). Fehlt jedes Gewicht, entspricht das
 * Ergebnis einer gleichmäßigen Aufteilung.
 */
export function splitWeighted(
  amount: number,
  members: { id: string; share?: number }[],
): SharedExpenseShare[] {
  if (members.length === 0) return [];
  const cents = Math.round(amount * 100);
  const weights = members.map((m) => (m.share != null && m.share > 0 ? m.share : 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const raw = weights.map((w) => (cents * w) / totalWeight);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = cents - floors.reduce((sum, f) => sum + f, 0);

  // Rest cent-weise an die größten Nachkommaanteile (stabil nach Index bei Gleichstand).
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = floors.slice();
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    result[order[k].i] += 1;
  }

  return members.map((m, i) => ({ member_id: m.id, amount: result[i] / 100 }));
}
