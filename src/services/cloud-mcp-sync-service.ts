// ⚠️ BEWUSSTE AUSNAHME vom Local-only-Designkonzept (Proof of Concept).
//
// Fintracker garantiert sonst per Test (`local-data-boundary.security.test.ts`,
// `[PRIVACY] lokale Finanzdaten-Grenze`), dass Finanzdaten das Gerät NICHT
// verlassen. Dieser Service ist die EINZIGE, ausdrücklich freigeschaltete
// Ausnahme: Er lädt – nur nach doppelter Nutzer-Bestätigung – AGGREGATE
// (Monatsausgaben, Budget-Status, Cashflow, Ausreißer) in die Cloud, damit ein
// gehosteter MCP-Server sie für Sprach-/Chat-Abfragen aus Claude/ChatGPT lesen
// kann. Es werden NIEMALS Rohtransaktionen, IBANs, `payee` oder `original_text`
// hochgeladen. Warum eine Ausnahme: Voice/Chat-Connector erreichen das Gerät nur
// über einen öffentlichen HTTPS-Endpunkt – das ist mit strikt-lokal unvereinbar.
//
// Risiko (siehe docs/mcp-poc.md): Aggregate verlassen das Gerät → Supabase UND
// der KI-Anbieter (Anthropic/OpenAI) sehen sie. POC-Auth ist ein Bearer-Token,
// kein produktives OAuth.

import type { Category, Transaction } from '@/types';
import type { BudgetStatus } from '@/types';
import type { WaterfallPlan } from './waterfall-service';
import { supabase } from '@/integrations/supabase/client';
import { getCategories, getTransactions } from './transaction-service';
import { currentMonthKey, getBudgetOverview, lastNMonths } from './budget-service';
import { getWaterfallPlan } from './waterfall-service';
import { getUserSettings } from './user-settings-service';

export const MCP_SNAPSHOT_SCHEMA_VERSION = 1 as const;

/** Phrase, die der Nutzer wörtlich tippen muss (zweite Bestätigungsstufe). */
export const MCP_CONFIRM_PHRASE = 'daten verlassen mein gerät';

export interface McpCategorySpending {
  category_id: string;
  name: string;
  amount: number;
}

export interface McpMonthlySpending {
  month: string; // YYYY-MM
  total: number;
  by_category: McpCategorySpending[];
}

export interface McpBudgetStatus {
  name: string;
  spent: number;
  remaining: number;
  ratio: number;
  health: 'ok' | 'warn' | 'over';
}

export interface McpCashflow {
  month: string;
  expected_income: number;
  expected_expenses: number;
  expected_savings: number;
  projected_end_balance: number;
  months_analyzed: number;
}

export interface McpUnusualExpense {
  month: string;
  category: string;
  amount: number;
  median: number;
  reason: string;
}

/**
 * Genau das, was das Gerät verlässt. Bewusst aggregat-only: keine `id`, kein
 * `payee`, keine `iban`, kein `original_text`, kein `description`.
 */
export interface McpAggregateSnapshot {
  schema_version: typeof MCP_SNAPSHOT_SCHEMA_VERSION;
  generated_at: string;
  base_currency: string;
  monthly_spending: McpMonthlySpending[];
  budget_status: McpBudgetStatus[];
  cashflow: McpCashflow | null;
  unusual_expenses: McpUnusualExpense[];
}

export interface SnapshotInput {
  transactions: Transaction[];
  categories: Category[];
  budgetStatuses: BudgetStatus[];
  waterfall: WaterfallPlan | null;
  /** Monats-Keys (YYYY-MM), absteigend oder aufsteigend – z. B. die letzten 6. */
  months: string[];
  baseCurrency: string;
  /** ISO-Zeitstempel; injizierbar für deterministische Tests. */
  now: string;
}

export interface SyncConsent {
  /** Erste Stufe: Risiko-Checkbox aktiv. */
  acknowledgedRisk: boolean;
  /** Zweite Stufe: wörtlich getippte Bestätigungsphrase. */
  confirmPhrase: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Wirft, solange die doppelte Bestätigung nicht vollständig vorliegt. Schützt
 * davor, dass ohne ausdrückliche Nutzer-Entscheidung Daten das Gerät verlassen.
 */
export function assertSyncConsent(consent: SyncConsent): void {
  if (!consent.acknowledgedRisk) {
    throw new Error('Sync abgebrochen: Risiko wurde nicht bestätigt (Stufe 1).');
  }
  if (normalizePhrase(consent.confirmPhrase) !== MCP_CONFIRM_PHRASE) {
    throw new Error('Sync abgebrochen: Bestätigungsphrase stimmt nicht (Stufe 2).');
  }
}

export function hasValidConsent(consent: SyncConsent): boolean {
  try {
    assertSyncConsent(consent);
    return true;
  } catch {
    return false;
  }
}

function spendingForMonth(
  month: string,
  transactions: Transaction[],
  categoryNameById: Map<string, string>,
): McpMonthlySpending {
  const byCategory = new Map<string, { name: string; amount: number }>();

  for (const tx of transactions) {
    // Nur bestätigte echte Ausgaben des Monats; interne Überträge zählen nicht.
    if (tx.is_transfer) continue;
    if (!tx.confirmed) continue;
    if (Number(tx.amount) >= 0) continue;
    if (!(tx.date || '').startsWith(month)) continue;

    const id = tx.category_id ?? 'uncategorized';
    const name = id === 'uncategorized' ? 'Unkategorisiert' : categoryNameById.get(id) ?? 'Unbekannt';
    const entry = byCategory.get(id) ?? { name, amount: 0 };
    entry.amount += Math.abs(Number(tx.amount) || 0);
    byCategory.set(id, entry);
  }

  const by_category = [...byCategory.entries()]
    .map(([category_id, { name, amount }]) => ({ category_id, name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    total: round2(by_category.reduce((sum, c) => sum + c.amount, 0)),
    by_category,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Ausreißer rein aus Aggregaten: Eine Kategorie-Monatssumme gilt als
 * ungewöhnlich, wenn sie deutlich über dem eigenen Median der betrachteten
 * Monate liegt. So bleiben Einzeltransaktionen auf dem Gerät.
 */
function detectUnusual(monthly: McpMonthlySpending[]): McpUnusualExpense[] {
  const seriesByCategory = new Map<string, { name: string; points: { month: string; amount: number }[] }>();
  for (const m of monthly) {
    for (const c of m.by_category) {
      const s = seriesByCategory.get(c.category_id) ?? { name: c.name, points: [] };
      s.points.push({ month: m.month, amount: c.amount });
      seriesByCategory.set(c.category_id, s);
    }
  }

  const unusual: McpUnusualExpense[] = [];
  for (const { name, points } of seriesByCategory.values()) {
    if (points.length < 3) continue; // zu wenig Historie für eine robuste Aussage
    const med = median(points.map((p) => p.amount));
    if (med <= 0) continue;
    for (const p of points) {
      // Schwelle: > 50 % über Median UND mind. 50 € absoluter Mehraufwand.
      if (p.amount > med * 1.5 && p.amount - med >= 50) {
        unusual.push({
          month: p.month,
          category: name,
          amount: p.amount,
          median: round2(med),
          reason: `${Math.round(((p.amount - med) / med) * 100)} % über dem üblichen Median (${round2(med)}) dieser Kategorie`,
        });
      }
    }
  }

  return unusual.sort((a, b) => b.amount - a.amount);
}

/**
 * Reine, deterministische Funktion: baut den Snapshot aus bereits geladenen
 * Daten. Genau hier wird sichergestellt, dass nur Aggregate entstehen.
 */
export function buildMcpAggregateSnapshot(input: SnapshotInput): McpAggregateSnapshot {
  const categoryNameById = new Map(input.categories.map((c) => [c.id, c.name]));

  const monthly_spending = input.months
    .map((month) => spendingForMonth(month, input.transactions, categoryNameById))
    .sort((a, b) => (a.month < b.month ? 1 : -1)); // neueste zuerst

  const budget_status: McpBudgetStatus[] = input.budgetStatuses.map((s) => ({
    name: s.budget.name,
    spent: round2(s.spent),
    remaining: round2(s.remaining),
    ratio: round4(s.ratio),
    health: s.health,
  }));

  const allocated = (key: 'savings' | 'essentials' | 'discretionary'): number =>
    input.waterfall?.steps.find((s) => s.key === key)?.allocated ?? 0;

  const cashflow: McpCashflow | null = input.waterfall
    ? {
        month: input.months[0] ?? input.now.slice(0, 7),
        expected_income: round2(input.waterfall.income),
        expected_expenses: round2(allocated('essentials') + allocated('discretionary')),
        expected_savings: round2(allocated('savings')),
        projected_end_balance: round2(input.waterfall.surplus),
        months_analyzed: input.waterfall.monthsAnalyzed ?? 0,
      }
    : null;

  return {
    schema_version: MCP_SNAPSHOT_SCHEMA_VERSION,
    generated_at: input.now,
    base_currency: input.baseCurrency,
    monthly_spending,
    budget_status,
    cashflow,
    unusual_expenses: detectUnusual(monthly_spending),
  };
}

// ── Cloud-Anbindung (die bewusste Ausnahme) ────────────────────────────────
// Ab hier wird Supabase berührt. Alles davor ist rein & netzwerkfrei testbar.

const SNAPSHOT_TABLE = 'mcp_aggregate_snapshots';
const LOOKBACK_MONTHS = 6;

/**
 * Fertige Connector-URL inklusive Token. Standard: same-origin Vercel-Function
 * (`/api/mcp/<token>`) – dann ist keine Konfiguration nötig. Optional kann
 * `VITE_MCP_POC_URL` auf einen separaten Server (mcp-poc/) zeigen.
 */
function buildConnectorUrl(token: string): string {
  const configured = import.meta.env.VITE_MCP_POC_URL;
  const base = configured
    ? String(configured).replace(/\/+$/, '')
    : typeof window !== 'undefined'
      ? window.location.origin
      : '';
  if (!base) {
    throw new Error('Connector-URL nicht bestimmbar (kein window, kein VITE_MCP_POC_URL).');
  }
  return `${base}/api/mcp/${token}`;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Nicht eingeloggt: Für den Cloud-Sync ist ein Konto nötig.');
  }
  return data.user.id;
}

/** Lädt live aus dem (entsperrten) lokalen Vault und baut den Aggregat-Snapshot. */
export async function buildSnapshotFromLiveData(now = new Date()): Promise<McpAggregateSnapshot> {
  const [transactions, categories, overview, settings] = await Promise.all([
    getTransactions(5000),
    getCategories(),
    getBudgetOverview(now),
    getUserSettings(),
  ]);
  const waterfall = await getWaterfallPlan(undefined, now).catch(() => null);

  return buildMcpAggregateSnapshot({
    transactions,
    categories,
    budgetStatuses: overview.statuses,
    waterfall,
    months: lastNMonths(currentMonthKey(now), LOOKBACK_MONTHS),
    baseCurrency: settings.default_currency ?? 'EUR',
    now: now.toISOString(),
  });
}

export interface EnableResult {
  /** Klartext-Token – wird nur EINMAL angezeigt, danach nur der Hash gespeichert. */
  token: string;
  /** Fertige Connector-URL für „No Auth"-Connector (Token im Pfad – POC!). */
  connectorUrl: string;
}

/**
 * Schaltet den Cloud-Sync frei (nur mit doppelter Bestätigung), lädt den ersten
 * Aggregat-Snapshot hoch und gibt das einmalige Zugriffstoken zurück.
 */
export async function enableCloudMcpSync(consent: SyncConsent): Promise<EnableResult> {
  assertSyncConsent(consent);
  const userId = await currentUserId();
  const token = generateAccessToken();
  const token_hash = await hashAccessToken(token);
  const payload = await buildSnapshotFromLiveData();

  const { error } = await supabase
    .from(SNAPSHOT_TABLE)
    .upsert(
      { user_id: userId, token_hash, payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`Snapshot-Upload fehlgeschlagen: ${error.message}`);

  return { token, connectorUrl: buildConnectorUrl(token) };
}

/** Aktualisiert den hochgeladenen Snapshot (Sync muss bereits aktiv sein). */
export async function syncCloudMcpAggregates(): Promise<{ updatedAt: string }> {
  const userId = await currentUserId();
  const payload = await buildSnapshotFromLiveData();
  const updatedAt = new Date().toISOString();
  const { error, count } = await supabase
    .from(SNAPSHOT_TABLE)
    .update({ payload, updated_at: updatedAt }, { count: 'exact' })
    .eq('user_id', userId);
  if (error) throw new Error(`Sync fehlgeschlagen: ${error.message}`);
  if (!count) throw new Error('Cloud-Sync ist nicht aktiviert.');
  return { updatedAt };
}

/** Deaktiviert den Cloud-Sync und löscht den hochgeladenen Snapshot vollständig. */
export async function disableCloudMcpSync(): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from(SNAPSHOT_TABLE).delete().eq('user_id', userId);
  if (error) throw new Error(`Deaktivieren fehlgeschlagen: ${error.message}`);
}

export interface SyncStatus {
  enabled: boolean;
  lastSyncedAt: string | null;
}

export async function getCloudMcpSyncStatus(): Promise<SyncStatus> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Status konnte nicht geladen werden: ${error.message}`);
  return { enabled: Boolean(data), lastSyncedAt: data?.updated_at ?? null };
}

/** SHA-256-Hex des Zugriffstokens (Web Crypto). Nur der Hash wird gespeichert. */
export async function hashAccessToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Erzeugt ein zufälliges, URL-sicheres Zugriffstoken. */
export function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
