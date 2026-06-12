import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getAccounts } from '@/services/account-service'
import type { Account } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useGentleMode } from '@/components/providers/GentleModeProvider'

interface AccountCardsProps {
  balances: Record<string, { amount: number; source: 'bank' | 'local'; balanceType?: string }>
  totalBalance: number
}

export function AccountCards({ balances, totalBalance }: AccountCardsProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  const { data: accounts = [], isLoading, error } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(),
  })

  const formatBalance = (amount: number) => {
    if (gentleModeEnabled) return '***'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Konten</CardTitle>
          {accounts.length > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Gesamtsaldo</div>
              <div className="text-lg font-semibold tabular-nums">
                {formatBalance(totalBalance)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
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
          <ul className="divide-y">
            {accounts.map((account) => {
              const hasBankConnection = !!account.gocardless_account_id
              const b = balances[account.id] || { amount: 0, source: 'local' as const }

              return (
                <li key={account.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-xl leading-none">{account.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{account.name}</span>
                      {hasBankConnection && (
                        <span
                          className="shrink-0 rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-medium text-positive"
                          title="Synchronisation aktiv"
                        >
                          PSD2
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" title={account.description || undefined}>
                      {account.type}
                      {' · '}
                      {b.source === 'bank'
                        ? `Bank (${b.balanceType || 'closingBooked'})`
                        : 'Lokal (Summe Transaktionen)'}
                      {account.description ? ` · ${account.description}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {formatBalance(b.amount)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
