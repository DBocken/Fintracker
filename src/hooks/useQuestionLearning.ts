import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearQuestionConfirmations,
  getQuestionConfirmations,
} from '@/services/question-confirmation-service';

/**
 * Datenanbindung des Lernschleifen-Rechenschaftsblocks (WP-F.5) — im Hook und
 * nicht in der Komponente, weil `check:view-data` eine Ratsche ist und die
 * Darstellung ihre Datenschicht nicht selbst sein soll (AGENTS.md §3/§4).
 */
export function useQuestionLearning() {
  const queryClient = useQueryClient();
  const bestaetigungen = useQuery({
    queryKey: ['question-confirmations'],
    queryFn: getQuestionConfirmations,
  });
  const loeschen = useMutation({
    mutationFn: clearQuestionConfirmations,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question-confirmations'] }),
  });

  return {
    anzahl: bestaetigungen.data?.length ?? 0,
    isError: bestaetigungen.isError,
    loeschen: () => loeschen.mutate(),
    loeschenLaeuft: loeschen.isPending,
  };
}
