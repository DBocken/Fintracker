import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSchufareminder,
  getActiveSchufareminder,
  isReminderDue,
  markSchufareminderScanned,
  type SchufareminderState,
} from "@/services/schufa-service";
import { getCurrentUserId } from "@/services/auth-service";

/** Lokaler Single-User-Fallback (local-first, identisch zu receivable-service). */
async function resolveUserId(): Promise<string> {
  return (await getCurrentUserId()) || "local";
}

export interface UseSchufareminder {
  reminder: SchufareminderState | null;
  isLoading: boolean;
  /** Erinnerung gesetzt, aber noch keine Auskunft gescannt. */
  isWaiting: boolean;
  /** Erwartetes Ankunftsdatum überschritten → „Brief da? Scannen". */
  isDue: boolean;
  request: () => void;
  markScanned: () => void;
  isRequesting: boolean;
  isMarking: boolean;
}

/**
 * Geführte SCHUFA-Selbstauskunft (Erklären → Erinnern → Erfassen, Issue #49).
 * Hält den aktiven Erinnerungs-Zustand lokal vor und stellt die zwei Aktionen
 * (anfordern, als gescannt markieren) als Mutationen bereit.
 */
export function useSchufareminder(): UseSchufareminder {
  const queryClient = useQueryClient();

  const { data: reminder = null, isLoading } = useQuery({
    queryKey: ["schufareminder"],
    queryFn: async () => getActiveSchufareminder(await resolveUserId()),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["schufareminder"] });

  const requestMutation = useMutation({
    mutationFn: async () => createSchufareminder(await resolveUserId()),
    onSuccess: invalidate,
  });

  const markScannedMutation = useMutation({
    mutationFn: async () => {
      if (!reminder) return null;
      return markSchufareminderScanned(reminder.id);
    },
    onSuccess: invalidate,
  });

  return {
    reminder,
    isLoading,
    isWaiting: !!reminder && !reminder.scanned,
    isDue: !!reminder && !reminder.scanned && isReminderDue(reminder),
    request: () => requestMutation.mutate(),
    markScanned: () => markScannedMutation.mutate(),
    isRequesting: requestMutation.isPending,
    isMarking: markScannedMutation.isPending,
  };
}
