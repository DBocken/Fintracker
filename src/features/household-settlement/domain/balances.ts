import { toMinor } from '@/lib/money';
import type { SharedExpenseSplit } from '@/lib/household-types';

/**
 * Reine Domänenlogik des lokalen Haushaltsausgleichs (kein React, kein I/O).
 *
 * Salden und der abgeleitete „wer schuldet wem"-Plan sind REINE ABLEITUNGEN aus
 * Splits (Soll-Anteile + Ist-Zahler) und Ausgleichsbuchungen — sie werden nie
 * gespeichert. Zahlen intern in Integer-Cent, damit die Summe der Salden über
 * alle Mitglieder immer exakt 0 ist (kein Cent geht verloren, Invariante-6-analog).
 */

/** Eine Ausgleichsbuchung (Teilmenge; die volle Entität kommt in C2/#248). */
export interface SettlementEntry {
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
  /** Optionaler Link auf die reale Transaktion, falls per Konto ausgeglichen. */
  linked_transaction_id?: string;
}

/** Nettosaldo eines Mitglieds: > 0 = ihm wird geschuldet, < 0 = er schuldet. */
export interface MemberBalance {
  member_id: string;
  balance_minor: number;
}

/** Ein konkreter Ausgleichsvorschlag „from zahlt to". */
export interface DebtTransfer {
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
}

/** Ausgleichsstatus eines Haushalts (reine Ableitung, nie gespeichert). */
export type SettlementStatus = 'settled' | 'partial' | 'open';

/** Summe aller offenen Guthaben (= Summe aller offenen Schulden), in Cent. */
export function totalOwedMinor(balances: MemberBalance[]): number {
  return balances.filter((b) => b.balance_minor > 0).reduce((sum, b) => sum + b.balance_minor, 0);
}

/**
 * Ausgleichsfortschritt eines Haushalts: vergleicht die Brutto-Schuld aus den
 * Splits mit dem Rest nach Ausgleichsbuchungen. `settled` = nichts mehr offen,
 * `partial` = teilweise ausgeglichen, `open` = noch nichts ausgeglichen.
 */
export function settlementProgress(
  splits: SharedExpenseSplit[],
  settlements: SettlementEntry[] = [],
): { status: SettlementStatus; grossOwedMinor: number; remainingOwedMinor: number } {
  const grossOwedMinor = totalOwedMinor(computeMemberBalances(splits, []));
  const remainingOwedMinor = totalOwedMinor(computeMemberBalances(splits, settlements));
  const status: SettlementStatus =
    remainingOwedMinor === 0 ? 'settled' : remainingOwedMinor < grossOwedMinor ? 'partial' : 'open';
  return { status, grossOwedMinor, remainingOwedMinor };
}

/**
 * Menge der Transaktions-IDs, die als interne Ausgleichszahlung verbucht wurden.
 * Diese Transaktionen werden aus der Konsumauswertung ausgeschlossen
 * (analog Invariante 2: interne Umbuchungen sind weder Einnahme noch Ausgabe),
 * um Doppelzählung zu verhindern.
 */
export function settlementTransactionIds(settlements: SettlementEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const s of settlements) {
    if (s.linked_transaction_id) ids.add(s.linked_transaction_id);
  }
  return ids;
}

function shareSumMinor(split: SharedExpenseSplit): number {
  return split.shares.reduce((sum, s) => sum + toMinor(s.amount), 0);
}

/**
 * Nettosalden je Mitglied aus Splits und bereits erfolgten Ausgleichen.
 *
 * Pro Split (nur mit Ist-Zahler): der Zahler hat den Gesamtbetrag ausgelegt und
 * bekommt ihn gutgeschrieben; jedes Mitglied trägt seinen Soll-Anteil als Schuld.
 * Netto je Mitglied = ausgelegt − eigener Anteil. Die Summe über alle Mitglieder
 * eines Splits ist exakt 0. Ausgleichsbuchungen verschieben den Saldo zurück:
 * zahlt A an B, sinkt A's Schuld (+amount) und B's Guthaben (−amount).
 */
export function computeMemberBalances(
  splits: SharedExpenseSplit[],
  settlements: SettlementEntry[] = [],
): MemberBalance[] {
  const balance = new Map<string, number>();
  const add = (memberId: string, deltaMinor: number) => {
    balance.set(memberId, (balance.get(memberId) ?? 0) + deltaMinor);
  };

  for (const split of splits) {
    // Ohne Ist-Zahler ist der Split reine Kostenaufteilung, keine Schuld.
    if (!split.paid_by_member_id) continue;
    const totalMinor = shareSumMinor(split);
    add(split.paid_by_member_id, totalMinor); // hat ausgelegt
    for (const share of split.shares) {
      add(share.member_id, -toMinor(share.amount)); // schuldet seinen Anteil
    }
  }

  for (const s of settlements) {
    add(s.from_member_id, s.amount_minor);
    add(s.to_member_id, -s.amount_minor);
  }

  return [...balance.entries()]
    .map(([member_id, balance_minor]) => ({ member_id, balance_minor }))
    .sort((a, b) => (a.member_id < b.member_id ? -1 : a.member_id > b.member_id ? 1 : 0));
}

/**
 * Minimaler Ausgleichsplan („wer schuldet wem wie viel"): Greedy-Matching des
 * größten Gläubigers mit dem größten Schuldner, bis alle Salden ausgeglichen
 * sind. Deterministisch (stabile Sortierung), erzeugt keine Ausgleichszahlung
 * über 0 Cent.
 */
export function computeDebts(balances: MemberBalance[]): DebtTransfer[] {
  const creditors = balances
    .filter((b) => b.balance_minor > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance_minor - a.balance_minor || (a.member_id < b.member_id ? -1 : 1));
  const debtors = balances
    .filter((b) => b.balance_minor < 0)
    .map((b) => ({ member_id: b.member_id, balance_minor: -b.balance_minor })) // als positive Schuld
    .sort((a, b) => b.balance_minor - a.balance_minor || (a.member_id < b.member_id ? -1 : 1));

  const transfers: DebtTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].balance_minor, debtors[di].balance_minor);
    if (amount > 0) {
      transfers.push({
        from_member_id: debtors[di].member_id,
        to_member_id: creditors[ci].member_id,
        amount_minor: amount,
      });
      creditors[ci].balance_minor -= amount;
      debtors[di].balance_minor -= amount;
    }
    if (creditors[ci].balance_minor === 0) ci++;
    if (debtors[di].balance_minor === 0) di++;
  }
  return transfers;
}
