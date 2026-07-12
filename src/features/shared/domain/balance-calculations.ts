import type { Account, Transaction } from '@/types';

/**
 * Effektiver Kontosaldo: entweder der Live-Saldo der Bank (GoCardless-Sync)
 * oder der lokal aus Eröffnungssaldo + erfassten Transaktionen berechnete Wert.
 */
export type EffectiveBalance = { amount: number; source: 'bank' | 'local'; balanceType?: string };

/**
 * Summiert Transaktionsbeträge je Konto (lokaler Rohsaldo ohne Eröffnungssaldo).
 * Transaktionen ohne account_id lassen sich keinem Konto zuordnen und werden
 * übersprungen.
 */
export function computeLocalBalances(transactions: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    const aid = t.account_id;
    if (!aid) continue;
    map[aid] = (map[aid] || 0) + (t.amount || 0);
  }
  return map;
}

/**
 * Effektiver Saldo je Konto: Bank-Live-Saldo (GoCardless-Sync) hat Vorrang,
 * sobald er gesetzt ist — auch bei 0 (0 ist ein gültiger Live-Saldo, kein
 * fehlender Wert). Sonst lokaler Saldo = Eröffnungssaldo (z. B. aus
 * GoCardless-Sync) plus die Summe der erfassten Transaktionen. Ohne den
 * Eröffnungssaldo zeigt das Konto fälschlich ein Minus, wenn nur ein Teil der
 * Historie importiert ist.
 */
export function computeEffectiveBalances(
  accounts: Account[],
  localBalances: Record<string, number>
): Record<string, EffectiveBalance> {
  const map: Record<string, EffectiveBalance> = {};
  for (const a of accounts) {
    if (a.live_balance_amount !== null && a.live_balance_amount !== undefined) {
      map[a.id] = {
        amount: Number(a.live_balance_amount) || 0,
        source: 'bank',
        balanceType: a.live_balance_type || undefined,
      };
      continue;
    }
    const opening = a.opening_balance ?? 0;
    map[a.id] = { amount: opening + (localBalances[a.id] ?? 0), source: 'local' };
  }
  return map;
}

/** Summe der effektiven Salden über alle Konten. */
export function computeTotalEffectiveBalance(
  accounts: Account[],
  effectiveBalances: Record<string, EffectiveBalance>
): number {
  return accounts.reduce((sum, a) => sum + (effectiveBalances[a.id]?.amount ?? 0), 0);
}
