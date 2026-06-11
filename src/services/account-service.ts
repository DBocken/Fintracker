import type { Account, AccountType } from '../types';
import { getCurrentUserId } from './auth-service';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
} from './local-finance-store';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Girokonto',
  credit_card: 'Kreditkarte',
  savings: 'Tagesgeld/Sparkonto',
  wallet: 'Wallet (PayPal, Revolut, etc.)',
  other: 'Sonstiges',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  checking: '🏦',
  credit_card: '💳',
  savings: '🐷',
  wallet: '📱',
  other: '💰',
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  checking: '#3b82f6',
  credit_card: '#8b5cf6',
  savings: '#10b981',
  wallet: '#f59e0b',
  other: '#6b7280',
};

export const FREE_ACCOUNT_LIMIT = 3;

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
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
  const existingAccounts = await getAccounts();
  if (existingAccounts.length >= FREE_ACCOUNT_LIMIT) {
    throw new Error(`Maximale Anzahl von ${FREE_ACCOUNT_LIMIT} Konten erreicht. Upgrade auf Premium für unbegrenzte Konten.`);
  }

  const type = account.type || 'checking';
  return upsertLocalFinanceItem<Account>('accounts', {
    id: account.id || crypto.randomUUID(),
    user_id: await localUserId(),
    name: account.name || 'Neues Konto',
    type,
    currency: account.currency || 'EUR',
    description: account.description || '',
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
  });
}

export async function updateAccount(account: Partial<Account> & { id: string }): Promise<Account> {
  return updateLocalFinanceItem<Account>('accounts', account.id, account);
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
  const accounts = await getAccounts();
  return {
    allowed: accounts.length < FREE_ACCOUNT_LIMIT,
    current: accounts.length,
    limit: FREE_ACCOUNT_LIMIT,
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

export function formatSyncStatus(account: Account): string {
  if (!account.gocardless_account_id) return 'Nicht verbunden';
  if (!account.sync_enabled) return 'Synchronisation deaktiviert';
  if (!account.last_sync_at) return 'Noch nie synchronisiert';

  const lastSync = new Date(account.last_sync_at);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `Vor ${diffMins} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  return lastSync.toLocaleDateString('de-DE');
}

export type { Account } from '../types';
