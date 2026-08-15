/**
 * Die Schritte innerhalb der Tutorial-Kapitel — was eingerahmt und was dazu
 * gesagt wird (`docs/tutorial-sequence.md`, „Kapitelgröße").
 *
 * Zwei Regeln, die hier eingebaut sind und leicht verloren gehen:
 *
 * 1. **Kein Text im Code.** Titel und Erklärung kommen ausschließlich über
 *    Schlüssel, die sich mechanisch aus Kapitel- und Schritt-ID ergeben
 *    ({@link stepTitleKey}, {@link stepBodyKey}). Beschriftungen dürfen sich
 *    danach beliebig ändern, ohne dass diese Datei etwas davon merkt.
 * 2. **Der Anker ist ein Marker, kein Text.** `data-tour-id` statt „das
 *    Element mit der Aufschrift X" — sonst bricht jede Umbenennung die
 *    Führung still. Fehlt der Anker zur Laufzeit, wird der Schritt
 *    übersprungen und niemand blockiert.
 *
 * Reine Domänenschicht: kein React, kein DOM (AGENTS.md §3).
 */

import type { TutorialChapterId } from './tutorial-sequence';

export interface TutorialStep {
  /** Stabil; Teil des i18n-Schlüssels. Wird nie mit einer Beschriftung umbenannt. */
  id: string;
  /**
   * `data-tour-id` des Elements, das eingerahmt wird. Ohne Anker erscheint der
   * Schritt mittig — für Aussagen, die zu keinem einzelnen Element gehören.
   */
  anchor?: string;
  /** Route, auf der dieser Schritt spielt. Der Lauf navigiert vorher dorthin. */
  route?: string;
  /**
   * `data-tour-id` eines Elements, das die Führung **anklickt**, bevor der
   * Schritt erscheint — für Bereiche, die es vorher gar nicht gibt
   * (Detailansicht, Aufteilen-Panel).
   *
   * Die Führung öffnet selbst, statt „bitte klicke jetzt auf …" zu sagen:
   * Sonst hinge die Folge davon ab, ob der Nutzer im richtigen Moment das
   * Richtige trifft, und bräche beim ersten Fehlklick ab.
   */
  openAnchor?: string;
  /**
   * Der Schritttext fordert den NUTZER SELBST zu einer Aktion am Anker auf
   * (tippen, klicken, auswählen) — anders als `openAnchor`, wo die Führung
   * das selbst übernimmt. `TutorialOverlay` hebt einen solchen Anker in
   * Warnfarbe hervor und lässt den Rahmen einmalig aufblitzen, statt ihn wie
   * einen reinen Erklär-Schritt neutral zu umranden — sonst sehen „schau her"
   * und „mach das jetzt" identisch aus, und genau das macht den Unterschied
   * zwischen Führung und Textkasten aus (`TutorialOverlay`-Doku, Regel 3).
   */
  interactive?: boolean;
}

function step(
  id: string,
  route: string,
  anchor?: string,
  openAnchor?: string,
  interactive?: boolean,
): TutorialStep {
  return {
    id,
    route,
    ...(anchor ? { anchor } : {}),
    ...(openAnchor ? { openAnchor } : {}),
    ...(interactive ? { interactive } : {}),
  };
}

/**
 * Schritte je Kapitel. Kapitel ohne Eintrag werden im Lauf **übersprungen** —
 * ein leeres Kapitel ist kein Fehler, sondern noch nicht geschriebener Text.
 *
 * Zwei Dinge, die hier bewusst so sind und sonst wie Lücken aussehen:
 *
 * - **`source` hat keine Schritte.** Kapitel 0 ist der `DataSourceDialog`
 *   selbst; ein Overlay über einem modalen Dialog wäre eine Führung durch eine
 *   Führung. Das Kapitel gilt als erledigt, sobald die Weiche beantwortet ist.
 * - **Ein Kapitel ist ein Arbeitsschritt, kein Bildschirm.** Die
 *   Buchungsseite hat allein 30 erklaerbare Bedienelemente; sie zerfaellt
 *   deshalb in vier Kapitel (`docs/tutorial-script-transactions.md`).
 * - **Nur die erste Sitzung hat Anker.** `transactions`, `categories`,
 *   `dashboard` und `city` rahmen ein konkretes Element ein; die übrigen
 *   Kapitel dunkeln ab und erklären den Bereich als Ganzes. Das ist für den
 *   ersten Auftritt eines gerade freigeschalteten Bereichs auch das Richtige —
 *   „das gibt es jetzt, dafür ist es da". Einzelne Elemente einzurahmen lohnt
 *   sich erst, wenn die Texte stehen; ein Anker ist billig nachzurüsten, ein
 *   falsch gesetzter kostet einen Refactor.
 */
export const TUTORIAL_STEPS: Partial<Record<TutorialChapterId, readonly TutorialStep[]>> = {
  // Kapitel 0.5 — nur der Datei-Weg landet hier, direkt nach der Weiche
  // (`tutorial-sequence.ts`). Ohne Anker wie die meisten Sekundär-Kapitel:
  // die Review-Tabelle existiert erst nach einem hochgeladenen Datensatz und
  // wäre als Anker instabil (`docs/tutorial-sequence.md`, "erst wenn die
  // Texte stehen lohnt sich ein Anker").
  csv: [
    step('upload', '/csv'),
    step('review', '/csv'),
  ],

  // Akt I — die Liste lesen (`docs/tutorial-script-transactions.md`).
  transactions: [
    step('overview', '/transactions', 'transactions-list'),
    step('row', '/transactions', 'transactions-first-row'),
    step('day', '/transactions', 'transactions-day-header'),
    step('balance', '/transactions', 'transactions-running-balance'),
    step('stats', '/transactions', 'transactions-stats'),
    step('add', '/transactions', 'transactions-add'),
  ],
  categories: [
    step('why', '/transactions', 'transactions-first-row'),
    step('assign', '/transactions', 'transactions-first-row', undefined, true),
  ],

  // Akt II — finden.
  transactionsFilter: [
    step('search', '/transactions', 'transactions-search', undefined, true),
    step('timerange', '/transactions', 'filter-timerange'),
    step('category', '/transactions', 'filter-category'),
    step('account', '/transactions', 'filter-account'),
    step('contract', '/transactions', 'filter-contract'),
    step('essential', '/transactions', 'filter-essential'),
    step('reset', '/transactions', 'filter-reset'),
  ],

  // Akt III — eine Buchung verstehen und korrigieren. Schritt 2 oeffnet die
  // Detailansicht selbst; alles Weitere spielt darin.
  transactionDetails: [
    step('open', '/transactions', 'transactions-first-row'),
    step('panel', '/transactions', 'transaction-detail', 'transactions-first-row'),
    step('basics', '/transactions', 'detail-basics'),
    step('payee', '/transactions', 'detail-payee'),
    step('category', '/transactions', 'detail-category'),
    step('applySimilar', '/transactions', 'detail-apply-similar'),
    step('expenseClass', '/transactions', 'detail-expense-class'),
    step('tax', '/transactions', 'detail-tax'),
    step('transfer', '/transactions', 'detail-transfer'),
    step('contract', '/transactions', 'detail-contract'),
    step('visibility', '/transactions', 'detail-visibility'),
  ],

  // Akt IV — aufteilen. Schritt 1 oeffnet das Panel selbst.
  transactionSplit: [
    step('why', '/transactions', 'split-panel', 'transactions-first-row'),
    step('row', '/transactions', 'split-row', undefined, true),
    step('addRow', '/transactions', 'split-add-row'),
    step('remaining', '/transactions', 'split-remaining'),
    step('fillRemaining', '/transactions', 'split-fill-remaining'),
    step('save', '/transactions', 'split-save'),
  ],
  dashboard: [
    step('flow', '/dashboard', 'dashboard-flow'),
    step('period', '/dashboard', 'dashboard-flow'),
    step('customize', '/dashboard', 'kpi-customize', undefined, true),
  ],
  city: [
    step('arrival', '/city', 'city-canvas'),
    step('districts', '/city', 'city-canvas'),
    step('growth', '/city', 'city-canvas'),
    // Ohne Anker wie die meisten Sekundär-Schritte: Das Detail-Sheet öffnet
    // sich erst durch einen 3D-Tap auf ein Gebäude, den die Führung nicht
    // simulieren kann (kein DOM-Element zum Anklicken über `openAnchor`).
    step('tap', '/city'),
  ],
  coach: [
    step('today', '/coach'),
    step('rhythm', '/coach'),
  ],
  accounts: [
    step('balances', '/accounts'),
    step('realBalance', '/accounts'),
    step('addCash', '/accounts', 'accounts-add-cash', undefined, true),
  ],
  income: [
    step('sources', '/income'),
    step('stability', '/income'),
  ],
  contracts: [
    step('found', '/contracts'),
    step('price', '/contracts'),
    step('decide', '/contracts'),
  ],
  budgets: [
    step('tanks', '/budgets'),
    step('learning', '/budgets'),
    step('create', '/budgets', 'budgets-add', undefined, true),
    // Kein `openAnchor`: Anders als bei `transactionDetails.panel` gibt es
    // keinen bereits gerahmten Schritt auf `budgets-first-tile`, den die
    // Führung als „das hier anklicken" ausweisen könnte
    // (`tutorial-steps.test.ts` verlangt das für jeden `openAnchor`). Der
    // Bearbeiten-Knopf wird trotzdem benannt — sichtbar, sobald der Nutzer
    // selbst eine Kachel öffnet.
    step('edit', '/budgets', 'budgets-edit'),
  ],
  liquidity: [
    step('forecast', '/liquidity'),
    step('buffer', '/liquidity'),
  ],
  milestones: [
    step('goals', '/milestones'),
    step('progress', '/milestones'),
  ],
  debts: [
    step('overview', '/debts'),
    // `strategy` hatte bislang keinen Anker; die Reiter Avalanche/Snowball
    // (`debts-strategy`) existieren als konkretes Element auf der Seite.
    step('strategy', '/debts', 'debts-strategy'),
    step('create', '/debts', 'debts-add', undefined, true),
    // Ohne Anker: Die Zuordnungs-Karte ist nur auf breiten Bildschirmen
    // inline sichtbar (`hidden lg:block`), auf Mobil steckt sie im
    // Detail-Sheet einer einzelnen Schuld — kein über beide Breiten
    // stabiler Anker vorhanden (AGENTS.md §4, Plattform-Parität).
    step('assignPayments', '/debts'),
  ],
  occasions: [
    step('crosscut', '/occasions'),
    step('total', '/occasions'),
    step('create', '/occasions', 'occasions-create', undefined, true),
  ],
  netWorth: [
    step('stock', '/net-worth'),
    step('direction', '/net-worth'),
  ],
  tax: [
    step('deductible', '/tax'),
    step('collect', '/tax'),
  ],
  euer: [
    step('profit', '/euer'),
    step('reserve', '/euer'),
  ],
  premiumReports: [
    step('trends', '/premium'),
    step('insights', '/premium'),
  ],
  trading: [
    step('portfolio', '/trading'),
    step('valuation', '/trading'),
    step('addPosition', '/trading', 'trading-add-position', undefined, true),
  ],
  export: [
    step('ownership', '/export'),
    // [REGRESSION] Zeigte bislang auf /export — dort gibt es gar keine
    // Sicherungsfunktion. Die eigentliche Backup-Karte liegt unter
    // /settings (`BackupManager`, in `EnhancedSettings` eingebunden).
    step('backup', '/settings', 'backup-create'),
    step('restore', '/settings', 'backup-restore'),
  ],
  settings: [
    step('areas', '/settings'),
    step('unlockAll', '/settings'),
    step('language', '/settings'),
    step('encryption', '/settings', 'encryption-setup', undefined, true),
  ],
};

export function stepsFor(chapter: TutorialChapterId): readonly TutorialStep[] {
  return TUTORIAL_STEPS[chapter] ?? [];
}

/**
 * Name eines Kapitels — bewusst der **vorhandene Navigations-Schlüssel** statt
 * eines eigenen Textes.
 *
 * Damit gibt es das Wort nur einmal: Wird „Abos & Verträge" morgen umbenannt,
 * heißt das Kapitel automatisch mit. Ein eigener Satz Kapitelnamen wäre eine
 * zweite Wahrheit, die beim ersten Umbenennen auseinanderläuft.
 *
 * Nur `categories` hat kein Nav-Ziel und deshalb einen eigenen Schlüssel.
 */
const CHAPTER_NAME_KEYS: Partial<Record<TutorialChapterId, string>> = {
  csv: 'nav.items.csv',
  transactions: 'nav.items.transactions',
  categories: 'tutorial.categories.name',
  transactionsFilter: 'tutorial.transactionsFilter.name',
  transactionDetails: 'tutorial.transactionDetails.name',
  transactionSplit: 'tutorial.transactionSplit.name',
  dashboard: 'nav.items.dashboard',
  city: 'nav.items.city',
  coach: 'nav.items.coach',
  accounts: 'nav.items.accounts',
  income: 'nav.items.income',
  contracts: 'nav.items.contracts',
  budgets: 'nav.items.budgets',
  liquidity: 'nav.items.liquidity',
  milestones: 'nav.items.milestones',
  debts: 'nav.items.debts',
  occasions: 'specialCategories.title',
  netWorth: 'nav.items.netWorth',
  tax: 'nav.items.tax',
  euer: 'nav.items.euer',
  premiumReports: 'nav.items.premium',
  trading: 'nav.items.trading',
  export: 'nav.items.export',
  settings: 'nav.items.settings',
};

export function chapterNameKey(chapter: TutorialChapterId): string | null {
  return CHAPTER_NAME_KEYS[chapter] ?? null;
}

/**
 * Name des **Tutorials** — nicht des Bereichs, in dem es spielt.
 *
 * Der Unterschied trägt die Übersicht: Unter der Überschrift „Buchungen"
 * stehen fünf Kapitel, und fünfmal „Buchungen" wäre keine Liste, sondern ein
 * Echo. Hier steht, was das eine Kapitel zeigt („Die Liste lesen", „Suchen &
 * Filtern"). Der Schlüssel wird wie die Schritttexte mechanisch gebildet —
 * `src/lib/__tests__/tutorial-catalog.test.ts` prüft, dass es ihn in allen
 * Sprachen gibt.
 */
export function tutorialTitleKey(chapter: TutorialChapterId): string {
  return `tutorial.${chapter}.name`;
}

/** Kapitel, für die es schon Text gibt — in der Reihenfolge des Lehrplans. */
export function hasSteps(chapter: TutorialChapterId): boolean {
  return stepsFor(chapter).length > 0;
}

export function stepTitleKey(chapter: TutorialChapterId, step: TutorialStep): string {
  return `tutorial.${chapter}.${step.id}.title`;
}

export function stepBodyKey(chapter: TutorialChapterId, step: TutorialStep): string {
  return `tutorial.${chapter}.${step.id}.body`;
}

/**
 * Route, auf der ein Kapitel spielt — die seines ersten Schrittes.
 *
 * Ein Kapitel ist ein Arbeitsschritt auf **einer** Fläche; der erste Schritt
 * bestimmt sie. `null` für Kapitel ohne Schritte (`source`).
 */
export function chapterRoute(chapter: TutorialChapterId): string | null {
  return stepsFor(chapter)[0]?.route ?? null;
}

/**
 * Das erste Kapitel aus `chapters`, das auf der gerade geöffneten Seite
 * spielt — oder `null`.
 *
 * Der Grund, warum es diese Funktion gibt: Die Einladung schwebt über **jeder**
 * Seite, das nächste Kapitel des Lehrplans gehört aber meist zu einer anderen.
 * Wer das nicht prüft, sagt „eine Führung durch diesen Bereich" und startet
 * eine durch einen fremden — die Seite springt weg, und erklärt wird etwas
 * anderes als das, worauf der Nutzer gerade sieht.
 *
 * Die Reihenfolge von `chapters` ist die des Lehrplans und wird gewahrt:
 * Spielen zwei Kapitel auf derselben Fläche (`transactions`, `categories`),
 * gilt das frühere.
 */
export function chapterOnRoute(
  chapters: readonly TutorialChapterId[],
  pathname: string,
): TutorialChapterId | null {
  return chapters.find((id) => routeMatches(chapterRoute(id), pathname)) ?? null;
}

/**
 * Gehört `pathname` zu `route`? Nur ein Segmentwechsel zählt — sonst wäre
 * `/transactions-archive` „dieselbe Fläche" wie `/transactions`.
 */
function routeMatches(route: string | null, pathname: string): boolean {
  if (!route) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** CSS-Selektor zu einem Anker. Eine Stelle, damit das Attribut nie driftet. */
export function anchorSelector(anchor: string): string {
  return `[data-tour-id="${anchor}"]`;
}
