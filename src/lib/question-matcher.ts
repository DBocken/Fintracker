/**
 * Freitext → Kandidaten aus dem Abfrage-Register — der ROUTER der
 * Nachfragen-Fläche: erkennen, was gemeint ist, und die passende Funktion
 * aufrufen. Er gibt nie selbst eine Antwort.
 *
 * **Das ist die EINZIGE Naht, an der ein Modell sitzt.** Das Beantworten
 * (`QuestionEntry.antwort`) inferiert nie — es summiert Buchungen, die es
 * gibt. Seit WP-F.4 sitzt hier tatsächlich eines: `question-intent-model.ts`
 * (Complement NB über Subword-Merkmale, abgeleitet aus kuratierten
 * Paraphrasen plus den eigenen bestätigten Zuordnungen) als **Stufe 2** in
 * `routeFrage`. Es schlägt vor, entscheidet nie allein; seine Slots baut
 * dieselbe deterministische Extraktion wie hier — ein halluzinierter Slot
 * fällt an dieser Schranke, nicht in der Antwort.
 *
 * ## Arbeitsteilung der Stufen — aus der Nutzererfahrung
 *
 * - **Stufe 1 (lexikalisch, diese Datei)** läuft bei jedem Tastendruck:
 *   Mikrosekunden über ein paar hundert eigene Vokabeln.
 * - **Stufe 2 (Intent-Modell)** läuft nur beim ABSENDEN: einstellige
 *   Millisekunden, in Millisekunden aus eingechecktem Text abgeleitet — kein
 *   Gewicht in der Auslieferung, kein Kaltstart, kein CSP-Thema.
 *
 * **Maßgebliche Messgröße** (ersetzt seit WP-F die frühere
 * Telemetrie-Bedingung dieses Kopfes — der 225-Fragen-Korpus hat den Bedarf
 * belegt, bevor die Zählung je lief): die Router-Ratsche in
 * `question-eval-ratchet.test.ts`. `richtigOderSicher ≥ 0.99`,
 * `zuversichtlichFalsch ≤ 0.01`, gemessen auf Fragen, die die Stufe 2
 * nachweislich nie gesehen hat. Wer am Router arbeitet, arbeitet gegen diese
 * Zahlen.
 */
import type { QuestionEntry, QuestionSlots, SlotName } from '@/lib/question-registry';
import { fehlendeSlots } from '@/lib/question-registry';
import { parseZeitraum } from '@/lib/question-time-expressions';
import { extrahiereSzenarioAbsicht, type SzenarioAbsicht } from '@/lib/scenario-intent';
import { extrahiereBudgetAktion } from '@/lib/budget-action-intent';

export interface VokabelEintrag {
  /** Wonach gesucht wird — kleingeschrieben. */
  wort: string;
  /** Stabile ID (Kategorie/Konto) bzw. normalisierter Händlername. */
  wert: string;
  /**
   * Anzeigeform für eine Rückfrage („Meinst du …?"). Der Matcher benutzt sie
   * NIE — er sucht in `wort`. Sie steht hier, damit die Fläche einen
   * unaufgelösten Slot mit echten Kandidaten beantworten lassen kann, statt
   * den Nutzer raten zu lassen. Fehlt sie, dient `wort` als Anzeige.
   */
  label?: string;
}

export interface QuestionVocabulary {
  kategorien: readonly VokabelEintrag[];
  konten: readonly VokabelEintrag[];
  haendler: readonly VokabelEintrag[];
  /** Eintrags-ID → aufgelöste Auslösewörter (aus dem Sprachbaum geholt). */
  ausloeser: ReadonlyMap<string, readonly string[]>;
  /** Eintrags-ID → aufgelöste Verstärker (zählen nur NACH einem Auslöser-Treffer). */
  verstaerker?: ReadonlyMap<string, readonly string[]>;
  /**
   * Zweiter Weg zur Kategorie: ein ABSTRAKTER Begriff („essen", „tanken"),
   * der den Kategorienamen gar nicht enthält.
   *
   * Der Namensvergleich oben kann das prinzipiell nicht — er verlangt, dass
   * der getippte Text den Kategorienamen enthält, und ein abstrakterer
   * Begriff ist kürzer als der Name. Aufgelöst wird über dieselbe Engine, die
   * Buchungen kategorisiert (kuratierte Stichwörter, eigene Händlerregeln,
   * gelerntes Modell) — siehe `question-category-resolution.ts`.
   *
   * Optional: Ohne sie verhält sich der Matcher wie zuvor.
   */
  kategorieAusText?: (text: string) => { categoryId: string; confidence: number } | null;
  /**
   * DRITTER Weg zur Kategorie: der Oberbegriff, der eine GRUPPE meint
   * („Essen" = Lebensmittel ∪ Essen & Trinken, „Auto" zusätzlich Versicherung
   * und Finanzierung). Er läuft VOR der Einzelauflösung, weil eine Gruppe die
   * genauere Antwort auf einen Oberbegriff ist — die Einzelauflösung würde
   * dieselbe Frage auf eine ihrer Kategorien verengen und damit zu wenig
   * summieren.
   */
  konzeptAusText?: (text: string) => readonly string[] | null;
}

export interface QuestionCandidate {
  entryId: string;
  score: number;
  slots: QuestionSlots;
  fehlend: SlotName[];
  /**
   * Slots, die NICHT wörtlich im Text standen, sondern erschlossen wurden.
   *
   * Die Fläche muss das benennen können („Verstanden als: Essen & Trinken"),
   * sonst wäre eine erschlossene Kategorie eine stille Behauptung — und der
   * Nutzer hätte keine Gelegenheit, sie zu korrigieren.
   */
  erschlossen: SlotName[];
}

export interface QuestionMatcher {
  match(
    text: string,
    vokabular: QuestionVocabulary,
    entries: readonly QuestionEntry[],
    locale: string,
    jetzt: Date,
  ): QuestionCandidate[];
}

/**
 * Funktionswörter, die NIE allein als Auslöser zählen dürfen.
 *
 * Der teuerste Fehler dieses Routers war gemessen genau das: Der Auslöser
 * „leisten kann ich mir" zerfiel in Einzel-Token, und „kann/ich/mir" machten
 * `leistbarkeit.anschaffung` zum Treffer für fast jede umgangssprachliche
 * Frage — 180 von 225 Korpus-Fragen wurden zuversichtlich falsch beantwortet
 * (`question-eval-ratchet.test.ts`). Ein Funktionswort trägt keine Absicht;
 * Absicht tragen Inhaltswörter und Phrasen.
 *
 * Die Liste ist bewusst klein und dreisprachig gemischt: Sie muss nur die
 * Wörter kennen, die in Auslöser-Phrasen realistisch vorkommen.
 */
const STOPPWOERTER = new Set(
  (
    'ich mir mich mein meine meinem meinen meiner kann koennte was wie viel wieviel ' +
    'hab habe noch fuer bei und oder aber der die das den dem ist sind war bin du wir ' +
    'es im in an auf aus mit von zu wenn wen dass ob nicht kein keine alles alle so ' +
    'dann wann wo er sie ' +
    'i my me can could what how much the for at and or is are was to in on of a an if no all when where ' +
    'я мне мой моя как что для и или в на не когда ли'
  ).split(/\s+/),
);

/**
 * Sprachliche Signale einer HYPOTHETISCHEN Frage. Absichtlich eng: „wenn ich"
 * (nicht jedes „wenn" — „wenn alle Abbuchungen stattfinden" beschreibt den
 * Ist-Plan, keine veränderte Welt), Wahrscheinlichkeits- und Szenario-Vokabeln
 * samt der Tippfehler-Formen aus dem Korpus.
 */
const SZENARIO_SIGNALE = [
  'wenn ich',
  'wen ich',
  'was passiert',
  'was muesste ich',
  'was muss ich aendern',
  'wie veraendert',
  'wahrscheinlichkeit',
  'wie wahrscheinlich',
  'warscheinlich',
  'szenario',
  'kombination',
  'simulation',
  'what if',
  'how likely',
  'probability',
  'scenario',
  'если я',
  'вероятность',
  'сценарий',
];

/** Redet die Frage über eine veränderte Welt? Für den Eval-Korpus exportiert. */
export function istSzenarioFrage(text: string): boolean {
  const n = normalisiere(text);
  return SZENARIO_SIGNALE.some((signal) => n.includes(signal));
}

/** Ein einzelnes Wort, das allein keine Absicht ausweist. Für Kurations-Tests exportiert. */
export function istStoppwort(wort: string): boolean {
  return STOPPWOERTER.has(normalisiere(wort.trim()));
}

/**
 * Zerlegt einen aufgelösten Auslöser-Sprachbaumwert in einzelne Phrasen.
 *
 * EINE Implementierung für Fläche UND Eval-Korpus. Die erste Fassung des
 * Korpus-Tests hatte die Zerlegung nachgebildet — und war nach der
 * Umstellung von Leerraum auf Komma prompt einen Stand hinterher: Aus
 * `'im jahr, jährlich'` wurde dort das Einzelwort „jahr", und der Test maß
 * ein Verhalten, das die App gar nicht hatte. Ein Harness, der das
 * Produktionsverhalten kopiert statt es zu benutzen, misst irgendwann sich
 * selbst.
 */
export function zerlegeAusloeser(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Kleinschreibung plus Umlaut-Faltung, damit „Bäckerei" auch „baeckerei" trifft. */
function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/**
 * Längster Treffer gewinnt. Bei GLEICHER Länge wird nicht geraten, sondern
 * `mehrdeutig` gemeldet — die Fläche fragt dann nach.
 */
function findeLaengsten(
  text: string,
  eintraege: readonly VokabelEintrag[],
): { wert: string; laenge: number; mehrdeutig: boolean } | null {
  let beste: VokabelEintrag | null = null;
  let mehrdeutig = false;

  for (const eintrag of eintraege) {
    const wort = normalisiere(eintrag.wort);
    if (!wort || !text.includes(wort)) continue;
    if (!beste || wort.length > normalisiere(beste.wort).length) {
      beste = eintrag;
      mehrdeutig = false;
    } else if (
      wort.length === normalisiere(beste.wort).length &&
      eintrag.wert !== beste.wert
    ) {
      mehrdeutig = true;
    }
  }

  return beste ? { wert: beste.wert, laenge: normalisiere(beste.wort).length, mehrdeutig } : null;
}

/** Einmal je Frage berechneter Kontext — Zeitraum, Vokabeltreffer, Betrag. */
interface FrageKontext {
  normalisiert: string;
  worttokens: string[];
  zeitraum: ReturnType<typeof parseZeitraum>;
  ohneZeit: string;
  haendler: ReturnType<typeof findeLaengsten>;
  kategorie: ReturnType<typeof findeLaengsten>;
  konto: ReturnType<typeof findeLaengsten>;
  betrag: number | null;
}

function analysiereFrage(
  text: string,
  vokabular: QuestionVocabulary,
  locale: string,
  jetzt: Date,
): FrageKontext {
  const normalisiert = normalisiere(text);
  const zeitraum = parseZeitraum(text, locale, jetzt);
  // Der Zeitausdruck wird aus dem Text geschnitten, bevor Händler und
  // Kategorien gesucht werden: „Mai" ist Monat UND Nachname, und ohne den
  // Schnitt fände ein Händler namens „Mai" sich im Zeitraum wieder.
  const ohneZeit = zeitraum
    ? normalisiert.replace(normalisiere(zeitraum.treffer), ' ')
    : normalisiert;

  const betragTreffer = ohneZeit.match(/\b(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?\s*(?:€|eur|euro)?\b/);
  let betrag: number | null = null;
  if (betragTreffer) {
    const ganz = betragTreffer[1].replace(/\./g, '');
    const nachkomma = betragTreffer[2] ? `.${betragTreffer[2]}` : '';
    const wert = Number(`${ganz}${nachkomma}`);
    if (Number.isFinite(wert) && wert > 0) betrag = wert;
  }

  return {
    normalisiert,
    worttokens: normalisiert.split(/[^a-z0-9]+/).filter(Boolean),
    zeitraum,
    ohneZeit,
    haendler: findeLaengsten(ohneZeit, vokabular.haendler),
    kategorie: findeLaengsten(ohneZeit, vokabular.kategorien),
    konto: findeLaengsten(ohneZeit, vokabular.konten),
    betrag,
  };
}

/**
 * Slot-Extraktion für EINEN Eintrag — von `match()` UND `kandidatFuer()`
 * benutzt: Auch ein von Stufe 2 vorgeschlagener Eintrag bekommt seine Slots
 * aus exakt dieser deterministischen Extraktion, nie aus dem Modell.
 */
function extrahiereEintragsSlots(
  kontext: FrageKontext,
  vokabular: QuestionVocabulary,
  entry: QuestionEntry,
): { slots: QuestionSlots; erschlossen: SlotName[]; slotPunkte: number } {
  const slots: QuestionSlots = {};
  const erschlossen: SlotName[] = [];
  let slotPunkte = 0;

  const nutzt = (slot: SlotName) =>
    entry.slots.erforderlich.includes(slot) || entry.slots.optional.includes(slot);

  if (kontext.zeitraum && nutzt('zeitraum')) {
    slots.zeitraum = kontext.zeitraum.slot;
    slotPunkte += 1;
  }
  // Ein mehrdeutiger Treffer füllt den Slot NICHT — er bleibt offen und
  // die Fläche fragt nach. Raten wäre hier eine falsche Zahl.
  if (kontext.haendler && !kontext.haendler.mehrdeutig && nutzt('haendler')) {
    slots.haendler = kontext.haendler.wert;
    slotPunkte += 2;
  }
  if (kontext.kategorie && !kontext.kategorie.mehrdeutig && nutzt('kategorie')) {
    // Händler schlägt Kategorie, wenn beide dasselbe Wort träfen: „bei
    // Lidl" meint den Händler. Nur wenn der Händlertreffer kürzer ist,
    // gewinnt die Kategorie.
    if (!slots.haendler || kontext.kategorie.laenge > kontext.haendler!.laenge) {
      slots.kategorieIds = [kontext.kategorie.wert];
      slotPunkte += 2;
    }
  }
  // Zweiter Weg: der Oberbegriff als GRUPPE. Vor der Einzelauflösung, weil
  // er die genauere Antwort ist — „für essen" auf „Restaurant" zu verengen
  // summierte zu wenig, ohne dass es jemandem auffiele.
  if (!slots.kategorieIds && !slots.haendler && nutzt('kategorie') && vokabular.konzeptAusText) {
    const gruppe = vokabular.konzeptAusText(kontext.ohneZeit);
    if (gruppe && gruppe.length > 0) {
      slots.kategorieIds = gruppe;
      erschlossen.push('kategorie');
      slotPunkte += 2;
    }
  }
  // Dritter Weg zur Kategorie: der abstrakte Begriff als EINZELNE Kategorie.
  // Nur, wenn weder Namensvergleich noch Gruppe etwas fanden und kein Händler
  // den Platz beansprucht — „bei Lidl" meint den Händler, nicht eine
  // Kategorie namens Lidl.
  if (!slots.kategorieIds && !slots.haendler && nutzt('kategorie') && vokabular.kategorieAusText) {
    const erschlossene = vokabular.kategorieAusText(kontext.ohneZeit);
    if (erschlossene) {
      slots.kategorieIds = [erschlossene.categoryId];
      erschlossen.push('kategorie');
      // Volle zwei Punkte wie ein wörtlicher Treffer — das Ergebnis
      // zweier MESSUNGEN am Korpus, nicht einer Vorliebe. Mit +1 endete
      // „für essen" in einer Auswahl-Rückfrage, obwohl die Zuordnung
      // abstrakter Begriffe die ausdrücklich verlangte Kernfunktion ist.
      // Mit +2 kippten zunächst vier Lücken-Fragen („was kostet mich mein
      // auto…") in zuversichtlich falsche Antworten — deren gemeinsamer
      // Einstieg war aber der AUSLÖSER „kostet": Die Gegenwartsform fragt
      // nach Raten und Durchschnitten, nicht nach einer Summe, und ist
      // seither kein Ausgaben-Auslöser mehr. Die Absicherung der
      // Erschliessung liegt in der BENENNUNG („Verstanden als …", 
      // korrigierbar), nicht in einem Punktabschlag.
      slotPunkte += 2;
    }
  }

  if (kontext.konto && !kontext.konto.mehrdeutig && nutzt('konto')) {
    slots.kontoId = kontext.konto.wert;
    slotPunkte += 1;
  }
  if (kontext.betrag !== null && nutzt('betrag')) {
    slots.betrag = kontext.betrag;
    slotPunkte += 2;
  }

  return { slots, erschlossen, slotPunkte };
}

/**
 * Deterministischer Treffer über das EIGENE Vokabular des Nutzers.
 *
 * Bewusst **keine Fuzzy-Distanz**: Levenshtein auf Kategorienamen erzeugt
 * zuversichtlich falsche Treffer („Miete" ↔ „Mieze"), und ein falscher Slot
 * führt zu einer falschen Zahl — schlimmer als gar keine Antwort.
 */
export const lexicalQuestionMatcher: QuestionMatcher = {
  match(text, vokabular, entries, locale, jetzt) {
    const normalisiert = normalisiere(text);
    if (!normalisiert.trim()) return [];

    const kontext = analysiereFrage(text, vokabular, locale, jetzt);
    // Hypothetische Fragen dürfen nur szenariofähige Einträge nehmen: Eine
    // Bestandsauswertung, die auf „wenn ich X ändere …" mit Ist-Zahlen
    // antwortet, beantwortet die falsche Frage — gemessen waren das zehn
    // zuversichtlich falsche Korpus-Antworten (Budget-, Forecast- und
    // Vertrags-Einträge auf Szenario-Lücken).
    const szenario = istSzenarioFrage(text);
    const kandidaten: QuestionCandidate[] = [];

    for (const entry of entries) {
      if (szenario && !entry.beantwortetSzenarien) continue;
      const worte = vokabular.ausloeser.get(entry.id) ?? [];
      const verstaerkerWorte = vokabular.verstaerker?.get(entry.id) ?? [];
      // Ein Auslöser ist eine PHRASE („kann ich mir leisten"), kein
      // Token-Beutel. Ein einzelnes Funktionswort zählt nie — auch dann
      // nicht, wenn es versehentlich im Sprachbaum kuratiert wurde; der
      // Kurations-Test in `question-catalog.test.ts` macht so einen Eintrag
      // zusätzlich laut.
      const trifft = (wort: string): boolean => {
        const phrase = normalisiere(wort.trim());
        if (!phrase) return false;
        if (phrase.includes(' ')) return normalisiert.includes(phrase);
        if (STOPPWOERTER.has(phrase)) return false;
        // Einzelwörter treffen an WORTGRENZEN, nicht als Teilzeichenkette:
        // „Sparrate" enthält „rate", meint aber keine Ratenzahlung — der
        // Substring-Treffer hat im Korpus messbar falsche Antworten erzeugt.
        // Deutsche KOMPOSITA sollen dagegen treffen („Freizeitbudget" fragt
        // nach einem Budget), deshalb zählt auch das Wortende — aber erst ab
        // fünf Zeichen, damit kurze Auslöser wie „rate" oder „abo" nicht
        // durch die Hintertür wieder Teilzeichenketten werden.
        return kontext.worttokens.some(
          (token) => token === phrase || (phrase.length >= 5 && token.endsWith(phrase)),
        );
      };
      const ausloeserTreffer = worte.filter(trifft).length;
      // Verstärker schärfen einen Treffer, stiften aber nie einen: Ohne
      // Auslöser bleiben sie wirkungslos (Begründung am `verstaerker`-Feld
      // des Registers).
      const verstaerkerTreffer = ausloeserTreffer > 0 ? verstaerkerWorte.filter(trifft).length : 0;

      // Ein Eintrag kommt NUR mit mindestens einem Auslöser-Treffer in Frage.
      //
      // Ohne diese Schranke qualifizierte er sich allein über gefüllte Slots —
      // und ein Zeitausdruck ist kein Beleg dafür, WONACH gefragt wurde. Genau
      // so hat „wieviel habe ich letzten monat für essen ausgegeben?"
      // Einnahmen geliefert: `einnahmen.zeitraum` kam über „letzten monat"
      // herein, obwohl keines seiner Auslösewörter im Satz stand.
      if (ausloeserTreffer === 0) continue;

      const { slots, erschlossen, slotPunkte } = extrahiereEintragsSlots(kontext, vokabular, entry);

      const score = (ausloeserTreffer + verstaerkerTreffer) * 3 + slotPunkte;
      kandidaten.push({
        entryId: entry.id,
        score,
        slots,
        fehlend: fehlendeSlots(entry, slots),
        erschlossen,
      });
    }

    // RELEVANZ vor Vollständigkeit — und das ist die eigentliche Lehre aus
    // demselben Fehler: Ein Eintrag ohne Pflicht-Slots ist per Definition
    // immer „vollständig" und überstrahlte damit jeden inhaltlich viel
    // besseren Treffer, dem ein Slot fehlte. Lieber nach dem fehlenden Slot
    // fragen, als eine andere Frage zu beantworten — eine falsche Zahl ist
    // schlimmer als keine. Bei gleicher Relevanz gewinnt der vollständige
    // Kandidat, und die ID macht die Reihenfolge zuletzt reproduzierbar.
    return kandidaten.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.fehlend.length !== b.fehlend.length) return a.fehlend.length - b.fehlend.length;
      return a.entryId.localeCompare(b.entryId);
    });
  },
};

/**
 * Entscheidung der Fläche über dem Matcher-Ergebnis — als REINE Funktion,
 * damit der Eval-Korpus (`question-eval-ratchet.test.ts`) exakt dieselbe
 * Entscheidung misst, die die Fläche trifft. Ein Test, der nur die
 * Kandidatenliste prüft, hätte am eigentlichen Verhalten vorbeigemessen.
 */
export type RoutingErgebnis =
  | { art: 'unverstanden' }
  | { art: 'aufloesen'; kandidat: QuestionCandidate }
  /**
   * Zu knapp, um zu entscheiden: der Nutzer wählt aus den Besten.
   * `nurVermutung` markiert den Fall, dass die Wortebene GAR nichts kannte
   * und allein die Stufe 2 vorschlägt — die Fläche sagt dann ehrlich „nicht
   * verstanden" und bietet den Vorschlag als „Meintest du …?" an, statt so
   * zu tun, als sei die Frage erkannt.
   */
  | { art: 'kandidaten'; top: QuestionCandidate[]; nurVermutung?: boolean };

/**
 * Mindestabstand zwischen Platz 1 und 2 in Score-Punkten. Ein Auslöser wiegt
 * 3, ein wörtlicher Slot 2 — unter 2 Punkten Abstand trennt die Kandidaten
 * also weniger als ein einziger Slot-Treffer, und dann wird nicht geraten.
 */
const MIN_MARGE = 2;

/** Wie viele Kandidaten eine Auswahl-Rückfrage anbietet. */
const MAX_KANDIDATEN = 3;

export function entscheideRouting(kandidaten: readonly QuestionCandidate[]): RoutingErgebnis {
  const beste = kandidaten[0];
  if (!beste) return { art: 'unverstanden' };

  // Marge-Gate: Liegt ein ANDERER Eintrag zu dicht hinter dem besten, ist die
  // Frage aus Sicht des Routers mehrdeutig — und Mehrdeutigkeit ist ein
  // Ergebnis, kein Hindernis (AGENTS.md §3): gefragt wird, nicht geraten.
  const zweite = kandidaten.find((k) => k.entryId !== beste.entryId);
  if (zweite && beste.score - zweite.score < MIN_MARGE) {
    const top: QuestionCandidate[] = [];
    for (const k of kandidaten) {
      if (top.some((t) => t.entryId === k.entryId)) continue;
      top.push(k);
      if (top.length >= MAX_KANDIDATEN) break;
    }
    return { art: 'kandidaten', top };
  }

  return { art: 'aufloesen', kandidat: beste };
}

/**
 * Router-Stufe 1 + 2 in einer Funktion — DIE Stelle, die Fläche und
 * Eval-Korpus gemeinsam benutzen.
 *
 * Stufe 2 (`IntentPrediction` aus `question-intent-model.ts`) schlägt vor,
 * entscheidet aber nie allein:
 *
 * - Sagt sie mit Marge **Lücke**, wird eine lexikalische Antwort zur
 *   Auswahl-Rückfrage herabgestuft — der einzelne Auslöser-Treffer („… meine
 *   Einnahmen …" in einer Beratungsfrage) war gemessen die letzte Quelle
 *   zuversichtlich falscher Antworten.
 * - Bestätigt sie einen der Auswahl-Kandidaten mit Marge, wird direkt
 *   geantwortet statt gefragt — der Klassifikator ist der Stichentscheid,
 *   den die Wortebene nicht hat.
 * - Kennt die Wortebene GAR keinen Kandidaten, trägt ihr Vorschlag allein —
 *   aber nur als Auswahl (nie als stille Antwort): Ohne einen einzigen
 *   Auslöser-Treffer ist die Evidenz zu dünn zum Antworten, aber zu gut zum
 *   Wegwerfen.
 *
 * Die Slots des Stufe-2-Kandidaten baut dieselbe deterministische Extraktion
 * wie überall — ein Modellvorschlag umgeht die Validierung nie.
 */
export interface IntentVorschlag {
  klasse: string;
  marge: number;
}

/**
 * Schwellen der Stufe 2, am Korpus kalibriert (Diagnoselauf in WP-F.4) —
 * zwei verschiedene, weil die Fehlerkosten verschieden sind:
 *
 * - **EINGREIFEN** (Antwort abstufen, Auswahl erweitern, Stichentscheid):
 *   verlangt echte Marge. Ein knapper NB-Sieg darf keine lexikalische
 *   Antwort kippen.
 * - **ALLEIN VORSCHLAGEN** (Wortebene kennt gar nichts): fast jede Marge
 *   reicht, denn das Ergebnis ist nur eine Auswahl-Schaltfläche — schlimmstes
 *   Ergebnis ist ein unpassender Button, nie eine falsche Zahl.
 */
const MIN_INTENT_MARGE = 0.02;
const MIN_INTENT_MARGE_ALLEIN = 0.005;
/**
 * Der Stichentscheid (Auswahl → Antwort) verlangt die höchste Marge: Er ist
 * der einzige Fusionszug, der aus einer SICHEREN Auswahl eine falsche Zahl
 * machen kann — im Diagnoselauf hat genau das eine korrekt angebotene
 * Kategorie-Auswahl mit einer 0.036er-Marge in die falsche Gesamtsumme
 * gekippt.
 */
const MIN_INTENT_MARGE_STICH = 0.05;
/**
 * Ab dieser Marge darf die Stufe 2 im Allein-Fall ANTWORTEN statt nur zu
 * vermuten. So hoch kommt praktisch nur eine GELERNTE Formulierung (eine
 * bestätigte Zuordnung mit Gewicht 3 misst ~0.4–0.7; die höchste ungelernte
 * Korpus-Marge liegt unter 0.2) — Browser-Fund: Ohne diesen Pfad blieb ein
 * Satz ohne Auslösewort auch NACH dem Lernen für immer „nur Vermutung", und
 * die Lernschleife war für genau die Formulierungen wirkungslos, für die es
 * sie gibt.
 */
const MIN_INTENT_MARGE_GELERNT = 0.25;

/**
 * Trägt eine extrahierte Absicht genug Evidenz, um die Frage als
 * Kombinations-Szenario zu routen? Zwei erkannte Veränderungen sind
 * stärkere Evidenz als jedes einzelne Auslösewort (je Delta mussten
 * Signalwort, Betrag/Konzept und ggf. Zukunftstermin ZUSAMMEN passen);
 * eine einzelne Veränderung reicht nur mit ausdrücklicher Schwelle
 * („… ohne den Notgroschen anzugreifen") — am Korpus gemessen: Ein
 * einzelnes Delta ohne Schwelle ist zu oft Nebensatz einer Frage, deren
 * Kern eine andere Familie beantwortet („wann kann ich mir den Urlaub
 * leisten, wenn ich 300 € monatlich spare" gehört der Leistbarkeit).
 */
export function traegtSzenarioRouting(absicht: SzenarioAbsicht | null): absicht is SzenarioAbsicht {
  if (!absicht) return false;
  return absicht.deltas.length >= 2 || (absicht.deltas.length >= 1 && absicht.schwelle !== undefined);
}

export function routeFrage(
  text: string,
  vokabular: QuestionVocabulary,
  entries: readonly QuestionEntry[],
  locale: string,
  jetzt: Date,
  intent?: IntentVorschlag | null,
): RoutingErgebnis {
  // Stufe 0a (WP-I): Ein BEFEHL ist keine Frage. Das Imperativ-Gate in
  // `extrahiereBudgetAktion` lässt nur Aktionsverben durch; steht eines da,
  // ist die Absicht eindeutiger als jedes Auslösewort — und die Antwort ist
  // ohnehin nur eine Vorschau, die bestätigt werden muss.
  const budgetAktion = extrahiereBudgetAktion(text);
  if (budgetAktion) {
    const aktionsEintrag = entries.find((e) => e.nimmtBudgetAktion);
    if (aktionsEintrag) {
      const kandidat = kandidatFuer(text, vokabular, aktionsEintrag, locale, jetzt);
      const slots = { ...kandidat.slots, budgetAktion };
      return {
        art: 'aufloesen',
        kandidat: { ...kandidat, slots, fehlend: fehlendeSlots(aktionsEintrag, slots) },
      };
    }
  }

  // Stufe 0b (WP-H): Eine Frage, die mehrere VERÄNDERUNGEN beschreibt, ist
  // ein Kombinations-Szenario — deterministisch erkannt, VOR Wort- und
  // Subword-Ebene. Die Deltas selbst sind die Evidenz; die Fläche zeigt sie
  // als korrigierbare Chips, bevor gerechnet wird.
  const absicht = extrahiereSzenarioAbsicht(text, locale, jetzt);
  if (traegtSzenarioRouting(absicht)) {
    const szenarioEntry = entries.find((e) => e.nimmtSzenarioAbsicht);
    if (szenarioEntry) {
      const kandidat = kandidatFuer(text, vokabular, szenarioEntry, locale, jetzt);
      return {
        art: 'aufloesen',
        kandidat: { ...kandidat, slots: { ...kandidat.slots, szenario: absicht } },
      };
    }
  }

  const kandidaten = lexicalQuestionMatcher.match(text, vokabular, entries, locale, jetzt);
  const lexikalisch = entscheideRouting(kandidaten);
  if (!intent) return lexikalisch;

  const istLuecke = intent.klasse === '__luecke__';

  if (lexikalisch.art === 'aufloesen') {
    if (istLuecke && intent.marge >= MIN_INTENT_MARGE) {
      // Herabstufen, nicht verwerfen: Der lexikalische Treffer könnte doch
      // stimmen — dann steht er in der Auswahl, und der Nutzer entscheidet.
      return { art: 'kandidaten', top: kandidaten.slice(0, 1) };
    }
    return lexikalisch;
  }

  if (lexikalisch.art === 'kandidaten') {
    if (istLuecke || intent.marge < MIN_INTENT_MARGE) return lexikalisch;
    const bestaetigt = lexikalisch.top.find((k) => k.entryId === intent.klasse);
    // Der Stichentscheid: Wortebene sagt „mehrdeutig", Subword-Ebene kennt
    // die Formulierung — zusammen reicht es für eine Antwort.
    if (bestaetigt && intent.marge >= MIN_INTENT_MARGE_STICH) {
      return { art: 'aufloesen', kandidat: bestaetigt };
    }
    if (bestaetigt) return lexikalisch;
    // Kennt die Subword-Ebene eine Deutung, die die Wortebene gar nicht
    // anbot, WÄCHST die Auswahl um sie — ans ENDE: überstimmen darf sie
    // nicht, verdrängen auch nicht (vorn eingefügt hätte sie beim
    // Drei-Kandidaten-Schnitt genau die Option herausgeschoben, die der
    // Nutzer brauchte — so gemessen im Pane-Test).
    const zusatz = entries.find((e) => e.id === intent.klasse);
    if (zusatz) {
      return {
        art: 'kandidaten',
        top: [...lexikalisch.top, kandidatFuer(text, vokabular, zusatz, locale, jetzt)].slice(0, 4),
      };
    }
    return lexikalisch;
  }

  // Wortebene: nichts. Stufe 2 allein trägt eine AUSWAHL, keine Antwort —
  // schlimmstes Ergebnis ist ein unpassender Button, deshalb die niedrige
  // Schwelle.
  if (!istLuecke && intent.marge >= MIN_INTENT_MARGE_ALLEIN) {
    const entry = entries.find((e) => e.id === intent.klasse);
    if (entry) {
      const kandidat = kandidatFuer(text, vokabular, entry, locale, jetzt);
      // Eine gelernte Formulierung trägt die Antwort allein — sonst bleibt
      // es beim ehrlichen „nicht verstanden, aber meintest du …?".
      if (intent.marge >= MIN_INTENT_MARGE_GELERNT) {
        return { art: 'aufloesen', kandidat };
      }
      return { art: 'kandidaten', top: [kandidat], nurVermutung: true };
    }
  }
  return lexikalisch;
}

/**
 * Kandidat für einen von Stufe 2 vorgeschlagenen Eintrag — MIT derselben
 * deterministischen Slot-Extraktion wie im lexikalischen Matcher: Der
 * Vorschlag eines Modells umgeht die Slot-Validierung nie (ein
 * halluzinierter Slot fällt hier, nicht in der Antwort).
 */
export function kandidatFuer(
  text: string,
  vokabular: QuestionVocabulary,
  entry: QuestionEntry,
  locale: string,
  jetzt: Date,
): QuestionCandidate {
  const kontext = analysiereFrage(text, vokabular, locale, jetzt);
  const { slots, erschlossen } = extrahiereEintragsSlots(kontext, vokabular, entry);
  return {
    entryId: entry.id,
    score: 0,
    slots,
    fehlend: fehlendeSlots(entry, slots),
    erschlossen,
  };
}
