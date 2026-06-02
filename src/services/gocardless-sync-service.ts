import { gocardlessService } from './gocardless-service';
import { updateAccount, getAccounts, type Account } from './account-service';
import { createTransaction, getTransactions } from './transaction-service';
import { bankConnectionService, getConsentStatus } from './bank-connection-service';
import { showSuccess, showError } from '@/utils/toast';
import { QueryClient } from '@tanstack/react-query';

export interface SyncResult {
  accountId: string;
  accountName: string;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

let queryClientRef: QueryClient | null = null;

export function setGoCardlessQueryClient(queryClient: QueryClient | null) {
  queryClientRef = queryClient;
}

function invalidateTransactionConsumers() {
  if (!queryClientRef) return;
  queryClientRef.invalidateQueries({ queryKey: ['transactions'] });
  queryClientRef.invalidateQueries({ queryKey: ['transactions-chart'] });
  queryClientRef.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
  queryClientRef.invalidateQueries({ queryKey: ['accounts'] });
  queryClientRef.invalidateQueries({ queryKey: ['live-balances'] });
  queryClientRef.invalidateQueries({ queryKey: ['net-worth'] });
}

interface GoCardlessTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationStructuredArray?: string[];
  additionalInformation?: string;
  purposeCode?: string;
  bankTransactionCode?: string;
  proprietaryBankTransactionCode?: string;
  balanceAfterTransaction?: {
    balanceAmount: {
      amount: string;
      currency: string;
    };
    balanceType: string;
    creditLimitIncluded?: boolean;
  };
}

export interface ConsentCheckResult {
  valid: boolean;
  expired: boolean;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  message?: string;
}

export async function getAccountConsentStatus(account: Account): Promise<ConsentCheckResult> {
  if (!account.gocardless_account_id || !account.bank_connection_id) {
    return { valid: true, expired: false };
  }

  const connection = await bankConnectionService.getBankConnectionById(account.bank_connection_id);
  if (!connection) {
    return {
      valid: false,
      expired: false,
      message: 'Die Bankverbindung konnte nicht gefunden werden.',
    };
  }

  const consent = getConsentStatus(connection);

  if (connection.status === 'expired' || consent.isExpired) {
    return {
      valid: false,
      expired: true,
      expiresAt: consent.expiresAt,
      daysRemaining: consent.daysRemaining,
      message: 'Dein Bankzugriff ist abgelaufen. Beim nächsten Aktualisieren wird die Consent-Abfrage erneut gestartet.',
    };
  }

  return {
    valid: true,
    expired: false,
    expiresAt: consent.expiresAt,
    daysRemaining: consent.daysRemaining,
  };
}

/**
 * Sync transactions for a single GoCardless-connected account
 */
export async function syncAccountTransactions(account: Account): Promise<SyncResult> {
  const result: SyncResult = {
    accountId: account.id,
    accountName: account.name,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  if (!account.gocardless_account_id) {
    result.errors.push('Keine GoCardless Account ID vorhanden');
    return result;
  }

  if (!account.gocardless_requisition_id) {
    result.errors.push('Keine GoCardless Requisition ID vorhanden');
    return result;
  }

  const consentStatus = await getAccountConsentStatus(account);
  if (!consentStatus.valid) {
    result.errors.push(consentStatus.message || 'Consent ungültig');
    return result;
  }

  try {
    const today = new Date();
    const lastSyncDate = account.last_sync_at
      ? new Date(account.last_sync_at)
      : new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000);
    
    const syncFrom = new Date(Math.max(
      lastSyncDate.getTime() - 24 * 60 * 60 * 1000,
      today.getTime() - 730 * 24 * 60 * 60 * 1000
    ));

    const dateFrom = syncFrom.toISOString().split('T')[0];

    const dateTo = today.toISOString().split('T')[0];

    console.log(`[gocardless-sync] Syncing ${account.name} from ${dateFrom} to ${dateTo}`);

    const transactions = await gocardlessService.getTransactions(
      account.gocardless_requisition_id,
      account.gocardless_account_id,
      dateFrom,
      dateTo
    );

    if (!transactions || transactions.length === 0) {
      console.log(`[gocardless-sync] No new transactions for ${account.name}`);
      await updateAccount({
        id: account.id,
        last_sync_at: new Date().toISOString(),
      });
      return result;
    }

    const existingTransactions = await getTransactions(5000);
    const existingDescriptions = new Set(
      existingTransactions.map(tx => `${tx.account_id || account.id}_${tx.date}_${tx.amount}_${tx.original_text}`)
    );

    for (const tx of transactions as GoCardlessTransaction[]) {
      try {
        const amount = parseFloat(tx.transactionAmount.amount);
        const date = tx.bookingDate;
        const payee = tx.debtorName || tx.creditorName || 'Unbekannt';
        const description = tx.remittanceInformationUnstructured ||
          (tx.remittanceInformationStructuredArray?.join(' ')) ||
          tx.additionalInformation ||
          payee;

        const txIdentifier = `${account.id}_${date}_${amount}_${description}`;

        if (existingDescriptions.has(txIdentifier)) {
          result.skippedCount++;
          continue;
        }

        await createTransaction({
          account_id: account.id,
          date: date,
          amount: amount,
          payee: payee.slice(0, 100),
          description: description.slice(0, 200),
          original_text: description.slice(0, 200),
          currency: tx.transactionAmount.currency || account.currency || 'EUR',
          auto_mapped: false,
          confirmed: false,
        });

        result.importedCount++;
      } catch (error: any) {
        console.error('[gocardless-sync] Failed to import transaction:', error);
        result.errors.push(`Transaktion ${tx.transactionId}: ${error.message}`);
      }
    }

    await updateAccount({
      id: account.id,
      last_sync_at: new Date().toISOString(),
    });

    console.log(`[gocardless-sync] Synced ${account.name}: ${result.importedCount} imported, ${result.skippedCount} skipped`);

  } catch (error: any) {
    console.error(`[gocardless-sync] Failed to sync ${account.name}:`, error);
    result.errors.push(`Sync-Fehler: ${error.message}`);
  }

  return result;
}

/**
 * Sync all GoCardless-connected accounts
 */
export async function syncAllAccounts(): Promise<SyncResult[]> {
  try {
    const accounts = await getAccounts();
    const syncableAccounts = accounts.filter(acc => acc.gocardless_account_id && acc.sync_enabled);

    if (syncableAccounts.length === 0) {
      showError('Keine synchronisierbaren Konten gefunden');
      return [];
    }

    const results: SyncResult[] = [];

    for (const account of syncableAccounts) {
      const result = await syncAccountTransactions(account);
      results.push(result);
    }

    const totalImported = results.reduce((sum, r) => sum + r.importedCount, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    invalidateTransactionConsumers();

    if (totalImported > 0) {
      showSuccess(`${totalImported} Transaktionen synchronisiert`);
    }
    if (totalErrors > 0) {
      showError(`${totalErrors} Fehler bei der Synchronisation`);
    }

    return results;
  } catch (error: any) {
    showError(`Synchronisation fehlgeschlagen: ${error.message}`);
    throw error;
  }
}

/**
 * Check if an account can be synced (rate limiting check)
 */
export function canSyncAccount(account: Account): { canSync: boolean; nextSyncIn?: string } {
  if (!account.gocardless_account_id) {
    return { canSync: false };
  }

  if (!account.last_sync_at) {
    return { canSync: true };
  }

  const lastSync = new Date(account.last_sync_at);
  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

  const minHoursBetweenSyncs = 6;

  if (hoursSinceSync < minHoursBetweenSyncs) {
    const hoursRemaining = Math.ceil(minHoursBetweenSyncs - hoursSinceSync);
    return { 
      canSync: false, 
      nextSyncIn: `${hoursRemaining} Std.` 
    };
  }

  return { canSync: true };
}

/**
 * Disconnect a GoCardless account (remove sync capability but keep account)
 */
export async function disconnectGoCardlessAccount(accountId: string): Promise<void> {
  await updateAccount({
    id: accountId,
    gocardless_account_id: null,
    gocardless_requisition_id: null,
    gocardless_institution_id: null,
    gocardless_institution_name: null,
    sync_enabled: false,
    last_sync_at: null,
  });
}

/**
 * Get sync status summary for dashboard display
 */
export async function getSyncStatus(): Promise<{
  totalConnected: number;
  lastSyncToday: number;
  lastSyncWeek: number;
  neverSynced: number;
}> {
  const accounts = await getAccounts();
  const connected = accounts.filter(acc => acc.gocardless_account_id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    totalConnected: connected.length,
    lastSyncToday: connected.filter(acc => 
      acc.last_sync_at && new Date(acc.last_sync_at) >= today
    ).length,
    lastSyncWeek: connected.filter(acc => 
      acc.last_sync_at && new Date(acc.last_sync_at) >= weekAgo
    ).length,
    neverSynced: connected.filter(acc => !acc.last_sync_at).length,
  };
}