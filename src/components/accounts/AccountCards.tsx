import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getAccounts } from '@/services/account-service'
import type { Account } from '@/types'
import { RefreshCw } from 'lucide-react'

interface AccountCardsProps {
  balances: Record<string, { amount: number; source: 'bank' | 'local'; balanceType?: string }>
  totalBalance: number
}

export function AccountCards({ balances, totalBalance }: AccountCardsProps) {
  const { data: accounts = [], isLoading, error } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(),
  })

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">
            💰 Kontenübersicht
          </CardTitle>
          {accounts.length > 0 && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Gesamtsaldo</div>
              <div className="text-2xl font-bold">
                {formatBalance(totalBalance)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-destructive text-sm mb-4">
            Fehler beim Laden der Konten
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Noch keine Konten vorhanden.</p>
            <p className="text-sm mt-2">Verbinde dein erstes Bankkonto über PSD2 oder erstelle manuell ein Konto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const hasBankConnection = !!account.gocardless_account_id
              const b = balances[account.id] || { amount: 0, source: 'local' as const }

              return (
                <Card
                  key={account.id}
                  className="bg-muted/40 border hover:border-primary/40 transition-all"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{account.icon}</span>
                        <CardTitle className="text-base truncate">
                          {account.name}
                        </CardTitle>
                      </div>
                      {hasBankConnection && (
                        <div className="text-xs bg-positive/15 text-positive dark:text-positive px-2 py-1 rounded-full">
                          PSD2
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Kontostand</div>
                      <div className="text-xl font-bold">
                        {formatBalance(b.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Quelle:{' '}
                        <span className="text-foreground">
                          {b.source === 'bank'
                            ? `Bank (${b.balanceType || 'closingBooked'})`
                            : 'Lokal (Summe Transaktionen)'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Typ: <span className="text-foreground">{account.type}</span>
                      </div>
                      {account.description && (
                        <div className="text-xs text-muted-foreground">
                          Beschreibung: <span className="text-foreground truncate block">{account.description}</span>
                        </div>
                      )}
                      {account.gocardless_account_id && (
                        <div className="text-xs text-muted-foreground">
                          Synchronisation: <span className="text-positive dark:text-positive">Aktiv</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}