import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Link2, Unlink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showError, showSuccess } from '@/utils/toast';
import { getAccounts } from '../../services/account-service';
import { getTransactions, markTransferPair, unmarkTransfer } from '../../services/transaction-service';
import { findTransferCandidates, type TransferCandidate } from '../../services/transfer-service';
import type { Transaction } from '../../types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('de-DE');

export function TransferSuggestions() {
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', 'all-for-transfers'],
    queryFn: () => getTransactions(10000),
  });

  const accountName = (id: string | null | undefined) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? `${acc.icon} ${acc.name}` : 'Unbekanntes Konto';
  };

  const candidates = useMemo(() => findTransferCandidates(transactions), [transactions]);

  const linkedPairs = useMemo(() => {
    const pairs: Transaction[][] = [];
    const seen = new Set<string>();
    for (const t of transactions) {
      if (!t.is_transfer || !t.id || seen.has(t.id)) continue;
      const partner = transactions.find((other) => other.id === t.transfer_pair_id);
      seen.add(t.id);
      if (partner?.id) seen.add(partner.id);
      pairs.push(partner ? [t, partner] : [t]);
    }
    return pairs;
  }, [transactions]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
  };

  const markMutation = useMutation({
    mutationFn: (candidate: TransferCandidate) =>
      markTransferPair(candidate.outgoing.id!, candidate.incoming.id!),
    onSuccess: () => {
      invalidate();
      showSuccess('Als interner Transfer markiert');
    },
    onError: (err: Error) => showError(err.message),
  });

  const unmarkMutation = useMutation({
    mutationFn: (transaction: Transaction) => unmarkTransfer(transaction),
    onSuccess: () => {
      invalidate();
      showSuccess('Transfer-Verknüpfung entfernt');
    },
    onError: (err: Error) => showError(err.message),
  });

  if (candidates.length === 0 && linkedPairs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Interne Transfers
        </CardTitle>
        <CardDescription>
          Buchungen, die nur Geld zwischen deinen eigenen Konten verschieben. Als Transfer
          markierte Paare bleiben auf den Konten sichtbar, zählen aber nicht als Einnahme/Ausgabe
          in Auswertungen und Budgets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Vorschläge</p>
            {candidates.map((c) => (
              <div
                key={`${c.outgoing.id}-${c.incoming.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <div>
                    {dateFmt.format(new Date(c.outgoing.date))} · {eur.format(Math.abs(c.outgoing.amount))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {accountName(c.outgoing.account_id)} → {accountName(c.incoming.account_id)}
                    {c.daysApart > 0 && ` · ${c.daysApart} Tag(e) Versatz`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markMutation.mutate(c)}
                  disabled={markMutation.isPending}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Als Transfer markieren
                </Button>
              </div>
            ))}
          </div>
        )}

        {linkedPairs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Verknüpfte Transfers</p>
            {linkedPairs.map((pair) => (
              <div
                key={pair[0].id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {dateFmt.format(new Date(pair[0].date))} · {eur.format(Math.abs(pair[0].amount))}
                    <Badge variant="secondary">Transfer</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pair.length === 2
                      ? `${accountName(pair[0].account_id)} ↔ ${accountName(pair[1].account_id)}`
                      : `${accountName(pair[0].account_id)} (Gegenbuchung nicht gefunden)`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unmarkMutation.mutate(pair[0])}
                  disabled={unmarkMutation.isPending}
                  className="text-warning hover:text-warning"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Trennen
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
