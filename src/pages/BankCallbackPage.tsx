import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

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
import { createTransaction, getCategories, categorizeTransaction, getUserSettings } from '@/services/transaction-service';
import { getMerchantRules } from '@/services/merchant-rules-service';
import { showSuccess, showError } from '@/utils/toast';

interface GoCardlessAccount {
  id: string;
  currency: string;
  iban?: string;
  ownerName?: string;
  name?: string;
  product?: string;
  status?: string;
  balances?: any[];
}

interface ImportedTransaction {
  transactionId: string;
  bookingDate: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
}

export default function BankCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'linking' | 'pending'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GoCardlessAccount[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [importingTransactions, setImportingTransactions] = useState<Set<string>>(new Set());
  const [linkedAccounts, setLinkedAccounts] = useState<Set<string>>(new Set());
  const [requisitionInfo, setRequisitionInfo] = useState<any | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [requisitionId, setRequisitionId] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
    loadExistingAccounts();
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
      setError('Keine Requisition-ID gefunden. Bitte versuche die Verbindung erneut.');
      setStatus('error');
      return;
    }

    try {
      setStatus('pending');

      // We'll implement polling: try up to 6 times (approx 12s) to allow GoCardless to provision accounts
      const maxAttempts = 6;
      let attempt = 0;
      let gotAccounts: any[] = [];
      let lastRequisition: any = null;

      while (attempt < maxAttempts) {
        attempt++;
        setPollingAttempts(attempt);
        const result = await gocardlessService.getAccounts(lookupKey);

        lastRequisition = result.requisition || null;
        gotAccounts = result.accounts || [];

        // Save for UI
        setRequisitionInfo(lastRequisition);

        if (gotAccounts && gotAccounts.length > 0) {
          const resolvedRequisitionId = lastRequisition?.id || null;
          setRequisitionId(resolvedRequisitionId);

          if (resolvedRequisitionId) {
            sessionStorage.setItem('gocardless_requisition_id', resolvedRequisitionId);
          }

          setAccounts(gotAccounts as GoCardlessAccount[]);

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
      setError('Keine Konten gefunden. Möglicherweise wurde der Zugriff nicht autorisiert oder die Bank liefert keine Konten.');
      setStatus('error');
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(`Fehler beim Abrufen der Konten: ${err.message}`);
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

      let localAccountId: string;

      if (existingAccountId) {
        // Link to existing account
        await updateAccount({
          id: existingAccountId,
          gocardless_account_id: gocardlessAccount.id,
          gocardless_requisition_id: resolvedRequisitionId,
          gocardless_institution_name: gocardlessAccount.product,
          bank_connection_id: bankConnection?.id,
          sync_enabled: true,
        });
        localAccountId = existingAccountId;
        showSuccess('Konto verknüpft!');
      } else {
        // Create new account
        const newAccount = await createAccount({
          name: gocardlessAccount.name || gocardlessAccount.product || 'Bankkonto',
          type: 'checking',
          currency: gocardlessAccount.currency,
          description: `IBAN: ${gocardlessAccount.iban || 'N/A'}`,
          gocardless_account_id: gocardlessAccount.id,
          gocardless_requisition_id: resolvedRequisitionId,
          gocardless_institution_name: gocardlessAccount.product,
          bank_connection_id: bankConnection?.id,
          sync_enabled: true,
        });
        localAccountId = newAccount.id;
        showSuccess('Neues Konto erstellt!');
      }

      // Import initial transactions (server enforces requisition/account binding)
      await importTransactionsForAccount(localAccountId, resolvedRequisitionId, gocardlessAccount.id);

      setLinkedAccounts(prev => new Set(prev).add(gocardlessAccount.id));
    } catch (err: any) {
      showError(`Fehler: ${err.message}`);
    } finally {
      setImportingTransactions(prev => {
        const next = new Set(prev);
        next.delete(gocardlessAccount.id);
        return next;
      });
    }
  };

  const importTransactionsForAccount = async (localAccountId: string, resolvedRequisitionId: string, gocardlessAccountId: string) => {
    try {
      const today = new Date();
      const twoYearsAgo = new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000);

      const dateFrom = twoYearsAgo.toISOString().split('T')[0];

      const dateTo = today.toISOString().split('T')[0];

      const transactions = await gocardlessService.getTransactions(
        resolvedRequisitionId,
        gocardlessAccountId,
        dateFrom,
        dateTo
      );

      if (transactions.length === 0) {
        return;
      }

      // Kategorien und gelernte Regeln einmalig laden, um Buchungen automatisch zuzuordnen
      const categories = await getCategories();
      const learnedRules = await getMerchantRules();
      const userSettings = await getUserSettings();

      // Map GoCardless transactions to app format
      const mappedTransactions = transactions.map((tx: ImportedTransaction) => {
        const draft = {
          date: tx.bookingDate,
          amount: parseFloat(tx.transactionAmount.amount),
          payee: tx.debtorName || tx.creditorName || 'Unbekannt',
          description: tx.remittanceInformationUnstructured || `${tx.debtorName || tx.creditorName || 'Transaktion'}`,
          original_text: tx.remittanceInformationUnstructured || `${tx.debtorName || tx.creditorName || 'Transaktion'}`,
          auto_mapped: false,
          confirmed: false,
        };
        const categoryId = categorizeTransaction(draft as any, categories, learnedRules);

        return {
          account_id: localAccountId, // Link to the local account
          ...draft,
          currency: tx.transactionAmount.currency,
          category_id: categoryId,
          auto_mapped: !!categoryId,
          confirmed: !!categoryId && userSettings.auto_confirm_mapping,
        };
      });

      let importedCount = 0;
      let skippedCount = 0;

      for (const tx of mappedTransactions) {
        try {
          await createTransaction(tx);
          importedCount++;
        } catch (err: any) {
          skippedCount++;
          console.error('Fehler beim Import der Transaktion:', {
            message: err?.message || 'Unbekannter Fehler',
            transaction: tx.original_text,
          });
        }
      }

      if (importedCount > 0) {
        showSuccess(`${importedCount} Transaktionen importiert`);
      }
      if (skippedCount > 0) {
        console.warn(`${skippedCount} Transaktionen konnten nicht importiert werden.`);
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

    } catch (err: any) {

      console.error('Error importing transactions:', err);
      // Don't throw - linking succeeded even if import partially failed
    }
  };

  const handleOpenAuthLink = () => {
    if (requisitionInfo?.link) {
      window.open(requisitionInfo.link, '_blank');
    }
  };

  const handleFinish = () => {
    sessionStorage.removeItem('gocardless_requisition_id');
    navigate('/');
  };

  const accountTypeLabel = (account: GoCardlessAccount) => {
    if (account.product?.toLowerCase().includes('credit')) return 'Kreditkarte';
    if (account.product?.toLowerCase().includes('giro')) return 'Girokonto';
    if (account.product?.toLowerCase().includes('spark')) return 'Sparkonto';
    return 'Konto';
  };

  const formatBalance = (account: GoCardlessAccount) => {
    if (!account.balances || account.balances.length === 0) return null;

    // Prefer closingBooked (real value shown in bank apps)
    const preferred = account.balances.find((b: any) => b.balanceType === 'closingBooked')
      || account.balances.find((b: any) => b.balanceType === 'interimAvailable')
      || account.balances.find((b: any) => b.balanceType === 'interimBooked')
      || account.balances.find((b: any) => b.balanceType === 'expected')
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
          <h1 className="text-2xl font-bold text-foreground mt-6">Konten werden abgerufen...</h1>
          <p className="text-muted-foreground mt-2">Bitte warte einen Moment, während wir deine Konten laden.</p>
          {pollingAttempts > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Wartezeit: {pollingAttempts * 2} Sekunden</p>
          )}
          {requisitionInfo && requisitionInfo.link && (
            <div className="mt-4">
              <Button onClick={handleOpenAuthLink} className="bg-positive">
                <ExternalLink className="h-4 w-4 mr-2" />
                Authentifizierungsseite erneut öffnen
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
                  <CardTitle className="text-foreground">Verbindung fehlgeschlagen</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Die Bankverbindung konnte nicht hergestellt werden.
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
                  {requisitionInfo.link && (
                    <div>
                      <div>Auth-Link:</div>
                      <a href={requisitionInfo.link} target="_blank" rel="noreferrer" className="text-positive underline break-words">{requisitionInfo.link}</a>
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
                  Zurück zur App
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gradient-to-r from-positive to-positive hover:from-positive hover:to-positive"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Erneut versuchen
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
                <CardTitle className="text-foreground">Bankkonten gefunden</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Wir haben {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'} gefunden. 
                  Verknüpfe sie mit bestehenden Konten oder erstelle neue.
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
                              Verknüpft
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
                          <p>Währung: {account.currency}</p>
                          {account.ownerName && (
                            <p>Inhaber: {account.ownerName}</p>
                          )}
                        </div>
                      </div>

                      {!isLinked && !isImporting && (
                        <div className="flex flex-col gap-2">
                          <select
                            onChange={(e) => handleLinkAccount(account, e.target.value === 'new' ? undefined : (e.target.value || undefined))}
                            className="bg-card border border-border text-foreground text-sm rounded px-3 py-2 min-w-[200px]"
                            defaultValue=""
                          >
                            <option value="" disabled>Konto wählen...</option>
                            <option value="new">➕ Neues Konto erstellen</option>
                            <optgroup label="Bestehende Konten">
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
                          <span className="text-sm">Importiere...</span>
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
                    Alle Konten erfolgreich verknüpft!
                  </span>
                </div>
                <Button
                  onClick={handleFinish}
                  className="bg-gradient-to-r from-positive to-positive hover:from-positive hover:to-positive text-white px-8"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Zurück zum Ausgabentracker
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}