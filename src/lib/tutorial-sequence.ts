/**
 * Lehrplan des Tutorials — welche Kapitel in welcher Reihenfolge laufen.
 *
 * Begründung und Herleitung stehen in `docs/tutorial-sequence.md`; hier steht
 * nur, was der Code davon trägt. Drei Entscheidungen von dort sind hier
 * eingebaut und sollten nicht versehentlich zurückgedreht werden:
 *
 * 1. **Die Reihenfolge folgt dem Geldfluss, nicht der Navigation.**
 *    `NAV_GROUPS` ist nach Aufmerksamkeit sortiert (Coach zuerst), nicht nach
 *    Verstehbarkeit. Gelernt wird entlang des Euro durch den Monat:
 *    hereinkommen → was fest weggeht → was steuerbar bleibt → was vorausliegt.
 * 2. **Die Finanzstadt ist Kernkapitel** ({@link TutorialStage} `core`), nicht
 *    an eine Bereichsauswahl gebunden — sie ist die zentrale Darstellung.
 * 3. **Kapitel ohne Datengrundlage werden vertagt, nicht leer gezeigt.** Ein
 *    Rahmen um einen leeren Bildschirm lehrt nichts, er beschädigt das
 *    Vertrauen in die Erklärung.
 *
 * Reine Domänenschicht: kein React, kein I/O, keine Service-Aufrufe
 * (AGENTS.md §3). Die Datenreife wird als Wert hereingereicht
 * ({@link DataReadiness}), damit der Lehrplan ohne Mock testbar bleibt.
 */

import {
  isFeatureEnabled,
  type LifeSituationId,
  type NavFeatureId,
} from './life-situations';

/** Die drei Wege, auf denen Daten in die App kommen (Kapitel 0, die Weiche). */
export const TUTORIAL_SOURCES = ['csv', 'bank', 'demo'] as const;

export type TutorialSource = (typeof TUTORIAL_SOURCES)[number];

export type TutorialChapterId =
  | 'source'
  | 'transactions'
  | 'categories'
  | 'transactionsFilter'
  | 'transactionDetails'
  | 'transactionSplit'
  | 'dashboard'
  | 'city'
  | 'coach'
  | 'accounts'
  | 'income'
  | 'contracts'
  | 'budgets'
  | 'liquidity'
  | 'milestones'
  | 'debts'
  | 'occasions'
  | 'netWorth'
  | 'tax'
  | 'euer'
  | 'premiumReports'
  | 'trading'
  | 'export'
  | 'settings';

/**
 * Grobe Position im Lehrplan. Trägt die Umsortierung: Vorgezogene Kapitel
 * (siehe {@link LEAD_FEATURES}) dürfen die Reihenfolge **innerhalb** von
 * `optional` ändern, aber nie den Kern überholen und nie den Ausgang nach
 * hinten schieben.
 */
export type TutorialStage = 'core' | 'optional' | 'closing';

/**
 * Zustand der Daten, aus dem sich ergibt, ob ein Kapitel jetzt etwas zu zeigen
 * hat. Wird einmal in der Service-Schicht erhoben und als Wert übergeben.
 */
export interface DataReadiness {
  transactionCount: number;
  /** Monate mit echten Buchungen — die Währung der Erkennungs-Schwellen. */
  monthsOfHistory: number;
  /** Monate, in denen Buchungen kategorisiert sind (Grundlage der Stadt). */
  categorizedMonths: number;
  accountCount: number;
  hasSalaryDetected: boolean;
  hasRecurringDetected: boolean;
  hasBudget: boolean;
  hasDebt: boolean;
  hasOccasion: boolean;
  /** Vermögen jenseits der Konten (Depot, Immobilie, Fahrzeug). */
  hasAssetsBeyondAccounts: boolean;
  hasDeductibleCategory: boolean;
  businessMode: boolean;
  hasPortfolio: boolean;
  hasPremiumAccess: boolean;
}

export interface TutorialChapter {
  id: TutorialChapterId;
  stage: TutorialStage;
  /**
   * Bereich, dessen Auswahl dieses Kapitel voraussetzt. `null` = Kernkapitel,
   * das unabhängig von der Bereichsauswahl läuft.
   *
   * Die Finanzstadt steht bewusst mit `null` hier, obwohl `'city'` heute noch
   * eine {@link NavFeatureId} ist: Sie ist als zentrale Darstellung nicht
   * abwählbar (`docs/tutorial-sequence.md`). Der Lehrplan hängt dadurch nicht
   * daran, wann die Navigation nachzieht — und bricht nicht, wenn `'city'`
   * dort später entfällt.
   */
  feature: NavFeatureId | null;
  /** Hat das Kapitel jetzt etwas zu zeigen? Reine Funktion über die Reife. */
  requires: (readiness: DataReadiness) => boolean;
}

/**
 * Ab hier wird die App wahr: Einkommenserkennung (`salary-detection.ts`,
 * `MIN_MONTHS = 3`), Vertragserkennung (`contract-detection-service.ts`,
 * drei gleiche Buchungen je Zahlungsempfänger) und adaptive Budgets
 * (`budget-adaptive.ts`, `minMonths` 3) verlangen alle dieselbe Historie.
 *
 * Bewusst als eigene Konstante gespiegelt statt importiert: die drei Module
 * dürfen ihre Schwelle unabhängig voneinander bewegen, der Lehrplan will
 * dann nicht stillschweigend mitwandern.
 */
export const MIN_MONTHS_FOR_TRENDS = 3;

/** Unter dieser Zahl ist ein Flussdiagramm eher Rauschen als Aussage. */
export const MIN_TRANSACTIONS_FOR_FLOW = 20;

const always = () => true;

function chapter(
  id: TutorialChapterId,
  stage: TutorialStage,
  feature: NavFeatureId | null,
  requires: (readiness: DataReadiness) => boolean,
): TutorialChapter {
  return { id, stage, feature, requires };
}

/**
 * Die globale Lernreihenfolge — genau EIN Ort.
 *
 * Bewusst nicht in den `features`-Listen von `LIFE_SITUATIONS` hinterlegt:
 * `resolveFeatureSelection` sortiert deren Ergebnis ohnehin nach der
 * kanonischen Nav-Reihenfolge, eine dort hinterlegte Lernreihenfolge käme nie
 * an — und zehn Listen wären zehn Orte, die bei jedem neuen Modul nachgezogen
 * werden müssten.
 */
export const TUTORIAL_ORDER: readonly TutorialChapter[] = [
  // Kapitel 0 — die Weiche. Drei Eingänge, ein Zusammenführungspunkt.
  chapter('source', 'core', null, always),

  // Teil 1 — der Kern und die erste Sitzung.
  chapter('transactions', 'core', null, (r) => r.transactionCount >= 1),
  chapter('categories', 'core', null, (r) => r.transactionCount >= 1),
  chapter('dashboard', 'core', null, (r) => r.transactionCount >= MIN_TRANSACTIONS_FOR_FLOW),
  // Die Stadt erntet, was das Kategorisieren gesät hat — ein kategorisierter
  // Monat reicht, die Drei-Monats-Schwellen gelten für sie nicht.
  chapter('city', 'core', null, (r) => r.categorizedMonths >= 1),
  chapter('coach', 'core', null, (r) => r.transactionCount >= 1),
  chapter('accounts', 'core', null, (r) => r.accountCount >= 1),

  // Vertiefung der Buchungsseite (`docs/tutorial-script-transactions.md`).
  // Bewusst NACH der ersten Sitzung: Erst kommt der Ertrag (Flussdiagramm,
  // Stadt), dann das Handwerk. Vorgezogen wäre es Pflichtstoff vor der
  // Belohnung — und genau das soll die behutsame Heranführung vermeiden.
  chapter(
    'transactionsFilter',
    'core',
    null,
    (r) => r.transactionCount >= MIN_TRANSACTIONS_FOR_FLOW,
  ),
  chapter('transactionDetails', 'core', null, (r) => r.transactionCount >= 1),
  // Das Aufteilen steht hinter einer Tarif-Schranke (`FeatureGate
  // splitTransactions`). Eine Fuehrung, die auf ein Schloss zeigt, verkauft
  // statt zu erklaeren — deshalb laeuft dieses Kapitel nur mit Zugang.
  chapter(
    'transactionSplit',
    'core',
    null,
    (r) => r.hasPremiumAccess && r.transactionCount >= 1,
  ),

  // Teil 2 — der Euro durch den Monat.
  chapter('income', 'optional', 'income', (r) => r.hasSalaryDetected),
  chapter('contracts', 'optional', 'contracts', (r) => r.hasRecurringDetected),
  chapter('budgets', 'optional', 'budgets', (r) => r.monthsOfHistory >= MIN_MONTHS_FOR_TRENDS),
  chapter(
    'liquidity',
    'optional',
    'liquidity',
    (r) => r.accountCount >= 1 && r.hasRecurringDetected,
  ),
  chapter('milestones', 'optional', 'milestones', (r) => r.hasBudget),

  // Teil 3 — Sonderlagen.
  chapter('debts', 'optional', 'debts', (r) => r.hasDebt),
  chapter('occasions', 'optional', 'occasions', (r) => r.hasOccasion),

  // Teil 4 — Vermögen und Pflicht.
  chapter(
    'netWorth',
    'optional',
    'netWorth',
    (r) => r.accountCount >= 2 || r.hasAssetsBeyondAccounts,
  ),
  chapter('tax', 'optional', 'tax', (r) => r.hasDeductibleCategory),
  chapter('euer', 'optional', 'euer', (r) => r.businessMode),

  // Teil 5 — Vertiefung.
  chapter(
    'premiumReports',
    'optional',
    'premiumReports',
    (r) => r.hasPremiumAccess && r.monthsOfHistory >= MIN_MONTHS_FOR_TRENDS,
  ),
  chapter('trading', 'optional', 'trading', (r) => r.hasPortfolio),

  // Abschluss — läuft auch für Abbrecher, sonst kennt niemand den Rückweg.
  chapter('export', 'closing', null, always),
  chapter('settings', 'closing', null, always),
];

/** Kapitel, die in jeder Situation laufen (ohne den Abschluss). */
export const CORE_CHAPTER_IDS: readonly TutorialChapterId[] = TUTORIAL_ORDER.filter(
  (c) => c.stage === 'core',
).map((c) => c.id);

const BY_ID = new Map<TutorialChapterId, TutorialChapter>(TUTORIAL_ORDER.map((c) => [c.id, c]));

export function chapterById(id: TutorialChapterId): TutorialChapter | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Was für eine Lebenssituation *zuerst* zählt.
 *
 * Bewusst kurz: umsortiert wird nur der Anfang des optionalen Blocks, alles
 * andere folgt der globalen Ordnung. Vorziehen darf **umsortieren, nie
 * hinzufügen** — ein Bereich, den der Nutzer nicht gewählt hat, entsteht
 * dadurch nicht. Sonst hinge das Ergebnis von der Klickreihenfolge ab, genau
 * wie es bei den Modifikatoren des Onboardings ausgeschlossen ist.
 */
export const LEAD_FEATURES: Partial<Record<LifeSituationId, readonly NavFeatureId[]>> = {
  // Wer bis zum Monatsende kommen muss, lernt nicht erst Einkommensanalyse.
  debt_focus: ['debts'],
  // Ein Einkommen trägt alles — die tagesgenaue Vorschau ist die Kernfrage.
  single_parent: ['debts', 'liquidity'],
  // Die Rücklage ist das Erste, was schiefgeht.
  self_employed: ['tax', 'euer'],
  creator: ['tax', 'euer'],
  // Der Schmerz sind die großen unregelmäßigen Ausgaben, nicht die Fixkosten.
  family: ['occasions'],
  // Vermögens*verzehr* ist die Leitfrage, nicht Aufbau.
  retired: ['netWorth'],
};

export interface CurriculumInput {
  /** Bereichsauswahl aus dem Onboarding. `null` = keine Einschränkung. */
  enabledFeatures?: readonly NavFeatureId[] | null;
  lifeSituation: LifeSituationId | null;
  readiness: DataReadiness;
  /** Bereits abgeschlossene Kapitel; unbekannte IDs werden ignoriert. */
  completed?: readonly TutorialChapterId[];
  /** Aus `UserSettings.enable_subcategories`. Default: an. */
  subcategoriesEnabled?: boolean;
}

export interface Curriculum {
  /** Kapitel, die jetzt laufen können — in Lernreihenfolge. */
  next: TutorialChapterId[];
  /**
   * Kapitel, die zum Lehrplan gehören, aber noch keine Datengrundlage haben.
   * Sie sind nicht übersprungen: der Coach trägt sie nach, sobald ihre
   * Voraussetzung eintritt.
   */
  postponed: TutorialChapterId[];
}

const STAGE_RANK: Record<TutorialStage, number> = { core: 0, optional: 1, closing: 2 };

/**
 * Bereichsauswahl + Lebenssituation + Datenreife → die konkrete Kapitelfolge.
 *
 * Vertagte Kapitel werden **gefiltert, nicht abgeschnitten**: ein Kapitel ohne
 * Daten hält den Rest des Lehrplans nicht auf. Wer nur einen Monat importiert
 * hat, lernt trotzdem alles, was mit einem Monat erklärbar ist.
 */
export function buildCurriculum(input: CurriculumInput): Curriculum {
  const { enabledFeatures = null, lifeSituation, readiness, completed = [], subcategoriesEnabled = true } = input;

  const done = new Set<TutorialChapterId>(completed);

  const applicable = TUTORIAL_ORDER.filter((c) => {
    if (done.has(c.id)) return false;
    // Ohne Unterkategorien wäre ein eigenes Kategorien-Kapitel Ballast; das
    // Zuordnen selbst trägt das Buchungs-Kapitel mit.
    if (c.id === 'categories' && !subcategoriesEnabled) return false;
    if (c.feature === null) return true;
    return isFeatureEnabled(c.feature, enabledFeatures);
  });

  const ordered = sortWithLead(applicable, lifeSituation);

  const next: TutorialChapterId[] = [];
  const postponed: TutorialChapterId[] = [];
  for (const c of ordered) {
    (c.requires(readiness) ? next : postponed).push(c.id);
  }

  return { next, postponed };
}

/**
 * Stabile Sortierung nach Abschnitt, mit den vorgezogenen Bereichen an der
 * Spitze des optionalen Blocks. Der Kern und der Abschluss bleiben unberührt.
 */
function sortWithLead(
  chapters: readonly TutorialChapter[],
  lifeSituation: LifeSituationId | null,
): TutorialChapter[] {
  const leads = (lifeSituation && LEAD_FEATURES[lifeSituation]) || [];
  const leadRank = new Map<NavFeatureId, number>(leads.map((f, i) => [f, i]));

  return [...chapters].sort((a, b) => {
    const stageDelta = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
    if (stageDelta !== 0) return stageDelta;

    const rankA = a.feature ? leadRank.get(a.feature) : undefined;
    const rankB = b.feature ? leadRank.get(b.feature) : undefined;
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return 0; // sonst: globale Reihenfolge (Array.sort ist stabil)
  });
}
