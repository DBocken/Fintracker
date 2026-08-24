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
      {/*
        `h1` und nicht `h2`: Nachgemessen (axe, Chromium) trugen `/transactions`
        und `/budgets` je ein `H1` mit dem Seitentitel, diese Fläche als einzige
        nur ein `H2` — axe meldete entsprechend `page-has-heading-one`. Das ist
        zwar unterhalb der CI-Schwelle, aber ein Screenreader fände hier sonst
        keine oberste Überschrift, wo er auf jeder anderen Fläche eine findet.
      */}
      <h1 id="money-questions-heading" className="flex items-center gap-2 text-base font-semibold">
        <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
        {t('financeQuestions.title')}
      </h1>
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
        <p className="text-sm text-muted-foreground">
          {t(`financeQuestions.slot.${ergebnis.fehlend[0]}`)}
        </p>

        {/*
          Die Kandidaten aus den EIGENEN Daten. Ohne sie war die Rückfrage eine
          Sackgasse: Wer „für essen" tippt, seine Kategorie aber „Lebensmittel"
          heisst, müsste den Namen erraten. Angeboten wird immer nur der ERSTE
          offene Slot — zwei Auswahllisten gleichzeitig sind keine Frage mehr,
          sondern ein Formular.
        */}
        {ergebnis.vorschlaege.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('financeQuestions.pickOne')}>
            {ergebnis.vorschlaege.map((vorschlag) => (
              <Button
                key={`${vorschlag.slot}:${vorschlag.wert}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => model.waehleVorschlag(vorschlag)}
              >
                {vorschlag.label}
              </Button>
            ))}
          </div>
        )}

        {ergebnis.fehlend.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('financeQuestions.alsoNeeded').split('{count}').join(String(ergebnis.fehlend.length - 1))}
          </p>
        )}
      </InfoGroup>
    );
  }

  if (ergebnis.art === 'kandidaten') {
    // Zwei Deutungen zu dicht beieinander: Es wird gewählt, nicht geraten.
    // Ein Chat-Feld weckt LLM-Erwartungen — die Antwort auf Mehrdeutigkeit
    // ist deshalb ausdrücklich eine Auswahl, keine Behauptung. Ist die
    // Auswahl eine reine Stufe-2-VERMUTUNG (kein einziges Auslösewort traf),
    // sagt die Fläche zuerst ehrlich „nicht verstanden" — der Vorschlag ist
    // dann ein Angebot, kein Verstehens-Anspruch.
    return (
      <InfoGroup
        title={
          ergebnis.nurVermutung
            ? t('financeQuestions.notUnderstoodTitle')
            : t('financeQuestions.candidatesTitle')
        }
      >
        <p className="text-sm text-muted-foreground">
          {ergebnis.nurVermutung
            ? t('financeQuestions.notUnderstood')
            : t('financeQuestions.candidatesIntro')}
        </p>
        {ergebnis.nurVermutung && (
          <p className="mt-2 text-sm text-muted-foreground">{t('financeQuestions.maybeMeant')}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('financeQuestions.pickOne')}>
          {ergebnis.kandidaten.map((k) => (
            <Button
              key={k.entryId}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => model.waehleKandidat(k)}
            >
              {t(`financeQuestions.entryName.${k.entryId}`)}
            </Button>
          ))}
        </div>
      </InfoGroup>
    );
  }

  return (
    <>
      <AntwortAnzeige antwort={ergebnis.antwort} />
      {ergebnis.erschlosseneKategorie && (
        <InfoGroup title={t('financeQuestions.understoodAsTitle')}>
          <p className="text-sm">
            {t('financeQuestions.understoodAs').split('{label}').join(ergebnis.erschlosseneKategorie.label)}
          </p>
          {ergebnis.erschlosseneKategorie.alternativen.length > 0 && (
            <div
              className="mt-2 flex flex-wrap gap-2"
              role="group"
              aria-label={t('financeQuestions.correctCategory')}
            >
              {ergebnis.erschlosseneKategorie.alternativen.map((v) => (
                <Button
                  key={v.wert}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => model.waehleVorschlag(v)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          )}
        </InfoGroup>
      )}
    </>
  );
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
  locale = 'de',
): string {
  return Object.entries(aussage.params).reduce(
    (text, [name, wert]) => {
      // `split`/`join` statt `replaceAll`: Das Ziel-`lib` der App kennt
      // `String.prototype.replaceAll` nicht, und ein einzelnes `replace`
      // ersetzte nur das erste Vorkommen — ein zweimal genannter Platzhalter
      // bliebe als `{name}` auf dem Bildschirm stehen.
      const anzeige =
        GELD_PLATZHALTER.has(name) && typeof wert === 'number'
          ? geld(wert)
          : DATUM_PLATZHALTER.has(name) && typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert)
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${wert}T12:00:00Z`))
            : String(wert);
      return text.split(`{${name}}`).join(anzeige);
    },
    t(aussage.key),
  );
}

/** Platzhalter, deren Wert ein Geldbetrag ist — sie müssen maskiert werden. */
const GELD_PLATZHALTER = new Set(['betrag', 'monatlich', 'rest']);

/** Platzhalter, deren Wert ein ISO-Datum ist — formatiert wird je Sprache. */
const DATUM_PLATZHALTER = new Set(['datum']);

/**
 * yyyy-mm → sprachrichtiger Monatsname. Das Register liefert den Monat roh
 * (`monatIso`), damit die Formatierung dort passiert, wo die Sprache bekannt
 * ist — ein rohes „2026-07" auf dem Bildschirm war schon einmal ein Fund.
 */
function formatMonat(iso: string, locale: string): string {
  const [jahr, monat] = iso.split('-').map(Number);
  if (!jahr || !monat) return iso;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(jahr, monat - 1, 1)),
  );
}

function AntwortAnzeige({ antwort }: { antwort: QuestionAnswer }) {
  const { t, locale } = useI18n();
  const money = useMoneyFormat();

  // „Keine Buchung" ist eine ANDERE Aussage als „0,00 €".
  //
  // Ein berechneter Nullbetrag und eine leere Treffermenge sehen identisch
  // aus, meinen aber Gegensätzliches: einmal „du hast dafür nichts
  // ausgegeben", einmal „dazu liegt mir nichts vor". Genau diese Verwechslung
  // ist der Grund, warum das Repo `check:state-coverage` hat. Der Deep-Link
  // bleibt trotzdem stehen — wer nachsehen will, soll es können.
  const ohneTreffer = antwort.anzahl === 0 && (antwort.art === 'geld' || antwort.art === 'anzahl');

  // Beträge laufen IMMER durch den Sanften Modus. Das Register liefert
  // bewusst eine rohe Zahl (docs/debt-avoidance-recovery.md) — ein einziger
  // unmaskierter Betrag auf dieser Fläche hebt das Versprechen auf.
  const wertText =
    antwort.wert === null
      ? null
      : antwort.art === 'geld' || antwort.art === 'liste'
        ? money.format(antwort.wert)
        : antwort.art === 'quote'
          ? `${Math.round(antwort.wert * 100)} %`
          : String(antwort.wert);

  return (
    <InfoGroup title={t('financeQuestions.answerTitle')}>
      {ohneTreffer ? (
        <p className="text-sm">{einsetzen({ ...antwort.aussage, key: 'financeQuestions.noMatch' }, t, money.format, locale)}</p>
      ) : (
        <>
          {wertText !== null && (
            <p className="text-2xl font-semibold tabular-nums">{wertText}</p>
          )}
          <p className="mt-1 text-sm">{einsetzen(antwort.aussage, t, money.format, locale)}</p>
        </>
      )}

      {/*
        Listen-Antwort: Die Posten SIND die Antwort. `label` ist Nutzerdatum
        (Händlername), kein Bildschirmtext; jeder Betrag läuft durch den
        Sanften Modus — ein einziger unmaskierter Betrag höbe das Versprechen
        der ganzen Fläche auf.
      */}
      {antwort.art === 'liste' && antwort.posten && antwort.posten.length > 0 && (
        <ul className="mt-2 space-y-1">
          {antwort.posten.map((p, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate">
                {p.label}
                {p.monatIso && (
                  <span className="text-muted-foreground"> · {formatMonat(p.monatIso, locale)}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{money.format(p.betrag)}</span>
            </li>
          ))}
        </ul>
      )}

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
          {einsetzen(grund, t, money.format, locale)}
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
        {antwort.deepLinkLabelKey
          ? t(antwort.deepLinkLabelKey)
          : antwort.deepLinkArt === 'quelle'
            ? t('financeQuestions.showSource')
            : t('financeQuestions.showContext')}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </InfoGroup>
  );
}
