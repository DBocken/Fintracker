import type { Account } from '../types';
import { normalizeIban } from './transfer-service';
import { getCurrentUserId } from './auth-service';
import { isDemoRecord } from './demo-data-service';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
} from './local-finance-store';
import { evaluateAccountCreation, type AccountCreationCheck } from '../lib/account-limits';
import type { Tier } from '../lib/tier';
import {
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_TYPE_ICONS,
} from '../lib/presentation/account-presentation';

/**
 * @deprecated Präsentationsdaten leben jetzt in
 * `@/lib/presentation/account-presentation`. Neuer Code importiert von dort;
 * diese Re-Exports halten bestehende Aufrufer während der Migration lauffähig.
 */
export {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_COLORS,
  formatSyncStatus,
} from '../lib/presentation/account-presentation';

export { FREE_ACCOUNT_LIMIT } from '../lib/constants';

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
}

/**
 * Tier in der Service-Schicht (Issue #59): ohne Login anonymous, mit
 * Login free. Premium folgt mit der Paywall (#52) über Entitlements.
 */
async function currentAccountTier(): Promise<Tier> {
  return (await getCurrentUserId()) ? 'free' : 'anonymous';
}

/**
 * Prüft das Konto-Limit zentral (nicht nur im UI). Demo-Konten (Issue #39)
 * zählen nicht mit — sie sind mit einem Klick entfernbar und dürfen die
 * erste echte Konto-Anlage nicht blockieren.
 */
async function checkAccountCreation(): Promise<AccountCreationCheck> {
  const accounts = await getAccounts();
  const realCount = accounts.filter((a) => !isDemoRecord(a)).length;
  return evaluateAccountCreation(await currentAccountTier(), realCount);
}

function sortAccounts(accounts: Account[]) {
  return [...accounts].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export async function getAccounts(): Promise<Account[]> {
  return sortAccounts(await readLocalFinanceList<Account>('accounts'));
}

export async function getAccountById(id: string): Promise<Account | null> {
  const accounts = await getAccounts();
  return accounts.find((account) => account.id === id) || null;
}

export async function createAccount(account: Partial<Account>): Promise<Account> {
  const check = await checkAccountCreation();
  if (!check.allowed) {
    throw new Error(check.message || `Konto-Limit von ${check.limit} erreicht.`);
  }

  const existingAccounts = await getAccounts();

  const type = account.type || 'checking';
  return upsertLocalFinanceItem<Account>('accounts', {
    id: account.id || crypto.randomUUID(),
    user_id: await localUserId(),
    name: account.name || 'Neues Konto',
    type,
    currency: account.currency || 'EUR',
    description: account.description || '',
    iban: normalizeIban(account.iban),
    color: account.color || ACCOUNT_TYPE_COLORS[type],
    icon: account.icon || ACCOUNT_TYPE_ICONS[type],
    is_budget_pool_member: account.is_budget_pool_member ?? true,
    order_index: account.order_index ?? existingAccounts.length,
    statement_close_day: account.statement_close_day || null,
    due_day: account.due_day || null,
    autopay_account_id: account.autopay_account_id || null,
    gocardless_account_id: account.gocardless_account_id || null,
    gocardless_requisition_id: account.gocardless_requisition_id || null,
    gocardless_institution_id: account.gocardless_institution_id || null,
    gocardless_institution_name: account.gocardless_institution_name || null,
    last_sync_at: account.last_sync_at || null,
    sync_enabled: account.sync_enabled ?? false,
    bank_connection_id: account.bank_connection_id || null,
    opening_balance: account.opening_balance ?? 0,
    opening_balance_date: account.opening_balance_date || null,
  });
}

export async function updateAccount(account: Partial<Account> & { id: string }): Promise<Account> {
  const patch = Object.prototype.hasOwnProperty.call(account, 'iban')
    ? { ...account, iban: normalizeIban(account.iban) }
    : account;
  return updateLocalFinanceItem<Account>('accounts', account.id, patch);
}

export async function deleteAccount(id: string): Promise<void> {
  await deleteLocalFinanceItem<Account>('accounts', id);
}

export async function getOrCreateDefaultAccount(): Promise<Account> {
  const accounts = await getAccounts();
  const checkingAccount = accounts.find(a => a.type === 'checking');
  if (checkingAccount) return checkingAccount;
  if (accounts.length > 0) return accounts[0];

  return createAccount({
    name: 'Girokonto',
    type: 'checking',
    description: 'Mein Hauptkonto',
    is_budget_pool_member: true,
  });
}

export async function canCreateAccount(): Promise<{ allowed: boolean; current: number; limit: number }> {
  const check = await checkAccountCreation();
  return {
    allowed: check.allowed,
    current: check.current,
    limit: check.limit,
  };
}

export async function getGoCardlessAccounts(): Promise<Account[]> {
  const accounts = await getAccounts();
  return accounts.filter(acc => acc.gocardless_account_id);
}

export async function getAccountByGoCardlessId(gocardlessAccountId: string): Promise<Account | null> {
  const accounts = await getAccounts();
  return accounts.find((account) => account.gocardless_account_id === gocardlessAccountId) || null;
}

export type { Account } from '../types';
