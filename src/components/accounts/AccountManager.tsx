import { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CreditCard, Building2, PiggyBank, Smartphone, Wallet, AlertCircle, RefreshCw, Link2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showSuccess, showError } from '@/utils/toast';
import type { Account, AccountType } from '../../types';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  canCreateAccount,
  ACCOUNT_TYPE_LABELS,
  FREE_ACCOUNT_LIMIT,
  formatSyncStatus
} from '../../services/account-service';
import { AccountFormDialog } from './AccountFormDialog';
import { GoCardlessConnect } from '../GoCardlessConnect';
import RequireTier from '@/components/common/RequireTier';
import { syncAccountTransactions, canSyncAccount, disconnectGoCardlessAccount, getAccountConsentStatus } from '../../services/gocardless-sync-service';
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
  other: <Wallet className="h-5 w-5" />,
};

const PRODUCTION_APP_ORIGIN = 'https://fintracker-phi.vercel.app';

function getRedirectOrigin() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin;
  }

  return PRODUCTION_APP_ORIGIN;
}

export function AccountManager() {

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

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-limit'] });
      showSuccess('Konto erstellt');
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      showSuccess('Konto aktualisiert');
      setIsDialogOpen(false);
      setEditingAccount(null);
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
      showSuccess('Konto gelöscht');
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
        showError(data.message || 'Tageslimit für Aktualisierungen erreicht.');
      } else if (data.error === 'automatic_already_done') {
      } else {
        showError(data.message || 'Aktualisierung fehlgeschlagen.');
      }
    },
    onError: (error: any) => {
      showError(error.message || 'Fehler bei der Aktualisierung.');
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
    if (confirm(`Möchtest du das Konto "${account.name}" wirklich löschen?`)) {
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
      showError('Für dieses Konto fehlt die Bankverbindung. Bitte verbinde die Bank erneut.');
      return;
    }

    const redirectUrl = `${getRedirectOrigin()}/ausgabentracker/return`;
    const requisition = await gocardlessService.reconnectBankConnection(account.bank_connection_id, redirectUrl);

    sessionStorage.setItem('gocardless_requisition_id', requisition.id);
    showSuccess('Die Bankfreigabe wird jetzt erneut angefragt.');
    window.location.href = requisition.link || requisition.redirect;
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
      showError(`Synchronisation noch nicht möglich. ${syncCheck.nextSyncIn || 'Bitte warte etwas.'}`);
      return;
    }

    setSyncingAccounts(prev => new Set(prev).add(account.id));
    try {
      const result = await syncAccountTransactions(account);
      if (result.importedCount > 0) {
        showSuccess(`${result.importedCount} neue Transaktionen von ${account.name} importiert`);
      } else if (result.errors.length === 0) {
        showSuccess('Konto ist auf dem neuesten Stand');
      }
      if (result.errors.length > 0) {
        showError(`${result.errors.length} Fehler beim Import`);
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['live-balances'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      showSuccess(`Synchronisation abgeschlossen: ${result.importedCount} importiert, ${result.skippedCount} übersprungen`);

    } catch (err: any) {

      showError(`Synchronisation fehlgeschlagen: ${err.message}`);
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  const handleDisconnect = async (account: Account) => {
    if (!confirm(`Möchtest du die GoCardless-Verbindung für "${account.name}" trennen? Die Transaktionen bleiben erhalten.`)) {
      return;
    }

    try {
      await disconnectGoCardlessAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
      showSuccess('Bankverbindung getrennt');
    } catch (err: any) {
      showError(`Fehler beim Trennen: ${err.message}`);
    }
  };

  const handleConnectionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account-consent-statuses'] });
    showSuccess('Bankverbindung erfolgreich!');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground animate-pulse">Lade Konten...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RequireTier feature="bank_sync">
        <GoCardlessConnect onConnectionSuccess={handleConnectionSuccess} />
      </RequireTier>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Konten verwalten
              </CardTitle>
              <CardDescription>
                Verwalte deine Bank-, Kreditkarten- und Sparkonten
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={refreshBalancesMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshBalancesMutation.isPending ? 'animate-spin' : ''}`} />
                Alle aktualisieren
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!limitInfo?.allowed}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neues Konto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {expiredConsentAccounts.length > 0 && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Bei {expiredConsentAccounts.length} Bankverbindung{expiredConsentAccounts.length > 1 ? 'en' : ''} ist der Consent abgelaufen. Beim Aktualisieren startet direkt die erneute Freigabe bei deiner Bank.
              </AlertDescription>
            </Alert>
          )}

          {limitInfo && !limitInfo.allowed && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Du hast das Limit von {FREE_ACCOUNT_LIMIT} Konten erreicht.
                Upgrade auf Premium für unbegrenzte Konten.
              </AlertDescription>
            </Alert>
          )}

          {limitInfo && limitInfo.allowed && (
            <div className="text-sm text-muted-foreground">
              {limitInfo.current} von {limitInfo.limit} Konten verwendet
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Konten angelegt</p>
              <p className="text-sm">Erstelle dein erstes Konto, um Transaktionen zuzuordnen</p>
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
                            <Badge variant="outline" className="text-xs shrink-0">Budget-Pool</Badge>
                          )}
                          {account.gocardless_account_id && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs shrink-0 flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              PSD2
                            </Badge>
                          )}
                          {consentExpired && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              Consent abgelaufen
                            </Badge>
                          )}
                          {consentExpiresSoon && (
                            <Badge variant="outline" className="text-xs shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400">
                              Consent läuft bald ab
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            {ACCOUNT_TYPE_LABELS[account.type]}
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
                                  Consent bis {new Date(consentStatus.expiresAt).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">{account.currency}</Badge>

                      {account.gocardless_account_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(account)}
                          disabled={syncingAccounts.has(account.id) || !canSyncAccount(account).canSync}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-500/10"
                          title="Transaktionen synchronisieren"
                        >
                          {syncingAccounts.has(account.id) ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {account.gocardless_account_id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnect(account)}
                          className="text-orange-600 hover:text-orange-700"
                          title="Bankverbindung trennen"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(account)}
                          className="text-red-600 hover:text-red-700"
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
                <strong>GoCardless Limits:</strong> Max. 4 Synchronisationen pro Tag pro Konto.
                Historische Daten verfügbar bis 90 Tage. Consent läuft nach 90 Tagen ab.
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
    </div>
  );
}