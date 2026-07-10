import { useEffect, useState } from 'react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { getRubric, taxCategoryById } from '@/data/tax-catalog';
import type { TaxRubricReport, TaxReportWarning } from '@/lib/tax-report';

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** Balken baut sich datengetrieben auf (0 → Ziel), respektiert reduced-motion. */
function useFill(target: number): number {
  const [value, setValue] = useState(REDUCED_MOTION ? target : 0);
  useEffect(() => {
    if (REDUCED_MOTION) {
      setValue(target);
      return;
    }
    const id = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return value;
}

function warningText(w: TaxReportWarning, t: (k: string, f?: string) => string): string {
  const base = t(`tax.warning.${w.kind}`, w.kind);
  return base.replace('{count}', String(w.count ?? 0)).replace('{amount}', formatCurrency(w.amount ?? 0));
}

export function TaxRubricCard({ report, onOpenTransaction }: { report: TaxRubricReport; onOpenTransaction?: (id: string) => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const rubric = getRubric(report.rubricId);
  const utilPct = report.capUtilization !== null ? Math.round(report.capUtilization * 100) : 0;
  const fill = useFill(utilPct);

  // Schwellwertbewusste Statusfarbe des Cap-Balkens (Budget-Ampel-Prinzip).
  const barTone =
    report.capUtilization === null
      ? ''
      : report.capUtilization >= 1
      ? '[&>div]:bg-warning'
      : report.capUtilization >= 0.8
      ? '[&>div]:bg-warning/70'
      : '[&>div]:bg-brand';

  const panelId = `tax-rubric-${report.rubricId}`;

  return (
    <div>
      <InteractiveCard
        expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        aria-controls={panelId}
        className="flex-col items-stretch gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{t(rubric?.nameKey ?? '', report.rubricId)}</span>
              <Badge variant="outline" className="shrink-0 text-[11px]">
                {t(`tax.anlage.${report.anlage}`, report.anlage)}
              </Badge>
            </div>
            {report.credit !== null ? (
              <p className="text-sm text-positive">
                {t('tax.page.creditExact', '20 % von {costs} = {credit} Steuerermäßigung')
                  .replace('{costs}', formatCurrency(report.eligibleCosts))
                  .replace('{credit}', formatCurrency(report.credit))}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{formatCurrency(report.costsTotal)}</p>
            )}
          </div>
        </div>

        {report.capUtilization !== null && report.capCosts !== null && (
          <div className="space-y-1">
            <Progress value={fill} className={cn('h-2', barTone)} />
            {report.capUtilization >= 1 && (
              <p className="text-xs text-warning">{t('tax.page.capReached', 'Höchstbetrag erreicht.').replace('{overflow}', '')}</p>
            )}
          </div>
        )}

        {report.threshold && (
          <p className={cn('text-xs', report.threshold.reached ? 'text-positive' : 'text-muted-foreground')}>
            {report.threshold.reached
              ? t('tax.page.thresholdReached', 'Über dem Arbeitnehmer-Pauschbetrag ({threshold}).').replace(
                  '{threshold}',
                  formatCurrency(report.threshold.value),
                )
              : t('tax.page.thresholdRemaining', 'Noch {remaining} bis über den Pauschbetrag ({threshold}).')
                  .replace('{remaining}', formatCurrency(report.threshold.remaining))
                  .replace('{threshold}', formatCurrency(report.threshold.value))}
          </p>
        )}
      </InteractiveCard>

      {expanded && (
        <div id={panelId} className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          {rubric?.hintKey && <p className="text-xs text-muted-foreground">{t(rubric.hintKey, '')}</p>}

          {report.virtualItems.length > 0 && (
            <dl className="space-y-1">
              {report.virtualItems.map((v) => (
                <div key={v.labelKey} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t(v.labelKey, v.labelKey)}</dt>
                  <dd className="tabular-nums">{formatCurrency(v.amount)}</dd>
                </div>
              ))}
            </dl>
          )}

          {report.byCategory.length > 0 && (
            <dl className="space-y-1">
              {report.byCategory.map((c) => (
                <div key={c.taxCategoryId} className="flex items-center justify-between">
                  <dt className="truncate text-muted-foreground">
                    {t(taxCategoryById.get(c.taxCategoryId)?.nameKey ?? '', c.taxCategoryId)}
                    <span className="ml-1 text-[11px]">({t('tax.page.catCount', '{count} Buchungen').replace('{count}', String(c.txCount))})</span>
                  </dt>
                  <dd className="tabular-nums">{formatCurrency(c.net)}</dd>
                </div>
              ))}
            </dl>
          )}

          {report.warnings
            .filter((w) => w.kind !== 'paramsNotExact')
            .map((w, i) => (
              <p key={`${w.kind}-${i}`} className="flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {warningText(w, t)}
              </p>
            ))}

          {onOpenTransaction && report.transactionIds.length > 0 && (
            <button
              type="button"
              className="text-xs text-brand underline underline-offset-2"
              onClick={() => onOpenTransaction(report.transactionIds[0])}
            >
              {t('tax.page.rubrikenTitle', 'Nach Steuer-Rubrik')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
