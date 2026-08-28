/**
 * Karte für Ein- und Auszahlungen eines Depots (Welle 4, Nachtrag).
 *
 * Sie ist der ERZEUGER des Zahlungsstroms. Ohne sie war die geldgewichtete
 * Rendite zwar gebaut, gespeichert und im Chat ausgewertet — aber für
 * niemanden erreichbar, weil sich keine Zahlung erfassen liess. Dieselbe
 * Lehre wie bei der Vermögens-Historie: Eine Datengrundlage ohne Erzeuger
 * ist keine.
 *
 * Die Rendite steht hier direkt daneben, nicht nur im Chat: Wer die Zahlungen
 * pflegt, soll sehen, wofür.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { TypedSelect } from '@/features/shared/presentation/TypedSelect';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  usePortfolioCashflows,
  type CashflowRichtung,
} from '../application/use-portfolio-cashflows';

export interface PortfolioCashflowsCardProps {
  portfolioId: string | undefined;
  /** Heutiger Marktwert — der abschliessende Rückfluss der Zinsfuß-Rechnung. */
  marktwert: number;
}

export function PortfolioCashflowsCard({ portfolioId, marktwert }: PortfolioCashflowsCardProps) {
  const { t, locale } = useI18n();
  const money = useMoneyFormat();
  const model = usePortfolioCashflows(portfolioId, marktwert);

  const datum = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${iso}T00:00:00`));

  // Ausgeschriebene `t()`-Aufrufe statt eines zusammengesetzten Schlüssels —
  // ein Key aus einer Variablen ist für die Aufrufstellen-Ratsche unsichtbar.
  const richtungLabel = (r: CashflowRichtung) =>
    r === 'deposit' ? t('portfolioCashflows.deposit') : t('portfolioCashflows.withdrawal');

  if (model.isError) {
    return <FinanceErrorState onRetry={() => void model.refetch()} />;
  }

  const entwurf = model.draft;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('portfolioCashflows.title')}</CardTitle>
        <CardDescription>{t('portfolioCashflows.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {model.zeilen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('portfolioCashflows.empty')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {model.zeilen.map((zeile) => (
                <li
                  key={zeile.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{richtungLabel(zeile.direction)}</div>
                    <div className="text-xs text-muted-foreground">{datum(zeile.date)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="tabular-nums text-sm">
                      {money.format(zeile.direction === 'deposit' ? zeile.amount : -zeile.amount)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('portfolioCashflows.edit')}
                      onClick={() => model.entwurfOeffnen(zeile)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('portfolioCashflows.remove')}
                      onClick={() => model.loeschen(zeile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-sm">
              {t('portfolioCashflows.totals')
                .split('{ein}')
                .join(money.format(model.eingezahlt))
                .split('{aus}')
                .join(money.format(model.entnommen))}
            </p>

            {/* Die Rendite sagt, WARUM die Zahlungen gepflegt werden — und wenn
                sie noch keine ist, sagt sie das, statt eine Zahl zu zeigen. */}
            <p className="text-sm font-medium">
              {model.rendite.art === 'rendite'
                ? t('portfolioCashflows.returnValue')
                    .split('{prozent}')
                    .join(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                      model.rendite.jaehrlich * 100,
                    ))
                : t('portfolioCashflows.returnNone')}
            </p>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!portfolioId}
          onClick={() => model.entwurfOeffnen()}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('portfolioCashflows.add')}
        </Button>
      </CardContent>

      <Dialog open={entwurf !== null} onOpenChange={(offen) => !offen && model.entwurfSchliessen()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entwurf?.id ? t('portfolioCashflows.edit') : t('portfolioCashflows.add')}
            </DialogTitle>
          </DialogHeader>

          {entwurf && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cashflow-direction">{t('portfolioCashflows.directionLabel')}</Label>
                <TypedSelect
                  id="cashflow-direction"
                  value={entwurf.direction}
                  onValueChange={(direction: CashflowRichtung) =>
                    model.entwurfAendern({ direction })
                  }
                  aria-label={t('portfolioCashflows.directionLabel')}
                  options={[
                    { value: 'deposit' as CashflowRichtung, label: t('portfolioCashflows.deposit') },
                    {
                      value: 'withdrawal' as CashflowRichtung,
                      label: t('portfolioCashflows.withdrawal'),
                    },
                  ]}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cashflow-amount">{t('portfolioCashflows.amountLabel')}</Label>
                {/* Dezimalfeld, nicht `type="number"` (§8). */}
                <DecimalInput
                  id="cashflow-amount"
                  value={entwurf.amount}
                  onChange={(amount) => model.entwurfAendern({ amount })}
                  aria-label={t('portfolioCashflows.amountLabel')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cashflow-date">{t('portfolioCashflows.dateLabel')}</Label>
                <Input
                  id="cashflow-date"
                  type="date"
                  value={entwurf.date}
                  onChange={(e) => model.entwurfAendern({ date: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={model.entwurfSchliessen}>
              {t('portfolioCashflows.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                !entwurf || entwurf.amount === null || entwurf.amount <= 0 || model.speichertGerade
              }
              onClick={() => entwurf && model.speichern(entwurf)}
            >
              {t('portfolioCashflows.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default PortfolioCashflowsCard;
