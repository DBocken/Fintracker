/**
 * Nutzer-Lebenssituationen für das Onboarding („Welche Situation beschreibt dich am
 * ehesten?").
 *
 * Zweck: Nutzer sehen zunächst nur die Bereiche, die zu ihrer Lebenssituation
 * passen — aber nichts ist gesperrt. Die Auswahl steuert ausschließlich die
 * **Sichtbarkeit in der Navigation**; alle Routen bleiben registriert
 * (Deep-Links, Coach-Verlinkungen, Bestandsdaten). Der Einzelunternehmer-Modus
 * (EÜR) lief früher über einen eigenen `businessOnly`-Sonderweg und ist hier
 * aufgegangen — ein Mechanismus statt zwei.
 *
 * Zwei Ebenen, weil Lebensphase und Lebensumstand unabhängig voneinander sind
 * (Familie *und* verschuldet, Ruhestand *und* vermietend):
 *   1. {@link LIFE_SITUATIONS} — Lebensphase, genau eine Auswahl.
 *   2. {@link MODIFIERS}  — Umstände, mehrfach wählbar, **rein additiv**.
 *
 * Additiv ist eine harte Regel: dürfte ein Modifikator etwas abwählen, hinge
 * das Ergebnis von der Klickreihenfolge ab und wäre dem Nutzer nicht mehr
 * erklärbar.
 *
 * Reine Domänenschicht: kein React, kein I/O (AGENTS.md §3).
 */

import type { GentleLevel } from './gentle-mode';

/** Nav-Bereiche, die im Onboarding an-/abwählbar sind. */
export type NavFeatureId =
  | 'debts'
  | 'netWorth'
  | 'liquidity'
  | 'budgets'
  | 'milestones'
  | 'income'
  | 'occasions'
  | 'tax'
  | 'euer'
  | 'premiumReports'
  | 'trading'
  | 'contracts';

export type LifeSituationId =
  | 'student_school'
  | 'student_university'
  | 'career_starter'
  | 'employed_stable'
  | 'family'
  | 'single_parent'
  | 'self_employed'
  | 'creator'
  | 'retired'
  | 'debt_focus';

export type ModifierId =
  | 'repaying_debt'
  | 'children'
  | 'investing'
  | 'irregular_income'
  | 'commute'
  | 'side_business'
  | 'property';

/**
 * Nav-Ziele, die IMMER sichtbar bleiben — unabhängig von der Lebenssituation.
 *
 * Drei Gründe, warum das kein „nice to have" ist:
 * - `/coach`, `/dashboard`, `/city`, `/transactions` speisen die mobile
 *   Bottom-Nav (`getBottomNavItems`). Würde eine Lebenssituation eines davon
 *   verstecken, verlöre die Bottom-Nav stillschweigend einen Tab.
 * - `/settings` ist der Rückweg: dort schaltet man Bereiche wieder frei. Wäre
 *   es ausblendbar, könnte sich ein Nutzer selbst aussperren.
 * - `/accounts`, `/csv`, `/export` sind der Dateneingang bzw. -ausgang und
 *   damit für jede Situation Kern.
 */
export const ALWAYS_VISIBLE_NAV_PATHS: readonly string[] = [
  '/coach',
  '/dashboard',
  '/transactions',
  '/accounts',
  '/csv',
  '/export',
  '/settings',
  // Die Finanzstadt ist die zentrale Darstellung und deshalb nicht abwählbar
  // (`docs/tutorial-sequence.md`). Zentral und optional zugleich gibt es
  // nicht — und mobil ist sie ein Bottom-Nav-Ziel, das nie verschwinden darf.
  '/city',
  // Die Übersicht der Führungen ist kein wählbarer Bereich: Eine Anleitung
  // abwählen zu können hilft niemandem, und wer sich in der App verirrt hat,
  // findet den Weg dorthin sonst gerade nicht.
  '/tutorials',
];

/**
 * Abbildung wählbares Feature → Nav-Pfad. Die Reihenfolge ist die kanonische
 * Ausgabereihenfolge von {@link resolveFeatureSelection} und entspricht der
 * Reihenfolge in `NAV_GROUPS`, damit die Feature-Liste im Onboarding dieselbe
 * Sortierung hat wie später die Navigation.
 */
export const NAV_FEATURE_PATHS: Record<NavFeatureId, string> = {
  debts: '/debts',
  netWorth: '/net-worth',
  liquidity: '/liquidity',
  budgets: '/budgets',
  milestones: '/milestones',
  income: '/income',
  occasions: '/occasions',
  tax: '/tax',
  euer: '/euer',
  premiumReports: '/premium',
  trading: '/trading',
  contracts: '/contracts',
};

const FEATURE_ORDER = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

/**
 * Bereiche, die auch **ohne** getroffene Auswahl verborgen bleiben — echtes
 * Opt-in statt Default-an („Ruhe vor Fülle").
 *
 * Das löst den früheren `businessOnly`-Sonderweg für die EÜR ab: statt eines
 * zweiten Gating-Mechanismus neben der Bereichsauswahl trägt der Katalog
 * dieses eine Merkmal. Ohne das Merkmal bekäme jeder Bestandsnutzer
 * (`enabled_nav_features === null` = keine Einschränkung) die EÜR ungefragt
 * eingeblendet.
 */
export const DEFAULT_OFF_FEATURES: readonly NavFeatureId[] = ['euer'];

/**
 * Ist ein Bereich eingeschaltet? `enabledFeatures == null` heißt „keine
 * Auswahl getroffen" — dann gilt alles als an, außer den Opt-in-Bereichen.
 */
export function isFeatureEnabled(
  feature: NavFeatureId,
  enabledFeatures?: readonly NavFeatureId[] | null,
): boolean {
  if (enabledFeatures == null) return !DEFAULT_OFF_FEATURES.includes(feature);
  return enabledFeatures.includes(feature);
}

/**
 * Einzelunternehmer-Modus — **abgeleitet**, nicht gespeichert.
 *
 * Schaltet neben der EÜR-Seite auch Fachlogik frei (Steuer-Stufe im
 * Liquiditäts-Wasserfall, EÜR-Kandidaten auf Geschäftskonten). Genau deshalb
 * darf es kein zweites Flag neben `enabled_nav_features` geben: sonst könnten
 * sichtbare Navigation und rechnende Logik auseinanderlaufen.
 */
export function isBusinessModeEnabled(
  enabledFeatures?: readonly NavFeatureId[] | null,
): boolean {
  return isFeatureEnabled('euer', enabledFeatures);
}

/**
 * Freischaltung — die zweite Achse neben der Relevanz
 * (`docs/tutorial-progressive-disclosure.md`).
 *
 * Sie beantwortet „bin ich schon so weit?", während `enabled_nav_features`
 * „passt das zu mir?" beantwortet. Zwei Achsen statt einer, weil ein
 * gemeinsames Feld zwei falsche Botschaften erzeugte: eine Freischaltung sähe
 * aus, als schalte die App etwas wieder ein, das der Nutzer bewusst abgewählt
 * hat — und ein Abwählen sähe aus, als hätte er etwas „noch nicht gelernt".
 *
 * `null`/`undefined` heißt „Achse nicht in Gebrauch" ⇒ alles freigeschaltet.
 * Das ist keine Bequemlichkeit, sondern Pflicht: Bestandsnutzer haben das Feld
 * nicht, und ein Update darf niemandem stillschweigend Navigation wegnehmen.
 * Die Achse wird erst scharf, wenn das Tutorial sie ausdrücklich schreibt.
 */
export function isFeatureUnlocked(
  feature: NavFeatureId,
  unlockedFeatures?: readonly NavFeatureId[] | null,
): boolean {
  if (unlockedFeatures == null) return true;
  return unlockedFeatures.includes(feature);
}

/**
 * Schaltet einen Bereich frei und hält die kanonische Reihenfolge ein.
 *
 * `null` bleibt `null`: „alles freigeschaltet" darf durch das Freischalten
 * eines einzelnen Bereichs nicht zu einer einelementigen Liste verengt werden
 * — der Nutzer verlöre schlagartig fast seine ganze Navigation. Der einzige
 * Weg von `null` in einen begrenzten Zustand führt über den Tutorialstart,
 * der die Achse bewusst setzt.
 */
export function withFeatureUnlocked(
  unlockedFeatures: readonly NavFeatureId[] | null | undefined,
  feature: NavFeatureId,
): NavFeatureId[] | null {
  if (unlockedFeatures == null) return null;
  if (unlockedFeatures.includes(feature)) return [...unlockedFeatures];
  const next = new Set([...unlockedFeatures, feature]);
  return FEATURE_ORDER.filter((f) => next.has(f));
}

const PATH_TO_FEATURE = new Map<string, NavFeatureId>(
  FEATURE_ORDER.map((feature) => [NAV_FEATURE_PATHS[feature], feature]),
);

/** Wählbares Feature zu einem Nav-Pfad, oder `null` für Kern-/Fremdpfade. */
export function navFeatureForPath(path: string): NavFeatureId | null {
  return PATH_TO_FEATURE.get(path) ?? null;
}

/**
 * Darf ein Nav-Ziel angezeigt werden? Sichtbar ist, was **gewählt UND
 * freigeschaltet** ist.
 *
 * `enabledFeatures == null` bedeutet „keine Auswahl getroffen" (Bestandsnutzer,
 * Onboarding übersprungen) — dann bleibt alles sichtbar außer den
 * Opt-in-Bereichen ({@link DEFAULT_OFF_FEATURES}). `unlockedFeatures == null`
 * bedeutet „Freischaltung nicht in Gebrauch" ⇒ alles freigeschaltet
 * ({@link isFeatureUnlocked}). Kernpfade und Pfade ohne Feature-Zuordnung
 * bleiben immer sichtbar: Ausblenden ist eine bewusste Entscheidung, kein
 * Nebeneffekt einer fehlenden Zuordnung.
 *
 * Beide Achsen sind optional, und ein Aufrufer, der die Freischaltung nicht
 * mitgibt, bekommt „alles freigeschaltet". Die Fehlerrichtung ist Absicht: im
 * Zweifel lieber zu viel Navigation als eine leere App.
 */
export function isNavPathVisible(
  path: string,
  enabledFeatures?: readonly NavFeatureId[] | null,
  unlockedFeatures?: readonly NavFeatureId[] | null,
): boolean {
  if (ALWAYS_VISIBLE_NAV_PATHS.includes(path)) return true;
  const feature = navFeatureForPath(path);
  if (!feature) return true;
  return isFeatureEnabled(feature, enabledFeatures) && isFeatureUnlocked(feature, unlockedFeatures);
}

/** Einstellungen, die eine Lebenssituation mit vorbelegt (bestehende `UserSettings`-Felder). */
export interface LifeSituationSettings {
  tax_reserve_percent?: number;
  gentle_level?: GentleLevel;
  enable_subcategories?: boolean;
}

export interface LifeSituation {
  id: LifeSituationId;
  labelKey: string;
  descriptionKey: string;
  /** Vorausgewählte Bereiche. Kernbereiche stehen bewusst nicht darin. */
  features: NavFeatureId[];
  /** Vorbelegte Einstellungen. Der Einzelunternehmer-Modus steht NICHT hier —
   *  er leitet sich aus dem Bereich `euer` ab ({@link isBusinessModeEnabled}). */
  settings?: LifeSituationSettings;
}

export interface Modifier {
  id: ModifierId;
  labelKey: string;
  /** Bereiche, die dieser Umstand ZUSÄTZLICH einschaltet. Nie abwählen. */
  adds: NavFeatureId[];
}

/** Vorschlag für die Steuerrücklage, wenn EÜR über einen Modifikator dazukommt. */
const DEFAULT_TAX_RESERVE_PERCENT = 30;

function lifeSituation(
  id: LifeSituationId,
  features: NavFeatureId[],
  settings?: LifeSituationSettings,
): LifeSituation {
  return {
    id,
    labelKey: `onboarding.lifeSituations.${id}.label`,
    descriptionKey: `onboarding.lifeSituations.${id}.description`,
    features,
    ...(settings ? { settings } : {}),
  };
}

/**
 * Die Lebensphasen. Bewusst als Lebensphase formuliert, nicht als Status:
 * niemand klickt freiwillig auf ein Etikett wie „verschuldet" oder
 * „wohlhabend". Deshalb ist Vermögen keine eigene Lebenssituation (das deckt
 * `employed_stable` + Modifikator `investing` ab) und Überschuldung wird als
 * Ziel formuliert (`debt_focus` — „Schulden abbauen").
 */
export const LIFE_SITUATIONS: readonly LifeSituation[] = [
  // Taschengeld/Ausbildungsvergütung, kaum Fixkosten, erste Abo-Fallen.
  // Bewusst die schlankste Lebenssituation — Steuer und Depot wären hier nur Ballast.
  lifeSituation('student_school', ['budgets', 'milestones', 'contracts'], {
    gentle_level: 3,
    enable_subcategories: false,
  }),

  // Einkommensmix (BAföG, Werkstudentenjob, Eltern) und Ausgaben in Blöcken:
  // der Semesterbeitrag ist genau der Fall, für den die Liquiditätsvorschau da ist.
  lifeSituation('student_university', ['liquidity', 'budgets', 'milestones', 'income', 'contracts'], {
    gentle_level: 3,
  }),

  // Erstes volles Gehalt, erste eigene Wohnung, erste Steuererklärung —
  // Pendler- und Homeoffice-Pauschale sind hier der konkrete Mehrwert.
  lifeSituation('career_starter', [
    'liquidity',
    'budgets',
    'milestones',
    'income',
    'tax',
    'netWorth',
    'contracts',
  ]),

  // Fixkosten im Griff; die Frage ist nicht „reicht es", sondern „optimiere ich
  // richtig". Deckt zusammen mit `investing`/`property` auch Vermögende ab.
  lifeSituation('employed_stable', [
    'liquidity',
    'budgets',
    'milestones',
    'income',
    'occasions',
    'tax',
    'netWorth',
    'premiumReports',
    'trading',
    'contracts',
  ]),

  // Der eigentliche Schmerz sind nicht die Fixkosten, sondern die großen
  // unregelmäßigen Ausgaben (Urlaub, Einschulung, Waschmaschine) — Anlässe.
  lifeSituation('family', [
    'liquidity',
    'budgets',
    'milestones',
    'occasions',
    'tax',
    'netWorth',
    'premiumReports',
    'contracts',
  ]),

  // Eigene Lebenssituation statt Modifikator, weil die Feature-Folge gegenläufig zu
  // `family` ist: nichts wird geteilt, ein Einkommen trägt alles, Unterhalt
  // läuft rein und raus — Schulden und tagesgenaue Liquidität statt Vermögen.
  lifeSituation(
    'single_parent',
    ['debts', 'liquidity', 'budgets', 'milestones', 'income', 'occasions', 'tax', 'contracts'],
    { gentle_level: 3 },
  ),

  // Bestehender `business_mode` (EÜR, Steuer-Tank, Steuerstufe im Wasserfall).
  lifeSituation(
    'self_employed',
    ['liquidity', 'budgets', 'milestones', 'income', 'tax', 'euer', 'netWorth', 'contracts'],
    { tax_reserve_percent: 30 },
  ),

  // Spezialisierung von `self_employed`: Plattform-Auszahlungen kommen
  // verzögert und in vielen kleinen Quellen, Sachbezüge sind geldwerter
  // Vorteil, Equipment ist Investition — die Rücklage muss höher liegen.
  lifeSituation(
    'creator',
    ['liquidity', 'milestones', 'income', 'tax', 'euer', 'netWorth', 'premiumReports', 'contracts'],
    { tax_reserve_percent: 35 },
  ),

  // Feste Bezüge, aber Vermögens*verzehr* statt -aufbau: das Depot bleibt
  // sichtbar, weil daraus entnommen wird, nicht weil angespart wird.
  lifeSituation('retired', [
    'liquidity',
    'budgets',
    'milestones',
    'tax',
    'netWorth',
    'trading',
    'contracts',
  ]),

  // Deckt geringes Einkommen, Jobverlust, Bürgergeld und Trennung ab — die
  // Bedürfnisse sind dieselben: bis zum Monatsende kommen, Raten sortieren,
  // sofort kündbare Kosten finden. Vermögensthemen wären hier blanker Hohn.
  lifeSituation('debt_focus', ['debts', 'liquidity', 'budgets', 'milestones', 'contracts'], {
    gentle_level: 3,
  }),
];

/**
 * Umstände, die zusätzliche Bereiche einschalten. Aufgenommen ist nur, was
 * tatsächlich einen Nav-Bereich schaltet — ein Chip ohne sichtbare Wirkung
 * wäre eine leere Geste. (Haushalts-Splitting hat noch kein Nav-Ziel und
 * bleibt deshalb vorerst außen vor.)
 */
export const MODIFIERS: readonly Modifier[] = (
  [
    { id: 'repaying_debt', adds: ['debts'] },
    { id: 'children', adds: ['occasions'] },
    { id: 'investing', adds: ['trading', 'netWorth'] },
    { id: 'irregular_income', adds: ['liquidity', 'income'] },
    { id: 'commute', adds: ['tax'] },
    { id: 'side_business', adds: ['euer', 'tax'] },
    { id: 'property', adds: ['netWorth', 'tax'] },
  ] satisfies { id: ModifierId; adds: NavFeatureId[] }[]
).map((m) => ({ ...m, labelKey: `onboarding.modifiers.${m.id}.label` }));

export interface FeatureSelection {
  features: NavFeatureId[];
  settings: LifeSituationSettings;
}

/**
 * Löst Lebenssituation und Umstände in die vorausgewählten Bereiche und Einstellungen
 * auf.
 *
 * Robust gegenüber kaputten gespeicherten Werten: eine unbekannte Lebenssituation
 * gibt ALLES frei, statt den Nutzer auszusperren — im Zweifel lieber zu viel
 * Navigation als eine leere App. Unbekannte Modifikatoren werden ignoriert.
 */
export function resolveFeatureSelection(
  lifeSituationId: LifeSituationId,
  modifierIds: readonly ModifierId[] = [],
): FeatureSelection {
  const selected = LIFE_SITUATIONS.find((a) => a.id === lifeSituationId);
  if (!selected) {
    return { features: [...FEATURE_ORDER], settings: {} };
  }

  const features = new Set<NavFeatureId>(selected.features);
  for (const id of modifierIds) {
    const modifier = MODIFIERS.find((m) => m.id === id);
    if (!modifier) continue;
    for (const feature of modifier.adds) features.add(feature);
  }

  const settings: LifeSituationSettings = { ...selected.settings };
  // Kommt die EÜR erst über einen Modifikator dazu (Nebengewerbe), fehlt der
  // Lebenssituation ein Rücklage-Vorschlag — dann greift der Standardsatz.
  if (features.has('euer')) {
    settings.tax_reserve_percent = selected.settings?.tax_reserve_percent ?? DEFAULT_TAX_RESERVE_PERCENT;
  }

  return {
    features: FEATURE_ORDER.filter((f) => features.has(f)),
    settings,
  };
}
