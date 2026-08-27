/**
 * ViewModel der Depot-Ein- und -Auszahlungen (Welle 4, Nachtrag).
 *
 * Der Zahlungsstrom war gebaut, gespeichert und im Chat ausgewertet — nur
 * konnte ihn niemand ERFASSEN. Damit fiel die geldgewichtete Rendite für
 * jeden Nutzer in ihren „ohne Zahlungen"-Zweig, und die Rechnung war
 * unerreichbar. Genau der Fehler, den dieselbe Welle bei den manuellen
 * Vermögenswerten vermieden und bei der Vermögens-Historie ausdrücklich
 * benannt hat: **Eine Datengrundlage ohne Erzeuger ist keine.**
 *
 * Der Datenzugriff liegt hier und nicht in der Karte (§4,
 * `check:view-data`).
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deletePortfolioCashflow,
  getPortfolioCashflows,
  upsertPortfolioCashflow,
} from '@/services/portfolio-cashflow-service';
import type { PortfolioCashflow } from '@/lib/portfolio-types';
import { geldgewichteteRendite, zahlungsreihe } from '@/lib/money-weighted-return';
import type { RenditeErgebnis } from '@/lib/money-weighted-return';

export const PORTFOLIO_CASHFLOWS_QUERY_KEY = ['portfolio-cashflows'] as const;

export type CashflowRichtung = 'deposit' | 'withdrawal';

export interface CashflowDraft {
  id?: string;
  date: string;
  amount: number | null;
  direction: CashflowRichtung;
}

export function leererCashflowEntwurf(jetzt: Date): CashflowDraft {
  return { date: jetzt.toISOString().slice(0, 10), amount: null, direction: 'deposit' };
}

export function usePortfolioCashflows(
  portfolioId: string | undefined,
  marktwert: number,
  jetzt: Date = new Date(),
) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CashflowDraft | null>(null);

  const {
    data: zahlungen,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...PORTFOLIO_CASHFLOWS_QUERY_KEY, portfolioId],
    queryFn: () => getPortfolioCashflows(portfolioId),
    enabled: Boolean(portfolioId),
  });

  const speichern = useMutation({
    mutationFn: (entwurf: CashflowDraft) =>
      upsertPortfolioCashflow({
        id: entwurf.id,
        portfolio_id: portfolioId ?? '',
        date: entwurf.date,
        amount: entwurf.amount ?? 0,
        direction: entwurf.direction,
      }),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_CASHFLOWS_QUERY_KEY });
      // Die Aufstellung hängt nicht daran, die Rendite-Antwort des Chats schon:
      // Sie liest den Zahlungsstrom im Depot-Kanal mit.
      void queryClient.invalidateQueries({ queryKey: ['portfolios', 'mit-positionen'] });
    },
  });

  const loeschen = useMutation({
    mutationFn: (id: string) => deletePortfolioCashflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_CASHFLOWS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['portfolios', 'mit-positionen'] });
    },
  });

  const liste: PortfolioCashflow[] = useMemo(() => zahlungen ?? [], [zahlungen]);

  /**
   * Dieselbe Rechnung wie im Chat — über dieselbe reine Funktion, nicht über
   * eine zweite Fassung daneben. Zwei Wege zu einer Rendite wären zwei Orte,
   * an denen sie auseinanderlaufen kann.
   */
  const rendite: RenditeErgebnis = useMemo(
    () => geldgewichteteRendite(zahlungsreihe(liste, marktwert, jetzt.toISOString().slice(0, 10))),
    [liste, marktwert, jetzt],
  );

  const summe = (richtung: CashflowRichtung) =>
    liste.filter((c) => c.direction === richtung).reduce((s, c) => s + Math.abs(c.amount), 0);

  return {
    zeilen: liste,
    eingezahlt: summe('deposit'),
    entnommen: summe('withdrawal'),
    rendite,
    isLoading,
    isError,
    refetch,
    draft,
    entwurfOeffnen: (zeile?: PortfolioCashflow) =>
      setDraft(
        zeile
          ? { id: zeile.id, date: zeile.date, amount: zeile.amount, direction: zeile.direction }
          : leererCashflowEntwurf(jetzt),
      ),
    entwurfAendern: (teil: Partial<CashflowDraft>) =>
      setDraft((bisher) => (bisher ? { ...bisher, ...teil } : bisher)),
    entwurfSchliessen: () => setDraft(null),
    speichern: (entwurf: CashflowDraft) => speichern.mutate(entwurf),
    speichertGerade: speichern.isPending,
    loeschen: (id: string) => loeschen.mutate(id),
  };
}
