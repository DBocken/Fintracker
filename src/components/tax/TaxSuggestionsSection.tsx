import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, X } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { Category, Transaction } from '@/types';
import { updateTransaction } from '@/services/transaction-service';
import {
  getAutomationSuggestions,
  upsertAutomationSuggestion,
  type AutomationSuggestion,
} from '@/services/automation-suggestion-service';
import { buildPendingTaxSuggestions } from '@/lib/tax-suggestions';
import { suggestionConfidenceLevel } from '@/lib/automation-suggestions';
import { getAccounts } from '@/services/account-service';
import { useBusinessMode } from '@/hooks/useBusinessMode';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onOpenTransaction?: (id: string) => void;
}

export function TaxSuggestionsSection({ transactions, categories, onOpenTransaction }: Props) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const businessMode = useBusinessMode();

  const { data: decided = [] } = useQuery({
    queryKey: ['automationSuggestions'],
    queryFn: getAutomationSuggestions,
  });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  // EÜR-Blätter nur im Business-Modus und nur auf Geschäftskonten vorschlagen.
  const businessAccountIds = useMemo(
    () => (businessMode ? new Set(accounts.filter((a) => a.is_business).map((a) => a.id)) : undefined),
    [businessMode, accounts],
  );

  const pending = useMemo(
    () => buildPendingTaxSuggestions(transactions, categories, decided, 50, businessAccountIds),
    [transactions, categories, decided, businessAccountIds],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['automationSuggestions'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const acceptMutation = useMutation({
    mutationFn: async (s: AutomationSuggestion) => {
      const taxId = (s.proposedChange as { tax_category_id?: string | null }).tax_category_id ?? null;
      if (taxId && s.entityId) {
        await updateTransaction([{ id: s.entityId, tax_category_id: taxId }]);
      }
      await upsertAutomationSuggestion({ ...s, status: 'accepted' });
    },
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: async (s: AutomationSuggestion) => {
      await upsertAutomationSuggestion({ ...s, status: 'rejected' });
    },
    onSuccess: invalidate,
  });

  // Sichere Vorschläge (hohe Konfidenz + eindeutige Ziel-Rubrik) für die
  // Sammel-Übernahme. Ein Batch-Write statt n Einzel-Writes.
  const safePending = pending.filter(
    (s) => s.confidence >= 0.85 && Boolean((s.proposedChange as { tax_category_id?: string | null }).tax_category_id) && s.entityId,
  );

  const bulkAcceptMutation = useMutation({
    mutationFn: async () => {
      await updateTransaction(
        safePending.map((s) => ({
          id: s.entityId,
          tax_category_id: (s.proposedChange as { tax_category_id?: string | null }).tax_category_id as string,
        })),
      );
      for (const s of safePending) {
        await upsertAutomationSuggestion({ ...s, status: 'accepted' });
      }
    },
    onSuccess: invalidate,
  });

  if (pending.length === 0) return null;

  const confidenceLabel = (level: 'hoch' | 'mittel' | 'niedrig') =>
    ({
      hoch: t('transactionDetails.confidenceLevelHigh', 'Hohe Sicherheit'),
      mittel: t('transactionDetails.confidenceLevelMedium', 'Mittlere Sicherheit'),
      niedrig: t('transactionDetails.confidenceLevelLow', 'Niedrige Sicherheit'),
    })[level];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('tax.page.suggestionsTitle', 'Vorschläge prüfen')}</h2>
        {safePending.length >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkAcceptMutation.isPending}
            onClick={() => bulkAcceptMutation.mutate()}
          >
            <Check className="mr-1 h-4 w-4" aria-hidden="true" />
            {t('tax.form.applyAllSafe', 'Alle sicheren übernehmen ({count})').replace('{count}', String(safePending.length))}
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {pending.map((s) => {
          const hasTarget = Boolean((s.proposedChange as { tax_category_id?: string | null }).tax_category_id);
          return (
            <li key={s.id} className="rounded-lg border border-brand/40 bg-brand/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {confidenceLabel(suggestionConfidenceLevel(s.confidence))}
                    {s.reasons[0] ? ` · ${s.reasons[0]}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {hasTarget ? (
                  <Button type="button" size="sm" disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate(s)}>
                    <Check className="mr-1 h-4 w-4" aria-hidden="true" /> {t('tax.form.applySuggestion', 'Übernehmen')}
                  </Button>
                ) : (
                  onOpenTransaction &&
                  s.entityId && (
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenTransaction(s.entityId)}>
                      {t('tax.form.selectPlaceholder', 'Steuer-Rubrik wählen …')}
                    </Button>
                  )
                )}
                <Button type="button" size="sm" variant="ghost" disabled={dismissMutation.isPending} onClick={() => dismissMutation.mutate(s)}>
                  <X className="mr-1 h-4 w-4" aria-hidden="true" /> {t('tax.form.dismissSuggestion', 'Ablehnen')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
