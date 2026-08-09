import { ArrowLeftRight, Link2, Unlink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { useTransferSuggestions } from '@/features/accounts/application/use-transfer-suggestions';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('de-DE');

/**
 * Uebertrags-Vorschlaege — Darstellung.
 *
 * Die zwei Abfragen und zwei Mutationen liegen seit WP 6.5a in
 * `features/accounts/application/use-transfer-suggestions.ts`. Diese Datei
 * bleibt vorerst unter `src/components/`, weil sie `FinanceErrorState` aus
 * `@/components/common/` benutzt — ein Umzug in die Slice wuerde die
 * `maxBausteine`-Ratsche erhoehen (`pnpm check:slice-presentation`), die nur
 * sinken darf. Sie wird mit WP 6.7 frei.
 */
export function TransferSuggestions() {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const model = useTransferSuggestions();

  // Nichts zu verknuepfen und nichts verknuepft: Die Karte entfaellt. Bei einem
  // LESEFEHLER gilt das ausdruecklich nicht — dann bleibt sie stehen und sagt,
  // dass sie nichts weiss (AGENTS.md §5).
  if (model.isEmpty) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          {t('accounts.transferSuggestions.title')}
        </CardTitle>
        <CardDescription>{t('accounts.transferSuggestions.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {model.hasLoadError && <FinanceErrorState variant="data" onRetry={model.retryAll} />}
        {model.candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t('accounts.transferSuggestions.suggestionsTitle')}
            </p>
            {model.candidates.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <div>
                    {dateFmt.format(new Date(row.date))} ·{' '}
                    {money.mask(eur.format(Math.abs(row.amount)))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.fromLabel} → {row.toLabel}
                    {row.daysApart > 0 &&
                      ` · ${t('accounts.transferSuggestions.daysApart').replace('{days}', row.daysApart.toString())}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => model.markAsTransfer(row.key)}
                  disabled={model.isMarking}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {t('accounts.transferSuggestions.markAsTransfer')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {model.linked.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t('accounts.transferSuggestions.linkedTransfers')}
            </p>
            {model.linked.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {dateFmt.format(new Date(row.date))} ·{' '}
                    {money.mask(eur.format(Math.abs(row.amount)))}
                    <Badge variant="secondary">
                      {t('accounts.transferSuggestions.transferBadge')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.toLabel
                      ? `${row.fromLabel} ↔ ${row.toLabel}`
                      : `${row.fromLabel} ${t('accounts.transferSuggestions.counterPartNotFound')}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => model.unlink(row.key)}
                  disabled={model.isUnlinking}
                  className="text-warning hover:text-warning"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  {t('accounts.transferSuggestions.unlink')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
