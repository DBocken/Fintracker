import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
  Wallet,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { gocardlessService } from '@/services/gocardless-service';
import { bankConnectionService } from '@/services/bank-connection-service';
import { updateAccount, getAccounts, createAccount, type Account } from '@/services/account-service';
import { syncAccountTransactions } from '@/services/gocardless-sync-service';
import { showSuccess, showError } from '@/utils/toast';
import { isSafeExternalAuthUrl } from '@/lib/safe-url';
import { logger } from '@/utils/logger';
import { safeParseAtBoundary } from '@/lib/schemas/boundary';
import { gocardlessAccountsResponseSchema, type GoCardlessAccount } from '@/lib/schemas/gocardless-account.schema';
import { financeKeys } from '@/features/shared/data/finance-query-keys';

export function isSafeBankCallbackAuthLink(link: string | null | undefined, origin?: string): boolean {
  const currentOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  return isSafeExternalAuthUrl(link, { allowedOrigins: currentOrigin ? [currentOrigin] : [] });
}

export default function BankCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'linking' | 'pending'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GoCardlessAccount[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [importingTransactions, setImportingTransactions] = useState<Set<string>>(new Set());
  const [linkedAccounts, setLinkedAccounts] = useState<Set<string>>(new Set());
  const [requisitionInfo, setRequisitionInfo] = useState<{ id?: string; link?: string; status?: string; reference?: string } | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [requisitionId, setRequisitionId] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
    loadExistingAccounts();
    // Bewusst nur beim Mount: `handleCallback`/`loadExistingAccounts` verarbeiten
    // den OAuth-Callback einmalig; ihre Aufnahme (neue Funktionsidentität bei
    // jedem Render) würde den Callback bei jedem Render erneut verarbeiten.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExistingAccounts = async () => {
    try {
      const accounts = await getAccounts();
      setExistingAccounts(accounts);
    } catch (err) {
      console.error('Failed to load existing accounts:', err);
    }
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const handleCallback = async () => {
    // We accept either requisition_id OR reference (ref) for the initial lookup.
    // For all DB writes we later use the resolved requisition.id.
    let lookupKey = searchParams.get('ref');

    // Alternative parameter names that GoCardless might use
    if (!lookupKey) {
      lookupKey = searchParams.get('reference');
    }
    if (!lookupKey) {
      lookupKey = searchParams.get('requisition_id');
    }
    if (!lookupKey) {
      lookupKey = searchParams.get('id');
    }

    // If no ref in URL, try to get from sessionStorage
    if (!lookupKey) {
      lookupKey = sessionStorage.getItem('gocardless_requisition_id');
    }

    if (!lookupKey) {
      setError(t('bankCallback.noRequisitionId'));
      setStatus('error');
      return;
    }

    try {
      setStatus('pending');

      // We'll implement polling: try up to 6 times (approx 12s) to allow GoCardless to provision accounts
      const maxAttempts = 6;
      let attempt = 0;
      let gotAccounts: GoCardlessAccount[] = [];
      let lastRequisition: { id?: string; link?: string; status?: string } | null = null;

      while (attempt < maxAttempts) {
        attempt++;
        setPollingAttempts(attempt);
        const result = await gocardlessService.getAccounts(lookupKey);

        lastRequisition = result.requisition || null;

        // Fremde Bankdaten (Supabase Edge Function -> GoCardless-API) sind eine
        // echte Datengrenze — ein Cast allein prüft zur Laufzeit nichts. Eine
        // manipulierte/kaputte Antwort erreicht die Fläche nie, sondern den
        // Fehlerzustand (GOV-1, coding-guide.md §6).
        const parsedAccounts = safeParseAtBoundary(
          gocardlessAccountsResponseSchema,
          result.accounts || [],
          'gocardless-accounts',
        );
        if (!parsedAccounts.ok) {
          setRequisitionInfo(lastRequisition);
          setError(parsedAccounts.error.message);
          setStatus('error');
          return;
        }
        gotAccounts = parsedAccounts.data;

        // Save for UI
        setRequisitionInfo(lastRequisition);

        if (gotAccounts && gotAccounts.length > 0) {
          const resolvedRequisitionId = lastRequisition?.id || null;
          setRequisitionId(resolvedRequisitionId);

          if (resolvedRequisitionId) {
            sessionStorage.setItem('gocardless_requisition_id', resolvedRequisitionId);
          }

          setAccounts(gotAccounts);

          // Complete bank connection setup (needs actual requisition.id)
          if (resolvedRequisitionId) {
            await gocardlessService.completeBankConnection(resolvedRequisitionId);
          }

          setStatus('linking');
          return;
        }

        // If requisition status indicates not-complete, wait and retry
        await sleep(2000);
      }

      // After polling, still no accounts
      setRequisitionInfo(lastRequisition);
      setError(t('bankCallback.noAccountsFound'));
      setStatus('error');
    } catch (err: unknown) {
      console.error('Error fetching accounts:', err);
      setError(t('bankCallback.fetchError').replace('{error}', (err as Error).message));
      setStatus('error');
    }
  };

  const handleLinkAccount = async (gocardlessAccount: GoCardlessAccount, existingAccountId?: string) => {
    try {
      const resolvedRequisitionId = requisitionId || requisitionInfo?.id || sessionStorage.getItem('gocardless_requisition_id');
      if (!resolvedRequisitionId) return;

      // Get bank connection for this requisition
      const bankConnection = await bankConnectionService.getBankConnectionByRequisitionId(resolvedRequisitionId);

      setImportingTransactions(prev => new Set(prev).add(gocardlessAccount.id));

      let account: Account;

      if (existingAccountId) {
        // Link to existing account
        account = await updateAccount({
          id: existingAccountId,
          iban: gocardlessAccount.iban || null,
          gocardless_account_id: gocardlessAccount.id,
          gocardless_requisition_id: resolvedRequisitionId,
          gocardless_institution_name: gocardlessAccount.product,
          bank_connection_id: bankConnection?.id,
          sync_enabled: true,
        });
        showSuccess(t('bankCallback.accountLinked'));
      } else {
        // Create new account
        account = await createAccount({
          name: gocardlessAccount.name || gocardlessAccount.product || t('bankCallback.account'),
          type: 'checking',
          currency: gocardlessAccount.currency,
          iban: gocardlessAccount.iban || null,
          description: `IBAN: ${gocardlessAccount.iban || 'N/A'}`,
          gocardless_account_id: gocardlessAccount.id,
          gocardless_requisition_id: resolvedRequisitionId,
          gocardless_institution_name: gocardlessAccount.product,
          bank_connection_id: bankConnection?.id,
          sync_enabled: true,
        });
        showSuccess(t('bankCallback.accountCreated'));
      }

      // Initialimport über DENSELBEN Pfad wie der spätere manuelle Sync
      // (Dedupe, Transfer-Reconciliation, opening_balance, last_sync_at). Kein
      // separater UI-Import mehr → keine Doppelbuchungen bei Reload/Erst-Sync (T1.6).
      await importInitialTransactions(account);

      setLinkedAccounts(prev => new Set(prev).add(gocardlessAccount.id));
    } catch (err: unknown) {
      showError(t('common.errorWithMessage').replace('{message}', (err as Error).message));
    } finally {
      setImportingTransactions(prev => {
        const next = new Set(prev);
        next.delete(gocardlessAccount.id);
        return next;
      });
    }
  };

  const importInitialTransactions = async (account: Account) => {
    try {
      const result = await syncAccountTransactions(account);

      if (result.importedCount > 0) {
        showSuccess(t('bankCallback.transactionsImported').replace('{count}', String(result.importedCount)));
      }
      if (result.errors.length > 0) {
        logger.warn('[bank-callback] Initialer Sync mit aggregierten Fehlern abgeschlossen.', {
          source: 'bank-callback',
          code: 'INITIAL_SYNC_PARTIAL_ERRORS',
          count: result.errors.length,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: financeKeys.transactionContracts });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    } catch (err: unknown) {
      logger.error('[bank-callback] Initialer Sync nach Kontoverknüpfung fehlgeschlagen.', {
        source: 'bank-callback',
        code: 'INITIAL_SYNC_FAILED',
      });
      // Don't throw - linking succeeded even if import partially failed
    }
  };

  const handleOpenAuthLink = () => {
    const link = requisitionInfo?.link;
    if (!link) return;

    if (!isSafeBankCallbackAuthLink(link)) {
      showError(t('bankCallback.unsafeAuthLink'));
      return;
    }

    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleFinish = () => {
    sessionStorage.removeItem('gocardless_requisition_id');
    navigate('/');
  };

  const safeRequisitionLink = requisitionInfo?.link && isSafeBankCallbackAuthLink(requisitionInfo.link)
    ? requisitionInfo.link
    : null;

  const accountTypeLabel = (account: GoCardlessAccount) => {
    if (account.product?.toLowerCase().includes('credit')) return t('bankCallback.creditCard');
    if (account.product?.toLowerCase().includes('giro')) return t('bankCallback.checkingAccount');
    if (account.product?.toLowerCase().includes('spark')) return t('bankCallback.savingsAccount');
    return t('bankCallback.account');
  };

  const formatBalance = (account: GoCardlessAccount) => {
    if (!account.balances || account.balances.length === 0) return null;

    // Prefer closingBooked (real value shown in bank apps)
    const preferred = account.balances.find((b) => b.balanceType === 'closingBooked')
      || account.balances.find((b) => b.balanceType === 'interimAvailable')
      || account.balances.find((b) => b.balanceType === 'interimBooked')
      || account.balances.find((b) => b.balanceType === 'expected')
      || account.balances[0];

    const amount = parseFloat(preferred.balanceAmount.amount);
    const currency = preferred.balanceAmount.currency;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const isAllLinked = accounts.length > 0 && accounts.every(acc => linkedAccounts.has(acc.id));

  if (status === 'loading' || status === 'pending') {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-positive/20 blur-3xl rounded-full" />
            <Loader2 className="h-16 w-16 animate-spin text-positive relative z-10 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-6">{t('bankCallback.loadingHeading')}</h1>
          <p className="text-muted-foreground mt-2">{t('bankCallback.loadingDescription')}</p>
          {pollingAttempts > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{t('bankCallback.waitingTime').replace('{seconds}', String(pollingAttempts * 2))}</p>
          )}
          {safeRequisitionLink && (
            <div className="mt-4">
              <Button onClick={handleOpenAuthLink} className="bg-positive">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('bankCallback.openAuthLink')}
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-card border-warning/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-warning/20 rounded-full">
                  <AlertCircle className="h-8 w-8 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-foreground">{t('bankCallback.failureHeading')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('bankCallback.failureDescription')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>

              {requisitionInfo && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <div>Requisition Status: <strong className="text-foreground">{requisitionInfo.status}</strong></div>
                  {safeRequisitionLink && (
                    <div>
                      <div>{t('bankCallback.authLinkLabel')}</div>
                      <a href={safeRequisitionLink} target="_blank" rel="noopener noreferrer" className="text-positive underline break-words">{safeRequisitionLink}</a>
                    </div>
                  )}
                  {requisitionInfo.reference && (
                    <div>Reference: {requisitionInfo.reference}</div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => navigate('/')}
                  className="flex-1 bg-muted hover:bg-accent"
                >
                  {t('bankCallback.backToApp')}
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gradient-to-r from-positive to-positive hover:from-positive hover:to-positive"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('bankCallback.retryButton')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-positive/20 rounded-full">
                <Building2 className="h-8 w-8 text-positive" />
              </div>
              <div>
                <CardTitle className="text-foreground">{t('bankCallback.successHeading')}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t('bankCallback.successDescription')
                    .replace('{count}', String(accounts.length))
                    .replace('{countLabel}', accounts.length === 1 ? t('bankCallback.accountSingular') : t('bankCallback.accountPlural'))
                    .replace('{action}', accounts.length === 1 ? t('bankCallback.linkActionSingular') : t('bankCallback.linkActionPlural'))
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {accounts.map((account, index) => {
                const isLinked = linkedAccounts.has(account.id);
                const isImporting = importingTransactions.has(account.id);
                const balance = formatBalance(account);

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-lg border ${
                      isLinked 
                        ? 'bg-positive/10 border-positive/30' 
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground truncate">
                            {account.name || account.product || 'Bankkonto'}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {accountTypeLabel(account)}
                          </Badge>
                          {isLinked && (
                            <Badge className="bg-positive/20 text-positive text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t('bankCallback.linked')}
                            </Badge>
                          )}
                        </div>
                        
                        {balance && (
                          <div className="text-2xl font-bold text-foreground mb-2">
                            {balance}
                          </div>
                        )}
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          {account.iban && (
                            <p>IBAN: {account.iban}</p>
                          )}
                          <p>{t('bankCallback.currency').replace('{currency}', account.currency)}</p>
                          {account.ownerName && (
                            <p>{t('bankCallback.owner').replace('{name}', account.ownerName)}</p>
                          )}
                        </div>
                      </div>

                      {!isLinked && !isImporting && (
                        <div className="flex flex-col gap-2">
                          <select
                            onChange={(e) => handleLinkAccount(account, e.target.value === 'new' ? undefined : (e.target.value || undefined))}
                            className="bg-card border border-border text-foreground text-sm rounded px-3 py-2 w-full max-w-full sm:w-auto sm:min-w-[200px]"
                            defaultValue=""
                          >
                            <option value="" disabled>{t('bankCallback.selectAccount')}</option>
                            <option value="new">{t('bankCallback.createNew')}</option>
                            <optgroup label={t('bankCallback.existingAccounts')}>
                              {existingAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.icon} {acc.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}

                      {isImporting && (
                        <div className="flex items-center gap-2 text-positive">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">{t('bankCallback.importing')}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {isAllLinked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center pt-4"
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle2 className="h-6 w-6 text-positive" />
                  <span className="text-positive font-medium">
                    {t('bankCallback.allLinked')}
                  </span>
                </div>
                <Button
                  onClick={handleFinish}
                  className="bg-gradient-to-r from-positive to-positive hover:from-positive hover:to-positive text-white px-8"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {t('bankCallback.finishButton')}
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}