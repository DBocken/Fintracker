import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getDebts } from '@/services/debt-service';
import { getBudgets } from '@/services/budget-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { lexicalQuestionMatcher } from '@/lib/question-matcher';
import type { QuestionVocabulary, VokabelEintrag } from '@/lib/question-matcher';
import type { QuestionAnswer, QuestionData, QuestionSlots, SlotName } from '@/lib/question-registry';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';

/** Ein Händler muss mindestens so oft vorkommen, um ins Vokabular zu zählen. */
const MIN_HAENDLER_VORKOMMEN = 2;

export type MoneyQuestionOutcome =
  | { art: 'leer' }
  | { art: 'unverstanden' }
  | { art: 'rueckfrage'; entryId: string; fehlend: SlotName[] }
  | { art: 'antwort'; entryId: string; antwort: QuestionAnswer };

export interface MoneyQuestionsViewModel {
  frage: string;
  setFrage: (text: string) => void;
  /** Ergebnis der zuletzt abgeschickten Frage. */
  ergebnis: MoneyQuestionOutcome;
  absenden: () => void;
  /** Beispielfragen aus dem EIGENEN Bestand — nie erfundene Händler. */
  beispiele: string[];
  hatBestand: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * ViewModel der Fläche „Nachfragen" (WP-D).
 *
 * Es kennt **keine einzige Fachfrage**. Was beantwortbar ist, steht im
 * Register (`questionCatalog`); dieses Hook füllt nur Vokabular, ruft den
 * Matcher und reicht die Antwort durch. Eine neue beantwortbare Frage ist
 * deshalb ein neuer Registereintrag — diese Datei wird dabei nicht angefasst.
 * Ein Test beweist genau das (`use-money-questions.test.ts`).
 */
export function useMoneyQuestions(jetzt: Date = new Date()): MoneyQuestionsViewModel {
  const { t, locale } = useI18n();
  const [frage, setFrage] = useState('');
  const [ergebnis, setErgebnis] = useState<MoneyQuestionOutcome>({ art: 'leer' });

  const transaktionen = useQuery({
    queryKey: financeKeys.transactions(FINANCE_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(FINANCE_TRANSACTION_LIMIT),
  });
  const kategorien = useQuery({ queryKey: financeKeys.categories, queryFn: getCategories });
  const konten = useQuery({ queryKey: financeKeys.accounts, queryFn: getAccounts });
  const schulden = useQuery({ queryKey: ['debts'], queryFn: getDebts });
  const budgets = useQuery({ queryKey: ['budgets'], queryFn: getBudgets });
  const vertragsentscheidungen = useQuery({
    queryKey: financeKeys.contractDecisions,
    queryFn: getContractDecisionMap,
  });

  const abfragen = [transaktionen, kategorien, konten, schulden, budgets, vertragsentscheidungen];
  // Fehlerfall ausdrücklich: Eine Antwort aus halben Daten nennt eine Zahl,
  // die nichts belegt — und eine falsche Zahl ist hier schlimmer als keine.
  const isError = abfragen.some((q) => q.isError);
  const isLoading = abfragen.some((q) => q.isLoading);

  const daten: QuestionData = useMemo(
    () => ({
      transactions: transaktionen.data ?? [],
      categories: kategorien.data ?? [],
      accounts: konten.data ?? [],
      debts: schulden.data ?? [],
      budgets: budgets.data ?? [],
      contractDecisions: vertragsentscheidungen.data ?? new Map(),
      jetzt,
    }),
    [
      transaktionen.data,
      kategorien.data,
      konten.data,
      schulden.data,
      budgets.data,
      vertragsentscheidungen.data,
      jetzt,
    ],
  );

  const vokabular: QuestionVocabulary = useMemo(() => {
    // Händler aus dem EIGENEN Bestand, ab zwei Vorkommen. Ohne die Schwelle
    // landete jeder Einmalempfänger im Vokabular und machte jeden Tippfehler
    // zu einem vermeintlichen Treffer.
    const zaehler = new Map<string, number>();
    for (const t of transaktionen.data ?? []) {
      if (t.is_transfer) continue;
      const name = normalizeMerchantName(t.payee) || (t.payee || '').toLowerCase().trim();
      if (!name) continue;
      zaehler.set(name, (zaehler.get(name) ?? 0) + 1);
    }
    const haendler: VokabelEintrag[] = [...zaehler.entries()]
      .filter(([, n]) => n >= MIN_HAENDLER_VORKOMMEN)
      .map(([name]) => ({ wort: name, wert: name }));

    return {
      kategorien: (kategorien.data ?? []).map((c) => ({ wort: c.name.toLowerCase(), wert: c.id })),
      konten: (konten.data ?? []).map((a) => ({ wort: a.name.toLowerCase(), wert: a.id })),
      haendler,
      // Auslösewörter stehen als i18n-Keys im Eintrag; die WÖRTER holt erst
      // die Anwendungsschicht aus dem Sprachbaum — sonst wäre jeder Eintrag
      // einsprachig.
      ausloeser: new Map(
        questionCatalog.entries.map((entry) => [
          entry.id,
          entry.ausloeser.flatMap((key) => {
            const text = t(key);
            // Ein nicht aufgelöster Key rendert den rohen Punkt-String — der
            // darf nicht als Auslösewort durchgehen.
            return text === key ? [] : text.split(/\s+/).filter(Boolean);
          }),
        ]),
      ),
    };
    // `locale` in den Abhängigkeiten, weil `t()` die Auslösewörter je Sprache
    // anders auflöst — ohne sie bliebe das Vokabular beim Sprachwechsel
    // eingefroren (dieselbe Falle wie `t()` in einer Modul-Konstanten,
    // AGENTS.md §6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaktionen.data, kategorien.data, konten.data, locale, t]);

  const beispiele = useMemo(() => {
    const ersterHaendler = vokabular.haendler[0]?.wort;
    return ersterHaendler
      ? [t('financeQuestions.exampleMerchant').replace('{haendler}', ersterHaendler)]
      : [];
  }, [vokabular.haendler, t]);

  const absenden = () => {
    if (!frage.trim()) {
      setErgebnis({ art: 'leer' });
      return;
    }

    const kandidaten = lexicalQuestionMatcher.match(
      frage,
      vokabular,
      questionCatalog.entries,
      locale,
      jetzt,
    );
    const beste = kandidaten[0];

    if (!beste) {
      setErgebnis({ art: 'unverstanden' });
      return;
    }
    if (beste.fehlend.length > 0) {
      // Nicht raten, sondern nachfragen — eine falsche Zahl ist schlimmer
      // als keine.
      setErgebnis({ art: 'rueckfrage', entryId: beste.entryId, fehlend: beste.fehlend });
      return;
    }

    const entry = questionCatalog.byId(beste.entryId);
    if (!entry) {
      setErgebnis({ art: 'unverstanden' });
      return;
    }

    setErgebnis({
      art: 'antwort',
      entryId: entry.id,
      antwort: entry.antwort(beste.slots as QuestionSlots, daten),
    });
  };

  return {
    frage,
    setFrage,
    ergebnis,
    absenden,
    beispiele,
    hatBestand: (transaktionen.data ?? []).length > 0,
    isLoading,
    isError,
    refetch: () => abfragen.forEach((q) => q.refetch()),
  };
}
