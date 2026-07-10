/**
 * Fachkatalog für steuerrelevante Ausgaben (deutsches Einkommensteuerrecht).
 *
 * KEINE Steuerberatung: Der Katalog bildet gesetzliche Rubriken, Sätze und
 * Höchstbeträge ab, damit die App markierte Ausgaben jahresweise gruppieren und
 * — nur wo gesetzlich exakt (§35a/§35c) — die Steuerermäßigung berechnen kann.
 * Alle Beträge/Sätze stehen ausschließlich in {@link TAX_YEAR_PARAMS} und werden
 * über {@link getTaxParams} je Veranlagungszeitraum (VZ) aufgelöst — nie in der
 * Berechnungslogik hartkodiert, damit Gesetzesänderungen an einer Stelle landen.
 *
 * Auditierbarkeit: Die Rechtsgrundlage jedes Parameters steht typerzwungen in
 * {@link TAX_PARAM_LEGAL_BASIS}; die aufgelösten Werte je VZ pinnt der
 * Golden-Table-Test (src/data/__tests__/tax-params-golden.test.ts). Neuer VZ:
 * Checkliste in docs/tax-year-update.md befolgen.
 */

/** Zuordnung zur Anlage/Rubrik der Steuererklärung (i18n: `tax.anlage.<id>`). */
export type TaxAnlage = 'N' | 'V' | 'sonderausgaben' | 'agb' | '35a' | 'euer';

export type TaxRubricId =
  | '35a-minijob'
  | '35a-dienstleistungen'
  | '35a-handwerker'
  | '35c-sanierung'
  | 'werbungskosten'
  | 'sonderausgaben'
  | 'agb'
  | 'vermietung'
  | 'betriebsausgaben';

/**
 * Mechanik einer Rubrik. Enthält NIE Beträge, sondern nur Referenzen auf Felder
 * in {@link TaxYearParams} — so bleiben die jahresabhängigen Zahlen an genau
 * einer Stelle.
 */
export interface TaxRubric {
  id: TaxRubricId;
  anlage: TaxAnlage;
  /**
   * `credit` = direkte Steuerermäßigung (§35a/§35c, exakt berechenbar).
   * `deduction` = mindert nur das zu versteuernde Einkommen — hier zeigt die App
   * ausschließlich Summen + Schwellen-Hinweise, keine Ersparnis-Schätzung.
   */
  kind: 'credit' | 'deduction';
  /** Nur Arbeits-/Fahrt-/Maschinenkosten sind begünstigt (§35a Abs. 3). */
  laborCostOnly?: boolean;
  /** Unbare Zahlung + Rechnung gesetzlich erforderlich (§35a Abs. 5 S. 3). */
  requiresCashlessPayment?: boolean;
  /**
   * Nur erfassen + Hinweis, keine Gutschrift-Zahl. §35c verteilt die Ermäßigung
   * über drei Jahre (7/7/6 %) — das bilden wir bewusst nicht falsch-exakt ab.
   */
  informationalOnly?: boolean;
  /** Feldname in {@link TaxYearParams} für den Ermäßigungssatz (credit). */
  creditRateParam?: NumericParam;
  /** Feldname für den Kosten-Höchstbetrag (credit). */
  capCostsParam?: NumericParam;
  /** Feldname für den Ermäßigungs-Höchstbetrag (credit). */
  capCreditParam?: NumericParam;
  /** Feldname für Pauschbetrag/Schwelle (deduction, z. B. Anlage N 1.230 €). */
  thresholdParam?: NumericParam;
  nameKey: string;
  hintKey: string;
}

/** Auswählbares „Blatt" — das, was an der Buchung (`tax_category_id`) hängt. */
export interface TaxCategory {
  /** Stabile ID, wird persistiert. Bei Umbenennung Alias-Migration nötig. */
  id: string;
  rubricId: TaxRubricId;
  nameKey: string;
  hintKey?: string;
  /** Lowercase-Stichwörter für Vorschläge auf payee+description (nie Auto-Markierung). */
  keywords: string[];
  /** Blatt-eigene Regel (Sonderausgaben-Unterregeln mit eigenem Satz/Cap). */
  rule?: {
    rateParam?: NumericParam;
    capParam?: NumericParam;
    /** i18n-Key der Cap-Einheit, z. B. `tax.capUnit.perChild`. */
    capUnitKey?: string;
    requiresCashlessPayment?: boolean;
  };
}

/**
 * Jahresparameter je Veranlagungszeitraum. Zahlen NUR hier. Alle Felder sind
 * `number`, damit Rubriken/Blätter sie typsicher per Feldnamen referenzieren.
 */
export interface TaxYearParams {
  vz: number;
  arbeitnehmerPauschbetrag: number;
  sonderausgabenPauschbetrag: number;
  homeofficeProTag: number;
  homeofficeMaxTage: number;
  homeofficeMax: number;
  pendlerKm1bis20: number;
  pendlerAbKm21: number;
  kinderbetreuungRate: number;
  kinderbetreuungMaxProKind: number;
  schulgeldRate: number;
  schulgeldMax: number;
  riesterMax: number;
  vorsorgeMaxArbeitnehmer: number;
  vorsorgeMaxSelbst: number;
  unterhaltExPartnerMax: number;
  erstausbildungMax: number;
  kontofuehrungPauschale: number;
  creditRate35a: number;
  a35a1CapCosts: number;
  a35a1CapCredit: number;
  a35a2CapCosts: number;
  a35a2CapCredit: number;
  a35a3CapCosts: number;
  a35a3CapCredit: number;
  creditRate35c: number;
  a35cCapCredit: number;
}

/** Nur die numerischen Parameter dürfen referenziert werden (nicht `vz`). */
export type NumericParam = Exclude<keyof TaxYearParams, 'vz'>;

export interface TaxParamLegalBasis {
  /** Gesetzliche Fundstelle (§ EStG bzw. Verwaltungsregelung). */
  law: string;
  /** Jahresbezüge, Herleitungen und Semantik-Hinweise. */
  note?: string;
}

/**
 * Rechtsgrundlage je Parameter — typerzwungen über {@link NumericParam}:
 * Ein neuer Parameter ohne Eintrag hier ist ein Compile-Fehler. Damit ist bei
 * jedem Steuer-Update nachvollziehbar, WELCHE Norm ein Wert abbildet und WARUM
 * er sich geändert hat (Audit-Anforderung).
 */
export const TAX_PARAM_LEGAL_BASIS: Record<NumericParam, TaxParamLegalBasis> = {
  arbeitnehmerPauschbetrag: {
    law: '§9a S. 1 Nr. 1 Buchst. a EStG',
    note: '1.230 € seit VZ 2023 (Jahressteuergesetz 2022).',
  },
  sonderausgabenPauschbetrag: {
    law: '§10c EStG',
    note: '36 € (Ledige); bei Zusammenveranlagung 72 €.',
  },
  homeofficeProTag: {
    law: '§4 Abs. 5 S. 1 Nr. 6c EStG i. V. m. §9 Abs. 5 EStG',
    note: 'Tagespauschale 6 € seit VZ 2023.',
  },
  homeofficeMaxTage: {
    law: '§4 Abs. 5 S. 1 Nr. 6c EStG',
    note: 'Abgeleitet: 1.260 € Jahres-Höchstbetrag / 6 € = 210 Tage.',
  },
  homeofficeMax: {
    law: '§4 Abs. 5 S. 1 Nr. 6c EStG',
    note: 'Jahres-Höchstbetrag 1.260 €.',
  },
  pendlerKm1bis20: {
    law: '§9 Abs. 1 S. 3 Nr. 4 EStG',
    note: 'Bis VZ 2025: 0,30 €/km für km 1–20. Ab VZ 2026 einheitlich 0,38 €/km ab dem 1. km (Steueränderungsgesetz 2025, Bundesrat 19.12.2025).',
  },
  pendlerAbKm21: {
    law: '§9 Abs. 1 S. 3 Nr. 4 S. 8 EStG',
    note: '0,38 €/km ab dem 21. km (seit VZ 2022).',
  },
  kinderbetreuungRate: {
    law: '§10 Abs. 1 Nr. 5 EStG',
    note: 'Ab VZ 2025: 80 % (JStG 2024); VZ 2024: 2/3.',
  },
  kinderbetreuungMaxProKind: {
    law: '§10 Abs. 1 Nr. 5 EStG',
    note: 'Abzugs-Höchstbetrag, NICHT Aufwendungs-Deckel: 4.800 € = 80 % von 6.000 € (ab VZ 2025, JStG 2024); VZ 2024: 4.000 € = 2/3 von 6.000 €. Mathematisch gilt min(rate·x; Abzugsdeckel) ≡ rate·min(x; 6.000 €).',
  },
  schulgeldRate: {
    law: '§10 Abs. 1 Nr. 9 EStG',
    note: '30 % des Entgelts (ohne Beherbergung/Betreuung/Verpflegung).',
  },
  schulgeldMax: {
    law: '§10 Abs. 1 Nr. 9 EStG',
    note: 'Höchstbetrag 5.000 € je Kind.',
  },
  riesterMax: {
    law: '§10a Abs. 1 EStG',
    note: 'Sonderausgaben-Höchstbetrag 2.100 €.',
  },
  vorsorgeMaxArbeitnehmer: {
    law: '§10 Abs. 4 S. 1–2 EStG',
    note: '1.900 € für Personen mit steuerfreiem Arbeitgeberzuschuss/Beihilfe.',
  },
  vorsorgeMaxSelbst: {
    law: '§10 Abs. 4 S. 3 EStG',
    note: '2.800 € für Personen, die ihre Krankenversicherung allein tragen.',
  },
  unterhaltExPartnerMax: {
    law: '§10 Abs. 1a Nr. 1 EStG',
    note: 'Realsplitting: 13.805 € zzgl. übernommener Basis-KV/PV-Beiträge.',
  },
  erstausbildungMax: {
    law: '§10 Abs. 1 Nr. 7 EStG',
    note: 'Erstausbildung 6.000 €/Jahr (Zweitausbildung → Werbungskosten).',
  },
  kontofuehrungPauschale: {
    law: 'H 9.1 LStH (Verwaltungspraxis)',
    note: 'Nichtbeanstandungsgrenze 16 € ohne Einzelnachweis — keine gesetzliche Pauschale.',
  },
  creditRate35a: {
    law: '§35a Abs. 1–3 EStG',
    note: 'Ermäßigungssatz jeweils 20 % der Aufwendungen (Abs. 3: nur Arbeits-/Fahrt-/Maschinenkosten).',
  },
  a35a1CapCosts: {
    law: '§35a Abs. 1 EStG',
    note: 'Abgeleitet: 2.550 € = 510 € Ermäßigungs-Höchstbetrag / 20 %.',
  },
  a35a1CapCredit: {
    law: '§35a Abs. 1 EStG',
    note: 'Ermäßigungs-Höchstbetrag 510 € (Minijob im Haushalt); gilt je Haushalt.',
  },
  a35a2CapCosts: {
    law: '§35a Abs. 2 EStG',
    note: 'Abgeleitet: 20.000 € = 4.000 € Ermäßigungs-Höchstbetrag / 20 %.',
  },
  a35a2CapCredit: {
    law: '§35a Abs. 2 EStG',
    note: 'Ermäßigungs-Höchstbetrag 4.000 € (haushaltsnahe Dienstleistungen, Pflege); gilt je Haushalt.',
  },
  a35a3CapCosts: {
    law: '§35a Abs. 3 EStG',
    note: 'Abgeleitet: 6.000 € = 1.200 € Ermäßigungs-Höchstbetrag / 20 %.',
  },
  a35a3CapCredit: {
    law: '§35a Abs. 3 EStG',
    note: 'Ermäßigungs-Höchstbetrag 1.200 € (Handwerkerleistungen); gilt je Haushalt.',
  },
  creditRate35c: {
    law: '§35c Abs. 1 EStG',
    note: '20 % insgesamt, verteilt über drei Jahre (7 %/7 %/6 %) — App erfasst nur, rechnet nicht.',
  },
  a35cCapCredit: {
    law: '§35c Abs. 1 S. 5 EStG',
    note: 'Höchstbetrag der Ermäßigung 40.000 € je begünstigtem Objekt.',
  },
};

/**
 * Über alle VZ 2024–2026 konstante Parameter. Werden je Jahr gespreizt und dort
 * nur mit den geänderten Werten überschrieben — so ist auf einen Blick sichtbar,
 * was sich gesetzlich geändert hat.
 */
const CONSTANT_PARAMS: Omit<TaxYearParams, 'vz'> = {
  arbeitnehmerPauschbetrag: 1230,
  sonderausgabenPauschbetrag: 36,
  homeofficeProTag: 6,
  homeofficeMaxTage: 210,
  homeofficeMax: 1260,
  pendlerKm1bis20: 0.3,
  pendlerAbKm21: 0.38,
  kinderbetreuungRate: 0.8,
  kinderbetreuungMaxProKind: 4800,
  schulgeldRate: 0.3,
  schulgeldMax: 5000,
  riesterMax: 2100,
  vorsorgeMaxArbeitnehmer: 1900,
  vorsorgeMaxSelbst: 2800,
  unterhaltExPartnerMax: 13805,
  erstausbildungMax: 6000,
  kontofuehrungPauschale: 16,
  creditRate35a: 0.2,
  a35a1CapCosts: 2550,
  a35a1CapCredit: 510,
  a35a2CapCosts: 20000,
  a35a2CapCredit: 4000,
  a35a3CapCosts: 6000,
  a35a3CapCredit: 1200,
  creditRate35c: 0.2,
  a35cCapCredit: 40000,
};

export const TAX_YEAR_PARAMS: Record<number, TaxYearParams> = {
  2024: {
    ...CONSTANT_PARAMS,
    vz: 2024,
    // VZ 2024: Kinderbetreuung noch 2/3 von max. 6.000 € = 4.000 €.
    kinderbetreuungRate: 2 / 3,
    kinderbetreuungMaxProKind: 4000,
  },
  2025: {
    ...CONSTANT_PARAMS,
    vz: 2025,
  },
  2026: {
    ...CONSTANT_PARAMS,
    vz: 2026,
    // StÄndG 2025: einheitlich 0,38 €/km ab dem 1. km.
    pendlerKm1bis20: 0.38,
  },
};

const KNOWN_YEARS = Object.keys(TAX_YEAR_PARAMS)
  .map(Number)
  .sort((a, b) => a - b);
const MIN_YEAR = KNOWN_YEARS[0];
const MAX_YEAR = KNOWN_YEARS[KNOWN_YEARS.length - 1];

/**
 * Löst die Parameter für ein Jahr auf. Für Jahre außerhalb des bekannten
 * Bereichs wird auf das nächstgelegene bekannte Jahr geklemmt und `exact:false`
 * gesetzt, damit die UI einen Hinweis anzeigen kann.
 */
export function getTaxParams(year: number): { params: TaxYearParams; exact: boolean } {
  if (TAX_YEAR_PARAMS[year]) return { params: TAX_YEAR_PARAMS[year], exact: true };
  const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year));
  return { params: TAX_YEAR_PARAMS[clamped], exact: false };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Vollständiger Rechenweg einer §35a-Ermäßigung. Wird von der UI 1:1 angezeigt
 * (Audit-Anforderung): Der angezeigte Rechenweg stammt aus derselben Funktion
 * wie das Ergebnis — UI und Mathematik können nicht divergieren.
 */
export interface Credit35aTrace {
  /** Bemessungsgrundlage vor Kappung (Arbeitskosten bzw. Netto-Kosten). */
  base: number;
  /** Kosten-Höchstbetrag. */
  capCosts: number;
  /** min(base, capCosts). */
  cappedBase: number;
  /** Ermäßigungssatz (z. B. 0,2). */
  rate: number;
  /** cappedBase × rate, vor Deckelung auf capCredit. */
  rawCredit: number;
  /** Ermäßigungs-Höchstbetrag. */
  capCredit: number;
  /** Ergebnis: min(rawCredit, capCredit). */
  credit: number;
}

export interface Credit35aResult {
  /** Kosten nach Kappung auf den Kosten-Höchstbetrag. */
  cappedCosts: number;
  /** Steuerermäßigung nach Kappung auf den Ermäßigungs-Höchstbetrag. */
  credit: number;
  /** Ausschöpfung 0..1 (credit / capCredit). */
  capUtilization: number;
  /** Kosten-Höchstbetrag überschritten? */
  capCostsExceeded: boolean;
  /** Vollständiger Rechenweg (für Anzeige & Audit). */
  trace: Credit35aTrace;
}

/**
 * §35a-Ermäßigung: `min(costs, capCosts) * rate`, zusätzlich auf `capCredit`
 * gedeckelt. Negative/NaN-Kosten werden als 0 behandelt.
 */
export function compute35aCredit(
  costs: number,
  rate: number,
  capCosts: number,
  capCredit: number,
): Credit35aResult {
  const safe = Number.isFinite(costs) && costs > 0 ? costs : 0;
  const cappedCosts = Math.min(safe, capCosts);
  const rawCredit = round2(cappedCosts * rate);
  const credit = round2(Math.min(rawCredit, capCredit));
  const capUtilization = capCredit > 0 ? Math.min(1, credit / capCredit) : 0;
  return {
    cappedCosts: round2(cappedCosts),
    credit,
    capUtilization,
    capCostsExceeded: safe > capCosts,
    trace: {
      base: round2(safe),
      capCosts,
      cappedBase: round2(cappedCosts),
      rate,
      rawCredit,
      capCredit,
      credit,
    },
  };
}

/**
 * Entfernungspauschale (einfache Entfernung, ein Arbeitsweg pro Arbeitstag).
 * Ab VZ 2026 identischer Satz ab km 1; bis VZ 2025 gestaffelt (km 1–20 vs. ab 21).
 */
export function computePendlerpauschale(
  daysPerYear: number,
  oneWayKm: number,
  p: TaxYearParams,
): number {
  const days = Number.isFinite(daysPerYear) && daysPerYear > 0 ? daysPerYear : 0;
  const km = Number.isFinite(oneWayKm) && oneWayKm > 0 ? oneWayKm : 0;
  if (days === 0 || km === 0) return 0;
  const firstTier = Math.min(km, 20) * p.pendlerKm1bis20;
  const secondTier = Math.max(0, km - 20) * p.pendlerAbKm21;
  return round2(days * (firstTier + secondTier));
}

/**
 * Homeoffice-Pauschale: 6 €/Tag, gedeckelt auf `homeofficeMaxTage` Tage bzw.
 * `homeofficeMax` Euro.
 */
export function computeHomeofficePauschale(days: number, p: TaxYearParams): number {
  const d = Number.isFinite(days) && days > 0 ? days : 0;
  const cappedDays = Math.min(d, p.homeofficeMaxTage);
  return round2(Math.min(cappedDays * p.homeofficeProTag, p.homeofficeMax));
}

export const TAX_RUBRICS: TaxRubric[] = [
  {
    id: '35a-minijob',
    anlage: '35a',
    kind: 'credit',
    requiresCashlessPayment: true,
    creditRateParam: 'creditRate35a',
    capCostsParam: 'a35a1CapCosts',
    capCreditParam: 'a35a1CapCredit',
    nameKey: 'tax.rubric.35aMinijob.name',
    hintKey: 'tax.rubric.35aMinijob.hint',
  },
  {
    id: '35a-dienstleistungen',
    anlage: '35a',
    kind: 'credit',
    requiresCashlessPayment: true,
    creditRateParam: 'creditRate35a',
    capCostsParam: 'a35a2CapCosts',
    capCreditParam: 'a35a2CapCredit',
    nameKey: 'tax.rubric.35aDienstleistungen.name',
    hintKey: 'tax.rubric.35aDienstleistungen.hint',
  },
  {
    id: '35a-handwerker',
    anlage: '35a',
    kind: 'credit',
    laborCostOnly: true,
    requiresCashlessPayment: true,
    creditRateParam: 'creditRate35a',
    capCostsParam: 'a35a3CapCosts',
    capCreditParam: 'a35a3CapCredit',
    nameKey: 'tax.rubric.35aHandwerker.name',
    hintKey: 'tax.rubric.35aHandwerker.hint',
  },
  {
    id: '35c-sanierung',
    anlage: '35a',
    kind: 'credit',
    informationalOnly: true,
    creditRateParam: 'creditRate35c',
    capCreditParam: 'a35cCapCredit',
    nameKey: 'tax.rubric.35cSanierung.name',
    hintKey: 'tax.rubric.35cSanierung.hint',
  },
  {
    id: 'werbungskosten',
    anlage: 'N',
    kind: 'deduction',
    thresholdParam: 'arbeitnehmerPauschbetrag',
    nameKey: 'tax.rubric.werbungskosten.name',
    hintKey: 'tax.rubric.werbungskosten.hint',
  },
  {
    id: 'sonderausgaben',
    anlage: 'sonderausgaben',
    kind: 'deduction',
    thresholdParam: 'sonderausgabenPauschbetrag',
    nameKey: 'tax.rubric.sonderausgaben.name',
    hintKey: 'tax.rubric.sonderausgaben.hint',
  },
  {
    id: 'agb',
    anlage: 'agb',
    kind: 'deduction',
    nameKey: 'tax.rubric.agb.name',
    hintKey: 'tax.rubric.agb.hint',
  },
  {
    id: 'vermietung',
    anlage: 'V',
    kind: 'deduction',
    nameKey: 'tax.rubric.vermietung.name',
    hintKey: 'tax.rubric.vermietung.hint',
  },
  {
    id: 'betriebsausgaben',
    anlage: 'euer',
    kind: 'deduction',
    nameKey: 'tax.rubric.betriebsausgaben.name',
    hintKey: 'tax.rubric.betriebsausgaben.hint',
  },
];

export const TAX_CATEGORIES: TaxCategory[] = [
  // ── §35a / §35c ──────────────────────────────────────────────────────────
  {
    id: 'tax-35a1-minijob',
    rubricId: '35a-minijob',
    nameKey: 'tax.cat.minijob.name',
    hintKey: 'tax.cat.minijob.hint',
    keywords: ['minijob-zentrale', 'minijob zentrale', 'haushaltshilfe', 'haushaltsscheck'],
  },
  {
    id: 'tax-35a2-dienstleistung',
    rubricId: '35a-dienstleistungen',
    nameKey: 'tax.cat.dienstleistung.name',
    hintKey: 'tax.cat.dienstleistung.hint',
    keywords: [
      'reinigungsservice',
      'reinigungsfirma',
      'putzhilfe',
      'putzkraft',
      'gebäudereinigung',
      'gebaeudereinigung',
      'fensterreinigung',
      'treppenhausreinigung',
      'gartenpflege',
      'gartenbau',
      'gartenservice',
      'winterdienst',
      'hausmeister',
      'hausmeisterservice',
      'pflegedienst',
      'umzugsservice',
      'umzugsunternehmen',
    ],
  },
  {
    id: 'tax-35a3-handwerker',
    rubricId: '35a-handwerker',
    nameKey: 'tax.cat.handwerker.name',
    hintKey: 'tax.cat.handwerker.hint',
    keywords: [
      'handwerker',
      'sanitär',
      'sanitaer',
      'elektriker',
      'elektroinstallation',
      'maler',
      'malerbetrieb',
      'dachdecker',
      'schornsteinfeger',
      'kaminkehrer',
      'heizung',
      'heizungswartung',
      'klempner',
      'installateur',
      'tischler',
      'schreiner',
      'fliesenleger',
      'gerüstbau',
      'geruestbau',
      'rohrreinigung',
      'schlüsseldienst',
      'schluesseldienst',
    ],
  },
  {
    id: 'tax-35c-sanierung',
    rubricId: '35c-sanierung',
    nameKey: 'tax.cat.sanierung.name',
    hintKey: 'tax.cat.sanierung.hint',
    keywords: [
      'energetische sanierung',
      'wärmedämmung',
      'waermedaemmung',
      'wärmepumpe',
      'waermepumpe',
      'fensteraustausch',
    ],
  },
  // ── Werbungskosten (Anlage N) ─────────────────────────────────────────────
  {
    id: 'tax-n-arbeitsmittel',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.arbeitsmittel.name',
    hintKey: 'tax.cat.arbeitsmittel.hint',
    keywords: [],
  },
  {
    id: 'tax-n-fortbildung',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.fortbildung.name',
    keywords: ['seminar', 'fortbildung', 'weiterbildung', 'schulung', 'udemy', 'coursera', 'fernuni'],
  },
  {
    id: 'tax-n-fahrtkosten',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.fahrtkosten.name',
    hintKey: 'tax.cat.fahrtkosten.hint',
    keywords: [],
  },
  {
    id: 'tax-n-berufskleidung',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.berufskleidung.name',
    keywords: ['berufskleidung', 'arbeitskleidung', 'arbeitsschutz', 'sicherheitsschuhe', 'engelbert strauss'],
  },
  {
    id: 'tax-n-gewerkschaft',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.gewerkschaft.name',
    keywords: ['gewerkschaft', 'verdi', 'ver.di', 'ig metall', 'ig bce', 'beamtenbund'],
  },
  {
    id: 'tax-n-bewerbung',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.bewerbung.name',
    keywords: ['bewerbung', 'bewerbungsfoto'],
  },
  {
    id: 'tax-n-reisekosten',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.reisekosten.name',
    hintKey: 'tax.cat.reisekosten.hint',
    keywords: ['dienstreise'],
  },
  {
    id: 'tax-n-doppelter-haushalt',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.doppelterHaushalt.name',
    hintKey: 'tax.cat.doppelterHaushalt.hint',
    keywords: [],
  },
  {
    id: 'tax-n-umzug',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.umzug.name',
    hintKey: 'tax.cat.umzug.hint',
    keywords: [],
  },
  {
    id: 'tax-n-telefon-internet',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.telefonInternet.name',
    hintKey: 'tax.cat.telefonInternet.hint',
    keywords: [],
  },
  {
    id: 'tax-n-kontofuehrung',
    rubricId: 'werbungskosten',
    nameKey: 'tax.cat.kontofuehrung.name',
    hintKey: 'tax.cat.kontofuehrung.hint',
    keywords: ['kontoführung', 'kontofuehrung', 'kontoführungsgebühr'],
  },
  // ── Sonderausgaben ────────────────────────────────────────────────────────
  {
    id: 'tax-so-spenden',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.spenden.name',
    hintKey: 'tax.cat.spenden.hint',
    keywords: [
      'spende',
      'betterplace',
      'unicef',
      'wwf',
      'caritas',
      'ärzte ohne grenzen',
      'aerzte ohne grenzen',
      'brot für die welt',
      'welthungerhilfe',
    ],
  },
  {
    id: 'tax-so-parteispenden',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.parteispenden.name',
    hintKey: 'tax.cat.parteispenden.hint',
    keywords: ['parteispende', 'parteibeitrag'],
  },
  {
    id: 'tax-so-kirchensteuer',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.kirchensteuer.name',
    keywords: ['kirchensteuer', 'kirchgeld'],
  },
  {
    id: 'tax-so-kinderbetreuung',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.kinderbetreuung.name',
    hintKey: 'tax.cat.kinderbetreuung.hint',
    keywords: ['kita', 'kindergarten', 'kindertagesstätte', 'kindertagesstaette', 'kinderhort', 'tagesmutter', 'babysitter', 'kinderbetreuung'],
    rule: {
      rateParam: 'kinderbetreuungRate',
      capParam: 'kinderbetreuungMaxProKind',
      capUnitKey: 'tax.capUnit.perChild',
      requiresCashlessPayment: true,
    },
  },
  {
    id: 'tax-so-schulgeld',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.schulgeld.name',
    hintKey: 'tax.cat.schulgeld.hint',
    keywords: ['schulgeld', 'privatschule'],
    rule: {
      rateParam: 'schulgeldRate',
      capParam: 'schulgeldMax',
      capUnitKey: 'tax.capUnit.perChild',
    },
  },
  {
    id: 'tax-so-riester',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.riester.name',
    keywords: ['riester'],
    rule: { capParam: 'riesterMax', capUnitKey: 'tax.capUnit.perYear' },
  },
  {
    id: 'tax-so-ruerup',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.ruerup.name',
    keywords: ['rürup', 'ruerup', 'basisrente'],
  },
  {
    id: 'tax-so-versicherungen',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.versicherungen.name',
    hintKey: 'tax.cat.versicherungen.hint',
    keywords: ['haftpflichtversicherung', 'berufsunfähigkeitsversicherung', 'unfallversicherung', 'risikolebensversicherung'],
  },
  {
    id: 'tax-so-unterhalt-ex',
    rubricId: 'sonderausgaben',
    nameKey: 'tax.cat.unterhaltEx.name',
    hintKey: 'tax.cat.unterhaltEx.hint',
    keywords: [],
    rule: { capParam: 'unterhaltExPartnerMax', capUnitKey: 'tax.capUnit.perYear' },
  },
  // ── Außergewöhnliche Belastungen ──────────────────────────────────────────
  {
    id: 'tax-agb-krankheit',
    rubricId: 'agb',
    nameKey: 'tax.cat.krankheit.name',
    hintKey: 'tax.cat.krankheit.hint',
    keywords: ['zuzahlung', 'eigenanteil', 'rezeptgebühr', 'rezeptgebuehr', 'zahnersatz', 'hörgerät', 'hoergeraet'],
  },
  {
    id: 'tax-agb-pflege',
    rubricId: 'agb',
    nameKey: 'tax.cat.pflege.name',
    keywords: ['pflegeheim', 'pflegedienst', 'kurzzeitpflege'],
  },
  {
    id: 'tax-agb-bestattung',
    rubricId: 'agb',
    nameKey: 'tax.cat.bestattung.name',
    hintKey: 'tax.cat.bestattung.hint',
    keywords: ['bestattung', 'beerdigung', 'bestattungshaus', 'friedhof', 'grabstein'],
  },
  {
    id: 'tax-agb-unterhalt-beduerftige',
    rubricId: 'agb',
    nameKey: 'tax.cat.unterhaltBeduerftige.name',
    hintKey: 'tax.cat.unterhaltBeduerftige.hint',
    keywords: [],
  },
  // ── Vermietung (Anlage V) ─────────────────────────────────────────────────
  {
    id: 'tax-v-schuldzinsen',
    rubricId: 'vermietung',
    nameKey: 'tax.cat.vSchuldzinsen.name',
    keywords: [],
  },
  {
    id: 'tax-v-erhaltung',
    rubricId: 'vermietung',
    nameKey: 'tax.cat.vErhaltung.name',
    keywords: [],
  },
  {
    id: 'tax-v-nebenkosten',
    rubricId: 'vermietung',
    nameKey: 'tax.cat.vNebenkosten.name',
    keywords: [],
  },
  {
    id: 'tax-v-verwaltung',
    rubricId: 'vermietung',
    nameKey: 'tax.cat.vVerwaltung.name',
    keywords: ['hausverwaltung'],
  },
  {
    id: 'tax-v-sonstiges',
    rubricId: 'vermietung',
    nameKey: 'tax.cat.vSonstiges.name',
    hintKey: 'tax.cat.vSonstiges.hint',
    keywords: [],
  },
  // ── Betriebsausgaben (EÜR) ────────────────────────────────────────────────
  {
    id: 'tax-eur-betriebsausgabe',
    rubricId: 'betriebsausgaben',
    nameKey: 'tax.cat.betriebsausgabe.name',
    hintKey: 'tax.cat.betriebsausgabe.hint',
    keywords: [],
  },
];

const rubricById = new Map<TaxRubricId, TaxRubric>(TAX_RUBRICS.map((r) => [r.id, r]));
export const taxCategoryById = new Map<string, TaxCategory>(TAX_CATEGORIES.map((c) => [c.id, c]));

export function getRubric(rubricId: TaxRubricId): TaxRubric | undefined {
  return rubricById.get(rubricId);
}

/** Rubrik einer Blatt-Kategorie (über deren `rubricId`). */
export function getRubricForCategory(taxCategoryId: string): TaxRubric | undefined {
  const cat = taxCategoryById.get(taxCategoryId);
  return cat ? rubricById.get(cat.rubricId) : undefined;
}
