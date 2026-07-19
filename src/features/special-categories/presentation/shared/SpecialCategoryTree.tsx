import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';
import { cn, formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types';
import type { SpecialCategoryTreeNode } from '../../application/special-categories-view-model';
import { EventTotalAmount } from './EventTotalAmount';

interface SpecialCategoryTreeProps {
  nodes: SpecialCategoryTreeNode[];
  /** Zeitfenster-Vorschläge je Anlass-ID (blendet den Vorschlags-Bereich ein). */
  getSuggestions?: (eventId: string) => Transaction[];
  /** Ordnet eine vorgeschlagene Buchung dem Anlass zu (schließt den Loop). */
  onAssignSuggested?: (eventId: string, transactionId: string) => void;
  onDelete?: (id: string) => void;
  /** `mobile` = eine große Hauptaussage je Karte; `desktop` = dichter, mit Direktsumme. */
  variant?: 'desktop' | 'mobile';
}

/** Wie viele Vorschläge je Anlass maximal inline gezeigt werden. */
const MAX_INLINE_SUGGESTIONS = 5;

/**
 * Rekursive, auf-/zuklappbare Anlass-Liste. Jede Karte ist als Ganzes klickbar
 * (Disclosure via InteractiveCard, „Karten sind Aktionen"). Die Gesamtsumme
 * (inkl. Unter-Anlässe) zählt hoch (Animations-Baseline). Aufgeklappt zeigt der
 * Anlass seine Kind-Anlässe und – falls vorhanden – Zeitfenster-Vorschläge mit
 * Ein-Klick-Zuordnung.
 */
export function SpecialCategoryTree({
  nodes,
  getSuggestions,
  onAssignSuggested,
  onDelete,
  variant = 'desktop',
}: SpecialCategoryTreeProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="space-y-2">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const suggestions = getSuggestions?.(node.id) ?? [];
        const canAssign = suggestions.length > 0 && !!onAssignSuggested;
        const expandable = hasChildren || canAssign;
        const isOpen = expanded.has(node.id);
        return (
          <li key={node.id}>
            <InteractiveCard
              onClick={expandable ? () => toggle(node.id) : undefined}
              expanded={expandable ? isOpen : undefined}
              indicator={expandable ? 'expand' : 'none'}
              aria-label={node.name}
              className={cn('flex items-center justify-between gap-3', variant === 'mobile' ? 'p-4' : 'p-3')}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {node.icon ? <span aria-hidden>{node.icon}</span> : null}
                  <span className="truncate font-medium">{node.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {node.total.transactionCount} {t('specialCategories.transactionsLabel')}
                  {hasChildren ? <> · {node.children.length} {t('specialCategories.childrenLabel')}</> : null}
                  {suggestions.length > 0 ? <> · {suggestions.length} {t('specialCategories.suggestionsLabel')}</> : null}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <EventTotalAmount
                  minor={node.total.subtreeMinor}
                  className={variant === 'mobile' ? 'text-xl font-semibold' : 'text-base font-semibold'}
                />
                {variant === 'desktop' && hasChildren ? (
                  <span className="text-[11px] text-muted-foreground">
                    {t('specialCategories.subtreeLabel')}
                  </span>
                ) : null}
              </div>
            </InteractiveCard>

            {isOpen ? (
              <div className="ml-4 mt-2 space-y-3 border-l pl-3">
                {hasChildren ? (
                  <SpecialCategoryTree
                    nodes={node.children}
                    getSuggestions={getSuggestions}
                    onAssignSuggested={onAssignSuggested}
                    onDelete={onDelete}
                    variant={variant}
                  />
                ) : null}

                {canAssign ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t('specialCategories.suggestionsLabel')}
                    </p>
                    <ul className="space-y-1">
                      {suggestions.slice(0, MAX_INLINE_SUGGESTIONS).map((tx) => (
                        <li key={tx.id}>
                          <button
                            type="button"
                            onClick={() => onAssignSuggested!(node.id, tx.id ?? '')}
                            className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                            aria-label={`${t('specialCategories.assignTitle')}: ${tx.payee}`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Plus className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                              <span className="truncate">{tx.payee}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">{formatCurrency(tx.amount)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {onDelete ? (
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => onDelete(node.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  aria-label={`${t('specialCategories.delete')}: ${node.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('specialCategories.delete')}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default SpecialCategoryTree;
