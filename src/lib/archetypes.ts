/**
 * Nutzer-Archetypen für das Onboarding („Welche Situation beschreibt dich am
 * ehesten?").
 *
 * Zweck: Nutzer sehen zunächst nur die Bereiche, die zu ihrer Lebenssituation
 * passen — aber nichts ist gesperrt. Die Auswahl steuert ausschließlich die
 * **Sichtbarkeit in der Navigation**; alle Routen bleiben registriert
 * (Deep-Links, Coach-Verlinkungen, Bestandsdaten). Genau dieses Muster
 * existiert bereits für den Einzelunternehmer-Modus (`businessOnly` in
 * `nav-config.ts`) und wird hier verallgemeinert.
 *
 * Zwei Ebenen, weil Lebensphase und Lebensumstand unabhängig voneinander sind
 * (Familie *und* verschuldet, Ruhestand *und* vermietend):
 *   1. {@link ARCHETYPES} — Lebensphase, genau eine Auswahl.
 *   2. {@link MODIFIERS}  — Umstände, mehrfach wählbar, **rein additiv**.
 *
 * Additiv ist eine harte Regel: dürfte ein Modifikator etwas abwählen, hinge
 * das Ergebnis von der Klickreihenfolge ab und wäre dem Nutzer nicht mehr
 * erklärbar.
 *
 * Reine Domänenschicht: kein React, kein I/O (AGENTS.md §3).
 */

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
  | 'city'
  | 'contracts';

export type ArchetypeId =
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
 * Nav-Ziele, die IMMER sichtbar bleiben — unabhängig vom Archetyp.
 *
 * Drei Gründe, warum das kein „nice to have" ist:
 * - `/coach`, `/dashboard`, `/transactions` speisen die mobile Bottom-Nav
 *   (`getBottomNavItems`). Würde ein Archetyp eines davon verstecken, verlöre
 *   die Bottom-Nav stillschweigend einen Tab.
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
  city: '/city',
  contracts: '/contracts',
};

const FEATURE_ORDER = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

const PATH_TO_FEATURE = new Map<string, NavFeatureId>(
  FEATURE_ORDER.map((feature) => [NAV_FEATURE_PATHS[feature], feature]),
);

/** Wählbares Feature zu einem Nav-Pfad, oder `null` für Kern-/Fremdpfade. */
export function navFeatureForPath(path: string): NavFeatureId | null {
  return PATH_TO_FEATURE.get(path) ?? null;
}

/**
 * Darf ein Nav-Ziel angezeigt werden?
 *
 * `enabledFeatures == null` bedeutet „keine Auswahl getroffen" (Bestandsnutzer,
 * Onboarding übersprungen) — dann bleibt alles sichtbar. Kernpfade und Pfade
 * ohne Feature-Zuordnung bleiben immer sichtbar: Ausblenden ist eine bewusste
 * Entscheidung, kein Nebeneffekt einer fehlenden Zuordnung.
 */
export function isNavPathVisible(
  path: string,
  enabledFeatures?: readonly NavFeatureId[] | null,
): boolean {
  if (enabledFeatures == null) return true;
  if (ALWAYS_VISIBLE_NAV_PATHS.includes(path)) return true;
  const feature = navFeatureForPath(path);
  if (!feature) return true;
  return enabledFeatures.includes(feature);
}

/** Einstellungen, die ein Archetyp mit vorbelegt (bestehende `UserSettings`-Felder). */
export interface ArchetypeSettings {
  business_mode?: boolean;
  tax_reserve_percent?: number;
  gentle_mode?: boolean;
  enable_subcategories?: boolean;
}

export interface Archetype {
  id: ArchetypeId;
  labelKey: string;
  descriptionKey: string;
  /** Vorausgewählte Bereiche. Kernbereiche stehen bewusst nicht darin. */
  features: NavFeatureId[];
  /** Vorbelegte Einstellungen (ohne `business_mode` — das leitet sich aus `euer` ab). */
  settings?: Omit<ArchetypeSettings, 'business_mode'>;
}

export interface Modifier {
  id: ModifierId;
  labelKey: string;
  /** Bereiche, die dieser Umstand ZUSÄTZLICH einschaltet. Nie abwählen. */
  adds: NavFeatureId[];
}

/** Vorschlag für die Steuerrücklage, wenn EÜR über einen Modifikator dazukommt. */
const DEFAULT_TAX_RESERVE_PERCENT = 30;

function archetype(
  id: ArchetypeId,
  features: NavFeatureId[],
  settings?: Omit<ArchetypeSettings, 'business_mode'>,
): Archetype {
  return {
    id,
    labelKey: `onboarding.archetypes.${id}.label`,
    descriptionKey: `onboarding.archetypes.${id}.description`,
    features,
    ...(settings ? { settings } : {}),
  };
}

/**
 * Die Lebensphasen. Bewusst als Lebensphase formuliert, nicht als Status:
 * niemand klickt freiwillig auf ein Etikett wie „verschuldet" oder
 * „wohlhabend". Deshalb ist Vermögen kein eigener Archetyp (das deckt
 * `employed_stable` + Modifikator `investing` ab) und Überschuldung wird als
 * Ziel formuliert (`debt_focus` — „Schulden abbauen").
 */
export const ARCHETYPES: readonly Archetype[] = [
  // Taschengeld/Ausbildungsvergütung, kaum Fixkosten, erste Abo-Fallen.
  // Bewusst der schlankste Archetyp — Steuer und Depot wären hier nur Ballast.
  archetype('student_school', ['budgets', 'milestones', 'contracts', 'city'], {
    gentle_mode: true,
    enable_subcategories: false,
  }),

  // Einkommensmix (BAföG, Werkstudentenjob, Eltern) und Ausgaben in Blöcken:
  // der Semesterbeitrag ist genau der Fall, für den die Liquiditätsvorschau da ist.
  archetype('student_university', ['liquidity', 'budgets', 'milestones', 'income', 'contracts', 'city'], {
    gentle_mode: true,
  }),

  // Erstes volles Gehalt, erste eigene Wohnung, erste Steuererklärung —
  // Pendler- und Homeoffice-Pauschale sind hier der konkrete Mehrwert.
  archetype('career_starter', [
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
  archetype('employed_stable', [
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
  archetype('family', [
    'liquidity',
    'budgets',
    'milestones',
    'occasions',
    'tax',
    'netWorth',
    'premiumReports',
    'contracts',
  ]),

  // Eigener Archetyp statt Modifikator, weil die Feature-Folge gegenläufig zu
  // `family` ist: nichts wird geteilt, ein Einkommen trägt alles, Unterhalt
  // läuft rein und raus — Schulden und tagesgenaue Liquidität statt Vermögen.
  archetype(
    'single_parent',
    ['debts', 'liquidity', 'budgets', 'milestones', 'income', 'occasions', 'tax', 'contracts'],
    { gentle_mode: true },
  ),

  // Bestehender `business_mode` (EÜR, Steuer-Tank, Steuerstufe im Wasserfall).
  archetype(
    'self_employed',
    ['liquidity', 'budgets', 'milestones', 'income', 'tax', 'euer', 'netWorth', 'contracts'],
    { tax_reserve_percent: 30 },
  ),

  // Spezialisierung von `self_employed`: Plattform-Auszahlungen kommen
  // verzögert und in vielen kleinen Quellen, Sachbezüge sind geldwerter
  // Vorteil, Equipment ist Investition — die Rücklage muss höher liegen.
  archetype(
    'creator',
    ['liquidity', 'milestones', 'income', 'tax', 'euer', 'netWorth', 'premiumReports', 'contracts'],
    { tax_reserve_percent: 35 },
  ),

  // Feste Bezüge, aber Vermögens*verzehr* statt -aufbau: das Depot bleibt
  // sichtbar, weil daraus entnommen wird, nicht weil angespart wird.
  archetype('retired', [
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
  archetype('debt_focus', ['debts', 'liquidity', 'budgets', 'milestones', 'contracts'], {
    gentle_mode: true,
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
  settings: ArchetypeSettings;
}

/**
 * Löst Archetyp + Umstände in die vorausgewählten Bereiche und Einstellungen
 * auf.
 *
 * Robust gegenüber kaputten gespeicherten Werten: ein unbekannter Archetyp
 * gibt ALLES frei, statt den Nutzer auszusperren — im Zweifel lieber zu viel
 * Navigation als eine leere App. Unbekannte Modifikatoren werden ignoriert.
 */
export function resolveFeatureSelection(
  archetypeId: ArchetypeId,
  modifierIds: readonly ModifierId[] = [],
): FeatureSelection {
  const selected = ARCHETYPES.find((a) => a.id === archetypeId);
  if (!selected) {
    return { features: [...FEATURE_ORDER], settings: {} };
  }

  const features = new Set<NavFeatureId>(selected.features);
  for (const id of modifierIds) {
    const modifier = MODIFIERS.find((m) => m.id === id);
    if (!modifier) continue;
    for (const feature of modifier.adds) features.add(feature);
  }

  const settings: ArchetypeSettings = { ...selected.settings };
  // `business_mode` wird abgeleitet, nicht separat gepflegt: sonst könnten
  // Nav-Sichtbarkeit (`euer`) und Fachlogik (Steuer-Tank, Wasserfall-Stufe)
  // auseinanderlaufen.
  if (features.has('euer')) {
    settings.business_mode = true;
    settings.tax_reserve_percent = selected.settings?.tax_reserve_percent ?? DEFAULT_TAX_RESERVE_PERCENT;
  }

  return {
    features: FEATURE_ORDER.filter((f) => features.has(f)),
    settings,
  };
}
