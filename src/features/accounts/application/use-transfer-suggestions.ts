/**
 * ViewModel der Uebertrags-Vorschlaege (WP 6.5a, ARCH-1).
 *
 * `components/accounts/TransferSuggestions.tsx` hielt bis hierher zwei
 * Abfragen und zwei Mutationen selbst. Sie liegen jetzt hier; die Darstellung
 * bekommt fertige Zeilen mit Kontonamen und rohem Betrag — formatiert wird
 * oben (Geldmaskierung ist eine Anzeigeentscheidung, keine fachliche).
 */

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/lib/transaction-types';
import { showError, showSuccess } from '@/utils/toast';
import { getAccounts } from '@/services/account-service';
import {
  getTransactions,
  markTransferPair,
  unmarkTransfer,
} from '@/services/transaction-service';
import { findTransferCandidates, type TransferCandidate } from '@/services/transfer-service';

import { accountQueryKeys } from '../data/account-query-keys';
import { collectLinkedTransferPairs } from '../domain/transfer-pairs';

/** Wieviel Bestand die Uebertrags-Erkennung ansieht. */
const TRANSFER_SCAN_LIMIT = 10000;

export interface TransferCandidateRow {
  key: string;
  date: string;
  /** Rohbetrag der Abbuchung — Formatierung bleibt Sache der Darstellung. */
  amount: number;
  daysApart: number;
  fromLabel: string;
  toLabel: string;
}

export interface LinkedTransferRow {
  key: string;
  date: string;
  amount: number;
  fromLabel: string;
  /** `null`, wenn die Gegenbuchung nicht im Bestand steht. */
  toLabel: string | null;
}

export interface TransferSuggestionsModel {
  candidates: TransferCandidateRow[];
  linked: LinkedTransferRow[];
  hasLoadError: boolean;
  retryAll: () => void;
  /**
   * Es gibt nichts anzuzeigen. Bewusst FALSCH bei einem Lesefehler: Sonst
   * verschwaende die Karte lautlos, und der Nutzer haette den Eindruck, es
   * gaebe keine Uebertraege zu verknuepfen.
   */
  isEmpty: boolean;
  markAsTransfer: (key: string) => void;
  unlink: (key: string) => void;
  isMarking: boolean;
  isUnlinking: boolean;
}

export function useTransferSuggestions(): TransferSuggestionsModel {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: accountQueryKeys.accounts,
    queryFn: getAccounts,
  });

  const {
    data: transactions = [],
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: accountQueryKeys.transactionsForTransfers,
    queryFn: () => getTransactions(TRANSFER_SCAN_LIMIT),
  });

  const accountLabel = useCallback(
    (id: string | null | undefined) => {
      const account = accounts.find((a) => a.id === id);
      return account
        ? `${account.icon} ${account.name}`
        : t('accounts.transferSuggestions.unknownAccount');
    },
    [accounts, t],
  );

  const candidateByKey = useMemo(() => {
    const map = new Map<string, TransferCandidate>();
    for (const candidate of findTransferCandidates(transactions)) {
      map.set(`${candidate.outgoing.id}-${candidate.incoming.id}`, candidate);
    }
    return map;
  }, [transactions]);

  const linkedPairs = useMemo(() => collectLinkedTransferPairs(transactions), [transactions]);

  const transactionByKey = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const pair of linkedPairs) map.set(String(pair[0].id), pair[0]);
    return map;
  }, [linkedPairs]);

  const candidates = useMemo<TransferCandidateRow[]>(
    () =>
      [...candidateByKey.entries()].map(([key, candidate]) => ({
        key,
        date: candidate.outgoing.date,
        amount: candidate.outgoing.amount,
        daysApart: candidate.daysApart,
        fromLabel: accountLabel(candidate.outgoing.account_id),
        toLabel: accountLabel(candidate.incoming.account_id),
      })),
    [accountLabel, candidateByKey],
  );

  const linked = useMemo<LinkedTransferRow[]>(
    () =>
      linkedPairs.map((pair) => ({
        key: String(pair[0].id),
        date: pair[0].date,
        amount: pair[0].amount,
        fromLabel: accountLabel(pair[0].account_id),
        toLabel: pair.length === 2 ? accountLabel(pair[1].account_id) : null,
      })),
    [accountLabel, linkedPairs],
  );

  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: accountQueryKeys.transactions });
  };

  const markMutation = useMutation({
    mutationFn: (candidate: TransferCandidate) =>
      markTransferPair(candidate.outgoing.id!, candidate.incoming.id!),
    onSuccess: () => {
      invalidateTransactions();
      showSuccess(t('accounts.transferSuggestions.markSuccess'));
    },
    onError: (error: Error) => showError(error.message),
  });

  const unmarkMutation = useMutation({
    mutationFn: (transaction: Transaction) => unmarkTransfer(transaction),
    onSuccess: () => {
      invalidateTransactions();
      showSuccess(t('accounts.transferSuggestions.unlinkSuccess'));
    },
    onError: (error: Error) => showError(error.message),
  });

  const hasLoadError = accountsError || transactionsError;

  return {
    candidates,
    linked,
    hasLoadError,
    retryAll: () => {
      void refetchAccounts();
      void refetchTransactions();
    },
    isEmpty: !hasLoadError && candidates.length === 0 && linked.length === 0,
    markAsTransfer: (key) => {
      const candidate = candidateByKey.get(key);
      if (candidate) markMutation.mutate(candidate);
    },
    unlink: (key) => {
      const transaction = transactionByKey.get(key);
      if (transaction) unmarkMutation.mutate(transaction);
    },
    isMarking: markMutation.isPending,
    isUnlinking: unmarkMutation.isPending,
  };
}
