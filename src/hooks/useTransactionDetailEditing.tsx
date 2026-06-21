import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import type { Transaction } from '@/types';
import { updateTransaction } from '@/services/transaction-service';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import { upsertContractDecision } from '@/services/contract-decision-service';

/**
 * Gemeinsame Logik für das Speichern aus dem Transaktions-Detail-Sheet:
 * familienweite Sammeländerung (optional), dauerhafte Vertrags-Entscheidung und
 * eine Undo-Aktion per Toast. Wird vom Dashboard und der eigenen Buchungsseite
 * geteilt, damit beide identisch funktionieren.
 */
export function useTransactionDetailEditing(allTransactions: Transaction[], onSaved?: () => void) {
  const qc = useQueryClient();

  const restoreMutation = useMutation<void, Error, Array<{ id: string } & Partial<Transaction>>>({
    mutationFn: (snapshots) => updateTransaction(snapshots).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
      toast.success('Änderung rückgängig gemacht');
    },
    onError: (error) => toast.error(`Rückgängig fehlgeschlagen: ${error.message}`),
  });

  const detailsMutation = useMutation<
    { count: number; snapshot: Array<{ id: string } & Partial<Transaction>> },
    Error,
    { id: string; patch: Partial<Transaction>; transaction: Transaction; applyToSimilar: boolean; similarIds: string[] }
  >({
    mutationFn: async ({ id, patch, transaction, applyToSimilar, similarIds }) => {
      const ids = applyToSimilar ? Array.from(new Set([id, ...similarIds])) : [id];
      const byId = new Map(allTransactions.map((t) => [t.id, t]));

      const patchKeys = Object.keys(patch) as (keyof Transaction)[];
      const snapshot = ids.map((tid) => {
        const prev = byId.get(tid);
        const entry: { id: string } & Partial<Transaction> = { id: tid };
        patchKeys.forEach((k) => {
          (entry as Record<string, unknown>)[k] = prev ? prev[k] ?? null : null;
        });
        return entry;
      });

      await updateTransaction(ids.map((tid) => ({ id: tid, ...patch })));

      if (patch.is_contract !== undefined) {
        const fp = merchantFingerprint(transaction);
        const cycle = patch.contract_cycle ?? transaction.contract_cycle ?? null;
        await upsertContractDecision(fp, {
          status: patch.is_contract ? 'active' : 'rejected',
          cycle_override: patch.is_contract ? cycle : null,
        });
      }

      return { count: ids.length, snapshot };
    },
    onSuccess: ({ count, snapshot }) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions', 'contracts'] });
      qc.invalidateQueries({ queryKey: ['contract-decisions'] });
      const msg = count > 1 ? `${count} Buchungen aktualisiert` : 'Transaktion aktualisiert';
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            {msg}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                toast.dismiss(t.id);
                restoreMutation.mutate(snapshot);
              }}
            >
              Rückgängig
            </button>
          </span>
        ),
        { duration: 6000 },
      );
      onSaved?.();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const save = useCallback(
    (
      transaction: Transaction,
      id: string,
      patch: Partial<Transaction>,
      options: { applyToSimilar: boolean; similarIds: string[] },
    ) => {
      detailsMutation.mutate({
        id,
        patch,
        transaction,
        applyToSimilar: options.applyToSimilar,
        similarIds: options.similarIds,
      });
    },
    [detailsMutation],
  );

  return { save, isPending: detailsMutation.isPending };
}
