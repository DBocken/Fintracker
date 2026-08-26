/**
 * Abfrage-Register — die Bauform, mit der „jede Abfrage der App" auch über
 * eine Chat-Fläche beantwortbar wird, ohne dass die Fläche je eine Fachfrage
 * kennt.
 *
 * Eine neue beantwortbare Frage ist ein Eintrag NEBEN dem Feature, das die
 * Antwort ohnehin schon berechnet — keine Änderung am Chat. Das ist die
 * einzige Bauform, die auf hunderte Fragen skaliert.
 *
 * ## Drei Festlegungen, die alles andere bestimmen
 *
 * **1. Ein Eintrag gibt keinen fertigen Satz und keinen formatierten Betrag
 * zurück**, sondern `{ wert, i18n-Key + Platzhalter, deepLink }`. Zwei harte
 * Gründe: `check:money-format` benennt selbst seine Blindstelle („Nicht
 * gesehen wird fertig formatierter Text aus `src/lib/`") — ein Eintrag, der
 * `"12,50 €"` zurückgäbe, umginge den Sanften Modus an einer Stelle, die kein
 * Wächter je sieht. Und der Sprachstil (`everyday`/`technical`) wird erst in
 * `t()` aufgelöst; ein hier formulierter Satz wäre ein toter Schalter.
 * Kurz: **Register rechnet, Präsentation formuliert und formatiert.**
 *
 * **2. `antwort()` ist rein und synchron.** Genau das macht das Register
 * testbar. Ein Eintrag ruft KEINEN Service; welche Daten er braucht,
 * deklariert er über `needs`, und die `application`-Schicht lädt genau die.
 * Wo eine Antwort teuer ist (Monte-Carlo), rechnet der Eintrag nicht, sondern
 * verweist (`art: 'verweis'`).
 *
 * **3. Diese Datei importiert nichts aus `src/features/`.** Deshalb trägt der
 * Zeitraum-Slot AUFGELÖSTE Daten (`{ von, bis, rangeToken }`) statt eines
 * `DashboardRange` — sonst zeigte die Abhängigkeit nach oben und
 * `check:layers` (Regel `lib-rein`) schlüge zu Recht an. Die Einträge selbst
 * liegen in `features/<slice>/domain/` und dürfen von dort auf
 * `features/shared/domain/` zugreifen.
 *
 * ## Die Naht für spätere Inferenz
 *
 * `QuestionMatcher` ist die EINZIGE Stelle, an der je ein Modell sitzen
 * könnte: Freitext → Kandidatenliste. `antwort()` inferiert nie — sie summiert
 * Buchungen, die es gibt. Ein Modell dürfte einen Eintrag und Slots
 * *vorschlagen*; die Slots laufen danach durch dieselbe Validierung wie heute
 * (Kategorie muss eine existierende ID sein, Zeitraum ein gültiger Bereich).
 * Ein halluzinierter Slot fällt an der Schranke, nicht in der Antwort.
 */
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import type { Budget } from '@/lib/budget-types';
import type { Debt } from '@/lib/debt-types';
import type { ContractDecision } from '@/lib/contract-types';
import type { SzenarioAbsicht } from '@/lib/scenario-intent';
import type { BudgetAktionsAbsicht } from '@/lib/budget-action-intent';
import type { SpecialCategory, SpecialCategoryAssignment } from '@/lib/category-types';
import type { Portfolio, PortfolioPosition } from '@/lib/portfolio-types';
import type { NetWorthBreakdown } from '@/lib/net-worth-types';
import type { TaxReserveState } from '@/lib/tax-types';
import type { UserSettings } from '@/lib/settings-types';

export type SlotName = 'zeitraum' | 'kategorie' | 'haendler' | 'konto' | 'betrag' | 'anlass';

/** Ein aufgelöster Zeitraum — nie Rohtext, nie ein Feature-Typ. */
export interface ZeitraumSlot {
  /** ISO-Datum, inklusive. */
  von: string;
  /** ISO-Datum, inklusive. */
  bis: string;
  /**
   * Kennung für den Deep-Link, wie `encodeDashboardFilters` sie erwartet
   * (`30d`, `2026-Q2`, `2026-07`, …). Rein durchgereicht.
   */
  rangeToken: string;
  /** Menschenlesbare Kennung des Zeitraums für die Antwort (z. B. `2026-07`). */
  label: string;
}

/**
 * Der Vergleichspartner einer Frage — dieselbe Achse wie die Hauptgröße.
 *
 * Verglichen wird nie Äpfel mit Birnen: Ein Händler steht gegen einen
 * Händler, eine Kategorienmenge gegen eine Kategorienmenge, ein Zeitraum
 * gegen einen Zeitraum. Achsübergreifende Vergleiche („Aldi gegen Juli")
 * gibt es nicht, weil sie keine Frage beantworten.
 */
export type VergleichsSlot =
  | { art: 'haendler'; haendler: string }
  | { art: 'kategorie'; kategorieIds: readonly string[] }
  | { art: 'zeitraum'; zeitraum: ZeitraumSlot };

export interface QuestionSlots {
  zeitraum?: ZeitraumSlot;
  /**
   * Stabile Kategorie-IDs, nie Anzeigenamen (AGENTS.md §6) — eine MENGE
   * (WP-G), weil ein Oberbegriff über Hauptkategorien hinweg spannt: „Essen"
   * meint Lebensmittel UND Essen & Trinken, „Auto" zusätzlich Versicherung
   * und Finanzierung. Die Einzelauswahl ist der Sonderfall einer Menge mit
   * einem Element — nicht umgekehrt, sonst gäbe es zwei Wahrheiten.
   */
  kategorieIds?: readonly string[];
  /** Normalisierter Händlername (`normalizeMerchantName`), nie ein Fingerprint. */
  haendler?: string;
  kontoId?: string;
  betrag?: number;
  /**
   * Anlass („Urlaub Italien", „Hochzeit") — stabile ID, nie der Name
   * (AGENTS.md §6). Ein eigener Slot und keine Kategorie: Ein Anlass ist
   * zeitlich begrenzt und schneidet QUER durch die Kategorien; dieselbe
   * Buchung kann in „Restaurants" liegen und zum Urlaub gehören. Sie in
   * einen Kategorie-Slot zu zwängen hiesse, zwei Achsen zu einer zu machen.
   */
  anlassId?: string;
  /**
   * Der zweite Partner einer Vergleichsfrage (Welle 1).
   *
   * „Gebe ich mehr bei Aldi oder bei Lidl aus?" und „Sind meine
   * Lebensmittelkosten höher als im Vorjahr?" sind DIESELBE Rechnung —
   * eine Menge gegen eine Referenzmenge. Deshalb ein Slot für beide
   * Achsen statt zweier Mechanismen, die auseinanderlaufen.
   *
   * Kein `SlotName`: Ein fehlender Vergleichspartner wird nie einzeln
   * nachgefragt („womit soll ich vergleichen?" ist eine Sackgasse, wenn
   * der Nutzer gar nicht vergleichen wollte) — ohne ihn ist die Frage
   * schlicht keine Vergleichsfrage.
   */
  vergleich?: VergleichsSlot;
  /**
   * Erkannte Szenario-Absicht (WP-H) — die MENGE der Veränderungen einer
   * kombinierten Was-wäre-wenn-Frage. Kein `SlotName`: Sie wird nie einzeln
   * nachgefragt, sondern vom Router als Ganzes extrahiert; korrigiert wird
   * sie in der Fläche über die Delta-Chips, nicht über eine Slot-Rückfrage.
   */
  szenario?: SzenarioAbsicht;
  /**
   * Erkannte Budget-Aktion (WP-I) — eine SCHREIBENDE Absicht. Wie
   * `szenario` kein `SlotName`: Sie wird als Ganzes extrahiert. Die
   * Kategorie dagegen IST ein normaler Slot und läuft durch die übliche
   * Rückfrage, wenn sie fehlt.
   */
  budgetAktion?: BudgetAktionsAbsicht;
}

/**
 * Die VORSCHAU einer Budget-Aktion — als Daten, nie als fertiger Satz
 * (Register-Regel). Beträge roh; maskiert wird in der Präsentation.
 *
 * Das Register RECHNET die Vorschau (Vorher/Nachher), es SCHREIBT nichts:
 * `antwort()` bleibt rein, die einzige schreibende Stelle ist der
 * Bestätigen-Klick in der Fläche.
 */
export interface BudgetAktionsVorschlag {
  art: 'anlegen' | 'aendern' | 'loeschen';
  /** Stabile Kategorie-ID, nie ein Anzeigename (§6). */
  kategorieId: string;
  /** Name des betroffenen bzw. neu anzulegenden Budgets — Nutzerdatum. */
  name: string;
  /** Bestehendes Limit; fehlt beim Anlegen. */
  vorher?: number;
  /** Limit nach der Aktion; fehlt beim Löschen. */
  nachher?: number;
  /** ID des bestehenden Budgets — fehlt beim Anlegen. */
  budgetId?: string;
}

/**
 * Welche Daten ein Eintrag braucht — deklarativ, damit die `application`-
 * Schicht genau diese Abfragen startet statt alles für jede Frage.
 */
export type DataNeed =
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'allocations'
  | 'contractDecisions'
  | 'debts'
  | 'budgets'
  /* Ab Welle 2 — die Dienste dahinter waren vollständig, nur der Kanal fehlte. */
  | 'settings'
  | 'specialCategories'
  | 'portfolios'
  | 'netWorth'
  | 'taxReserve';

/**
 * Was die `application`-Schicht bereitstellt. Optional, weil `needs` steuert.
 *
 * **Ein Feld, das `undefined` ist, heisst „nicht geladen" — nie „leer".** Die
 * Unterscheidung ist keine Förmlichkeit: `allocations` stand hier ab WP-C in
 * `DataNeed`, vier Budget-Einträge forderten es an, und geladen hat es
 * niemand. Weil die Einträge auf eine leere Map zurückfielen, zählte eine
 * gesplittete Buchung im Chat mit ihrem VOLLEN Betrag gegen das Budget —
 * lautlos, ohne Fehler, und kein Test wurde rot: Der Katalog-Test prüft Form
 * und Deep-Link, nicht den gerechneten Wert. Seit Welle 2 füllt das ViewModel
 * jeden Kanal, den ein Eintrag anmeldet, und meldet zurück, wenn eine Quelle
 * NICHT lesbar war, statt sie als leer auszugeben.
 */
export interface QuestionData {
  transactions?: readonly Transaction[];
  categories?: readonly Category[];
  accounts?: readonly Account[];
  allocationsByTransaction?: ReadonlyMap<string, TransactionAllocation[]>;
  contractDecisions?: ReadonlyMap<string, ContractDecision>;
  debts?: readonly Debt[];
  budgets?: readonly Budget[];
  /** Einstellungen — Steuersatz, Unternehmer-Modus, Notgroschen-Ziel. */
  settings?: UserSettings | null;
  /** Anlässe („Urlaub Italien") samt ihren Zuordnungen. */
  specialCategories?: readonly SpecialCategory[];
  specialCategoryAssignments?: readonly SpecialCategoryAssignment[];
  /** Depots samt Positionen — je Depot ein Eintrag in der Map. */
  portfolios?: readonly Portfolio[];
  positionsByPortfolio?: ReadonlyMap<string, PortfolioPosition[]>;
  /** Vermögensaufstellung inkl. Kontosalden aus den Ankern. */
  netWorth?: NetWorthBreakdown | null;
  /** Steuerrücklage des laufenden Veranlagungsjahres. */
  taxReserve?: TaxReserveState | null;
  /** Bezugszeitpunkt — hereingereicht, damit `antwort()` rein bleibt. */
  jetzt: Date;
}

/**
 * Art der Antwort — steuert, wie die Präsentation sie darstellt.
 *
 * `szenario` (WP-H): Die Antwort IST noch keine Zahl, sondern die erkannte
 * Veränderungs-Menge — die Präsentation zeigt sie als korrigierbare Chips
 * und rechnet die Monte-Carlo-Simulation asynchron nach (`antwort()` bleibt
 * rein und synchron; eine teure Rechnung gehört nicht ins Register).
 */
export type AnswerKind =
  | 'geld'
  | 'anzahl'
  | 'quote'
  | 'datum'
  | 'liste'
  | 'verweis'
  | 'szenario'
  /**
   * `vergleich` (Welle 1): Zwei Größen nebeneinander — Wert, Referenz und
   * Differenz. Trägt sowohl „Aldi oder Lidl?" als auch „mehr als im
   * Vorjahr?"; es ist dieselbe Rechnung, und zwei Antwortarten dafür
   * würden bloss auseinanderlaufen.
   */
  | 'vergleich'
  /**
   * `aktion` (WP-I): Die Antwort IST eine VORSCHAU einer Schreiboperation,
   * nicht ihre Ausführung. Die Präsentation zeigt sie und schreibt erst auf
   * ausdrücklichen Klick — der Chat schreibt nie aus eigener Deutung.
   */
  | 'aktion'
  /**
   * `zielrueckrechnung` (Welle 3): Die Antwort ist noch KEINE Zahl, sondern
   * die gestellte Zielfrage — „wie hoch höchstens?" oder „wie viel monatlich?".
   * Gerechnet wird sie asynchron in der Fläche über die Monte-Carlo-Suche,
   * genau wie bei `szenario`: Eine Binärsuche mit hunderten Simulationsläufen
   * gehört nicht in eine reine, synchrone `antwort()`.
   */
  | 'zielrueckrechnung'
  | 'keine';

/**
 * Eine Zeile einer Listen-Antwort („Top-Händler", „teurer gewordene
 * Verträge"). `label` ist NUTZERDATUM (Händler-/Vertragsname), kein
 * Bildschirmtext — übersetzt wird hier nichts. `betrag` ist roh; maskiert
 * wird in der Präsentation (Sanfter Modus), wie überall im Register.
 */
export interface ListenPosten {
  label: string;
  /**
   * i18n-Key STATT `label`, wenn die Zeile keinen Nutzertext trägt, sondern
   * eine feste Rubrik („Bar", „Depots", „Forderungen", „Schulden" in der
   * Vermögensaufteilung). Ohne dieses Feld hätte die Präsentation raten
   * müssen, ob ein `label` zu übersetzen ist — und eine Konvention, die man
   * nur durch Lesen des Kommentars erfährt, hält keine zwei Änderungen durch.
   * Ist `labelKey` gesetzt, gewinnt er; `label` bleibt der Rückfall.
   */
  labelKey?: string;
  betrag: number;
  /**
   * Monat (yyyy-mm), auf den sich die Zeile bezieht — ROH, formatiert wird in
   * der Präsentation je Sprache. Ein rohes „2026-07" auf dem Bildschirm war
   * bereits einmal ein Browser-Fund; deshalb liefert das Register hier
   * ausdrücklich Daten, keinen Anzeigetext.
   */
  monatIso?: string;
}

/** Ein i18n-Key samt Platzhaltern. Nie ein fertiger Satz. */
export interface Aussage {
  key: string;
  params: Record<string, string | number>;
}

/**
 * Zwei Größen nebeneinander. `labelWert`/`labelReferenz` sind NUTZERDATEN
 * (Händlername, Kategoriename, Zeitraum-Label) — hier wird nichts übersetzt,
 * dieselbe Regel wie bei `ListenPosten.label`.
 */
export interface VergleichsAntwort {
  labelWert: string;
  labelReferenz: string;
  referenz: number;
  /** `wert − referenz`. Negativ heisst: die erste Größe ist kleiner. */
  differenz: number;
  /** Relative Veränderung gegenüber der Referenz; `null`, wenn diese null ist. */
  quote: number | null;
}

/**
 * Eine Zielfrage — die Umkehrung der Leistbarkeit.
 *
 * `obergrenze`: „Wie hoch darf X höchstens sein, damit mein Puffer hält?"
 * `sparrate`: „Wie viel muss ich monatlich zurücklegen, um X zu schaffen?"
 *
 * Beide brauchen dieselbe Engine und unterscheiden sich nur darin, WELCHE
 * Grösse gesucht wird — deshalb eine Form mit einer `art`, nicht zwei.
 */
export interface Zielfrage {
  art: 'obergrenze' | 'sparrate';
  /** Betrag des Ziels — bei `obergrenze` das Gesuchte und deshalb offen. */
  betrag?: number;
  /** Tage bis zum Ziel; Vorgabe ist der Horizont des Eintrags. */
  inTagen: number;
}

export interface QuestionAnswer {
  art: AnswerKind;
  /** Euro bei `art: 'geld'`, Anteil 0..1 bei `quote`, sonst je nach Art. */
  wert: number | null;
  /** Wie viele Buchungen/Posten hinter dem Wert stehen. */
  anzahl: number;
  /** Zeilen einer `art: 'liste'`-Antwort — sonst leer. */
  posten?: readonly ListenPosten[];
  /** Die Veränderungs-Menge einer `art: 'szenario'`-Antwort — sonst leer. */
  szenario?: SzenarioAbsicht;
  /** Die Vorschau einer `art: 'aktion'`-Antwort — sonst leer. */
  aktion?: BudgetAktionsVorschlag;
  /** Die gestellte Frage einer `art: 'zielrueckrechnung'`-Antwort. */
  ziel?: Zielfrage;
  /**
   * Die Gegenüberstellung einer `art: 'vergleich'`-Antwort — sonst leer.
   * `wert` trägt dabei die HAUPT-Größe, `vergleich.referenz` die zweite;
   * beide roh, maskiert wird in der Präsentation.
   */
  vergleich?: VergleichsAntwort;
  aussage: Aussage;
  /** Worauf der Wert beruht — erklärbar wie `CategorizationResult.reasons`. */
  begruendung?: Aussage[];
  deepLink: string;
  /**
   * Was der Deep-Link zeigt — und damit, wie die Präsentation ihn beschriften
   * darf.
   *
   * - `quelle`: GENAU die Menge, aus der `wert` entstand. Dafür gilt die harte
   *   Invariante des Registers (Anzahl und Summe der verlinkten Liste stimmen
   *   mit der Antwort überein), abgesichert durch einen generischen Test über
   *   den ganzen Katalog.
   * - `kontext`: eine verwandte, aber NICHT identische Menge. Das ist kein
   *   Schlupfloch, sondern eine echte Unterscheidung: „Was kostet mich Netflix
   *   im Jahr?" beantwortet sich aus der erkannten Vertragsserie, während der
   *   Link alle Buchungen dieses Händlers zeigt — ein einmaliger Gutscheinkauf
   *   wäre im Link, aber nicht in der Jahresrechnung. Diese Entfernung zu
   *   benennen ist ehrlicher, als die Zahl passend zu biegen; die Präsentation
   *   beschriftet solche Links entsprechend zurückhaltender.
   */
  deepLinkArt: 'quelle' | 'kontext';
  /**
   * Eigene Beschriftung des Links, wenn weder „genau diese Buchungen" noch
   * „verwandte Buchungen" passt — etwa wenn das Ziel gar keine Buchungsliste
   * ist, sondern ein Vertrag. Ohne sie greift die Beschriftung nach
   * `deepLinkArt`.
   */
  deepLinkLabelKey?: string;
}

export interface QuestionEntry {
  /** Stabile ID, nie übersetzt, nie umbenannt: `ausgaben.haendler`. */
  id: string;
  slots: { erforderlich: readonly SlotName[]; optional: readonly SlotName[] };
  /**
   * Auslösebegriffe als **i18n-Keys**, nicht als Wörter — sonst wäre jeder
   * Eintrag einsprachig. Die Wörter stehen im Sprachbaum.
   */
  ausloeser: readonly string[];
  /**
   * Verstärker: Begriffe, die einen Eintrag SCHÄRFEN, aber allein nie
   * qualifizieren („zusammen", „anteil", der Vertragskontext bei
   * `vertraege.teurer`). Gemessen am Korpus: Als normale Auslöser haben genau
   * solche generischen Zusatzwörter Lücken-Fragen zuversichtlich falsch
   * beantwortet („was kostet mich mein auto … alles zusammen" → Abo-Summe).
   * Ein Verstärker zählt Punkte NUR, wenn mindestens ein Auslöser traf —
   * dieselbe Idee, die die Präpositions-Auslöser „bei"/„für" hätten sein
   * sollen, diesmal als benannter Mechanismus.
   */
  verstaerker?: readonly string[];
  needs: readonly DataNeed[];
  /**
   * `teuer` heisst: Der Eintrag rechnet NICHT, sondern verweist. Reserviert
   * für Antworten, die eine Monte-Carlo-Suche o. Ä. bräuchten — die pro
   * Tastendruck auszuführen wäre die Fläche, die beim Tippen einfriert.
   */
  aufwand: 'guenstig' | 'teuer';
  /**
   * Darf dieser Eintrag HYPOTHETISCHE Fragen nehmen („wenn ich …", „mit
   * welcher Wahrscheinlichkeit …")? Solche Fragen reden über eine VERÄNDERTE
   * Welt; eine Bestandsauswertung, die darauf mit Ist-Zahlen antwortet,
   * beantwortet die falsche Frage. Heute trägt das nur der Verweis auf die
   * Simulation — sie ist die einzige Funktion, die veränderte Welten rechnet.
   */
  beantwortetSzenarien?: boolean;
  /**
   * Nimmt dieser Eintrag die vom Router extrahierte {@link SzenarioAbsicht}
   * entgegen (WP-H)? Genau EIN Eintrag im Katalog trägt das Flag — der
   * Router routet eine Frage mit mehreren erkannten Veränderungen direkt
   * dorthin, weil mehrere extrahierte Deltas stärkere Evidenz sind als jedes
   * einzelne Auslösewort.
   */
  nimmtSzenarioAbsicht?: boolean;
  /**
   * Nimmt dieser Eintrag eine erkannte {@link BudgetAktionsAbsicht} entgegen
   * (WP-I)? Genau EIN Eintrag im Katalog trägt das Flag. Auch er RECHNET nur
   * die Vorschau — geschrieben wird ausschliesslich per Bestätigen-Klick.
   */
  nimmtBudgetAktion?: boolean;
  /**
   * Auf WELCHER Achse vergleicht dieser Eintrag (Welle 1)? Je Achse genau
   * ein Eintrag. Erkennt der Router zwei Größen derselben Achse, routet er
   * direkt hierher — zwei genannte Vergleichspartner sind stärkere Evidenz
   * als jedes einzelne Auslösewort, dieselbe Begründung wie beim
   * Szenario-Gate.
   */
  nimmtVergleich?: 'haendler' | 'kategorie' | 'zeitraum';
  /**
   * Normiert dieser Eintrag auf MONATE (Welle 1)?
   *
   * Dann darf er nicht antworten, wenn die Frage eine andere Bezugsperiode
   * nennt: „Was kostet mich mein Auto pro NUTZUNG?" und „Wie viel gebe ich
   * pro WOCHE aus?" fragen nach etwas, das dieser Eintrag nicht rechnet —
   * und eine Monatszahl darauf ist nicht knapp daneben, sondern eine
   * Antwort auf eine andere Frage.
   *
   * Dieselbe Bauform wie das Szenario-Gate: ein deterministischer
   * Ausschluss, kein Vokabel-Feintuning. Gemessen entstand er, weil sich
   * die Fehlschläge sonst nur zwischen den Korpora verschoben — jede
   * Paraphrase, die eine Monatsfrage rettete, kippte eine Nutzungsfrage.
   */
  normiertAufMonat?: boolean;
  /** REIN und SYNCHRON. Ruft keinen Service — auch ein Aktions-Eintrag nicht. */
  antwort(slots: QuestionSlots, daten: QuestionData): QuestionAnswer;
}

export interface QuestionRegistry {
  readonly entries: readonly QuestionEntry[];
  byId(id: string): QuestionEntry | undefined;
  /** Alle Bedürfnisse der genannten Einträge — Eingabe fürs Laden. */
  needsFor(ids: readonly string[]): DataNeed[];
}

/**
 * Baut das Register und weist doppelte IDs ab.
 *
 * Doppelte IDs sind der Fehler, der sonst still bleibt: Der spätere Eintrag
 * gewänne, der frühere verschwände wortlos — dieselbe Falle wie der doppelte
 * i18n-Namespace (AGENTS.md §6).
 */
export function createQuestionRegistry(entries: readonly QuestionEntry[]): QuestionRegistry {
  const byId = new Map<string, QuestionEntry>();
  const doppelt: string[] = [];

  for (const entry of entries) {
    if (byId.has(entry.id)) doppelt.push(entry.id);
    byId.set(entry.id, entry);
  }
  if (doppelt.length) {
    // Wortlaut bewusst technisch und nicht deutsch: Die Meldung nennt IDs,
    // nicht Prosa — der deutsche Wortlaut wäre hier nicht „die Sache selbst"
    // und rechtfertigte damit keinen Eintrag in `i18n-allowlist.json`
    // (AGENTS.md §6). Vorbild ist `entitlement-service.ts`, das seine Würfe
    // ebenso technisch formuliert.
    throw new Error(`question-registry: duplicate ids: ${[...new Set(doppelt)].sort().join(', ')}`);
  }

  const sortiert = [...entries].sort((a, b) => a.id.localeCompare(b.id));

  return {
    entries: sortiert,
    byId: (id) => byId.get(id),
    needsFor: (ids) => {
      const benoetigt = new Set<DataNeed>();
      for (const id of ids) {
        for (const need of byId.get(id)?.needs ?? []) benoetigt.add(need);
      }
      return [...benoetigt].sort();
    },
  };
}

/** Fehlende Pflicht-Slots eines Eintrags — die Grundlage jeder Rückfrage. */
export function fehlendeSlots(entry: QuestionEntry, slots: QuestionSlots): SlotName[] {
  const vorhanden: Record<SlotName, boolean> = {
    zeitraum: slots.zeitraum !== undefined,
    kategorie: (slots.kategorieIds?.length ?? 0) > 0,
    haendler: slots.haendler !== undefined,
    konto: slots.kontoId !== undefined,
    betrag: slots.betrag !== undefined,
    anlass: slots.anlassId !== undefined,
  };
  return entry.slots.erforderlich.filter((slot) => !vorhanden[slot]);
}
