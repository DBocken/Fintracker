import { format, startOfMonth, subMonths, addDays } from 'date-fns';
import type { Account, Debt, Transaction } from '@/types';
import { mutateLocalFinanceList } from './local-finance-store';
import { getTransactions, saveTransactions, deleteTransaction } from './transaction-service';
import { t } from '@/i18n/serviceT';

/**
 * Demo-Datensatz für das Onboarding (Issue #39): ein realistischer
 * deutscher Haushalt — 3 Monate Transaktionen, 2 Konten, 2 Schulden.
 *
 * Trennung von echten Daten über das ID-Präfix `demo-`: echte Datensätze
 * bekommen crypto.randomUUID() und können nie mit diesem Präfix beginnen.
 * Entfernen = alle Datensätze mit Präfix herausfiltern — echte Daten
 * bleiben unangetastet, auch wenn beides nebeneinander existiert.
 */

export const DEMO_ID_PREFIX = 'demo-';
export const DEMO_ACTIVE_KEY = 'ausgabentracker_demo_active_v1';
/** Fenster-Event, das beim Aktivieren/Entfernen der Demo gefeuert wird (für reaktives Tier). */
export const DEMO_ACTIVE_EVENT = 'demo-active-change';

/** Signalisiert eine Änderung des Demo-Status an Hooks im selben Tab. */
function notifyDemoActiveChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_ACTIVE_EVENT));
}

export function isDemoRecord(record: { id?: string }): boolean {
  return typeof record.id === 'string' && record.id.startsWith(DEMO_ID_PREFIX);
}

export interface DemoDataset {
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
}

const GIRO_ID = `${DEMO_ID_PREFIX}acc-giro`;
const KK_ID = `${DEMO_ID_PREFIX}acc-kreditkarte`;

type MonthlyTemplate = {
  /** Tag im Monat (1-basiert); Werte > 28 werden auf Monatsende gekappt. */
  day: number;
  amount: number;
  payee: string;
  description: string;
  categoryId: string;
  accountId?: string;
};

// Beträge leicht variieren, damit Charts lebendig aussehen — deterministisch
// über (Monatsindex, Position), kein Math.random (Tests!).
function vary(base: number, monthIndex: number, slot: number): number {
  const factor = 1 + (((monthIndex * 7 + slot * 13) % 11) - 5) / 100; // ±5 %
  return Math.round(base * factor * 100) / 100;
}

/**
 * Bewusst eine FUNKTION und keine Modul-`const`: die Beschreibungen laufen ueber
 * `serviceT`. In einer Modul-`const` wuerden sie einmal beim Import aufgeloest
 * und ein spaeterer Sprachwechsel bliebe wirkungslos.
 *
 * Die `payee`-Werte bleiben unuebersetzt — es sind Haendler- und Firmennamen
 * (REWE, Netflix, "Wohnbau Sued"), also Daten und keine Beschriftungen.
 */
function monthlyTemplate(): MonthlyTemplate[] {
  return [
    { day: 1, amount: 2650, payee: 'Muster GmbH', description: t('demoData.tx.salary'), categoryId: 'local-cat-gehalt' },
    { day: 1, amount: -980, payee: 'Wohnbau Süd', description: t('demoData.tx.rent'), categoryId: 'local-cat-wohnen' },
    { day: 3, amount: -89, payee: 'Stadtwerke', description: t('demoData.tx.utilities'), categoryId: 'local-cat-wohnen' },
    { day: 4, amount: -44.95, payee: 'Telekom', description: t('demoData.tx.mobileInternet'), categoryId: 'local-cat-mobilfunk' },
    { day: 5, amount: -12.99, payee: 'Netflix', description: t('demoData.tx.netflix'), categoryId: 'local-cat-streaming' },
    { day: 6, amount: -10.99, payee: 'Spotify', description: t('demoData.tx.spotify'), categoryId: 'local-cat-streaming' },
    { day: 7, amount: -28.5, payee: 'HUK-Coburg', description: t('demoData.tx.liability'), categoryId: 'local-cat-haftpflicht' },
    { day: 2, amount: -120, payee: 'Santander', description: t('demoData.tx.furnitureLoan'), categoryId: 'local-cat-sonstiges' },
    // Lebensmittel — wöchentlich
    { day: 4, amount: -62.4, payee: 'REWE', description: t('demoData.tx.groceryRun'), categoryId: 'local-cat-lebensmittel' },
    { day: 11, amount: -48.9, payee: 'ALDI Süd', description: t('demoData.tx.groceryRun'), categoryId: 'local-cat-lebensmittel' },
    { day: 18, amount: -71.2, payee: 'EDEKA', description: t('demoData.tx.groceryRun'), categoryId: 'local-cat-lebensmittel' },
    { day: 25, amount: -55.6, payee: 'LIDL', description: t('demoData.tx.groceryRun'), categoryId: 'local-cat-lebensmittel' },
    // Mobilität
    { day: 9, amount: -68, payee: 'Aral Tankstelle', description: t('demoData.tx.fuel'), categoryId: 'local-cat-mobilitaet' },
    { day: 23, amount: -64.5, payee: 'Shell', description: t('demoData.tx.fuel'), categoryId: 'local-cat-mobilitaet' },
    // Restaurant & Freizeit
    { day: 13, amount: -32.8, payee: 'Lieferando', description: t('demoData.tx.foodDelivery'), categoryId: 'local-cat-restaurant', accountId: KK_ID },
    { day: 20, amount: -24.6, payee: 'Trattoria Roma', description: t('demoData.tx.restaurant'), categoryId: 'local-cat-restaurant', accountId: KK_ID },
    // Shopping & Gesundheit
    { day: 15, amount: -59.99, payee: 'Amazon', description: t('demoData.tx.onlineOrder'), categoryId: 'local-cat-shopping', accountId: KK_ID },
    { day: 27, amount: -16.9, payee: 'Rats-Apotheke', description: t('demoData.tx.pharmacy'), categoryId: 'local-cat-gesundheit' },
    // BNPL-Rate
    { day: 28, amount: -60, payee: 'Klarna', description: t('demoData.tx.klarna'), categoryId: 'local-cat-shopping', accountId: KK_ID },
  ];
}

/**
 * Pure Erzeugung des Demo-Datensatzes für die letzten `months` Monate
 * (inkl. laufendem Monat bis `now`). Deterministisch — testbar.
 */
export function buildDemoDataset(now: Date = new Date(), months = 3): DemoDataset {
  const nowIso = now.toISOString();

  const accounts: Account[] = [
    {
      id: GIRO_ID,
      user_id: 'demo',
      name: 'Girokonto (Demo)',
      type: 'checking',
      currency: 'EUR',
      description: t('demoData.tx.demoNotice'),
      color: '#2e7d72',
      icon: '🏦',
      is_budget_pool_member: true,
      order_index: 0,
      created_at: nowIso,
      updated_at: nowIso,
    } as Account,
    {
      id: KK_ID,
      user_id: 'demo',
      name: 'Kreditkarte (Demo)',
      type: 'credit_card',
      currency: 'EUR',
      description: t('demoData.tx.demoNotice'),
      color: '#5c7a99',
      icon: '💳',
      is_budget_pool_member: true,
      order_index: 1,
      created_at: nowIso,
      updated_at: nowIso,
    } as Account,
  ];

  const debts: Debt[] = [
    {
      id: `${DEMO_ID_PREFIX}debt-moebelkredit`,
      user_id: 'demo',
      name: 'Möbelkredit (Demo)',
      type: 'installment',
      balance: 3240,
      original_amount: 4800,
      interest_rate: 9.9,
      min_payment: 120,
      due_day: 2,
      is_bnpl: false,
      provider: 'Santander',
      notes: 'Beispieldaten',
      is_paid_off: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: `${DEMO_ID_PREFIX}debt-klarna`,
      user_id: 'demo',
      name: 'Klarna-Rechnung (Demo)',
      type: 'bnpl',
      balance: 180,
      original_amount: 300,
      interest_rate: 0,
      min_payment: 60,
      due_day: 28,
      is_bnpl: true,
      provider: 'Klarna',
      notes: 'Beispieldaten',
      is_paid_off: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const transactions: Transaction[] = [];

  for (let m = months - 1; m >= 0; m -= 1) {
    const monthStart = startOfMonth(subMonths(now, m));

    monthlyTemplate().forEach((tpl, slot) => {
      const date = addDays(monthStart, Math.min(tpl.day, 28) - 1);
      // Zukunfts-Buchungen im laufenden Monat weglassen
      if (date > now) return;

      const dateStr = format(date, 'yyyy-MM-dd');
      transactions.push({
        id: `${DEMO_ID_PREFIX}tx-${dateStr}-${slot}`,
        account_id: tpl.accountId ?? GIRO_ID,
        date: dateStr,
        amount: vary(tpl.amount, m, slot),
        payee: tpl.payee,
        description: tpl.description,
        original_text: `${tpl.payee} ${tpl.description}`,
        currency: 'EUR',
        category_id: tpl.categoryId,
        auto_mapped: true,
        confirmed: true,
      } as Transaction);
    });
  }

  return { accounts, transactions, debts };
}

function getFlagStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Schneller, synchroner Check fürs UI (Banner) — ohne IndexedDB-Roundtrip. */
export function isDemoDataActive(): boolean {
  return getFlagStorage()?.getItem(DEMO_ACTIVE_KEY) === 'true';
}

/**
 * Ersetzt die vorhandenen Demo-Buchungen durch `newDemoTransactions` (leer
 * für ein reines Entfernen). Buchungen laufen bewusst über dieselbe Fassade
 * wie jeder andere Aufrufer (`getTransactions`/`saveTransactions`/
 * `deleteTransaction` aus `transaction-service.ts`) — NICHT mehr über den
 * generischen `writeLocalFinanceList('transactions', …)`, der früher direkt
 * den v3-Blob ersetzte.
 *
 * WP 4.1c (PERF-1): Seit `transactionStorage` auf die Quartals-Chunk-Ablage
 * umschaltet, ist der v3-Blob nach einer Migration LEER/weg — ein Schreiber,
 * der ihn trotzdem direkt ersetzt, würde den gesamten migrierten (echten)
 * Bestand lautlos verlieren und den "Zeiger" (`hasLegacyV3Blob`,
 * `transaction-storage-service.ts`) fälschlich zurück auf v3 kippen. Die
 * Fassade routet dagegen automatisch zur jeweils aktuellen Ablage.
 *
 * Löschungen laufen SEQUENTIELL, nicht über `Promise.all`: Jede
 * Einzellöschung ist ein Lesen-Ändern-Schreiben ihres Quartals/Blobs; parallel
 * gestartet würden mehrere Löschungen desselben Quartals denselben
 * Vorher-Stand lesen und sich beim Schreiben gegenseitig überschreiben (nur
 * die zuletzt geschriebene Löschung bliebe wirksam) — ein klassisches
 * Lost-Update, keine Nebenläufigkeit, die sich hier lohnt.
 */
async function replaceDemoTransactions(newDemoTransactions: Transaction[]): Promise<void> {
  const existing = await getTransactions(10000);
  const staleDemoIds = existing.filter(isDemoRecord).map((tx) => tx.id!);

  for (const id of staleDemoIds) {
    await deleteTransaction(id);
  }
  if (newDemoTransactions.length > 0) {
    await saveTransactions(newDemoTransactions);
  }
}

/**
 * Lädt den Demo-Datensatz in den lokalen Speicher. Bestehende echte Daten
 * bleiben unangetastet; bereits vorhandene Demo-Datensätze werden ersetzt
 * (idempotent — zweimal laden erzeugt keine Duplikate).
 */
export async function loadDemoData(now: Date = new Date()): Promise<DemoDataset> {
  const dataset = buildDemoDataset(now);

  await replaceDemoTransactions(dataset.transactions);
  // Je Collection ein Lock (Issue #311): Die beiden laufen weiterhin parallel —
  // sie berühren verschiedene Schlüssel —, aber jede für sich vollständig.
  await Promise.all([
    mutateLocalFinanceList<Account>('accounts', (accounts) => [
      ...accounts.filter((a) => !isDemoRecord(a)),
      ...dataset.accounts,
    ]),
    mutateLocalFinanceList<Debt>('debts', (debts) => [
      ...debts.filter((d) => !isDemoRecord(d)),
      ...dataset.debts,
    ]),
  ]);

  getFlagStorage()?.setItem(DEMO_ACTIVE_KEY, 'true');
  notifyDemoActiveChange();
  return dataset;
}

/** Entfernt ausschließlich Demo-Datensätze (ID-Präfix) — echte Daten bleiben. */
export async function removeDemoData(): Promise<void> {
  await replaceDemoTransactions([]);
  await Promise.all([
    mutateLocalFinanceList<Account>('accounts', (accounts) => accounts.filter((a) => !isDemoRecord(a))),
    mutateLocalFinanceList<Debt>('debts', (debts) => debts.filter((d) => !isDemoRecord(d))),
  ]);

  getFlagStorage()?.removeItem(DEMO_ACTIVE_KEY);
  notifyDemoActiveChange();
}
