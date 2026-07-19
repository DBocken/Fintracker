import { useMemo } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Transaction } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import type { SpecialCategoriesOverviewViewModel } from '../../application/special-categories-view-model';

interface AssignmentPickerProps {
  transaction: Transaction;
  model: SpecialCategoriesOverviewViewModel;
  onAssigned?: () => void;
  className?: string;
}

/**
 * Ordnet eine Buchung einem Anlass zu. Zeigt alle Anlässe (nach Baumtiefe
 * eingerückt), hebt für diese Buchung passende Vorschläge hervor und
 * deaktiviert bereits zugeordnete Anlässe. Fehler aus den Invarianten-Guards
 * (I2/I3) landen als Toast. Wiederverwendbar: Buchungsdetail (Aside/Sheet),
 * Batch-Flow, Anlass-Seite.
 */
export function AssignmentPicker({ transaction, model, onAssigned, className }: AssignmentPickerProps) {
  const { t } = useI18n();

  // Anlässe, für die genau DIESE Buchung im Zeitfenster vorgeschlagen wird.
  const suggestedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of model.flat) {
      if (model.suggestionsFor(node.id).some((tx) => tx.id === transaction.id)) ids.add(node.id);
    }
    return ids;
  }, [model, transaction.id]);

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [eventId, list] of model.assignmentsByEvent) {
      if (list.some((a) => a.transaction_id === transaction.id)) ids.add(eventId);
    }
    return ids;
  }, [model.assignmentsByEvent, transaction.id]);

  const assign = async (specialCategoryId: string) => {
    try {
      await model.actions.assign({ specialCategoryId, transactionId: transaction.id ?? '' });
      toast.success(t('specialCategories.assigned'));
      onAssigned?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('specialCategories.service.notFound'));
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="text-sm font-medium">{t('specialCategories.assignTitle')}</h3>
      {model.flat.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('specialCategories.assignEmpty')}</p>
      ) : (
        <ul className="space-y-1">
          {model.flat.map((node) => {
            const isAssigned = assignedIds.has(node.id);
            const isSuggested = suggestedIds.has(node.id);
            return (
              <li key={node.id}>
                <button
                  type="button"
                  disabled={isAssigned || model.actions.saving}
                  onClick={() => assign(node.id)}
                  style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm',
                    'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60',
                    isSuggested && !isAssigned ? 'border-brand/60' : 'border-border',
                  )}
                  aria-label={node.name}
                >
                  <span className="flex items-center gap-2 truncate">
                    {node.icon ? <span aria-hidden>{node.icon}</span> : null}
                    <span className="truncate">{node.name}</span>
                  </span>
                  {isAssigned ? (
                    <Check className="h-4 w-4 text-muted-foreground" aria-hidden />
                  ) : isSuggested ? (
                    <span className="inline-flex items-center gap-1 text-xs text-brand">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {t('specialCategories.suggestedBadge')}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AssignmentPicker;
