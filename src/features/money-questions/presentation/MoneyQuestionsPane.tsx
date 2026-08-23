import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircleQuestion, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import FinanceEmptyState from '@/features/shared/presentation/FinanceEmptyState';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import type { Aussage, QuestionAnswer } from '@/lib/question-registry';
import type { MoneyQuestionsViewModel } from '@/features/money-questions/application/use-money-questions';

/**
 * Die Fläche „Nachfragen" (WP-D).
 *
 * Sie enthält **kein einziges `if (frage === …)`**: Was beantwortbar ist,
 * steht im Register. Diese Datei füllt ein Eingabefeld, zeigt das Ergebnis
 * und verlinkt. Ein Test beweist, dass ein neu registrierter Eintrag hier
 * ohne Änderung beantwortet wird.
 *
 * Bewusst kein Karten-Chrome um die Antwort: Sie ist ein Readout, keine
 * Aktion (AGENTS.md §9) — `InfoGroup` statt `InteractiveCard`. Der Deep-Link
 * ist das Bedienelement, und er ist als solches sichtbar.
 */
export function MoneyQuestionsPane({ model }: { model: MoneyQuestionsViewModel }) {
  const { t } = useI18n();

  if (model.isError) {
    return <FinanceErrorState variant="data" onRetry={model.refetch} />;
  }
  if (!model.isLoading && !model.hatBestand) {
    // Leerzustand mit Grund: „noch nichts zu fragen" ist eine ANDERE Aussage
    // als „0 € ausgegeben" — und nur die erste stimmt ohne Buchungen.
    return <FinanceEmptyState variant="no-data" />;
  }

  return (
    <section className="space-y-4" aria-labelledby="money-questions-heading">
      <h2 id="money-questions-heading" className="flex items-center gap-2 text-base font-semibold">
        <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
        {t('financeQuestions.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('financeQuestions.intro')}</p>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          model.absenden();
        }}
      >
        <Input
          value={model.frage}
          onChange={(e) => model.setFrage(e.target.value)}
          aria-label={t('financeQuestions.inputLabel')}
          placeholder={model.beispiele[0] ?? t('financeQuestions.placeholder')}
          className="flex-1"
        />
        <Button type="submit" size="icon" aria-label={t('financeQuestions.submit')}>
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <Ergebnis model={model} />
    </section>
  );
}

function Ergebnis({ model }: { model: MoneyQuestionsViewModel }) {
  const { t } = useI18n();
  const ergebnis = model.ergebnis;

  if (ergebnis.art === 'leer') return null;

  if (ergebnis.art === 'unverstanden') {
    // Kein „Verstanden" plus falscher Zahl. Ein Eingabefeld, das aussieht wie
    // ein Chat, weckt LLM-Erwartungen — die Antwort auf eine unverstandene
    // Frage ist deshalb ausdrücklich eine Rückfrage, keine Behauptung.
    return (
      <InfoGroup title={t('financeQuestions.notUnderstoodTitle')}>
        <p className="text-sm text-muted-foreground">{t('financeQuestions.notUnderstood')}</p>
      </InfoGroup>
    );
  }

  if (ergebnis.art === 'rueckfrage') {
    return (
      <InfoGroup title={t('financeQuestions.needMoreTitle')}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {ergebnis.fehlend.map((slot) => (
            <li key={slot}>{t(`financeQuestions.slot.${slot}`)}</li>
          ))}
        </ul>
      </InfoGroup>
    );
  }

  return <AntwortAnzeige antwort={ergebnis.antwort} />;
}

/**
 * Setzt die Platzhalter einer Register-Aussage ein.
 *
 * `t(key, fallback)` kennt keine Platzhalter-Argumente — im Repo wird
 * durchgehend `.replace('{x}', …)` an der Aufrufstelle benutzt. Statt die
 * Signatur repo-weit zu ändern (147 Aufrufstellen), bleibt das Einsetzen hier
 * lokal und an EINER Stelle.
 *
 * Geldwerte in den Platzhaltern laufen dabei durch `mask`: Ein Betrag in einem
 * Begründungssatz ist derselbe Betrag wie oben in der Zahl, und der Sanfte
 * Modus darf ihn nicht durch die Hintertür wieder sichtbar machen.
 */
function einsetzen(
  aussage: Aussage,
  t: (key: string, fallback?: string) => string,
  geld: (betrag: number) => string,
): string {
  return Object.entries(aussage.params).reduce(
    (text, [name, wert]) =>
      // `split`/`join` statt `replaceAll`: Das Ziel-`lib` der App kennt
      // `String.prototype.replaceAll` nicht, und ein einzelnes `replace`
      // ersetzte nur das erste Vorkommen — ein zweimal genannter Platzhalter
      // bliebe als `{name}` auf dem Bildschirm stehen.
      text.split(`{${name}}`).join(
        GELD_PLATZHALTER.has(name) && typeof wert === 'number' ? geld(wert) : String(wert),
      ),
    t(aussage.key),
  );
}

/** Platzhalter, deren Wert ein Geldbetrag ist — sie müssen maskiert werden. */
const GELD_PLATZHALTER = new Set(['betrag', 'monatlich', 'rest']);

function AntwortAnzeige({ antwort }: { antwort: QuestionAnswer }) {
  const { t } = useI18n();
  const money = useMoneyFormat();

  // Beträge laufen IMMER durch den Sanften Modus. Das Register liefert
  // bewusst eine rohe Zahl (docs/debt-avoidance-recovery.md) — ein einziger
  // unmaskierter Betrag auf dieser Fläche hebt das Versprechen auf.
  const wertText =
    antwort.wert === null
      ? null
      : antwort.art === 'geld'
        ? money.format(antwort.wert)
        : antwort.art === 'quote'
          ? `${Math.round(antwort.wert * 100)} %`
          : String(antwort.wert);

  return (
    <InfoGroup title={t('financeQuestions.answerTitle')}>
      {wertText !== null && (
        <p className="text-2xl font-semibold tabular-nums">{wertText}</p>
      )}
      <p className="mt-1 text-sm">{einsetzen(antwort.aussage, t, money.format)}</p>

      {/*
        Anzahl getrennt vom Antwortsatz — und mit eigenem Singular-Key. Im
        Browser stand sonst „1 Buchungen": Ein Platzhalter im Satz kann keinen
        Plural bilden, und die Zahl ist genau der Fall, in dem das auffällt.

        Nur bei `deepLinkArt === 'quelle'`: Dort — und nur dort — ist `anzahl`
        nachweislich eine Zahl von BUCHUNGEN (der Katalog-Test bindet
        Quell-Links an `/transactions?`). Bei `budget.status` zählt dasselbe
        Feld Budgets, und „Aus 3 Buchungen" wäre schlicht gelogen.
      */}
      {antwort.deepLinkArt === 'quelle' && antwort.anzahl > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {antwort.anzahl === 1
            ? t('financeQuestions.countOne')
            : t('financeQuestions.countMany').split('{anzahl}').join(String(antwort.anzahl))}
        </p>
      )}

      {antwort.begruendung?.map((grund, i) => (
        <p key={i} className="mt-1 text-xs text-muted-foreground">
          {einsetzen(grund, t, money.format)}
        </p>
      ))}

      <Link
        to={antwort.deepLink}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/*
          Die Beschriftung folgt `deepLinkArt`: Nur ein Quell-Link zeigt GENAU
          die Menge, aus der die Zahl entstand. Ein Kontext-Link (etwa alle
          Buchungen eines Händlers neben einer Vertrags-Jahressumme) wird
          entsprechend zurückhaltender benannt, statt mehr zu versprechen, als
          er einlöst.
        */}
        {antwort.deepLinkArt === 'quelle'
          ? t('financeQuestions.showSource')
          : t('financeQuestions.showContext')}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </InfoGroup>
  );
}
