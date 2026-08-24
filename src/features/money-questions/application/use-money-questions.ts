import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getDebts } from '@/services/debt-service';
import { getBudgets } from '@/services/budget-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';
import { getMerchantRules } from '@/services/merchant-rules-service';
import { useCategoryModel } from '@/hooks/useCategoryModel';
import { resolveKategorieAusText } from '@/lib/question-category-resolution';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { routeFrage, zerlegeAusloeser } from '@/lib/question-matcher';
import { predictIntent, trainIntentModel } from '@/lib/question-intent-model';
import { intentBeispieleFuer } from '@/features/money-questions/data/paraphrases';
import {
  addQuestionConfirmation,
  getQuestionConfirmations,
} from '@/services/question-confirmation-service';
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
  | {
      /**
       * Zwei oder mehr Deutungen liegen zu dicht beieinander (Marge-Gate in
       * `entscheideRouting`). Statt zu raten, wählt der Nutzer — jeder
       * Kandidat behält die Slots, die für IHN erkannt wurden.
       */
      art: 'kandidaten';
      kandidaten: { entryId: string; slots: QuestionSlots; erschlossen: SlotName[] }[];
      /** Reine Stufe-2-Vermutung: die Fläche sagt „nicht verstanden" dazu. */
      nurVermutung?: boolean;
    }
  | {
      art: 'antwort';
      entryId: string;
      antwort: QuestionAnswer;
      /**
       * Erschlossene Kategorie, die NICHT wörtlich gefragt war („essen" →
       * „Essen & Trinken"). Wird benannt und ist korrigierbar — sonst wäre
       * die Zuordnung eine stille Behauptung.
       */
      erschlosseneKategorie?: { label: string; alternativen: SlotVorschlag[] };
    };

export interface MoneyQuestionsViewModel {
  frage: string;
  setFrage: (text: string) => void;
  /** Ergebnis der zuletzt abgeschickten Frage. */
  ergebnis: MoneyQuestionOutcome;
  absenden: () => void;
  /** Beantwortet eine Rückfrage, indem der gewählte Kandidat den Slot füllt. */
  waehleVorschlag: (vorschlag: SlotVorschlag) => void;
  /** Löst eine Kandidaten-Auswahl auf — derselbe Weg wie eine erkannte Frage. */
  waehleKandidat: (kandidat: { entryId: string; slots: QuestionSlots; erschlossen: SlotName[] }) => void;
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
  const regeln = useQuery({ queryKey: ['merchant-rules'], queryFn: getMerchantRules });
  // Bestätigte Zuordnungen (WP-F.5): Fehler hier sind bewusst folgenlos —
  // ohne sie läuft der Router mit den kuratierten Paraphrasen weiter, deshalb
  // kein eigener Fehlerzustand (throwOnError bleibt aus, die Liste ist leer).
  const bestaetigungen = useQuery({
    queryKey: ['question-confirmations'],
    queryFn: getQuestionConfirmations,
    // Ein Lesefehler lässt den Router mit dem kuratierten Korpus weiterlaufen.
    retry: false,
  });

  // Dasselbe gelernte Modell, das die Kategorisierung benutzt — damit kennt
  // die Chat-Erkennung auch Händler, die in keinem Katalog stehen.
  const modellKontext = useCategoryModel();

  const abfragen = [transaktionen, kategorien, konten, schulden, budgets, vertragsentscheidungen, regeln];
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

    // Der zweite Weg zur Kategorie — abstrakte Begriffe über dieselbe Engine,
    // die auch Buchungen kategorisiert. Ohne ihn scheitert „für essen" an
    // einer Kategorie, die „Essen & Trinken" heisst.
    const kategorieAusText = (text: string) => {
      const treffer = resolveKategorieAusText(
        text,
        [...(kategorien.data ?? [])],
        [...(regeln.data ?? [])],
        modellKontext,
      );
      return treffer ? { categoryId: treffer.categoryId, confidence: treffer.confidence } : null;
    };

    // Ein nicht aufgelöster Key rendert den rohen Punkt-String — der darf
    // nicht als Auslösewort durchgehen. Getrennt wird am KOMMA (Phrasen,
    // keine Token-Beutel) — über `zerlegeAusloeser`, damit der Eval-Korpus
    // exakt dieselbe Zerlegung benutzt statt einer Nachbildung.
    const loeseWorte = (keys: readonly string[]): string[] =>
      keys.flatMap((key) => {
        const text = t(key);
        return text === key ? [] : zerlegeAusloeser(text);
      });

    return {
      kategorieAusText,
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
        questionCatalog.entries.map((entry) => [entry.id, loeseWorte(entry.ausloeser)]),
      ),
      verstaerker: new Map(
        questionCatalog.entries.map((entry) => [entry.id, loeseWorte(entry.verstaerker ?? [])]),
      ),
    };
    // `locale` in den Abhängigkeiten, weil `t()` die Auslösewörter je Sprache
    // anders auflöst — ohne sie bliebe das Vokabular beim Sprachwechsel
    // eingefroren (dieselbe Falle wie `t()` in einer Modul-Konstanten,
    // AGENTS.md §6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaktionen.data, kategorien.data, konten.data, regeln.data, modellKontext, locale, t]);

  // Stufe 2 des Routers: kuratierte Paraphrasen der aktiven Sprache PLUS die
  // eigenen bestätigten Zuordnungen — mit Gewicht 3, dieselbe Abstufung wie
  // die Händlerregeln im Kategorienmodell: Eine ausdrückliche Entscheidung
  // wiegt schwerer als ein kuratiertes Beispiel. Abgeleitet in Millisekunden,
  // nicht persistiert.
  const intentModel = useMemo(
    () =>
      trainIntentModel([
        ...intentBeispieleFuer(locale),
        ...(bestaetigungen.data ?? []).map((b) => ({
          klasse: b.entry_id,
          text: b.text,
          gewicht: 3,
        })),
      ]),
    [locale, bestaetigungen.data],
  );

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
  const aufloesen = (entryId: string, slots: QuestionSlots, erschlossen: SlotName[] = []): void => {
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

    // Eine erschlossene Kategorie wird BENANNT und bleibt korrigierbar: Sie
    // stand nicht im Text, sie wurde geschlossen. Ohne den Hinweis wäre sie
    // eine stille Behauptung, und wer „für essen" meinte, aber „Restaurant"
    // bekam, merkte es nie.
    const erschlosseneKategorie =
      erschlossen.includes('kategorie') && slots.kategorieId
        ? {
            label:
              vokabular.kategorien.find((k) => k.wert === slots.kategorieId)?.label ??
              slots.kategorieId,
            alternativen: vorschlaegeFuer('kategorie').filter((v) => v.wert !== slots.kategorieId),
          }
        : undefined;

    setErgebnis({
      art: 'antwort',
      entryId,
      antwort: entry.antwort(slots, daten),
      erschlosseneKategorie,
    });
  };

  const absenden = () => {
    if (!frage.trim()) {
      setErgebnis({ art: 'leer' });
      return;
    }

    // Beide Router-Stufen liegen in `routeFrage` — der Eval-Korpus misst
    // exakt DIESE Funktion, nicht eine Nachbildung. Stufe 2 läuft nur beim
    // Absenden (nicht je Tastendruck) und kostet einstellige Millisekunden.
    const routing = routeFrage(
      frage,
      vokabular,
      questionCatalog.entries,
      locale,
      jetzt,
      predictIntent(intentModel, frage),
    );
    if (routing.art === 'unverstanden') {
      setErgebnis({ art: 'unverstanden' });
      return;
    }
    if (routing.art === 'kandidaten') {
      setErgebnis({
        art: 'kandidaten',
        kandidaten: routing.top.map((k) => ({
          entryId: k.entryId,
          slots: k.slots,
          erschlossen: k.erschlossen,
        })),
        nurVermutung: routing.nurVermutung,
      });
      return;
    }
    aufloesen(routing.kandidat.entryId, routing.kandidat.slots, routing.kandidat.erschlossen);
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

  const queryClient = useQueryClient();
  const lernen = useMutation({
    mutationFn: ({ text, entryId }: { text: string; entryId: string }) =>
      addQuestionConfirmation(text, entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question-confirmations'] }),
  });

  const waehleKandidat = (kandidat: { entryId: string; slots: QuestionSlots; erschlossen: SlotName[] }) => {
    if (ergebnis.art !== 'kandidaten') return;
    // Der Klick IST das Label: Der Nutzer hat gesagt, was seine Frage meint.
    // Gespeichert wird NUR die ausdrückliche Wahl — eine direkt beantwortete
    // Frage lernt nichts (der Router war schon richtig, und die eigene
    // Ausgabe als Trainingsdatum wäre der Selbstbestätigungskreis, den schon
    // das Kategorienmodell meidet). Fehler beim Speichern sind folgenlos.
    lernen.mutate({ text: frage, entryId: kandidat.entryId });
    // Derselbe Weg wie eine direkt erkannte Frage: Fehlt danach ein
    // Pflicht-Slot, folgt die Slot-Rückfrage — keine Abkürzung an der
    // Validierung vorbei.
    aufloesen(kandidat.entryId, kandidat.slots, kandidat.erschlossen);
  };

  return {
    frage,
    setFrage,
    ergebnis,
    absenden,
    waehleVorschlag,
    waehleKandidat,
    beispiele,
    hatBestand: (transaktionen.data ?? []).length > 0,
    isLoading,
    isError,
    refetch: () => abfragen.forEach((q) => q.refetch()),
  };
}
