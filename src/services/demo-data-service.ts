import { format, startOfMonth, subMonths, addDays } from 'date-fns';
import type { Account, Debt, Transaction } from '@/types';
import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';

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

const MONTHLY_TEMPLATE: MonthlyTemplate[] = [
  { day: 1, amount: 2650, payee: 'Muster GmbH', description: 'Gehalt', categoryId: 'local-cat-einkommen' },
  { day: 1, amount: -980, payee: 'Wohnbau Süd', description: 'Miete Musterstraße 12', categoryId: 'local-cat-wohnen' },
  { day: 3, amount: -89, payee: 'Stadtwerke', description: 'Abschlag Strom & Gas', categoryId: 'local-cat-wohnen' },
  { day: 4, amount: -44.95, payee: 'Telekom', description: 'Mobilfunk & Internet', categoryId: 'local-cat-abos' },
  { day: 5, amount: -12.99, payee: 'Netflix', description: 'Netflix Abo', categoryId: 'local-cat-abos' },
  { day: 6, amount: -10.99, payee: 'Spotify', description: 'Spotify Premium', categoryId: 'local-cat-abos' },
  { day: 7, amount: -28.5, payee: 'HUK-Coburg', description: 'Haftpflichtversicherung', categoryId: 'local-cat-versicherung' },
  { day: 2, amount: -120, payee: 'Santander', description: 'Rate Möbelkredit', categoryId: 'local-cat-sonstiges' },
  // Lebensmittel — wöchentlich
  { day: 4, amount: -62.4, payee: 'REWE', description: 'Wocheneinkauf', categoryId: 'local-cat-lebensmittel' },
  { day: 11, amount: -48.9, payee: 'ALDI Süd', description: 'Wocheneinkauf', categoryId: 'local-cat-lebensmittel' },
  { day: 18, amount: -71.2, payee: 'EDEKA', description: 'Wocheneinkauf', categoryId: 'local-cat-lebensmittel' },
  { day: 25, amount: -55.6, payee: 'LIDL', description: 'Wocheneinkauf', categoryId: 'local-cat-lebensmittel' },
  // Mobilität
  { day: 9, amount: -68, payee: 'Aral Tankstelle', description: 'Tanken', categoryId: 'local-cat-mobilitaet' },
  { day: 23, amount: -64.5, payee: 'Shell', description: 'Tanken', categoryId: 'local-cat-mobilitaet' },
  // Restaurant & Freizeit
  { day: 13, amount: -32.8, payee: 'Lieferando', description: 'Essen bestellt', categoryId: 'local-cat-restaurant', accountId: KK_ID },
  { day: 20, amount: -24.6, payee: 'Trattoria Roma', description: 'Restaurant', categoryId: 'local-cat-restaurant', accountId: KK_ID },
  // Shopping & Gesundheit
  { day: 15, amount: -59.99, payee: 'Amazon', description: 'Online-Bestellung', categoryId: 'local-cat-shopping', accountId: KK_ID },
  { day: 27, amount: -16.9, payee: 'Rats-Apotheke', description: 'Apotheke', categoryId: 'local-cat-gesundheit' },
  // BNPL-Rate
  { day: 28, amount: -60, payee: 'Klarna', description: 'Klarna Rechnung Teilzahlung', categoryId: 'local-cat-shopping', accountId: KK_ID },
];

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
      description: 'Beispieldaten — mit einem Klick entfernbar',
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
      description: 'Beispieldaten — mit einem Klick entfernbar',
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

    MONTHLY_TEMPLATE.forEach((tpl, slot) => {
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
 * Lädt den Demo-Datensatz in den lokalen Speicher. Bestehende echte Daten
 * bleiben unangetastet; bereits vorhandene Demo-Datensätze werden ersetzt
 * (idempotent — zweimal laden erzeugt keine Duplikate).
 */
export async function loadDemoData(now: Date = new Date()): Promise<DemoDataset> {
  const dataset = buildDemoDataset(now);

  const [transactions, accounts, debts] = await Promise.all([
    readLocalFinanceList<Transaction>('transactions'),
    readLocalFinanceList<Account>('accounts'),
    readLocalFinanceList<Debt>('debts'),
  ]);

  await Promise.all([
    writeLocalFinanceList('transactions', [...transactions.filter((t) => !isDemoRecord(t)), ...dataset.transactions]),
    writeLocalFinanceList('accounts', [...accounts.filter((a) => !isDemoRecord(a)), ...dataset.accounts]),
    writeLocalFinanceList('debts', [...debts.filter((d) => !isDemoRecord(d)), ...dataset.debts]),
  ]);

  getFlagStorage()?.setItem(DEMO_ACTIVE_KEY, 'true');
  return dataset;
}

/** Entfernt ausschließlich Demo-Datensätze (ID-Präfix) — echte Daten bleiben. */
export async function removeDemoData(): Promise<void> {
  const [transactions, accounts, debts] = await Promise.all([
    readLocalFinanceList<Transaction>('transactions'),
    readLocalFinanceList<Account>('accounts'),
    readLocalFinanceList<Debt>('debts'),
  ]);

  await Promise.all([
    writeLocalFinanceList('transactions', transactions.filter((t) => !isDemoRecord(t))),
    writeLocalFinanceList('accounts', accounts.filter((a) => !isDemoRecord(a))),
    writeLocalFinanceList('debts', debts.filter((d) => !isDemoRecord(d))),
  ]);

  getFlagStorage()?.removeItem(DEMO_ACTIVE_KEY);
}
