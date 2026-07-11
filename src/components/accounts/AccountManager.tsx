import { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CreditCard, Building2, PiggyBank, Smartphone, Wallet, Banknote, AlertCircle, RefreshCw, Link2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showSuccess, showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import type { Account, AccountType } from '../../types';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  canCreateAccount,
  getAccountTypeLabels,
  formatSyncStatus
} from '../../services/account-service';
import { AccountFormDialog } from './AccountFormDialog';
import { AccountDataQualityBadge } from './AccountDataQualityBadge';
import { TransferSuggestions } from './TransferSuggestions';
import { deriveAccountDataQuality } from '../../services/account-data-quality-service';
import { GoCardlessConnect } from '../GoCardlessConnect';
import RequireTier from '@/components/common/RequireTier';
import { getRedirectOrigin } from '@/lib/app-origin';
import { isSafeExternalAuthUrl } from '@/lib/safe-url';
import { syncAccountTransactions, canSyncAccount, disconnectGoCardlessAccount, getAccountConsentStatus, reconcileAllInternalTransfers } from '../../services/gocardless-sync-service';
import { gocardlessService } from '../../services/gocardless-service';
import {
  refreshBalances,
  type RefreshBalancesResponse,
  type RefreshMode,
} from '../../services/live-balance-service';

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  checking: <Building2 className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
  wallet: <Smartphone className="h-5 w-5" />,
  cash: <Banknote className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};


export function AccountManager() {
  const { t } = useI18n();
  const accountTypeLabels = getAccountTypeLabels();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const { data: limitInfo } = useQuery({
    queryKey: ['account-limit'],
    queryFn: canCreateAccount,
  });

  const { data: consentStatuses = {} } = useQuery({
    queryKey: ['account-consent-statuses', accounts.map((a) => a.id).join(',')],
    enabled: accounts.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        accounts.map(async (account) => [account.id, await getAccountConsentStatus(account)] as const)
      );
      return Object.fromEntries(entries);
    },
  });

  const expiredConsentAccounts = useMemo(
    () => accounts.filter((account) => consentStatuses[account.id]?.expired),
    [accounts, consentStatuses]
  );

  // Nach dem Setzen/Ändern einer IBAN den gesamten Bestand auf interne
  // Überträge prüfen, damit bereits vorhandene Buchungen nachträglich erkannt
  // und verknüpft/gespiegelt werden.
  const reconcileTransfersAfterIbanChange = async () => {
    try {
      await reconcileAllInternalTransfers();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
    } catch (error) {
      console.warn('Internal transfer reconciliation failed after account save:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-limit'] });
      showSuccess(t('accounts.manager.createSuccess'));
      setIsDialogOpen(false);
      await reconcileTransfersAfterIbanChange();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      showSuccess(t('accounts.manager.updateSuccess'));
      setIsDialogOpen(false);
      setEditingAccount(null);
      await reconcileTransfersAfterIbanChange();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-limit'] });
      showSuccess(t('accounts.manager.deleteSuccess'));
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const refreshBalancesMutation = useMutation({
    mutationFn: (mode: RefreshMode) => refreshBalances(mode),
    onSuccess: (data: RefreshBalancesResponse) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['live-balances'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      if (data.success) {
        showSuccess(data.message);
      } else if (data.error === 'rate_limit_exceeded') {
        showError(data.message || t('accounts.manager.syncNotPossibleMessage').replace('{nextSyncIn}', t('accounts.manager.dailyLimitReached')));
      } else if (data.error === 'automatic_already_done') {
      } else {
        showError(data.message || t('accounts.manager.syncFailedMessage').replace('{error}', t('accounts.manager.updateFailedGeneric')));
      }
    },
    onError: (error: unknown) => {
      showError((error as Error).message || t('accounts.manager.syncFailedMessage').replace('{error}', t('accounts.manager.updateErrorGeneric')));
    },
  });

  const handleCreate = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleDelete = (account: Account) => {
    if (confirm(t('accounts.manager.confirmDeleteMessage').replace('{name}', account.name))) {
      deleteMutation.mutate(account.id);
    }
  };

  const handleSave = (data: Partial<Account>) => {
    if (editingAccount) {
      updateMutation.mutate({ ...data, id: editingAccount.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const startReconnectFlow = async (account: Account) => {
    if (!account.bank_connection_id) {
      showError(t('accounts.manager.bankConnectionMissingError'));
      return;
    }

    const redirectUrl = `${getRedirectOrigin()}/ausgabentracker/return`;
    const requisition = await gocardlessService.reconnectBankConnection(account.bank_connection_id, redirectUrl);

    // requisition.link zeigt auf GoCardless, der redirect-Fallback auf die eigene App —
    // beides API-Antwort und damit vor dem Redirect zu validieren (safe-url)
    const link = requisition.link || requisition.redirect;
    if (!isSafeExternalAuthUrl(link, { allowedOrigins: [getRedirectOrigin(), window.location.origin] })) {
      showError(t('accounts.manager.unsafeAuthLinkError'));
      return;
    }

    sessionStorage.setItem('gocardless_requisition_id', requisition.id);
    showSuccess(t('accounts.manager.reconnectRequestedMessage'));
    window.location.href = link;
  };

  const handleRefreshAll = async () => {
    if (expiredConsentAccounts.length > 0) {
      await startReconnectFlow(expiredConsentAccounts[0]);
      return;
    }
    refreshBalancesMutation.mutate("manual");
  };

  const handleSync = async (account: Account) => {
    if (!account.gocardless_account_id) return;

    const consentStatus = consentStatuses[account.id];
    if (consentStatus?.expired) {
      await startReconnectFlow(account);
      return;
    }

    const syncCheck = canSyncAccount(account);
    if (!syncCheck.canSync) {
      showError(t('accounts.manager.syncNotPossibleMessage').replace('{nextSyncIn}', syncCheck.nextSyncIn || t('accounts.manager.syncNotPossibleDefault')));
      return;
    }

    setSyncingAccounts(prev => new Set(prev).add(account.id));
    try {
      const result = await syncAccountTransactions(account);
      if (result.importedCount > 0) {
        showSuccess(t('accounts.manager.syncSuccessMessage').replace('{count}', String(result.importedCount)).replace('{name}', account.name));
      } else if (result.errors.length === 0) {
        showSuccess(t('accounts.manager.syncUpToDateMessage'));
      }
      if (result.errors.length > 0) {
        showError(t('accounts.manager.syncErrorsMessage').replace('{count}', String(result.errors.length)));
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['live-balances'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      showSuccess(t('accounts.manager.syncCompleteMessage').replace('{importedCount}', String(result.importedCount)).replace('{skippedCount}', String(result.skippedCount)));

    } catch (err: unknown) {
      showError(t('accounts.manager.syncFailedMessage').replace('{error}', (err as Error).message));
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  const handleDisconnect = async (account: Account) => {
    if (!confirm(t('accounts.manager.disconnectConfirmMessage').replace('{name}', account.name))) {
      return;
    }

    try {
      await disconnectGoCardlessAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
      showSuccess(t('accounts.manager.disconnectSuccessMessage'));
    } catch (err: unknown) {
      showError(t('accounts.manager.disconnectErrorMessage').replace('{error}', (err as Error).message));
    }
  };

  const handleConnectionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
    showSuccess(t('accounts.manager.connectionSuccessMessage'));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground animate-pulse">{t('accounts.manager.loadingText')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RequireTier feature="bankSync">
        <GoCardlessConnect onConnectionSuccess={handleConnectionSuccess} />
      </RequireTier>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t('accounts.manager.title')}
              </CardTitle>
              <CardDescription>
                {t('accounts.manager.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={refreshBalancesMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshBalancesMutation.isPending ? 'animate-spin' : ''}`} />
                {t('accounts.manager.refreshAllButton')}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!limitInfo?.allowed}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('accounts.manager.newAccountButton')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {expiredConsentAccounts.length > 0 && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                {t('accounts.manager.expiredConsentAlert')
                  .replace('{count}', String(expiredConsentAccounts.length))
                  .replace('{plural}', expiredConsentAccounts.length > 1 ? 'en' : '')}
              </AlertDescription>
            </Alert>
          )}

          {limitInfo && !limitInfo.allowed && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {limitInfo.limit === 1
                  ? t('accounts.manager.limitReachedLimitOne')
                  : t('accounts.manager.limitReachedMultiple').replace('{limit}', String(limitInfo.limit))}
              </AlertDescription>
            </Alert>
          )}

          {limitInfo && limitInfo.allowed && (
            <div className="text-sm text-muted-foreground">
              {t('accounts.manager.accountsUsed').replace('{current}', String(limitInfo.current)).replace('{limit}', String(limitInfo.limit))}
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('accounts.manager.emptyTitle')}</p>
              <p className="text-sm">{t('accounts.manager.emptyDescription')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const consentStatus = consentStatuses[account.id];
                const consentExpired = !!consentStatus?.expired;
                const consentExpiresSoon = !consentExpired && consentStatus?.daysRemaining != null && consentStatus.daysRemaining <= 7;

                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ borderLeftColor: account.color, borderLeftWidth: 4 }}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: account.color + '20', color: account.color }}
                      >
                        {ACCOUNT_TYPE_ICONS[account.type]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <span>{account.icon}</span>
                          <span className="truncate">{account.name}</span>
                          {account.is_budget_pool_member && (
                            <Badge variant="outline" className="text-xs shrink-0">{t('accounts.manager.budgetPoolBadge')}</Badge>
                          )}
                          {account.is_business && (
                            <Badge variant="outline" className="text-xs shrink-0 border-primary/40 text-primary">
                              {t('accounts.manager.businessBadge')}
                            </Badge>
                          )}
                          {account.gocardless_account_id && (
                            <Badge className="bg-positive/15 text-positive dark:text-positive text-xs shrink-0 flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              {t('accounts.manager.connectedBadge')}
                            </Badge>
                          )}
                          {consentExpired && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              {t('accounts.manager.connectionExpiredBadge')}
                            </Badge>
                          )}
                          {consentExpiresSoon && (
                            <Badge variant="outline" className="text-xs shrink-0 border-warning/40 text-warning dark:text-warning">
                              {t('accounts.manager.connectionExpiresSoonBadge')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            {accountTypeLabels[account.type]}
                            {account.description && ` • ${account.description}`}
                          </div>
                          {account.gocardless_account_id && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {formatSyncStatus(account)}
                              </span>
                              {consentStatus?.expiresAt && (
                                <span>
                                  {t('accounts.manager.connectionValidUntil').replace('{date}', new Date(consentStatus.expiresAt).toLocaleDateString('de-DE'))}
                                </span>
                              )}
                            </div>
                          )}
                          <AccountDataQualityBadge quality={deriveAccountDataQuality(account)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="secondary" className="mr-1">{account.currency}</Badge>

                      {account.gocardless_account_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(account)}
                          disabled={syncingAccounts.has(account.id) || !canSyncAccount(account).canSync}
                          className="h-9 w-9 text-positive hover:bg-positive/10 hover:text-positive dark:text-positive dark:hover:text-positive"
                          title={t('accounts.manager.syncButton')}
                          aria-label={t('accounts.manager.syncButton')}
                        >
                          {syncingAccounts.has(account.id) ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleEdit(account)}
                        aria-label={t('accounts.manager.editButton')}
                        title={t('accounts.manager.editButton')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {account.gocardless_account_id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDisconnect(account)}
                          className="h-9 w-9 text-warning hover:text-warning"
                          title={t('accounts.manager.disconnectButton')}
                          aria-label={t('accounts.manager.disconnectButton')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(account)}
                          className="h-9 w-9 text-warning hover:text-warning"
                          title={t('accounts.manager.deleteButton')}
                          aria-label={t('accounts.manager.deleteButton')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {accounts.some(a => a.gocardless_account_id) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Hinweis:</strong> {t('accounts.manager.bankSyncNote')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <AccountFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          account={editingAccount}
          accounts={accounts}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Card>

      {accounts.length > 1 && <TransferSuggestions />}
    </div>
  );
}