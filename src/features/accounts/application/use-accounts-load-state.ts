/**
 * Ladezustand des Kontenbestands fuer die Route `/accounts` (WP 6.5a).
 *
 * Die Seite legt zwei Karten uebereinander, die BEIDE denselben Bestand lesen.
 * Scheitert er, ist das EIN Problem — also gehoert die Aussage darueber der
 * Seite und nicht jeder Karte einzeln (WP-9.6,
 * `src/pages/__tests__/AccountsPage.error-state.test.tsx`).
 *
 * Der Zugriff selbst liegt jetzt hier statt in der Seite: Gleicher Query-Key
 * heisst gleicher Cache-Eintrag — es entsteht kein zweiter Ladevorgang
 * (AGENTS.md §4, „keine doppelten Queries").
 */

import { useQuery } from '@tanstack/react-query';

import { getAccounts } from '@/services/account-service';

import { accountQueryKeys } from '../data/account-query-keys';

export interface AccountsLoadState {
  hasLoadError: boolean;
  retry: () => void;
}

export function useAccountsLoadState(): AccountsLoadState {
  const { isError, refetch } = useQuery({
    queryKey: accountQueryKeys.accounts,
    queryFn: getAccounts,
  });

  return {
    hasLoadError: isError,
    retry: () => {
      void refetch();
    },
  };
}
