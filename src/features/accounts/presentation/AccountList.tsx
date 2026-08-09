import {
  Banknote,
  Building2,
  CreditCard,
  ExternalLink,
  Link2,
  Pencil,
  PiggyBank,
  RefreshCw,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { Account, AccountType } from '@/lib/account-types';

import type { AccountRowModel } from '../application/use-account-manager';
import { AccountDataQualityBadge } from './AccountDataQualityBadge';

/**
 * Kontenliste der Konten-Slice (WP 6.5a).
 *
 * Sie bekommt fertige Zeilenmodelle und hat KEINEN eigenen Datenzugriff — das
 * ist der Punkt der Slice: Eine zweite Praesentation (Mobile) kann daneben
 * gestellt werden, ohne dass die Datenbeschaffung ein zweites Mal entsteht
 * (AGENTS.md §4).
 *
 * Zur Karten-Regel (§9): Die Zeile hat bewusst kein Karten-Chrome (kein
 * Schatten) — sie ist ein Listeneintrag mit mehreren getrennten Aktionen
 * (bearbeiten, synchronisieren, trennen/loeschen) und gerade KEINE Flaeche mit
 * genau einer Folgehandlung.
 */

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  checking: <Building2 className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
  wallet: <Smartphone className="h-5 w-5" />,
  cash: <Banknote className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

export interface AccountListProps {
  rows: AccountRowModel[];
  /**
   * Der Bestand wurde gelesen und ist leer. Bewusst getrennt von
   * `rows.length === 0`: Nach einem Lesefehler ist die Liste ebenfalls leer,
   * aber dann darf die Flaeche NICHT „noch keine Konten" behaupten
   * (AGENTS.md §5, `pnpm check:state-coverage`).
   */
  isEmpty: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onSync: (account: Account) => void;
  onDisconnect: (account: Account) => void;
}

export function AccountList({
  rows,
  isEmpty,
  onEdit,
  onDelete,
  onSync,
  onDisconnect,
}: AccountListProps) {
  const { t } = useI18n();

  if (isEmpty) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('accounts.manager.emptyTitle')}</p>
        <p className="text-sm">{t('accounts.manager.emptyDescription')}</p>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const { account } = row;
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
                    <Badge variant="outline" className="text-xs shrink-0">
                      {t('accounts.manager.budgetPoolBadge')}
                    </Badge>
                  )}
                  {account.is_business && (
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-primary/40 text-primary"
                    >
                      {t('accounts.manager.businessBadge')}
                    </Badge>
                  )}
                  {row.isConnected && (
                    <Badge className="bg-positive/15 text-positive dark:text-positive text-xs shrink-0 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {t('accounts.manager.connectedBadge')}
                    </Badge>
                  )}
                  {row.consentExpired && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      {t('accounts.manager.connectionExpiredBadge')}
                    </Badge>
                  )}
                  {row.consentExpiresSoon && (
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-warning/40 text-warning dark:text-warning"
                    >
                      {t('accounts.manager.connectionExpiresSoonBadge')}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    {row.typeLabel}
                    {account.description && ` • ${account.description}`}
                  </div>
                  {row.isConnected && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {row.syncStatusText}
                      </span>
                      {row.consentExpiresAt && (
                        <span>
                          {t('accounts.manager.connectionValidUntil').replace(
                            '{date}',
                            new Date(row.consentExpiresAt).toLocaleDateString('de-DE'),
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  <AccountDataQualityBadge quality={row.quality} />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="secondary" className="mr-1">
                {account.currency}
              </Badge>

              {row.isConnected && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSync(account)}
                  disabled={row.isSyncing || !row.canSync}
                  className="h-9 w-9 text-positive hover:bg-positive/10 hover:text-positive dark:text-positive dark:hover:text-positive"
                  title={t('accounts.manager.syncButton')}
                  aria-label={t('accounts.manager.syncButton')}
                >
                  <RefreshCw className={`h-4 w-4 ${row.isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onEdit(account)}
                aria-label={t('accounts.manager.editButton')}
                title={t('accounts.manager.editButton')}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {row.isConnected ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDisconnect(account)}
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
                  onClick={() => onDelete(account)}
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
  );
}
