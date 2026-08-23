/**
 * Freitext → Kandidaten aus dem Abfrage-Register.
 *
 * **Das ist die EINZIGE Naht, an der je ein Modell sitzen könnte.** Das
 * Beantworten (`QuestionEntry.antwort`) inferiert nie — es summiert Buchungen,
 * die es gibt. Ein späteres Modell dürfte einen Eintrag und Slots
 * *vorschlagen*; die Slots liefen danach durch dieselbe Validierung wie hier
 * (Kategorie muss eine existierende ID sein, Zeitraum ein auflösbarer
 * Ausdruck). Ein halluzinierter Slot fiele an dieser Schranke, nicht in der
 * Antwort.
 *
 * ## Warum heute kein Modell dahinter gehört — aus der Nutzererfahrung
 *
 * - **Antwortzeit beim Tippen.** Der Matcher läuft bei jedem Tastendruck. Ein
 *   Treffer über ein paar hundert eigene Vokabeln kostet Mikrosekunden; jede
 *   Modell-Inferenz kostet zweistellige Millisekunden pro Anschlag und macht
 *   das Feld spürbar zäh — auf Android zuerst.
 * - **Kaltstart.** Das erste Wort wäre das langsamste: laden, allozieren,
 *   aufwärmen. Genau in dem Moment, in dem jemand zum ersten Mal ausprobiert,
 *   ob die Fläche etwas taugt.
 * - **Auslieferung.** `script-src 'self'` in `vercel.json` verbietet
 *   CDN-Gewichte; ein Same-Origin-Modell aus `public/` zählte gegen
 *   `bundle-size-budget.json` und würde bei JEDEM Nutzer geladen — auch bei
 *   dem, der die Fläche nie öffnet.
 * - **Nutzen.** Das Vokabular ist klein, geschlossen und gehört dem Nutzer
 *   selbst. Ein Modell kann „Lidl" nicht besser erkennen als eine Liste, in
 *   der „lidl" steht.
 *
 * **Messbare Bedingung, das zu ändern:** Erst wenn eine lokale, opt-in
 * erhobene Zählung der UNBEANTWORTETEN Eingaben (nur Fehlschlag-Kategorien,
 * kein Rohtext) zeigt, dass mehr als 20 % der Eingaben hier scheitern UND die
 * Fehlschläge überwiegend Umschreibungen bekannter Einträge sind (nicht
 * fehlende Einträge), lohnt ein Modell — und selbst dann zuerst eine
 * Synonymtabelle, kein Netz.
 */
import type { QuestionEntry, QuestionSlots, SlotName } from '@/lib/question-registry';
import { fehlendeSlots } from '@/lib/question-registry';
import { parseZeitraum } from '@/lib/question-time-expressions';

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

    const zeitraum = parseZeitraum(text, locale, jetzt);
    // Der Zeitausdruck wird aus dem Text geschnitten, bevor Händler und
    // Kategorien gesucht werden: „Mai" ist Monat UND Nachname, und ohne den
    // Schnitt fände ein Händler namens „Mai" sich im Zeitraum wieder.
    const ohneZeit = zeitraum
      ? normalisiert.replace(normalisiere(zeitraum.treffer), ' ')
      : normalisiert;

    const haendler = findeLaengsten(ohneZeit, vokabular.haendler);
    const kategorie = findeLaengsten(ohneZeit, vokabular.kategorien);
    const konto = findeLaengsten(ohneZeit, vokabular.konten);
    const betragTreffer = ohneZeit.match(/\b(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?\s*(?:€|eur|euro)?\b/);

    const worttokens = normalisiert.split(/[^a-z0-9]+/).filter(Boolean);
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
        return worttokens.some(
          (token) => token === phrase || (phrase.length >= 5 && token.endsWith(phrase)),
        );
      };
      const ausloeserTreffer = worte.filter(trifft).length;
      // Verstärker schärfen einen Treffer, stiften aber nie einen: Ohne
      // Auslöser bleiben sie wirkungslos (Begründung am `verstaerker`-Feld
      // des Registers).
      const verstaerkerTreffer = ausloeserTreffer > 0 ? verstaerkerWorte.filter(trifft).length : 0;

      const slots: QuestionSlots = {};
      const erschlossen: SlotName[] = [];
      let slotPunkte = 0;

      const nutzt = (slot: SlotName) =>
        entry.slots.erforderlich.includes(slot) || entry.slots.optional.includes(slot);

      if (zeitraum && nutzt('zeitraum')) {
        slots.zeitraum = zeitraum.slot;
        slotPunkte += 1;
      }
      // Ein mehrdeutiger Treffer füllt den Slot NICHT — er bleibt offen und
      // die Fläche fragt nach. Raten wäre hier eine falsche Zahl.
      if (haendler && !haendler.mehrdeutig && nutzt('haendler')) {
        slots.haendler = haendler.wert;
        slotPunkte += 2;
      }
      if (kategorie && !kategorie.mehrdeutig && nutzt('kategorie')) {
        // Händler schlägt Kategorie, wenn beide dasselbe Wort träfen: „bei
        // Lidl" meint den Händler. Nur wenn der Händlertreffer kürzer ist,
        // gewinnt die Kategorie.
        if (!slots.haendler || kategorie.laenge > haendler!.laenge) {
          slots.kategorieId = kategorie.wert;
          slotPunkte += 2;
        }
      }
      // Zweiter Weg zur Kategorie: der abstrakte Begriff. Nur, wenn der
      // Namensvergleich nichts fand und kein Händler den Platz beansprucht —
      // „bei Lidl" meint den Händler, nicht eine Kategorie namens Lidl.
      if (!slots.kategorieId && !slots.haendler && nutzt('kategorie') && vokabular.kategorieAusText) {
        const erschlossene = vokabular.kategorieAusText(ohneZeit);
        if (erschlossene) {
          slots.kategorieId = erschlossene.categoryId;
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

      if (konto && !konto.mehrdeutig && nutzt('konto')) {
        slots.kontoId = konto.wert;
        slotPunkte += 1;
      }
      if (betragTreffer && nutzt('betrag')) {
        const ganz = betragTreffer[1].replace(/\./g, '');
        const nachkomma = betragTreffer[2] ? `.${betragTreffer[2]}` : '';
        const betrag = Number(`${ganz}${nachkomma}`);
        if (Number.isFinite(betrag) && betrag > 0) {
          slots.betrag = betrag;
          slotPunkte += 2;
        }
      }

      // Ein Eintrag kommt NUR mit mindestens einem Auslöser-Treffer in Frage.
      //
      // Ohne diese Schranke qualifizierte er sich allein über gefüllte Slots —
      // und ein Zeitausdruck ist kein Beleg dafür, WONACH gefragt wurde. Genau
      // so hat „wieviel habe ich letzten monat für essen ausgegeben?"
      // Einnahmen geliefert: `einnahmen.zeitraum` kam über „letzten monat"
      // herein, obwohl keines seiner Auslösewörter im Satz stand.
      if (ausloeserTreffer === 0) continue;

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
  /** Zu knapp, um zu entscheiden: der Nutzer wählt aus den Besten. */
  | { art: 'kandidaten'; top: QuestionCandidate[] };

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
