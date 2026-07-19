import { useMemo } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Transaction } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { useSpecialCategoriesOverview } from '../../application/use-special-categories-overview';
import { AssignmentPicker } from './AssignmentPicker';

interface TransactionOccasionsProps {
  transaction: Transaction;
  className?: string;
}

/**
 * Anlass-Zuordnung im Buchungsdetail: zeigt die Anlässe, denen diese Buchung
 * bereits zugeordnet ist (mit Entfernen), und darunter den {@link AssignmentPicker}
 * zum Hinzufügen. Self-contained (eigener Hook) — als Lazy-Widget hinter der
 * Detail-Interaktion gemountet, teilt sich aber den Finance-Query-Cache.
 */
export function TransactionOccasions({ transaction, className }: TransactionOccasionsProps) {
  const { t } = useI18n();
  const model = useSpecialCategoriesOverview();

  // Bereits zugeordnete Anlässe dieser Buchung (Anlass-Name + Zuordnungs-ID).
  const assigned = useMemo(() => {
    const out: { assignmentId: string; eventId: string; name: string }[] = [];
    for (const [eventId, list] of model.assignmentsByEvent) {
      for (const a of list) {
        if (a.transaction_id === transaction.id) {
          out.push({ assignmentId: a.id, eventId, name: model.byId.get(eventId)?.name ?? eventId });
        }
      }
    }
    return out;
  }, [model.assignmentsByEvent, model.byId, transaction.id]);

  const handleUnassign = async (assignmentId: string) => {
    try {
      await model.actions.unassign(assignmentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('specialCategories.service.notFound'));
    }
  };

  if (model.loading) return null;

  return (
    <div className={cn('space-y-3 border-t pt-3', className)}>
      {assigned.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{t('specialCategories.assignedTitle')}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {assigned.map((a) => (
              <li key={a.assignmentId}>
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                  {a.name}
                  <button
                    type="button"
                    onClick={() => handleUnassign(a.assignmentId)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`${t('specialCategories.unassign')}: ${a.name}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AssignmentPicker transaction={transaction} model={model} />
    </div>
  );
}

export default TransactionOccasions;
