import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/services/transaction-service';
import { buildLumpyRiskProfile, type LumpyRiskProfile } from '@/lib/finrisk/lumpy-risk';

/**
 * Leitet das Lumpy-Risikoprofil aus der lokalen Transaktionshistorie ab
 * (Frequency-Severity seltener Großausgaben). Reine lokale Berechnung – die
 * Transaktionen verlassen das Gerät nicht.
 */
export function useLumpyRisk(): {
  lumpy: LumpyRiskProfile | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['transactions', 'lumpy-risk'],
    queryFn: () => getTransactions(5000),
    staleTime: 5 * 60 * 1000,
  });

  const lumpy = useMemo(
    () => (query.data ? buildLumpyRiskProfile(query.data) : null),
    [query.data],
  );

  // WP-9.6: `lumpy: null` bedeutet sonst zweierlei — „keine Großausgaben
  // gefunden" und „nicht geladen". Der Hook stellt nichts dar (AGENTS.md §3),
  // also reicht er den Unterschied weiter, statt ihn einzuebnen.
  return {
    lumpy,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
