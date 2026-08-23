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
}

export interface QuestionVocabulary {
  kategorien: readonly VokabelEintrag[];
  konten: readonly VokabelEintrag[];
  haendler: readonly VokabelEintrag[];
  /** Eintrags-ID → aufgelöste Auslösewörter (aus dem Sprachbaum geholt). */
  ausloeser: ReadonlyMap<string, readonly string[]>;
}

export interface QuestionCandidate {
  entryId: string;
  score: number;
  slots: QuestionSlots;
  fehlend: SlotName[];
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

    const kandidaten: QuestionCandidate[] = [];

    for (const entry of entries) {
      const worte = vokabular.ausloeser.get(entry.id) ?? [];
      const ausloeserTreffer = worte.filter((wort) => normalisiert.includes(normalisiere(wort))).length;

      const slots: QuestionSlots = {};
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

      const score = ausloeserTreffer * 3 + slotPunkte;
      if (score <= 0) continue;

      kandidaten.push({ entryId: entry.id, score, slots, fehlend: fehlendeSlots(entry, slots) });
    }

    // Vollständige Kandidaten zuerst, dann nach Punkten, dann nach ID —
    // die letzte Stufe macht die Reihenfolge reproduzierbar.
    return kandidaten.sort((a, b) => {
      if (a.fehlend.length !== b.fehlend.length) return a.fehlend.length - b.fehlend.length;
      if (b.score !== a.score) return b.score - a.score;
      return a.entryId.localeCompare(b.entryId);
    });
  },
};
