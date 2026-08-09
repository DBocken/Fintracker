import { useState } from 'react';

import { AlertCircle, Plus, RefreshCw, ShieldAlert, Wallet } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import RequireTier from '@/components/RequireTier';
import { useI18n } from '@/i18n/useI18n';
import type { Account } from '@/lib/account-types';
import { useAccountManager } from '@/features/accounts/application/use-account-manager';
import { AccountList } from '@/features/accounts/presentation/AccountList';

import { AccountFormDialog } from './AccountFormDialog';
import { TransferSuggestions } from './TransferSuggestions';
import { GoCardlessConnect } from '../GoCardlessConnect';

/**
 * Konten-Verwaltung — Zusammenbau der Flaeche (WP 6.5a, ARCH-1).
 *
 * Die Datenschicht liegt seit WP 6.5a in `features/accounts/application`; die
 * Kontenliste in `features/accounts/presentation`. Was HIER bleibt, ist die
 * Komposition samt Dialog-Zustand und den Rueckfragen vor Loeschen/Trennen —
 * Interaktion, die laut Kochrezept (`docs/architecture/feature-structure.md`,
 * Schritt 5) nicht ins ViewModel gehoert.
 *
 * **Warum diese Datei noch unter `src/components/` steht — die Baustein-
 * Blockade ist gefallen (WP 6.7).** Bis dahin lagen die benutzten Bausteine
 * (`FinanceErrorState`, `LoadingSwap`) unter `src/components/common/`; ein
 * Umzug dieser Datei in die Slice haette die `maxBausteine`-Spalte von
 * `pnpm check:slice-presentation` von 36 aus ERHOEHT — eine Ratsche, die nur
 * sinken darf. Seit WP 6.7 liegen sie unter `@/features/shared/presentation/`
 * und werden gar nicht mehr gezaehlt (die Spalte steht auf 0).
 *
 * Offen bleibt fuer diesen Umzug allein die Feature-UI-Spalte (`max`):
 * `RequireTier` (Gate, kein Baustein — siehe `src/components/RequireTier.tsx`)
 * und `GoCardlessConnect` liegen weiter unter `src/components/`. Das ist eine
 * andere Frage mit einer anderen Antwort (Screen fuer Screen) und ein eigenes
 * Paket — bewusst NICHT Teil von WP 6.7, weil eine Verschiebung von 25
 * Bausteinen und eine Screen-Migration in einem Diff nicht mehr
 * auseinanderzuhalten waeren.
 */
export function AccountManager() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const model = useAccountManager({
    onSaved: () => {
      setIsDialogOpen(false);
      setEditingAccount(null);
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
      model.deleteAccount(account.id);
    }
  };

  const handleDisconnect = (account: Account) => {
    if (!confirm(t('accounts.manager.disconnectConfirmMessage').replace('{name}', account.name))) {
      return;
    }
    void model.disconnectAccount(account);
  };

  if (model.isLoading) {
    // WP-8.2: Choreografie aus WP-7.3 statt eines fruehen Returns — kein
    // Skeleton unter 150 ms, ein gezeigtes bleibt mindestens 300 ms. Der
    // Platzhalter hat die Form des spaeteren Inhalts statt eines pulsierenden
    // Satzes; sein Text bleibt fuer die Sprachausgabe erhalten.
    return (
      <LoadingSwap
        loading
        skeleton={
          <div className="space-y-3 py-2">
            <Skeleton variant="shimmer" className="h-6 w-48" />
            <Skeleton variant="shimmer" className="h-16 w-full" />
            <Skeleton variant="shimmer" className="h-16 w-full" />
            <span className="sr-only">{t('accounts.manager.loadingText')}</span>
          </div>
        }
      >
        {null}
      </LoadingSwap>
    );
  }

  return (
    <div className="space-y-6">
      <RequireTier feature="bankSync">
        <GoCardlessConnect onConnectionSuccess={model.notifyConnectionSuccess} />
      </RequireTier>

      {model.hasLoadError && <FinanceErrorState variant="data" onRetry={model.retryAll} />}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t('accounts.manager.title')}
              </CardTitle>
              <CardDescription>{t('accounts.manager.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void model.refreshAll()}
                disabled={model.isRefreshingBalances}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${model.isRefreshingBalances ? 'animate-spin' : ''}`}
                />
                {t('accounts.manager.refreshAllButton')}
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={!model.limit?.allowed}>
                <Plus className="h-4 w-4 mr-2" />
                {t('accounts.manager.newAccountButton')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {model.expiredConsentCount > 0 && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                {t('accounts.manager.expiredConsentAlert')
                  .replace('{count}', String(model.expiredConsentCount))
                  .replace('{plural}', model.expiredConsentCount > 1 ? 'en' : '')}
              </AlertDescription>
            </Alert>
          )}

          {model.limit && !model.limit.allowed && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {model.limit.limit === 1
                  ? t('accounts.manager.limitReachedLimitOne')
                  : t('accounts.manager.limitReachedMultiple').replace(
                      '{limit}',
                      String(model.limit.limit),
                    )}
              </AlertDescription>
            </Alert>
          )}

          {model.limit && model.limit.allowed && (
            <div className="text-sm text-muted-foreground">
              {t('accounts.manager.accountsUsed')
                .replace('{current}', String(model.limit.current))
                .replace('{limit}', String(model.limit.limit))}
            </div>
          )}

          <AccountList
            rows={model.rows}
            isEmpty={model.isEmpty}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSync={(account) => void model.syncAccount(account)}
            onDisconnect={handleDisconnect}
          />

          {model.hasConnectedAccount && (
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
          accounts={model.accounts}
          onSave={(data) => model.saveAccount(data, editingAccount)}
          isLoading={model.isSavingAccount}
        />
      </Card>

      {model.showTransferSuggestions && <TransferSuggestions />}
    </div>
  );
}
