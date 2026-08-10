import { useState } from 'react';
import InteractiveCard from '@/features/shared/presentation/InteractiveCard';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import { taxCategoryById } from '@/data/tax-catalog';
import type { EuerLine } from '@/lib/euer-report';
import type { Category } from '@/types';

interface Props {
  titleKey: string;
  titleFallback: string;
  /** Summe der Kopfzeile (Einnahmen: total; Ausgaben: deductibleTotal). */
  total: number;
  lines: EuerLine[];
  categories: Category[];
  /** Abziehbar-Anteil zeigen, wenn er vom Netto abweicht (Bewirtung 70 %). */
  showDeductible?: boolean;
  onOpenTransaction?: (id: string) => void;
}

/** Akkordeon-Karte für die EÜR-Zeilen einer Seite (Einnahmen bzw. Ausgaben). */
export function EuerLinesCard({
  titleKey,
  titleFallback,
  total,
  lines,
  categories,
  showDeductible,
  onOpenTransaction,
}: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const byId = new Map(categories.map((c) => [c.id, c.name]));

  const labelFor = (line: EuerLine): string => {
    if (line.key.startsWith('cat:')) {
      return byId.get(line.key.slice(4)) ?? t('euer.export.unknownCategory', 'Ohne Kategorie');
    }
    const cat = taxCategoryById.get(line.key);
    return cat ? t(cat.nameKey, line.key) : line.key;
  };

  const panelId = `euer-lines-${titleKey.replace(/\W/g, '-')}`;

  return (
    <div>
      <InteractiveCard expanded={expanded} onClick={() => setExpanded((e) => !e)} aria-controls={panelId}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{t(titleKey, titleFallback)}</span>
          <span className="tabular-nums font-semibold">{formatCurrency(total)}</span>
        </div>
      </InteractiveCard>

      {expanded && (
        <div id={panelId} className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          {lines.map((line) => (
            <div key={line.key} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate">{labelFor(line)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t('euer.page.lineCount', '{count} Buchungen').replace('{count}', String(line.txCount))}
                  {showDeductible && line.deductible !== line.net && (
                    <>
                      {' · '}
                      {t('euer.page.deductibleOf', '{deductible} von {net} abziehbar')
                        .replace('{deductible}', formatCurrency(line.deductible))
                        .replace('{net}', formatCurrency(line.net))}
                    </>
                  )}
                </p>
                {onOpenTransaction && line.transactionIds.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-brand underline underline-offset-2"
                    onClick={() => onOpenTransaction(line.transactionIds[0])}
                  >
                    {t('euer.page.openTransaction', 'Buchung ansehen')}
                  </button>
                )}
              </div>
              <span className="shrink-0 tabular-nums">{formatCurrency(line.net)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
