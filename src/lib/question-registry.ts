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

export type SlotName = 'zeitraum' | 'kategorie' | 'haendler' | 'konto' | 'betrag';

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

export interface QuestionSlots {
  zeitraum?: ZeitraumSlot;
  /** Stabile Kategorie-ID, nie der Anzeigename (AGENTS.md §6). */
  kategorieId?: string;
  /** Normalisierter Händlername (`normalizeMerchantName`), nie ein Fingerprint. */
  haendler?: string;
  kontoId?: string;
  betrag?: number;
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
  | 'budgets';

/** Was die `application`-Schicht bereitstellt. Optional, weil `needs` steuert. */
export interface QuestionData {
  transactions?: readonly Transaction[];
  categories?: readonly Category[];
  accounts?: readonly Account[];
  allocationsByTransaction?: ReadonlyMap<string, TransactionAllocation[]>;
  contractDecisions?: ReadonlyMap<string, ContractDecision>;
  debts?: readonly Debt[];
  budgets?: readonly Budget[];
  /** Bezugszeitpunkt — hereingereicht, damit `antwort()` rein bleibt. */
  jetzt: Date;
}

/** Art der Antwort — steuert, wie die Präsentation sie darstellt. */
export type AnswerKind = 'geld' | 'anzahl' | 'quote' | 'datum' | 'liste' | 'verweis' | 'keine';

/**
 * Eine Zeile einer Listen-Antwort („Top-Händler", „teurer gewordene
 * Verträge"). `label` ist NUTZERDATUM (Händler-/Vertragsname), kein
 * Bildschirmtext — übersetzt wird hier nichts. `betrag` ist roh; maskiert
 * wird in der Präsentation (Sanfter Modus), wie überall im Register.
 */
export interface ListenPosten {
  label: string;
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

export interface QuestionAnswer {
  art: AnswerKind;
  /** Euro bei `art: 'geld'`, Anteil 0..1 bei `quote`, sonst je nach Art. */
  wert: number | null;
  /** Wie viele Buchungen/Posten hinter dem Wert stehen. */
  anzahl: number;
  /** Zeilen einer `art: 'liste'`-Antwort — sonst leer. */
  posten?: readonly ListenPosten[];
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
  /** REIN und SYNCHRON. Ruft keinen Service. */
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
    kategorie: slots.kategorieId !== undefined,
    haendler: slots.haendler !== undefined,
    konto: slots.kontoId !== undefined,
    betrag: slots.betrag !== undefined,
  };
  return entry.slots.erforderlich.filter((slot) => !vorhanden[slot]);
}
