import { InfoGroup } from '@/components/common/InfoGroup'
import type { Account } from '@/types'
import type { EffectiveBalance } from '@/features/dashboard/domain/overview-types'
import { RefreshCw } from 'lucide-react'
import { useGentleMode } from '@/components/providers/GentleModeProvider'
import { useI18n } from '@/i18n/useI18n'

interface AccountCardsProps {
  accounts: Account[]
  balances: Record<string, EffectiveBalance>
  totalBalance: number
  isLoading?: boolean
  hasError?: boolean
}

export function AccountCards({ accounts, balances, totalBalance, isLoading = false, hasError = false }: AccountCardsProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();

  const formatBalance = (amount: number) => {
    if (gentleModeEnabled) return '***'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // WP-8.1: Karten-los (AGENTS.md Paragraf 9). Diese Flaeche ist ein reines
  // Readout — eine betitelte Liste von Konten mit Salden, in der nichts
  // anklickbar ist. Der Karten-Rahmen versprach ein Weiterkommen, das es hier
  // nie gab.
  return (
    <InfoGroup className="flex h-full flex-col" title={
      <span className="flex w-full items-center justify-between gap-3">
        <span className="text-base font-semibold text-foreground">{t('accounts.cards.title')}</span>
        {accounts.length > 0 && (
          <span className="text-right">
            <span className="block text-xs text-muted-foreground">{t('accounts.cards.totalBalance')}</span>
            <span className="block text-lg font-semibold tabular-nums text-foreground">
              {formatBalance(totalBalance)}
            </span>
          </span>
        )}
      </span>
    }>
      <div className="flex-1">
        {hasError && (
          <div className="text-destructive text-sm mb-4">{t('accounts.cards.errorLoading')}</div>
        )}
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('accounts.cards.emptyTitle')}</p>
            <p className="text-sm mt-2">{t('accounts.cards.emptyDesc')}</p>
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
                          title={t('accounts.cards.connectedTitle')}
                        >
                          {t('accounts.cards.connected')}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" title={account.description || undefined}>
                      {account.type}
                      {' · '}
                      {b.source === 'bank'
                        ? t('accounts.cards.bankSync').replace('{type}', b.balanceType || 'closingBooked')
                        : t('accounts.cards.localSync')}
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
      </div>
    </InfoGroup>
  )
}
