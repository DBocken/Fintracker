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
import { fehlendeSlots } from '@/lib/question-registry';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';

/** Ein Händler muss mindestens so oft vorkommen, um ins Vokabular zu zählen. */
const MIN_HAENDLER_VORKOMMEN = 2;

/**
 * Wie viele Kandidaten eine Rückfrage höchstens anbietet.
 *
 * Eine Liste aller vierzig Kategorien ist keine Hilfe, sondern eine zweite
 * Suchaufgabe. Sortiert wird nach Häufigkeit im EIGENEN Bestand — was jemand
 * oft bucht, meint er auch beim Nachfragen am ehesten.
 */
const MAX_VORSCHLAEGE = 8;

/** Ein anklickbarer Kandidat für einen offenen Slot. */
export interface SlotVorschlag {
  slot: SlotName;
  /** Anzeigeform (Kategoriename, Kontoname, Händlername). */
  label: string;
  /** Der Wert, der in den Slot geht — Kategorie-/Konto-ID bzw. Händlername. */
  wert: string;
}

export type MoneyQuestionOutcome =
  | { art: 'leer' }
  | { art: 'unverstanden' }
  | {
      art: 'rueckfrage';
      entryId: string;
      /** Was bereits erkannt wurde — bleibt beim Beantworten der Rückfrage erhalten. */
      slots: QuestionSlots;
      fehlend: SlotName[];
      /**
       * Kandidaten für den ERSTEN offenen Slot. Ohne sie wäre die Rückfrage
       * eine Sackgasse: „Welche Kategorie meinst du?" ist unbeantwortbar, wenn
       * man die Namen der eigenen Kategorien nicht auswendig kennt.
       */
      vorschlaege: SlotVorschlag[];
    }
  | { art: 'antwort'; entryId: string; antwort: QuestionAnswer };

export interface MoneyQuestionsViewModel {
  frage: string;
  setFrage: (text: string) => void;
  /** Ergebnis der zuletzt abgeschickten Frage. */
  ergebnis: MoneyQuestionOutcome;
  absenden: () => void;
  /** Beantwortet eine Rückfrage, indem der gewählte Kandidat den Slot füllt. */
  waehleVorschlag: (vorschlag: SlotVorschlag) => void;
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
      // Häufigster zuerst — das ist zugleich die Reihenfolge der Rückfrage.
      .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
      .map(([name]) => ({ wort: name, wert: name }));

    // Kategorien ebenfalls nach eigener Nutzung sortieren, nicht alphabetisch:
    // Wer nach einer Kategorie gefragt wird, meint am ehesten eine, die er
    // wirklich benutzt.
    const kategorieNutzung = new Map<string, number>();
    for (const buchung of transaktionen.data ?? []) {
      const id = buchung.subcategory_id ?? buchung.category_id;
      if (id) kategorieNutzung.set(id, (kategorieNutzung.get(id) ?? 0) + 1);
    }

    return {
      kategorien: (kategorien.data ?? [])
        .map((c) => ({ wort: c.name.toLowerCase(), wert: c.id, label: c.name }))
        .sort((a, b) => {
          const na = kategorieNutzung.get(a.wert) ?? 0;
          const nb = kategorieNutzung.get(b.wert) ?? 0;
          return nb === na ? a.label.localeCompare(b.label) : nb - na;
        }),
      konten: (konten.data ?? []).map((a) => ({
        wort: a.name.toLowerCase(),
        wert: a.id,
        label: a.name,
      })),
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

  /**
   * Kandidaten für einen offenen Slot — aus dem EIGENEN Vokabular.
   *
   * Für `betrag` und `zeitraum` gibt es bewusst keine: Ein Betrag ist eine
   * freie Zahl, und ein Zeitraum wäre eine zweite, größere Auswahlliste.
   * Beides wird weiterhin als reine Frage gestellt.
   */
  const vorschlaegeFuer = (slot: SlotName): SlotVorschlag[] => {
    const quelle =
      slot === 'kategorie'
        ? vokabular.kategorien
        : slot === 'konto'
          ? vokabular.konten
          : slot === 'haendler'
            ? vokabular.haendler
            : [];
    return quelle
      .slice(0, MAX_VORSCHLAEGE)
      .map((v) => ({ slot, label: v.label ?? v.wort, wert: v.wert }));
  };

  /**
   * Entscheidet zwischen Antwort und Rückfrage — eine Stelle für beide Wege,
   * damit ein per Klick gefüllter Slot exakt dieselbe Prüfung durchläuft wie
   * ein aus dem Text erkannter.
   */
  const aufloesen = (entryId: string, slots: QuestionSlots): void => {
    const entry = questionCatalog.byId(entryId);
    if (!entry) {
      setErgebnis({ art: 'unverstanden' });
      return;
    }

    const fehlend = fehlendeSlots(entry, slots);
    if (fehlend.length > 0) {
      // Nicht raten, sondern nachfragen — eine falsche Zahl ist schlimmer als
      // keine. Und die Rückfrage bringt gleich die Kandidaten mit, sonst wäre
      // sie für jemanden, der seine Kategorienamen nicht auswendig kennt, eine
      // Sackgasse.
      setErgebnis({
        art: 'rueckfrage',
        entryId,
        slots,
        fehlend,
        vorschlaege: vorschlaegeFuer(fehlend[0]),
      });
      return;
    }

    setErgebnis({ art: 'antwort', entryId, antwort: entry.antwort(slots, daten) });
  };

  const absenden = () => {
    if (!frage.trim()) {
      setErgebnis({ art: 'leer' });
      return;
    }

    const [beste] = lexicalQuestionMatcher.match(
      frage,
      vokabular,
      questionCatalog.entries,
      locale,
      jetzt,
    );

    if (!beste) {
      setErgebnis({ art: 'unverstanden' });
      return;
    }
    aufloesen(beste.entryId, beste.slots);
  };

  const waehleVorschlag = (vorschlag: SlotVorschlag) => {
    if (ergebnis.art !== 'rueckfrage') return;
    const ergaenzt: QuestionSlots = { ...ergebnis.slots };
    if (vorschlag.slot === 'kategorie') ergaenzt.kategorieId = vorschlag.wert;
    else if (vorschlag.slot === 'konto') ergaenzt.kontoId = vorschlag.wert;
    else if (vorschlag.slot === 'haendler') ergaenzt.haendler = vorschlag.wert;
    else return;

    // Derselbe Weg wie beim Absenden: Bleibt danach ein Pflicht-Slot offen,
    // wird erneut gefragt statt geraten.
    aufloesen(ergebnis.entryId, ergaenzt);
  };

  return {
    frage,
    setFrage,
    ergebnis,
    absenden,
    waehleVorschlag,
    beispiele,
    hatBestand: (transaktionen.data ?? []).length > 0,
    isLoading,
    isError,
    refetch: () => abfragen.forEach((q) => q.refetch()),
  };
}
