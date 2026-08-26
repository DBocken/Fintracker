import type { Account, Transaction } from '@/types';

/**
 * Effektiver Kontosaldo: der Ankerwert plus alle Buchungen, die NACH dem
 * Stichtag des Ankers liegen.
 */
export type EffectiveBalance = { amount: number; source: 'bank' | 'local'; balanceType?: string };

/**
 * Ein Saldo-Anker ist ein Betrag MIT Stichtag: „so viel war auf dem Konto, als
 * dieser Tag zu Ende ging". Alles danach wird aufaddiert, alles davor steckt
 * bereits im Anker.
 *
 * **Warum das der Kern dieser Datei ist.** Bis zur Korrektur rechnete sie
 * `opening_balance + Summe ALLER Buchungen` — ohne den Stichtag, den
 * `opening_balance_date` seit jeher mitliefert. Wer Historie nachimportierte,
 * die älter war als der Startsaldo, bekam sie doppelt gezählt; und ein
 * `live_balance_amount` schlug umgekehrt jede spätere Buchung, war also ab dem
 * Moment seiner Eingabe eingefroren. Beides zusammen war der Grund, warum der
 * Kontostand nach einem Import manuell nachgezogen werden musste.
 *
 * `date === null` bedeutet je nach Herkunft etwas anderes — und zwar genau
 * das, was das jeweilige Feld ohne Datum schon immer meinte:
 * - `'opening'` ohne Stichtag: Saldo seit Anbeginn, ALLE Buchungen zählen.
 * - `'bank'` ohne Zeitstempel: Momentaufnahme von jetzt, KEINE Buchung zählt.
 *
 * Dadurch verhalten sich Altbestände unverändert; niemand braucht eine
 * Migration, damit sein Konto weiter dieselbe Zahl zeigt.
 */
export type BalanceAnchor = {
  amount: number;
  /** Stichtag (ISO-Datum oder -Zeitstempel); `null` = kein Stichtag bekannt. */
  date: string | null;
  source: 'bank' | 'opening';
  balanceType?: string;
};

/** ISO-Zeitstempel oder -Datum auf den Kalendertag `YYYY-MM-DD` kürzen. */
function toDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Der maßgebliche Anker eines Kontos: der Bank-Saldo (`live_balance_amount`,
 * auch manuell korrigiert) oder der Startsaldo (`opening_balance`).
 *
 * Liegen beide vor, gewinnt der **jüngere** Stichtag — ein Bank-Saldo von
 * gestern ist die bessere Auskunft als ein Startsaldo von vor zwei Jahren,
 * ein nachgetragener Startsaldo von heute die bessere als ein Bank-Saldo von
 * vor drei Monaten. Bei Gleichstand gewinnt die Bank.
 */
export function pickBalanceAnchor(account: Account): BalanceAnchor | null {
  const bank: BalanceAnchor | null =
    account.live_balance_amount !== null && account.live_balance_amount !== undefined
      ? {
          amount: Number(account.live_balance_amount) || 0,
          date: account.live_balance_updated_at || null,
          source: 'bank',
          balanceType: account.live_balance_type || undefined,
        }
      : null;

  const opening: BalanceAnchor | null =
    account.opening_balance !== null && account.opening_balance !== undefined
      ? {
          amount: Number(account.opening_balance) || 0,
          date: account.opening_balance_date || null,
          source: 'opening',
        }
      : null;

  if (!bank) return opening;
  if (!opening) return bank;

  // Ein Anker ohne Stichtag lässt sich nicht datieren: Der Bank-Anker gilt
  // dann als „jetzt" (gewinnt), der Startsaldo als „seit Anbeginn" (verliert).
  if (!bank.date) return bank;
  if (!opening.date) return bank;

  return toDay(opening.date) > toDay(bank.date) ? opening : bank;
}

/**
 * Zählt eine Buchung auf den Anker drauf?
 *
 * Buchungen **am** Stichtag zählen NICHT: Ein Tagesschlusssaldo (`closingBooked`,
 * der Wert, den auch die Bank-App zeigt) enthält die Buchungen dieses Tages
 * bereits. Ein Stichtag ohne Uhrzeit lässt keine feinere Grenze zu, und die
 * Alternative — den Tag doppelt zu zählen — ist der Fehler, der hier behoben
 * wird.
 */
function countsAfterAnchor(anchor: BalanceAnchor, transactionDate: string): boolean {
  if (!anchor.date) return anchor.source === 'opening';
  return toDay(transactionDate) > toDay(anchor.date);
}

/**
 * Summiert Transaktionsbeträge je Konto (lokaler Rohsaldo ohne Anker).
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
 * Saldo EINES Kontos: Anker plus die Buchungen nach dessen Stichtag.
 *
 * Ohne jeden Anker bleibt nur die Summe der erfassten Buchungen — dann zeigt
 * das Konto zwangsläufig ein Minus, sobald nur ein Teil der Historie vorliegt.
 * Genau dafür gibt es den Anker; `account-data-quality-service` meldet sein
 * Fehlen als Datenlücke.
 */
export function computeAnchoredBalance(account: Account, transactions: Transaction[]): number {
  const anchor = pickBalanceAnchor(account);
  let sum = anchor ? anchor.amount : 0;
  for (const t of transactions) {
    if (t.account_id !== account.id) continue;
    if (anchor && !countsAfterAnchor(anchor, t.date)) continue;
    sum += t.amount || 0;
  }
  return sum;
}

/**
 * Effektiver Saldo je Konto.
 *
 * Nimmt die Transaktionen **selbst** entgegen, nicht ihre vorsummierten
 * Beträge: Eine `Record<accountId, number>`-Zwischenstufe hat die Datumsangaben
 * bereits weggeworfen, bevor diese Funktion sie sehen konnte — die
 * Signatur machte die richtige Rechnung unmöglich. Deshalb ist sie geändert.
 */
export function computeEffectiveBalances(
  accounts: Account[],
  transactions: Transaction[]
): Record<string, EffectiveBalance> {
  // Einmal gruppieren statt je Konto die ganze Liste durchlaufen: Bei vielen
  // Konten und zehntausend Buchungen ist der Unterschied nicht akademisch.
  const byAccount = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const aid = t.account_id;
    if (!aid) continue;
    const list = byAccount.get(aid);
    if (list) list.push(t);
    else byAccount.set(aid, [t]);
  }

  const map: Record<string, EffectiveBalance> = {};
  for (const a of accounts) {
    const anchor = pickBalanceAnchor(a);
    map[a.id] = {
      amount: computeAnchoredBalance(a, byAccount.get(a.id) ?? []),
      source: anchor?.source === 'bank' ? 'bank' : 'local',
      balanceType: anchor?.balanceType,
    };
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
