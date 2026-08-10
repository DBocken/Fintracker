/**
 * ViewModel der Konten-Verwaltung (WP 6.5a, ARCH-1).
 *
 * Bis hierher lagen drei Abfragen, vier Mutationen, der Sync- und der
 * Wiederverbinden-Ablauf IN `components/accounts/AccountManager.tsx` — die
 * Flaeche WAR ihre Datenschicht, und damit liess sich keine zweite
 * Praesentation danebenstellen, ohne die Datenbeschaffung ein zweites Mal zu
 * schreiben (AGENTS.md §4). Sie liegen jetzt hier; die Darstellung bekommt ein
 * Modell.
 *
 * Was BEWUSST nicht hier liegt: der Dialog-Zustand (offen/bearbeitetes Konto)
 * und die Rueckfragen vor Loeschen bzw. Trennen. Beides ist Interaktion und
 * gehoert laut Kochrezept (`docs/architecture/feature-structure.md`, Schritt 5)
 * in die Darstellung — das ViewModel meldet nur, dass es etwas zu schliessen
 * gibt (`onSaved`).
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@/i18n/useI18n';
import type { Account } from '@/lib/account-types';
import { getRedirectOrigin } from '@/lib/app-origin';
import { isSafeExternalAuthUrl } from '@/lib/safe-url';
import { showError, showSuccess } from '@/utils/toast';
import {
  canCreateAccount,
  createAccount,
  deleteAccount as deleteAccountService,
  formatSyncStatus,
  getAccounts,
  getAccountTypeLabels,
  updateAccount,
} from '@/services/account-service';
import {
  deriveAccountDataQuality,
  type AccountDataQuality,
} from '@/services/account-data-quality-service';
import {
  canSyncAccount,
  disconnectGoCardlessAccount,
  getAccountConsentStatus,
  reconcileAllInternalTransfers,
  syncAccountTransactions,
} from '@/services/gocardless-sync-service';
import { gocardlessService } from '@/services/gocardless-service';
import {
  refreshBalances,
  type RefreshBalancesResponse,
  type RefreshMode,
} from '@/services/live-balance-service';

import { accountQueryKeys, accountsSignature } from '../data/account-query-keys';
import {
  isConsentExpiringSoon,
  selectExpiredConsentAccounts,
  type ConsentSnapshot,
} from '../domain/consent-status';

/** Alles, was eine Kontozeile zum Darstellen braucht — und nichts darueber hinaus. */
export interface AccountRowModel {
  account: Account;
  /** Anzeigename der Kontoart („Girokonto", „Tagesgeld/Sparkonto", …). */
  typeLabel: string;
  quality: AccountDataQuality;
  isConnected: boolean;
  consentExpired: boolean;
  consentExpiresSoon: boolean;
  /** ISO-Zeitpunkt des Freigabe-Endes, sofern die Bank einen nennt. */
  consentExpiresAt: string | null;
  /** „Vor 5 Min.", „Noch nie synchronisiert", … */
  syncStatusText: string;
  canSync: boolean;
  isSyncing: boolean;
}

export interface AccountLimitInfo {
  allowed: boolean;
  current: number;
  limit: number;
}

export interface AccountManagerModel {
  isLoading: boolean;
  /** Mindestens eine der drei Abfragen ist gescheitert. */
  hasLoadError: boolean;
  retryAll: () => void;
  /**
   * Nur wahr, wenn der Bestand GELESEN und leer ist. Ein Lesefehler darf nicht
   * als „noch keine Konten" durchgehen — genau diese Verwechslung ist der Grund
   * fuer `pnpm check:state-coverage` (AGENTS.md §5).
   */
  isEmpty: boolean;
  /** Rohbestand fuer den Formulardialog (Auswahl des Ausgleichskontos). */
  accounts: Account[];
  rows: AccountRowModel[];
  limit: AccountLimitInfo | undefined;
  expiredConsentCount: number;
  hasConnectedAccount: boolean;
  showTransferSuggestions: boolean;
  isRefreshingBalances: boolean;
  isSavingAccount: boolean;
  refreshAll: () => Promise<void>;
  saveAccount: (data: Partial<Account>, editing: Account | null) => void;
  deleteAccount: (id: string) => void;
  syncAccount: (account: Account) => Promise<void>;
  disconnectAccount: (account: Account) => Promise<void>;
  notifyConnectionSuccess: () => void;
}

export interface AccountManagerOptions {
  /**
   * Speichern war erfolgreich. Getrennt gemeldet, weil daran der DIALOG-Zustand
   * haengt: Er lebt in der Darstellung, nicht im ViewModel.
   */
  onSaved?: () => void;
}

export function useAccountManager({ onSaved }: AccountManagerOptions = {}): AccountManagerModel {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [syncingAccountIds, setSyncingAccountIds] = useState<Set<string>>(new Set());

  const {
    data: accounts = [],
    isLoading,
    isError: accountsError,
    isSuccess: accountsLoaded,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: accountQueryKeys.accounts,
    queryFn: getAccounts,
  });

  const {
    data: limit,
    isError: limitError,
    refetch: refetchLimit,
  } = useQuery({
    queryKey: accountQueryKeys.limit,
    queryFn: canCreateAccount,
  });

  const {
    data: consentStatuses = {},
    isError: consentError,
    refetch: refetchConsent,
  } = useQuery({
    queryKey: accountQueryKeys.consentStatuses(accountsSignature(accounts.map((a) => a.id))),
    enabled: accounts.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        accounts.map(
          async (account) => [account.id, await getAccountConsentStatus(account)] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<string, ConsentSnapshot>;
    },
  });

  const hasLoadError = accountsError || limitError || consentError;

  const retryAll = useCallback(() => {
    void refetchAccounts();
    void refetchLimit();
    void refetchConsent();
  }, [refetchAccounts, refetchConsent, refetchLimit]);

  const expiredConsentAccounts = useMemo(
    () => selectExpiredConsentAccounts(accounts, consentStatuses),
    [accounts, consentStatuses],
  );

  // BEWUSST ohne `useMemo`: `getAccountTypeLabels()` und `formatSyncStatus()`
  // liefern uebersetzten Text und `formatSyncStatus()` zusaetzlich eine
  // Relativzeit („Vor 5 Min."). Beides haengt an etwas, das in keiner
  // Abhaengigkeitsliste steht — ein Memo darueber waere genau die Falle aus
  // AGENTS.md §6 („`t()` im Initializer einer Modul-`const`"), nur eine Ebene
  // hoeher: Nach einem Sprachwechsel bliebe die Liste in der alten Sprache
  // stehen. Die Berechnung ist billig (eine Handvoll Konten, reine Funktionen).
  const typeLabels = getAccountTypeLabels();
  const rows: AccountRowModel[] = accounts.map((account) => {
    const consent = consentStatuses[account.id];
    return {
      account,
      typeLabel: typeLabels[account.type],
      quality: deriveAccountDataQuality(account),
      isConnected: !!account.gocardless_account_id,
      consentExpired: !!consent?.expired,
      consentExpiresSoon: isConsentExpiringSoon(consent),
      consentExpiresAt: consent?.expiresAt ?? null,
      syncStatusText: formatSyncStatus(account),
      canSync: canSyncAccount(account).canSync,
      isSyncing: syncingAccountIds.has(account.id),
    };
  });

  /**
   * Nach dem Setzen/Aendern einer IBAN den gesamten Bestand auf interne
   * Uebertraege pruefen, damit bereits vorhandene Buchungen nachtraeglich
   * erkannt und verknuepft/gespiegelt werden.
   */
  const reconcileTransfersAfterIbanChange = useCallback(async () => {
    try {
      await reconcileAllInternalTransfers();
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.transactions });
    } catch (error) {
      console.warn('Internal transfer reconciliation failed after account save:', error);
    }
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.limit });
      showSuccess(t('accounts.manager.createSuccess'));
      onSaved?.();
      await reconcileTransfersAfterIbanChange();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
      showSuccess(t('accounts.manager.updateSuccess'));
      onSaved?.();
      await reconcileTransfersAfterIbanChange();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccountService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.limit });
      showSuccess(t('accounts.manager.deleteSuccess'));
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const refreshBalancesMutation = useMutation({
    mutationFn: (mode: RefreshMode) => refreshBalances(mode),
    onSuccess: (data: RefreshBalancesResponse) => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.liveBalances });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.netWorth });
      if (data.success) {
        showSuccess(data.message);
      } else if (data.error === 'rate_limit_exceeded') {
        showError(
          data.message ||
            t('accounts.manager.syncNotPossibleMessage').replace(
              '{nextSyncIn}',
              t('accounts.manager.dailyLimitReached'),
            ),
        );
      } else if (data.error === 'automatic_already_done') {
        // Der automatische Lauf war schon: kein Fehler, keine Meldung.
      } else {
        showError(
          data.message ||
            t('accounts.manager.syncFailedMessage').replace(
              '{error}',
              t('accounts.manager.updateFailedGeneric'),
            ),
        );
      }
    },
    onError: (error: unknown) => {
      showError(
        (error as Error).message ||
          t('accounts.manager.syncFailedMessage').replace(
            '{error}',
            t('accounts.manager.updateErrorGeneric'),
          ),
      );
    },
  });

  /**
   * Bankfreigabe erneuern. Der Link kommt aus der API-Antwort und wird deshalb
   * VOR dem Redirect geprueft (AGENTS.md §10.5, `isSafeExternalAuthUrl`).
   */
  const startReconnectFlow = useCallback(
    async (account: Account) => {
      if (!account.bank_connection_id) {
        showError(t('accounts.manager.bankConnectionMissingError'));
        return;
      }

      const redirectUrl = `${getRedirectOrigin()}/ausgabentracker/return`;
      const requisition = await gocardlessService.reconnectBankConnection(
        account.bank_connection_id,
        redirectUrl,
      );

      const link = requisition.link || requisition.redirect;
      if (
        !isSafeExternalAuthUrl(link, {
          allowedOrigins: [getRedirectOrigin(), window.location.origin],
        })
      ) {
        showError(t('accounts.manager.unsafeAuthLinkError'));
        return;
      }

      sessionStorage.setItem('gocardless_requisition_id', requisition.id);
      showSuccess(t('accounts.manager.reconnectRequestedMessage'));
      window.location.href = link;
    },
    [t],
  );

  const refreshAll = useCallback(async () => {
    if (expiredConsentAccounts.length > 0) {
      await startReconnectFlow(expiredConsentAccounts[0]);
      return;
    }
    refreshBalancesMutation.mutate('manual');
  }, [expiredConsentAccounts, refreshBalancesMutation, startReconnectFlow]);

  const syncAccount = useCallback(
    async (account: Account) => {
      if (!account.gocardless_account_id) return;

      if (consentStatuses[account.id]?.expired) {
        await startReconnectFlow(account);
        return;
      }

      const syncCheck = canSyncAccount(account);
      if (!syncCheck.canSync) {
        showError(
          t('accounts.manager.syncNotPossibleMessage').replace(
            '{nextSyncIn}',
            syncCheck.nextSyncIn || t('accounts.manager.syncNotPossibleDefault'),
          ),
        );
        return;
      }

      setSyncingAccountIds((prev) => new Set(prev).add(account.id));
      try {
        const result = await syncAccountTransactions(account);
        if (result.importedCount > 0) {
          showSuccess(
            t('accounts.manager.syncSuccessMessage')
              .replace('{count}', String(result.importedCount))
              .replace('{name}', account.name),
          );
        } else if (result.errors.length === 0) {
          showSuccess(t('accounts.manager.syncUpToDateMessage'));
        }
        if (result.errors.length > 0) {
          showError(
            t('accounts.manager.syncErrorsMessage').replace('{count}', String(result.errors.length)),
          );
        }
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.consentStatusesRoot });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.transactions });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.transactionContracts });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.liveBalances });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.netWorth });
        showSuccess(
          t('accounts.manager.syncCompleteMessage')
            .replace('{importedCount}', String(result.importedCount))
            .replace('{skippedCount}', String(result.skippedCount)),
        );
      } catch (error: unknown) {
        showError(
          t('accounts.manager.syncFailedMessage').replace('{error}', (error as Error).message),
        );
      } finally {
        setSyncingAccountIds((prev) => {
          const next = new Set(prev);
          next.delete(account.id);
          return next;
        });
      }
    },
    [consentStatuses, queryClient, startReconnectFlow, t],
  );

  const disconnectAccount = useCallback(
    async (account: Account) => {
      try {
        await disconnectGoCardlessAccount(account.id);
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.consentStatusesRoot });
        showSuccess(t('accounts.manager.disconnectSuccessMessage'));
      } catch (error: unknown) {
        showError(
          t('accounts.manager.disconnectErrorMessage').replace('{error}', (error as Error).message),
        );
      }
    },
    [queryClient, t],
  );

  const notifyConnectionSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: accountQueryKeys.accounts });
    queryClient.invalidateQueries({ queryKey: accountQueryKeys.consentStatusesRoot });
    showSuccess(t('accounts.manager.connectionSuccessMessage'));
  }, [queryClient, t]);

  const saveAccount = useCallback(
    (data: Partial<Account>, editing: Account | null) => {
      if (editing) {
        updateMutation.mutate({ ...data, id: editing.id });
      } else {
        createMutation.mutate(data);
      }
    },
    [createMutation, updateMutation],
  );

  return {
    isLoading,
    hasLoadError,
    retryAll,
    isEmpty: accountsLoaded && accounts.length === 0,
    accounts,
    rows,
    limit,
    expiredConsentCount: expiredConsentAccounts.length,
    hasConnectedAccount: accounts.some((account) => !!account.gocardless_account_id),
    showTransferSuggestions: accounts.length > 1,
    isRefreshingBalances: refreshBalancesMutation.isPending,
    isSavingAccount: createMutation.isPending || updateMutation.isPending,
    refreshAll,
    saveAccount,
    deleteAccount: (id: string) => deleteMutation.mutate(id),
    syncAccount,
    disconnectAccount,
    notifyConnectionSuccess,
  };
}
