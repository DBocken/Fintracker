import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircleQuestion, Plus, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import FinanceEmptyState from '@/features/shared/presentation/FinanceEmptyState';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import type { Aussage, DataNeed, QuestionAnswer } from '@/lib/question-registry';
import {
  istAnlassAktion,
  istKategorieAktion,
  istTransferAktion,
} from '@/lib/question-registry';
import type { MoneyQuestionsViewModel } from '@/features/money-questions/application/use-money-questions';
import { SzenarioAntwort } from './SzenarioAntwort';
import { ZielAntwort } from './ZielAntwort';
import { KategorieAktionAntwort } from './KategorieAktionAntwort';
import { AnlassAktionAntwort } from './AnlassAktionAntwort';
import { TransferAktionAntwort } from './TransferAktionAntwort';
import { BudgetAktionAntwort } from './BudgetAktionAntwort';

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
/**
 * Kanalname → i18n-Key, als geschlossene Tabelle statt als gebauter Key.
 *
 * Zwei Gründe, und beide sind gemessen: Ein `t(\`…\${need}\`)` ist für
 * `call-site-keys.test.ts` unsichtbar — der Wächter prüft Aufrufstellen gegen
 * den Sprachbaum und kann einen zusammengesetzten Key nicht auflösen. Und der
 * `Record` über der geschlossenen Union macht einen NEUEN Kanal ohne Namen zu
 * einem Compilerfehler statt zu einem rohen Bezeichner auf dem Bildschirm.
 */
const QUELLEN_KEY: Record<DataNeed, string> = {
  transactions: 'financeQuestions.source.transactions',
  categories: 'financeQuestions.source.categories',
  accounts: 'financeQuestions.source.accounts',
  allocations: 'financeQuestions.source.allocations',
  contractDecisions: 'financeQuestions.source.contractDecisions',
  debts: 'financeQuestions.source.debts',
  budgets: 'financeQuestions.source.budgets',
  settings: 'financeQuestions.source.settings',
  specialCategories: 'financeQuestions.source.specialCategories',
  portfolios: 'financeQuestions.source.portfolios',
  netWorth: 'financeQuestions.source.netWorth',
  taxReserve: 'financeQuestions.source.taxReserve',
  merchantRules: 'financeQuestions.source.merchantRules',
  netWorthHistory: 'financeQuestions.source.netWorthHistory',
};

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
  const { t, locale } = useI18n();
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

  // Eine Quelle, die der erkannte Eintrag ANMELDET, war nicht lesbar. Der
  // Chat sagt das und nennt sie beim Namen — er nennt keine Zahl. „0 €" und
  // „konnte ich nicht lesen" sind verschiedene Aussagen, und die zweite als
  // die erste auszugeben ist der Fehler, den Welle 2 am Split-Kanal gefunden
  // hat.
  if (ergebnis.art === 'quellenfehlt') {
    return (
      <InfoGroup title={t('financeQuestions.sourceMissingTitle')}>
        <p className="text-sm">
          {t(
            ergebnis.grund === 'laedt'
              ? 'financeQuestions.sourceLoading'
              : 'financeQuestions.sourceUnreadable',
          )
            .split('{quellen}')
            .join(ergebnis.quellen.map((q) => t(QUELLEN_KEY[q])).join(', '))}
        </p>
        {ergebnis.grund === 'fehler' && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={model.refetch}>
            {t('financeQuestions.retry')}
          </Button>
        )}
      </InfoGroup>
    );
  }

  // Eine Szenario-Antwort rechnet asynchron in der Fläche (WP-H): Die
  // erkannten Veränderungen erscheinen als korrigierbare Chips, die
  // Monte-Carlo läuft im Worker — das Register hat nur die Absicht geliefert.
  if (ergebnis.antwort.art === 'szenario' && ergebnis.antwort.szenario) {
    return <SzenarioAntwort absicht={ergebnis.antwort.szenario} />;
  }

  // Eine Zielrückrechnung trägt nur die FRAGE (Welle 3): Die Binärsuche über
  // den Betrag läuft in der Fläche, nicht im Register.
  if (ergebnis.antwort.art === 'zielrueckrechnung' && ergebnis.antwort.ziel) {
    return <ZielAntwort ziel={ergebnis.antwort.ziel} />;
  }

  // Eine Aktions-Antwort ist eine VORSCHAU (WP-I): Geschrieben wird erst auf
  // Klick — das Register hat gerechnet, was passieren WÜRDE. Seit Welle 5
  // gibt es mehrere Aktionsarten; unterschieden wird über die Vorschau,
  // nicht über eine zweite Antwortart — es ist dieselbe Zusage an den
  // Nutzer (Vorschau, Bestätigen, Rückgängig), nur ein anderer Gegenstand.
  if (ergebnis.antwort.art === 'aktion' && ergebnis.antwort.aktion) {
    const vorschlag = ergebnis.antwort.aktion;
    const aussage = einsetzen(ergebnis.antwort.aussage, t, (b) => String(b), locale);
    // Benannte Wache statt einer Bedingung hier: Der Compiler ist an dieser
    // Stelle die Sicherung — ein Vorschlag in der falschen Fläche kündigte
    // etwas anderes an, als der Klick dann tut.
    if (istKategorieAktion(vorschlag)) {
      return <KategorieAktionAntwort vorschlag={vorschlag} aussage={aussage} />;
    }
    if (istAnlassAktion(vorschlag)) {
      return <AnlassAktionAntwort vorschlag={vorschlag} aussage={aussage} />;
    }
    if (istTransferAktion(vorschlag)) {
      return <TransferAktionAntwort vorschlag={vorschlag} aussage={aussage} />;
    }
    return (
      <BudgetAktionAntwort
        antwort={ergebnis.antwort}
        vorschlag={vorschlag}
        budgets={model.budgets}
        aussage={aussage}
      />
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

          {/*
            Je erkannte Kategorie ein einzeln abwählbarer Chip. Ein
            Oberbegriff wie „Essen" spannt über mehrere Kategorien; eine
            Sammelangabe („6 Kategorien") ließe sich weder prüfen noch
            korrigieren — und eine nicht prüfbare Menge macht die Summe
            darüber zu einer Behauptung.
          */}
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label={t('financeQuestions.recognisedCategories')}
          >
            {ergebnis.erschlosseneKategorie.teile.map((teil) => (
              <Button
                key={teil.wert}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => model.entferneKategorie(teil.wert)}
                aria-label={t('financeQuestions.removeCategory').split('{label}').join(teil.label)}
              >
                {teil.label}
                <X className="ml-1 h-3 w-3" aria-hidden="true" />
              </Button>
            ))}
          </div>

          {ergebnis.erschlosseneKategorie.alternativen.length > 0 && (
            <>
              <p className="mt-3 text-xs text-muted-foreground">
                {t('financeQuestions.addCategoryHint')}
              </p>
              <div
                className="mt-1 flex flex-wrap gap-2"
                role="group"
                aria-label={t('financeQuestions.correctCategory')}
              >
                {ergebnis.erschlosseneKategorie.alternativen.map((v) => (
                  <Button
                    key={v.wert}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => model.ergaenzeKategorie(v.wert)}
                  >
                    <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                    {v.label}
                  </Button>
                ))}
              </div>
            </>
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
          : PROZENT_PLATZHALTER.has(name) && typeof wert === 'number'
          ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(wert)
          : DATUM_PLATZHALTER.has(name) && typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert)
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${wert}T12:00:00Z`))
            : // Ein roher Monat („2026-08") auf dem Bildschirm war hier schon
              // einmal ein Browser-Fund — das Register liefert Daten, die
              // Präsentation macht daraus Sprache.
              MONATS_PLATZHALTER.has(name) && typeof wert === 'string' && /^\d{4}-\d{2}$/.test(wert)
              ? formatMonat(wert, locale)
              : // `all` ist die Kennung des Gesamtzeitraums, kein Wort. Roh
                // stand „entfällt auf Wohnen, all." auf dem Bildschirm —
                // dieselbe Sorte Fund wie der rohe Monat darüber.
                wert === 'all'
                ? t('financeQuestions.zeitraumGesamt')
                : String(wert);
      return text.split(`{${name}}`).join(anzeige);
    },
    t(aussage.key),
  );
}

/** Platzhalter, deren Wert ein Geldbetrag ist — sie müssen maskiert werden. */
const GELD_PLATZHALTER = new Set(['betrag', 'monatlich', 'rest', 'direkt']);

/**
 * Platzhalter, die einen PROZENTSATZ tragen (Welle 2).
 *
 * Ohne sie stünde „Das sind 19.999999999999996 Prozent." auf dem Bildschirm —
 * dieselbe Sorte Fund wie der rohe Monat „2026-08" und das rohe „all" darüber.
 * Das Register liefert die Zahl ungerundet, weil Runden eine Darstellungsfrage
 * ist; hier wird sie beantwortet.
 */
const PROZENT_PLATZHALTER = new Set(['prozent']);

/** Platzhalter, deren Wert ein ISO-Datum ist — formatiert wird je Sprache. */
const DATUM_PLATZHALTER = new Set(['datum']);

/**
 * Platzhalter, deren Wert ein Monat (`yyyy-mm`) ist.
 *
 * `vonMonat`/`bisMonat` kamen mit der Bestands-Spanne dazu. Ohne sie stünde
 * „so weit reicht dein Datenbestand (2026-01 bis 2026-04)" auf dem
 * Bildschirm — genau der rohe Monat, der hier schon einmal ein Fund war.
 */
const MONATS_PLATZHALTER = new Set(['monat', 'vonMonat', 'bisMonat']);

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
  //
  // NUR bei `deepLinkArt === 'quelle'`: Dort ist `anzahl` die Zahl der
  // Buchungen hinter dem Wert, und 0 heisst wirklich „nichts gefunden".
  // Sonst ist das Feld etwas ganz anderes — bei „Wie lange reicht mein
  // Geld?" steht dort bewusst 0, weil die Antwort aus Salden und Schnitt
  // gerechnet wird und gar keine Treffermenge hat. Im Browser stand deshalb
  // „Dazu gibt es keine Buchung", während direkt darunter Guthaben und
  // Monatsverbrauch ausgewiesen waren: eine Fläche, die sich selbst
  // widerspricht. Dieselbe Regel steht schon bei der Zähl-Zeile weiter
  // unten — sie galt nur an einer der beiden Stellen.
  const ohneTreffer =
    antwort.deepLinkArt === 'quelle' &&
    antwort.anzahl === 0 &&
    (antwort.art === 'geld' || antwort.art === 'anzahl');

  // Beträge laufen IMMER durch den Sanften Modus. Das Register liefert
  // bewusst eine rohe Zahl (docs/debt-avoidance-recovery.md) — ein einziger
  // unmaskierter Betrag auf dieser Fläche hebt das Versprechen auf.
  const wertText =
    antwort.wert === null
      ? null
      : antwort.art === 'geld' || antwort.art === 'liste' || antwort.art === 'vergleich'
        ? money.format(antwort.wert)
        : antwort.art === 'quote'
          ? `${Math.round(antwort.wert * 100)} %`
          // Browser-Fund: `String(1.5)` schrieb „1.5" in eine deutsche
          // Oberfläche. Eine Anzahl ist kein Betrag (der Sanfte Modus gilt
          // ihr nicht), aber sie ist eine ZAHL und gehört in die Schreibweise
          // der Sprache — „So viele Monate reicht dein Geld: 1.5" liest sich
          // wie ein Tippfehler.
          : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(antwort.wert);

  return (
    <InfoGroup title={t('financeQuestions.answerTitle')}>
      {ohneTreffer ? (
        <p className="text-sm">
          {einsetzen(
            {
              ...antwort.aussage,
              key: 'financeQuestions.noMatch',
              // Browser-Fund: Ohne Zeitraum-Slot stand ein Satzloch auf dem
              // Bildschirm („— ist dort nichts erfasst"). Ein leerer
              // Platzhalter ist nie Absicht — ersatzweise „insgesamt".
              params: {
                ...antwort.aussage.params,
                zeitraum: antwort.aussage.params.zeitraum || t('financeQuestions.zeitraumGesamt'),
              },
            },
            t,
            money.format,
            locale,
          )}
        </p>
      ) : (
        <>
          {wertText !== null && (
            <p className="text-2xl font-semibold tabular-nums">{wertText}</p>
          )}
          <p className="mt-1 text-sm">{einsetzen(antwort.aussage, t, money.format, locale)}</p>
        </>
      )}

      {/*
        Vergleichs-Antwort: Zwei Größen nebeneinander, darunter die Differenz.
        Beide Beträge laufen durch den Sanften Modus — ein Vergleich, dessen
        eine Hälfte maskiert und die andere sichtbar wäre, höbe das
        Versprechen der Fläche auf. Die Labels sind NUTZERDATEN
        (Händler-/Kategoriename, Zeitraum), hier wird nichts übersetzt.
      */}
      {antwort.art === 'vergleich' && antwort.vergleich && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">{antwort.vergleich.labelWert}</dt>
            <dd className="text-lg font-semibold tabular-nums">{money.format(antwort.wert ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{antwort.vergleich.labelReferenz}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {money.format(antwort.vergleich.referenz)}
            </dd>
          </div>
          <div className="col-span-2 text-sm">
            {t('financeQuestions.vergleichDifferenz')
              .split('{differenz}')
              .join(money.format(Math.abs(antwort.vergleich.differenz)))
              .split('{prozent}')
              .join(
                antwort.vergleich.quote === null
                  ? '—'
                  : `${Math.abs(Math.round(antwort.vergleich.quote * 100))} %`,
              )}
          </div>
        </dl>
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
                {p.labelKey ? t(p.labelKey) : p.label}
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
