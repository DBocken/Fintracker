import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Wallet } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  parseCsv,
  detectBank,
  createDefaultMapping,
  BANK_TEMPLATES,
  CsvMapping,
} from '../services/csv-service'
import type { Transaction } from '../types'
import { applyAutoCategorization } from '../services/transaction-service'
import { getAccounts, getOrCreateDefaultAccount, ACCOUNT_TYPE_LABELS } from '../services/account-service'
import { useI18n } from '@/i18n/useI18n'

interface CsvUploaderProps {
  onTransactionsLoaded: (transactions: Transaction[]) => void
}

// Local storage key for last selected account
const LAST_ACCOUNT_KEY = 'ausgabentracker_last_import_account';

export function CsvUploader({ onTransactionsLoaded }: CsvUploaderProps) {
  const { t } = useI18n();
  const [rawHeaderLine, setRawHeaderLine] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState<string>(';')
  const [mapping, setMapping] = useState<CsvMapping>({
    bankName: 'custom',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    payeeColumn: 'Beguenstigter/Zahlungspflichtiger',
    descriptionColumn: 'Verwendungszweck',
    currencyColumn: 'Waehrung',
    categoryColumn: 'Kategorie',
  })
  const [accountType, setAccountType] = useState<'bank' | 'credit'>('bank')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  // Load accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  })

  // Initialize with last used account or create default
  useEffect(() => {
    const initAccount = async () => {
      // Try to get last used account from localStorage
      const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY)
      
      if (lastAccountId && accounts.find(a => a.id === lastAccountId)) {
        setSelectedAccountId(lastAccountId)
      } else if (accounts.length > 0) {
        // Use first account
        setSelectedAccountId(accounts[0].id)
      } else if (!accountsLoading) {
        // No accounts exist, create default
        try {
          const defaultAccount = await getOrCreateDefaultAccount()
          setSelectedAccountId(defaultAccount.id)
        } catch (e) {
          console.error('Failed to create default account:', e)
        }
      }
    }
    
    initAccount()
  }, [accounts, accountsLoading])

  // Save selected account to localStorage
  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId)
    localStorage.setItem(LAST_ACCOUNT_KEY, accountId)
    
    // Auto-detect account type from selected account
    const account = accounts.find(a => a.id === accountId)
    if (account) {
      setAccountType(account.type === 'credit_card' ? 'credit' : 'bank')
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return
    const f = acceptedFiles[0]
    const text = await f.text()
    const firstLine = text.split('\n')[0]

    const autoDelim = firstLine.includes(';')
      ? ';'
      : firstLine.includes('\t')
      ? '\t'
      : firstLine.includes('|')
      ? '|'
      : ','
    setDelimiter(autoDelim)
    setRawHeaderLine(firstLine)
    setFile(f)

    const rawCols = firstLine.split(autoDelim)
    const cols = rawCols.map(h => h.replace(/^["']|["']$/g, '').trim())

    const bankKey = detectBank(cols) || 'custom'
    if (bankKey !== 'custom' && BANK_TEMPLATES[bankKey]) {
      setMapping(BANK_TEMPLATES[bankKey])
    } else {
      setMapping(createDefaultMapping(cols))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const handleImport = async () => {
    if (!file || !rawHeaderLine || !selectedAccountId) return
    let transactions = await parseCsv(file, mapping, delimiter)
    
    // Invert amounts for credit card statements
    if (accountType === 'credit') {
      transactions = transactions.map(t => ({
        ...t,
        amount: -t.amount
      }))
    }

    // Add account_id to all transactions
    transactions = transactions.map(t => ({
      ...t,
      account_id: selectedAccountId,
    }))

    // Auto-kategorisieren anhand deiner Kategorien/Filter
    transactions = await applyAutoCategorization(transactions)
    
    onTransactionsLoaded(transactions)
    setRawHeaderLine(null)
    setFile(null)
  }

  const headers = rawHeaderLine
    ? rawHeaderLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim())
    : []

  if (!rawHeaderLine) {
    return (
      <Card className="ui-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            CSV hochladen
          </CardTitle>
          <CardDescription>
            Importiere Transaktionen aus deiner Bank-CSV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Account Selection - Required */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Zielkonto <span className="text-warning">*</span>
              </label>
              {accounts.length === 0 && !accountsLoading ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Bitte erstelle zuerst ein Konto in den Einstellungen.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Select
                    value={selectedAccountId || ''}
                    onValueChange={handleAccountChange}
                    disabled={accountsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={accountsLoading ? t("csv.loadingAccounts", "Lade Konten...") : t("forms.selectAccountPlaceholder", "Konto auswählen")} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: account.color }}
                            />
                            <span>{account.icon}</span>
                            <span>{account.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({ACCOUNT_TYPE_LABELS[account.type]})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Alle importierten Transaktionen werden diesem Konto zugeordnet
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Kontotyp</label>
              <Select value={accountType} onValueChange={(val: 'bank' | 'credit') => setAccountType(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bankkonto (Giro)</SelectItem>
                  <SelectItem value="credit">Kreditkarte</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {accountType === 'credit' 
                  ? 'Ausgaben werden automatisch negiert' 
                  : 'Standard Bankkonto'}
              </p>
            </div>

            <div
              {...getRootProps()}
              className={`border-dashed border-2 p-8 text-center cursor-pointer rounded-lg transition-colors ${
                !selectedAccountId 
                  ? 'border-border bg-muted cursor-not-allowed opacity-50' 
                  : 'border-border hover:border-primary hover:bg-primary/5'
              }`}
              style={{ pointerEvents: selectedAccountId ? 'auto' : 'none' }}
            >
              <input {...getInputProps()} disabled={!selectedAccountId} />
              {!selectedAccountId ? (
                <p className="text-muted-foreground">Bitte zuerst ein Konto auswählen</p>
              ) : isDragActive ? (
                <p>Loslassen zum Hochladen...</p>
              ) : (
                <p>Ziehe eine CSV-Datei hierher oder klicke, um sie auszuwählen</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get selected account for display
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  return (
    <Card className="ui-card">
      <CardHeader>
        <CardTitle>Spalten zuordnen</CardTitle>
        {selectedAccount && (
          <CardDescription className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedAccount.color }}
            />
            Import für: <strong>{selectedAccount.icon} {selectedAccount.name}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Kontotyp</label>
          <Select value={accountType} onValueChange={(val: 'bank' | 'credit') => setAccountType(val)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bankkonto (Giro)</SelectItem>
              <SelectItem value="credit">Kreditkarte</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {accountType === 'credit' 
              ? 'Ausgaben werden automatisch negiert' 
              : 'Standard Bankkonto'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Trennzeichen</label>
          <Select value={delimiter} onValueChange={setDelimiter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Komma (,)</SelectItem>
              <SelectItem value=";">Semikolon (;)</SelectItem>
              <SelectItem value="\t">Tabulator (\t)</SelectItem>
              <SelectItem value="|">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(
          [
            'dateColumn',
            'amountColumn',
            'payeeColumn',
            'descriptionColumn',
            'currencyColumn',
            'categoryColumn',
            'ibanColumn',
          ] as const
        ).map((key) => (
          <div key={key}>
            <label className="block text-sm font-medium mb-1">
              {{
                dateColumn: 'Datum',
                amountColumn: 'Betrag',
                payeeColumn: 'Empfänger',
                descriptionColumn: 'Verwendungszweck',
                currencyColumn: 'Währung',
                categoryColumn: 'Kategorie',
                ibanColumn: 'Gegenkonto-IBAN (optional)',
              }[key]}
            </label>
            <Select
              value={mapping[key] || ''}
              onValueChange={(val: string) =>
                setMapping({ ...mapping, [key]: val === '__none__' ? undefined : val })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("csv.selectColumn", "Spalte wählen")} />
              </SelectTrigger>
              <SelectContent>
                {(['currencyColumn', 'categoryColumn', 'ibanColumn'] as ReadonlyArray<string>).includes(key) && (
                  <SelectItem value="__none__">— keine —</SelectItem>
                )}
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="text-right">
          <Button
            onClick={handleImport}
            disabled={
              !mapping.dateColumn ||
              !mapping.amountColumn ||
              !mapping.payeeColumn ||
              !selectedAccountId
            }
          >
            Importieren
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}