import { gocardlessService } from './gocardless-service';
import { getBankBalanceForAccount } from './live-balance-service';
import { updateAccount, getAccounts, type Account } from './account-service';
import { createTransaction, getTransactions, getCategories, getUserSettings, markTransferPair } from './transaction-service';
import { categorizeTransactionConfident } from '@/lib/categorization';
import { getMerchantRules } from './merchant-rules-service';
import { bankConnectionService, getConsentStatus } from './bank-connection-service';
import { applyDetectedContracts } from './contract-detection-service';
import { planInternalTransfers, type AccountIbanRef } from './transfer-service';
import type { Transaction } from '../types';
import { showSuccess, showError } from '@/utils/toast';
import { QueryClient } from '@tanstack/react-query';
import { t } from '@/i18n/serviceT';

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
  debtorAccount?: { iban?: string };
  creditorAccount?: { iban?: string };
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
      message: t('syncService.bankConnectionNotFound'),
    };
  }

  const consent = getConsentStatus(connection);

  if (connection.status === 'expired' || consent.isExpired) {
    return {
      valid: false,
      expired: true,
      expiresAt: consent.expiresAt,
      daysRemaining: consent.daysRemaining,
      message: t('syncService.consentExpired'),
    };
  }

  return {
    valid: true,
    expired: false,
    expiresAt: consent.expiresAt,
    daysRemaining: consent.daysRemaining,
  };
}

/** Maximale Länge des gespeicherten Verwendungszwecks (original_text/description). */
const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Stabiler Dedupe-Schlüssel einer Bankbuchung. Der Text wird IMMER auf dieselbe
 * Länge gekürzt, mit der er auch gespeichert wird — sonst würde der Vergleich
 * bei langen Verwendungszwecken (> 200 Zeichen) nie matchen und die Buchung bei
 * jedem Sync erneut angelegt (F-ARCH-2). Ein Aufrufer baut den Schlüssel aus der
 * rohen API-Description, der andere aus dem gespeicherten (bereits gekürzten)
 * original_text — beide müssen identisch sein.
 */
export function buildTxIdentifier(
  accountId: string,
  date: string,
  amount: number,
  text: string,
): string {
  return `${accountId}_${date}_${amount}_${(text || '').slice(0, MAX_DESCRIPTION_LENGTH)}`;
}

/**
 * Verknüpft frisch importierte Buchungen, deren Gegenkonto-IBAN auf ein eigenes
 * Konto zeigt, als interne Überträge. Existiert die Gegenbuchung bereits, wird
 * nur verknüpft; auf nicht-live-synchronisierten Konten wird die fehlende
 * Gegenbuchung als Spiegelbuchung angelegt.
 */
export async function reconcileInternalTransfers(
  importedTransactions: Transaction[],
  allTransactions: Transaction[],
  options: { amountDateFallback?: boolean } = {},
): Promise<void> {
  const accounts = await getAccounts();
  const accountRefs: AccountIbanRef[] = accounts.map((a) => ({
    id: a.id,
    iban: a.iban,
    isLive: !!a.gocardless_account_id && a.sync_enabled !== false,
  }));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const plans = planInternalTransfers(importedTransactions, allTransactions, accountRefs, options);

  for (const plan of plans) {
    if (!plan.source.id) continue;

    if (plan.existingCounterpart?.id) {
      await markTransferPair(plan.source.id, plan.existingCounterpart.id);
      continue;
    }

    // Spiegelbuchung auf dem nicht-live-Konto anlegen (entgegengesetztes Vorzeichen).
    const sourceAccount = plan.source.account_id ? accountsById.get(plan.source.account_id) : null;
    const counterAccount = accountsById.get(plan.counterAccountId);
    const internalTransferLabel = t('dashboard.removeTransfer');
    const mirror = await createTransaction({
      account_id: plan.counterAccountId,
      date: plan.source.date,
      amount: -plan.source.amount,
      payee: sourceAccount?.name || plan.source.payee || internalTransferLabel,
      description: `${internalTransferLabel} (${sourceAccount?.name || t('transactionService.unknownPayee')})`,
      original_text: plan.source.original_text || plan.source.description || internalTransferLabel,
      currency: plan.source.currency || counterAccount?.currency || 'EUR',
      counterparty_iban: sourceAccount?.iban ?? null,
      auto_mapped: false,
      confirmed: true,
    });

    if (mirror.id) {
      await markTransferPair(plan.source.id, mirror.id);
    }
  }
}

/**
 * Wie {@link reconcileInternalTransfers}, betrachtet aber den gesamten
 * Transaktionsbestand als mögliche Quelle (nicht nur einen frisch importierten
 * Stapel). Damit werden auch bereits vorhandene Buchungen nachträglich anhand
 * ihrer Gegenkonto-IBAN als interne Überträge erkannt und verknüpft bzw.
 * gespiegelt – z.B. nachdem die IBAN eines Kontos erst nachgetragen wurde.
 *
 * Idempotent: bereits als Übertrag markierte Buchungen werden übersprungen,
 * es entstehen keine Doppelbuchungen bei mehrfachem Aufruf.
 *
 * Aktiviert zusätzlich den Betrag+Datum-Fallback, damit auch Überträge erkannt
 * werden, bei denen die Bank keine Gegenkonto-IBAN liefert – allerdings nur
 * verknüpfend bei eindeutigem Treffer, nie durch Anlegen einer Spiegelbuchung.
 */
export async function reconcileAllInternalTransfers(): Promise<void> {
  const allTransactions = await getTransactions(10000);
  await reconcileInternalTransfers(allTransactions, allTransactions, { amountDateFallback: true });
}

/**
 * Holt den echten Kontostand der Bank (`closingBooked` — der Wert, den auch
 * die Bank-App zeigt) und schreibt ihn samt Stichtag als Saldo-Anker fort.
 *
 * **Warum das der eigentliche Kern des Imports ist.** Vorher wurde der Anker
 * aus der ERSTEN Buchung des Sync-Fensters zurückgerechnet
 * (`balanceAfterTransaction - amount`). Das ergibt einen Anker am ANFANG des
 * Fensters, und weil der Sync inkrementell läuft (`dateFrom = last_sync_at`),
 * war dieser Anfang bei jedem Lauf ein anderer — während zugleich weiterhin
 * die gesamte Buchungshistorie daraufaddiert wurde. Der Bank-Saldo selbst,
 * den GoCardless mitliefert, landete nie im lokalen Konto; er wurde nur
 * ungespeichert in der Kontenliste angezeigt. Deshalb musste der Kontostand
 * nach jedem Import von Hand nachgezogen werden.
 *
 * Fehler beim Abruf sind hier nicht tödlich: Der Saldo bleibt dann auf dem
 * letzten bekannten Anker stehen, und der Buchungs-Import läuft weiter.
 */
async function refreshBalanceAnchor(account: Account): Promise<void> {
  try {
    const live = await getBankBalanceForAccount(account);
    if (!live || !Number.isFinite(live.amount)) return;

    await updateAccount({
      id: account.id,
      live_balance_amount: live.amount,
      live_balance_currency: live.currency || account.currency || 'EUR',
      live_balance_type: live.balanceType || null,
      // Der Stichtag der BANK, nicht der Zeitpunkt des Abrufs: Er entscheidet,
      // welche Buchungen noch auf den Anker draufgerechnet werden.
      live_balance_updated_at: live.referenceDate || new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.warn('[gocardless-sync] Balance anchor refresh failed:', { message: (error as Error).message });
  }
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
    result.errors.push(t('syncService.noGoCardlessAccountId'));
    return result;
  }

  if (!account.gocardless_requisition_id) {
    result.errors.push(t('syncService.noGoCardlessRequisitionId'));
    return result;
  }

  const consentStatus = await getAccountConsentStatus(account);
  if (!consentStatus.valid) {
    result.errors.push(consentStatus.message || t('syncService.consentInvalid'));
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

    console.log('[gocardless-sync] Starting account sync', { dateFrom, dateTo });

    const transactions = await gocardlessService.getTransactions(
      account.gocardless_requisition_id,
      account.gocardless_account_id,
      dateFrom,
      dateTo
    );

    if (!transactions || transactions.length === 0) {
      console.log('[gocardless-sync] Account sync completed with no new transactions');
      // Keine neue Buchung heisst NICHT „Saldo unveraendert": Zinsen, Gebuehren
      // und Buchungen, die die Bank erst spaeter nachliefert, bewegen ihn auch
      // dann. Der Anker wird deshalb auch auf diesem Weg nachgezogen.
      await refreshBalanceAnchor(account);
      await updateAccount({
        id: account.id,
        last_sync_at: new Date().toISOString(),
      });
      return result;
    }

    const existingTransactions = await getTransactions(5000);
    const existingDescriptions = new Set(
      existingTransactions.map(tx =>
        buildTxIdentifier(tx.account_id || account.id, tx.date, tx.amount, tx.original_text || '')
      )
    );

    const categories = await getCategories();
    const learnedRules = await getMerchantRules();
    const userSettings = await getUserSettings();

    // Startsaldo aus der ersten Buchung des Fensters zurueckrechnen — als
    // Rueckfallebene fuer den Fall, dass die Bank keinen Saldo herausgibt.
    //
    // Das ist NUR beim allerersten Sync eines Kontos zulaessig: Nur dann ist
    // das Fenster die volle Historie und der lokale Bestand leer. Bei jedem
    // weiteren (inkrementellen) Lauf waere das Ergebnis der Saldo vor einem
    // beliebigen Zwischenstand — und genau der wurde bisher gesetzt, weil die
    // Bedingung `!account.opening_balance` bei dem von `createAccount`
    // vergebenen Wert 0 IMMER wahr war.
    let openingBalance: number | null = null;
    let openingBalanceDate: string | null = null;

    const sortedTransactions = [...(transactions as GoCardlessTransaction[])].sort(
      (a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
    );

    const firstTx = sortedTransactions[0];
    if (firstTx?.balanceAfterTransaction) {
      const balanceAfter = parseFloat(
        firstTx.balanceAfterTransaction.balanceAmount.amount
      );
      const txAmount = parseFloat(firstTx.transactionAmount.amount);
      openingBalance = balanceAfter - txAmount;
      openingBalanceDate = firstTx.bookingDate;
    }

    const importedTransactions: Transaction[] = [];

    for (const tx of transactions as GoCardlessTransaction[]) {
      try {
        const amount = parseFloat(tx.transactionAmount.amount);
        const date = tx.bookingDate;
        const payee = tx.debtorName || tx.creditorName || t('transactionService.unknownPayee');
        const description = tx.remittanceInformationUnstructured ||
          (tx.remittanceInformationStructuredArray?.join(' ')) ||
          tx.additionalInformation ||
          payee;
        // IBAN des Gegenübers für die automatische Erkennung interner Überträge.
        const counterpartyIban = tx.debtorAccount?.iban || tx.creditorAccount?.iban || null;

        // Dedupe-Identifier aus derselben (gesliceten) Description bilden, die
        // auch als original_text gespeichert wird (F-ARCH-2, siehe buildTxIdentifier).
        const normalizedDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);
        const txIdentifier = buildTxIdentifier(account.id, date, amount, description);

        if (existingDescriptions.has(txIdentifier)) {
          result.skippedCount++;
          continue;
        }

        const draftTransaction = {
          date: date,
          amount: amount,
          payee: payee.slice(0, 100),
          description: normalizedDescription,
          original_text: normalizedDescription,
          auto_mapped: false,
          confirmed: false,
        };
        // Stille Zuweisung nur ab mittlerer Konfidenz — Regex-Raten (0,55) bleiben
        // unkategorisiert und landen als Vorschlag in der Coach-Inbox.
        const categoryId = categorizeTransactionConfident(draftTransaction as import('../types').Transaction, categories, learnedRules);

        const created = await createTransaction({
          account_id: account.id,
          date: date,
          amount: amount,
          payee: payee.slice(0, 100),
          description: normalizedDescription,
          original_text: normalizedDescription,
          currency: tx.transactionAmount.currency || account.currency || 'EUR',
          category_id: categoryId,
          auto_mapped: !!categoryId,
          confirmed: !!categoryId && userSettings.auto_confirm_mapping,
          counterparty_iban: counterpartyIban,
        });
        importedTransactions.push(created);

        result.importedCount++;
      } catch (error: unknown) {
        console.error('[gocardless-sync] Failed to import transaction:', { message: (error as Error).message });
        result.errors.push(t('syncService.importTransactionFailed', '{error}').replace('{error}', (error as Error).message));
      }
    }

    // Interne Überträge anhand der Gegenkonto-IBAN automatisch verknüpfen bzw.
    // auf nicht-live-synchronisierten Konten (z.B. CSV-Tagesgeld) spiegeln.
    if (importedTransactions.length > 0) {
      try {
        await reconcileInternalTransfers(importedTransactions, [...existingTransactions, ...importedTransactions]);
      } catch (error: unknown) {
        console.warn('[gocardless-sync] Internal transfer reconciliation failed:', { message: (error as Error).message });
      }
    }

    const accountUpdate: Partial<import('../types').Account> & { id: string } = {
      id: account.id,
      last_sync_at: new Date().toISOString(),
    };

    // Erststart-Rueckfallebene: nur ohne jeden vorhandenen Anker und nur beim
    // ersten Sync dieses Kontos (`last_sync_at === null`).
    const hasAnchor =
      account.opening_balance != null || account.live_balance_amount != null;
    if (!hasAnchor && !account.last_sync_at && openingBalance !== null) {
      accountUpdate.opening_balance = openingBalance;
      accountUpdate.opening_balance_date = openingBalanceDate;
    }

    await updateAccount(accountUpdate);

    // Der echte Bankstand zuletzt: Er ist die beste verfuegbare Auskunft und
    // ueberschreibt als juengerer Anker alles Zurueckgerechnete.
    await refreshBalanceAnchor(account);

    // Apply contract detection to all transactions (existing and newly synced)
    if (result.importedCount > 0) {
      try {
        console.log('[gocardless-sync] Running contract detection after import');
        await applyDetectedContracts();
      } catch (error: unknown) {
        console.warn('[gocardless-sync] Contract detection failed:', { message: (error as Error).message });
        // Don't fail the sync if contract detection fails
      }
    }

    console.log('[gocardless-sync] Account sync completed', {
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
    });

  } catch (error: unknown) {
    console.error('[gocardless-sync] Failed to sync account:', { message: (error as Error).message });
    result.errors.push(`Sync-Fehler: ${(error as Error).message}`);
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
      showError(t('syncService.noSyncableAccounts'));
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
      showSuccess(t('syncService.syncSuccess', '{count}').replace('{count}', String(totalImported)));
    }
    if (totalErrors > 0) {
      showError(t('syncService.syncError', '{count}').replace('{count}', String(totalErrors)));
    }

    return results;
  } catch (error: unknown) {
    showError(t('syncService.syncFailed', '{error}').replace('{error}', (error as Error).message));
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
      nextSyncIn: t('syncService.syncHoursRemaining', '{hours}').replace('{hours}', String(hoursRemaining))
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