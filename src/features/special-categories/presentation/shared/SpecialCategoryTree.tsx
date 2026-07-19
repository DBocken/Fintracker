import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import type { SpecialCategoryTreeNode } from '../../application/special-categories-view-model';
import { EventTotalAmount } from './EventTotalAmount';

interface SpecialCategoryTreeProps {
  nodes: SpecialCategoryTreeNode[];
  /** Anzahl Vorschläge je Anlass-ID (optional; blendet den Vorschlags-Hinweis ein). */
  suggestionCounts?: Map<string, number>;
  onDelete?: (id: string) => void;
  /** `mobile` = eine große Hauptaussage je Karte; `desktop` = dichter, mit Direktsumme. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Rekursive, auf-/zuklappbare Anlass-Liste. Jede Karte ist als Ganzes klickbar
 * (Disclosure via InteractiveCard, „Karten sind Aktionen"). Die Gesamtsumme
 * (inkl. Unter-Anlässe) zählt hoch (Animations-Baseline). Desktop zeigt zusätzlich
 * die Direktsumme; Mobile bleibt bei einer Hauptaussage pro Karte.
 */
export function SpecialCategoryTree({
  nodes,
  suggestionCounts,
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
        const isOpen = expanded.has(node.id);
        const suggestions = suggestionCounts?.get(node.id) ?? 0;
        return (
          <li key={node.id}>
            <InteractiveCard
              onClick={hasChildren ? () => toggle(node.id) : undefined}
              expanded={hasChildren ? isOpen : undefined}
              indicator={hasChildren ? 'expand' : 'none'}
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
                  {suggestions > 0 ? <> · {suggestions} {t('specialCategories.suggestionsLabel')}</> : null}
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

            {isOpen && hasChildren ? (
              <div className="ml-4 mt-2 border-l pl-3">
                <SpecialCategoryTree
                  nodes={node.children}
                  suggestionCounts={suggestionCounts}
                  onDelete={onDelete}
                  variant={variant}
                />
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
