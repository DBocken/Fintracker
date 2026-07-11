import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, Trash2 } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { computeTaxTank } from '@/lib/tax-reserve-tank';
import {
  addTaxReserveMovement,
  deleteTaxReserveMovement,
} from '@/services/tax-reserve-service';
import type { TaxReserveState } from '@/types';

interface Props {
  year: number;
  /** YTD-Betriebseinnahmen (aus buildEuerReport — Ziel wird NIE persistiert). */
  businessIncomeYtd: number;
  percent: number;
  reserve: TaxReserveState | null;
}

/**
 * Steuerrücklage-Tank: datengetriebener Füllstand (0 → Ziel wächst beim Mount,
 * reduced-motion zeigt den Zielzustand direkt) mit Quick-Actions
 * „zurückgelegt" / „Steuer gezahlt" im aufklappbaren Bereich.
 */
export function TaxReserveTankCard({ year, businessIncomeYtd, percent, reserve }: Props) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');

  const movements = reserve?.movements ?? [];
  const tank = computeTaxTank(businessIncomeYtd, percent, movements);
  const targetPct = Math.round(tank.fillRatio * 100);

  // Füllstand baut sich auf (Baseline: Daten poppen nicht, sie wachsen).
  const [fill, setFill] = useState(reduced ? targetPct : 0);
  useEffect(() => {
    if (reduced) {
      setFill(targetPct);
      return;
    }
    const raf = requestAnimationFrame(() => setFill(targetPct));
    return () => cancelAnimationFrame(raf);
  }, [targetPct, reduced]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['taxReserve', year] });
  const addMutation = useMutation({
    mutationFn: (signedAmount: number) =>
      addTaxReserveMovement(year, {
        date: new Date().toISOString().slice(0, 10),
        amount: signedAmount,
      }),
    onSuccess: () => {
      setAmount('');
      void invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (movementId: string) => deleteTaxReserveMovement(year, movementId),
    onSuccess: () => void invalidate(),
  });

  const parsedAmount = Number(amount.replace(',', '.'));
  const canSubmit = Number.isFinite(parsedAmount) && parsedAmount > 0 && !addMutation.isPending;

  const panelId = `tax-reserve-tank-${year}`;

  return (
    <div>
      <InteractiveCard
        expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        aria-controls={panelId}
        className="flex-col items-stretch gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <PiggyBank className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="truncate font-medium">
              {t('euer.tank.title', 'Steuerrücklage {year}').replace('{year}', String(year))}
            </span>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {formatCurrency(tank.saved)} / {formatCurrency(tank.target)}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" data-tank-fill={targetPct}>
          <div
            className={cn(
              'h-full rounded-full',
              // Schwellwertbewusste Ampel: voll = grün, gut gefüllt = brand, dünn = warning.
              tank.fillRatio >= 1 ? 'bg-positive' : tank.fillRatio >= 0.6 ? 'bg-brand' : 'bg-warning',
              !reduced && 'transition-[width] duration-700 ease-out',
            )}
            style={{ width: `${fill}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {t('euer.tank.targetLine', 'Ziel: {percent} % von {income} Betriebseinnahmen')
            .replace('{percent}', String(percent))
            .replace('{income}', formatCurrency(businessIncomeYtd))}
          {tank.gap > 0 && (
            <>
              {' · '}
              {t('euer.tank.gap', 'noch {gap} offen').replace('{gap}', formatCurrency(tank.gap))}
            </>
          )}
        </p>
        {tank.overfunded && (
          <p className="text-xs text-positive">{t('euer.tank.overfunded', 'Mehr zurückgelegt als das Ziel – gut gepolstert.')}</p>
        )}
      </InteractiveCard>

      {expanded && (
        <div id={panelId} className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`tank-amount-${year}`} className="text-xs">
                {t('euer.tank.addLabel', 'Betrag')}
              </Label>
              <Input
                id={`tank-amount-${year}`}
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-32"
              />
            </div>
            <Button size="sm" disabled={!canSubmit} onClick={() => addMutation.mutate(parsedAmount)}>
              {t('euer.tank.addReserve', 'Zurückgelegt')}
            </Button>
            <Button size="sm" variant="outline" disabled={!canSubmit} onClick={() => addMutation.mutate(-parsedAmount)}>
              {t('euer.tank.payTax', 'Steuer gezahlt')}
            </Button>
          </div>

          {movements.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('euer.tank.empty', 'Noch keine Bewegungen – nutze die Schnellaktionen, sobald du Geld zur Seite legst.')}
            </p>
          ) : (
            <ul className="space-y-1">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{m.date}</span>
                  <span className={cn('tabular-nums', m.amount < 0 && 'text-warning')}>{formatCurrency(m.amount)}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('euer.tank.deleteMovement', 'Bewegung löschen')}
                    onClick={() => deleteMutation.mutate(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
