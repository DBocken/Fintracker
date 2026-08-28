/**
 * Slots → Filterzustand: die eine Quelle, aus der Registereinträge der
 * Buchungen-Slice sowohl RECHNEN als auch VERLINKEN.
 *
 * Ausgelagert (Welle 1), weil die Kennzahl-Einträge (`metric-questions.ts`)
 * dieselbe Übersetzung brauchen und der Katalog-Glob je Slice nur EINE
 * `questions.ts` einsammelt — zwei Kopien der Übersetzung wären zwei
 * Wahrheiten über dieselbe Menge, und genau daran hängt die Invariante des
 * Registers.
 */
import type { QuestionEntry, QuestionSlots, SlotName } from '@/lib/question-registry';
import type { DashboardFilterState } from '@/features/shared/domain/dashboard-filters';

/**
 * Übersetzt die Slots in genau den Filterzustand, mit dem gerechnet UND
 * verlinkt wird. Eine Quelle für beides — das ist der ganze Trick hinter der
 * Invariante.
 *
 * `erlaubt` ist nicht Zierde: Ein Eintrag darf NUR die Slots auswerten, die er
 * deklariert hat. Sonst filterte `ausgaben.haendler` zusätzlich nach einer
 * Kategorie, die ihm jemand mitgegeben hat, ohne dass die Frage danach
 * gefragt hätte — und die genannte Zahl wäre stillschweigend eine andere als
 * die erwartete.
 */
export function filterAusSlots(
  slots: QuestionSlots,
  erlaubt: ReadonlySet<SlotName>,
): Partial<DashboardFilterState> {
  const filters: Partial<DashboardFilterState> = {};
  if (erlaubt.has('haendler') && slots.haendler) filters.merchant = slots.haendler;
  if (erlaubt.has('kategorie') && slots.kategorieIds?.length) {
    // Eine Kategorie bleibt die Einzelauswahl (kurze, lesbare URL), mehrere
    // gehen als Menge — beides landet in `cat`, `aktiveKategorien()` löst es
    // wieder auf. Gerechnet und verlinkt wird damit aus derselben Quelle;
    // genau daran hängt die Invariante des Registers.
    if (slots.kategorieIds.length === 1) filters.category = slots.kategorieIds[0];
    else filters.categories = slots.kategorieIds;
  }
  if (erlaubt.has('konto') && slots.kontoId) filters.account = slots.kontoId;
  if (erlaubt.has('zeitraum') && slots.zeitraum) {
    const token = slots.zeitraum.rangeToken;
    if (/^\d{4}(-Q[1-4]|-\d{2})?$/.test(token)) {
      // Konkrete Periode: `range` trägt sie direkt (2026-Q2, 2026-07, 2026).
      filters.range = token.length === 4 ? 'Jahr' : token.includes('Q') ? 'Quartal' : 'Monat';
      filters.customPeriod = token;
    } else {
      // Rollende Spannen. Ohne diese Zuordnung fiele „letzte 30 Tage" still
      // auf „Gesamt" zurück — die Antwort nennte dann eine Summe über den
      // ganzen Bestand, obwohl nach einem Monat gefragt war.
      const spannen: Record<string, { range: DashboardFilterState['range']; tage?: number }> = {
        '7d': { range: '7 Tage', tage: 7 },
        '30d': { range: '30 Tage', tage: 30 },
        '90d': { range: '90 Tage', tage: 90 },
        all: { range: 'Gesamt' },
      };
      const spanne = spannen[token];
      if (spanne) {
        filters.range = spanne.range;
        if (spanne.tage) filters.customDays = spanne.tage;
      }
    }
  }
  return filters;
}

/** Vollständiger Zustand fürs Rechnen — `buildTransactionsHref` spreizt denselben. */
export function vollstaendig(partial: Partial<DashboardFilterState>): DashboardFilterState {
  return {
    category: 'all',
    account: 'all',
    contract: 'all',
    essential: 'all',
    ausgabenklasse: 'all',
    search: '',
    merchant: '',
    range: 'Gesamt',
    customDays: 30,
    customPeriod: '',
    ...partial,
  };
}

/** Alle Slots, die ein Eintrag überhaupt auswerten darf. */
export function erlaubteSlots(entry: Pick<QuestionEntry, 'slots'>): ReadonlySet<SlotName> {
  return new Set([...entry.slots.erforderlich, ...entry.slots.optional]);
}

