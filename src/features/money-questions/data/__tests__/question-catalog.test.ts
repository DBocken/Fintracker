import { describe, it, expect } from 'vitest';
import { questionCatalog } from '../question-catalog';
import { ERFRAGBARE_SLOTS } from '@/features/money-questions/application/use-money-questions';
import { fehlendeSlots } from '@/lib/question-registry';
import type { DataNeed, QuestionData, QuestionSlots, SlotName } from '@/lib/question-registry';
import { decodeDashboardFilters, filterTransactions } from '@/features/shared/domain/dashboard-filtering';
import { sumExpenses, sumIncome } from '@/lib/analysis-data';
import { SUPPORTED_LOCALES, translations } from '@/i18n/translations';
import { istStoppwort, zerlegeAusloeser } from '@/lib/question-matcher';
import type { Account, Category, Transaction } from '@/types';
import type { Debt } from '@/lib/debt-types';
import type { SpecialCategory, SpecialCategoryAssignment } from '@/lib/category-types';
import type { Portfolio, PortfolioPosition } from '@/lib/portfolio-types';
import type { NetWorthBreakdown } from '@/lib/net-worth-types';
import type { TaxReserveState } from '@/lib/tax-types';
import { asTransactionId } from '@/lib/ids';

const JETZT = new Date('2026-07-20T12:00:00Z');

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-07-05',
    amount: -30,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    id: asTransactionId(overrides.id ?? `qc-${seq}`),
  };
}

const categories: Category[] = [
  { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] } as unknown as Category,
];
function konto(id: string, name: string, type: Account['type'], saldo: number): Account {
  return {
    id,
    user_id: 'local',
    name,
    type,
    currency: 'EUR',
    color: '#000000',
    icon: 'wallet',
    is_budget_pool_member: true,
    order_index: 0,
    opening_balance: saldo,
    opening_balance_date: '2026-01-01',
  };
}

const accounts: Account[] = [
  konto('a1', 'Girokonto', 'checking', 2000),
  konto('a2', 'Sparkonto', 'savings', 1200),
];

const transactions: Transaction[] = [
  tx({ id: 't1', payee: 'LIDL SAGT DANKE 1234', amount: -30, date: '2026-07-05' }),
  tx({ id: 't2', payee: 'LIDL SAGT DANKE 5678', amount: -20, date: '2026-07-12' }),
  tx({ id: 't3', payee: 'LIDL SAGT DANKE 9012', amount: -25, date: '2026-06-11' }),
  tx({ id: 't4', payee: 'REWE SAGT DANKE 4711', amount: -15, date: '2026-07-08' }),
  tx({ id: 't5', payee: 'Arbeitgeber', amount: 2400, date: '2026-07-01' }),
  // Notiz nennt Lidl — darf beim Händlerfilter NICHT mitzählen.
  tx({ id: 't6', payee: 'Parkhaus', amount: -4, date: '2026-07-09', tax_note: 'bei Lidl geparkt' }),
];

const debts: Debt[] = [
  {
    id: 'd1',
    user_id: 'local',
    name: 'Autokredit',
    type: 'car_loan',
    balance: 4800,
    interest_rate: 3.9,
    min_payment: 180,
    is_bnpl: false,
    is_paid_off: false,
  } as Debt,
];

/**
 * Die Kanäle der Welle 2 und 3 — bewusst ALLE belegt.
 *
 * Browser-Fund der Nach-Verifikation: Die Fixture kannte nur die fünf Kanäle
 * der ersten Ausbaustufe. Jeder Eintrag, dessen Daten hier fehlten, fiel in
 * seinen „nichts da"-Zweig — und lag damit ausserhalb der tragenden
 * Invariante dieses Tests, ohne dass irgendetwas rot wurde. Gemessen betraf
 * das 15 der 61 Einträge: Vermögen, Depots, Anlässe, Steuer, Reichweite,
 * Überträge. Eine Invariante prüft nur, was die Fixture füllt.
 */
const specialCategories: SpecialCategory[] = [
  { id: 'sc1', name: 'Urlaub Italien', start_date: '2026-07-01', end_date: '2026-07-31' },
];
const specialCategoryAssignments: SpecialCategoryAssignment[] = [
  { id: 'sca1', special_category_id: 'sc1', transaction_id: 't1', source: 'manual' },
];

const portfolios: Portfolio[] = [
  { id: 'p1', user_id: 'local', name: 'Depot', type: 'manual', currency: 'EUR', is_active: true },
];
const positionsByPortfolio = new Map<string, PortfolioPosition[]>([
  [
    'p1',
    [
      { id: 'pos1', portfolio_id: 'p1', symbol: 'ACME', quantity: 10, entry_price: 100, currency: 'EUR', last_price: 120 },
    ],
  ],
]);

const netWorth: NetWorthBreakdown = {
  cash: 3200,
  investments: 1200,
  receivables: 0,
  debts: 4800,
  netWorth: 3200 + 1200 + 15000 - 4800,
  accountBalances: { a1: 2000, a2: 1200 },
  accountSources: [
    { id: 'a1', name: 'Girokonto', balance: 2000, source: 'local' },
    { id: 'a2', name: 'Sparkonto', balance: 1200, source: 'local' },
  ],
  portfolioSources: [{ id: 'p1', name: 'Depot', value: 1200, positionsCount: 1 }],
  unconvertedInvestments: [],
  debtSources: [{ id: 'd1', name: 'Autokredit', balance: 4800 }],
  receivableSources: [],
  // Gefüllt, nicht auf 0 gelassen — die Lehre der Nach-Verifikation: Eine
  // Invariante prüft nur, was die Fixture füllt.
  manualAssets: 15000,
  manualAssetSources: [
    { id: 'ma1', name: 'Auto', value: 15000, kind: 'vehicle', valuedAt: '2026-05-01', stale: false },
  ],
};

const taxReserve: TaxReserveState = {
  id: 'tax-reserve-2026',
  user_id: 'local',
  year: 2026,
  movements: [{ id: 'm1', date: '2026-07-01', amount: 200 }],
};

/**
 * Der Zahlungsstrom reist im KANAL `portfolios` mit (Welle 4) und ist damit
 * kein eigener `DataNeed` — der Kanal-Wächter unten sieht ihn also nicht.
 * Gefüllt gehört er trotzdem: Sonst fiele die Rendite-Antwort in ihren
 * „ohne Zahlungen"-Zweig, und der läge ausserhalb der Prüfung.
 */
const portfolioCashflows = [
  { id: 'cf1', portfolio_id: 'p1', date: '2025-08-01', amount: 1000, direction: 'deposit' as const },
];

const daten: QuestionData = {
  transactions,
  categories,
  accounts,
  debts,
  budgets: [],
  contractDecisions: new Map(),
  settings: null,
  specialCategories,
  specialCategoryAssignments,
  portfolios,
  positionsByPortfolio,
  portfolioCashflows,
  netWorth,
  taxReserve,
  merchantRules: [],
  // Zwei Stände, nicht einer: Mit nur einem Punkt fiele der Entwicklungs-
  // Eintrag in seinen „noch keine Historie"-Zweig — und läge damit ausserhalb
  // der Prüfung.
  netWorthHistory: [
    { month: '2026-02', takenAt: '2026-02-15', netWorth: 1000, cash: 1000, investments: 0, manualAssets: 0, receivables: 0, debts: 0 },
    { month: '2026-07', takenAt: '2026-07-15', netWorth: 1500, cash: 1500, investments: 0, manualAssets: 0, receivables: 0, debts: 0 },
  ],
  allocationsByTransaction: new Map(),
  jetzt: JETZT,
};

/** Slots, die jeden Pflicht-Slot des Katalogs plausibel belegen. */
const alleSlots: QuestionSlots = {
  haendler: 'lidl sagt danke',
  kategorieIds: ['local-cat-lebensmittel'],
  betrag: 12000,
  zeitraum: { von: '2026-07-01', bis: '2026-07-31', rangeToken: '2026-07', label: '2026-07' },
};

function leaf(baum: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, teil) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[teil] : undefined),
    baum,
  );
}

describe('Abfrage-Register: Katalog', () => {
  it('sollte Einträge aus mehreren Slices einsammeln', () => {
    // Belegt, dass der Glob wirklich greift — eine leere Liste wäre der
    // stumme Ausfall, gegen den die Kompositionswurzel gebaut ist.
    expect(questionCatalog.entries.length).toBeGreaterThanOrEqual(5);
    const ids = questionCatalog.entries.map((e) => e.id);
    expect(ids).toContain('ausgaben.haendler');
    expect(ids).toContain('vertrag.jahreskosten');
    expect(ids).toContain('schulden.restschuld');
    expect(ids).toContain('budget.status');
    expect(ids).toContain('leistbarkeit.anschaffung');
  });

  it('sollte für jeden Eintrag mindestens ein Auslösewort haben', () => {
    // Seit der Matcher einen Auslöser-Treffer VERLANGT (sonst qualifizierte
    // sich ein Eintrag allein über einen Zeitausdruck und beantwortete die
    // falsche Frage), ist ein Eintrag ohne Auslöser unerreichbar — und das
    // wäre ein stummer Ausfall: Die Frage würde schlicht nie beantwortet.
    for (const entry of questionCatalog.entries) {
      expect(entry.ausloeser.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('sollte für jeden Eintrag einen Anzeigenamen in ALLEN Sprachen kennen (WP-F.2)', () => {
    // Der Name beschriftet den Kandidaten-Button der Auswahl-Rückfrage. Er
    // wird dynamisch aufgelöst (`t(\`financeQuestions.entryName.\${id}\`)`)
    // und stünde ohne Eintrag als roher Punkt-String auf dem Button.
    for (const entry of questionCatalog.entries) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(
          typeof leaf(translations[locale], `financeQuestions.entryName.${entry.id}`),
          `${locale}: financeQuestions.entryName.${entry.id}`,
        ).toBe('string');
      }
    }
  });

  it('sollte kein einzelnes Funktionswort als Auslöser kuratieren (WP-F.2)', () => {
    // Der Matcher ignoriert so einen Auslöser zwar defensiv — aber still.
    // Ein kuratierter Stoppwort-Auslöser ist ein Fehler der Sprachpflege und
    // soll LAUT scheitern: Genau diese Bauform („leisten kann ich mir" als
    // Token-Beutel) hat 180 von 225 Korpus-Fragen falsch beantwortet.
    for (const entry of questionCatalog.entries) {
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of entry.ausloeser) {
          const wert = leaf(translations[locale], key);
          if (typeof wert !== 'string') continue;
          for (const phrase of zerlegeAusloeser(wert)) {
            // Bis Welle 2 wurden MEHRWORT-Phrasen hier übersprungen — und
            // damit war „noch für" als Auslöser von `budget.rest` unsichtbar,
            // obwohl es aus zwei Funktionswörtern besteht und deshalb genauso
            // wenig Absicht trägt wie ein einzelnes. Es fing gemessen die
            // Frage „wie viel muss ich noch fürs finanzamt zurücklegen" ab.
            // Geprüft wird deshalb die ganze Phrase: Besteht sie NUR aus
            // Funktionswörtern, ist sie als Auslöser untauglich.
            const teile = phrase.split(' ');
            expect(
              teile.every((teil) => istStoppwort(teil)),
              `${locale}: „${phrase}" (${key}) besteht nur aus Funktionswörtern`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('sollte eindeutige IDs haben', () => {
    const ids = questionCatalog.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sollte für jeden Eintrag Auslöser und Aussage in ALLEN Sprachen kennen', () => {
    // Ein Eintrag ohne Übersetzung ist in dieser Sprache stumm — und das
    // fällt sonst niemandem auf, weil `t()` den rohen Punkt-String rendert.
    const fehlend: string[] = [];

    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      const keys = [
        ...entry.ausloeser,
        antwort.aussage.key,
        ...(antwort.begruendung ?? []).map((b) => b.key),
        // Auch die eigene Link-Beschriftung: Sie wird dynamisch aufgelöst
        // (`t(antwort.deepLinkLabelKey)`) und stünde sonst als roher
        // Punkt-String auf dem Bildschirm.
        ...(antwort.deepLinkLabelKey ? [antwort.deepLinkLabelKey] : []),
        // Und die Rubriken einer Listen-Antwort. Sie waren hier NICHT
        // geprüft, und genau das ist im Browser aufgeschlagen: Die neue
        // Vermögens-Rubrik der Welle 4 landete beim Einsetzen im falschen
        // Sprachbaum-Block, und auf dem Bildschirm stand
        // `financeQuestions.vermoegen.manualAssets`. Ein `labelKey` ist ein
        // DATENFELD, kein `t()`-Aufruf — die Aufrufstellen-Ratsche kann ihn
        // strukturell nicht sehen, und diese Prüfung sah ihn bis hierher
        // auch nicht.
        ...(antwort.posten ?? []).flatMap((p) => (p.labelKey ? [p.labelKey] : [])),
      ];
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of keys) {
          if (typeof leaf(translations[locale], key) !== 'string') {
            fehlend.push(`${locale}: ${key}`);
          }
        }
      }
    }

    expect(fehlend).toEqual([]);
  });

  it('sollte für JEDEN Slot-Namen eine Rückfrage in allen Sprachen haben', () => {
    // Die Fläche baut den Key dynamisch (`financeQuestions.slot.${slot}`) —
    // `call-site-keys.test.ts` kann so etwas nicht auflösen und zählt es nur.
    // Dieser Test leuchtet genau diesen blinden Fleck aus: Ein Slot ohne
    // Übersetzung führte sonst dazu, dass die Rückfrage den rohen
    // Punkt-String auf den Bildschirm schreibt, statt zu fragen.
    const alleSlots: SlotName[] = ['zeitraum', 'kategorie', 'haendler', 'konto', 'betrag'];
    const fehlend: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      for (const slot of alleSlots) {
        const key = `financeQuestions.slot.${slot}`;
        if (typeof leaf(translations[locale], key) !== 'string') fehlend.push(`${locale}: ${key}`);
      }
    }

    expect(fehlend).toEqual([]);
  });

  it('sollte keinen Slot verlangen, für den es keine Rückfrage gibt', () => {
    // Gegenrichtung: Ein Eintrag darf keinen Pflicht-Slot deklarieren, den die
    // Fläche nicht erfragen kann — sonst stünde die Rückfrage leer da.
    // Die Liste kommt aus der FLÄCHE (`ERFRAGBARE_SLOTS`), nicht aus diesem
    // Test: Eine zweite Handliste hier hätte beim nächsten Slot gefehlt und
    // den Fehler durchgelassen, den sie fangen soll. `zeitraum` und `betrag`
    // stehen zusätzlich darin — sie werden aus dem Text gelesen statt
    // ausgewählt und brauchen deshalb keine Kandidatenliste.
    const erfragbar = new Set<string>([...ERFRAGBARE_SLOTS, 'zeitraum', 'betrag']);
    for (const entry of questionCatalog.entries) {
      for (const slot of [...entry.slots.erforderlich, ...entry.slots.optional]) {
        expect(erfragbar.has(slot), `${entry.id}: ${slot}`).toBe(true);
      }
    }
  });

  it('sollte niemals einen fertig formatierten Betrag zurückgeben', () => {
    // Die Festlegung, an der der Sanfte Modus hängt: Formatiert wird in der
    // Präsentation (über `money.mask`), nie im Register — `src/lib/` hat
    // keinen React-Kontext, und `check:money-format` sieht dort nichts.
    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      expect(typeof antwort.wert === 'number' || antwort.wert === null).toBe(true);
      for (const wert of Object.values(antwort.aussage.params)) {
        expect(String(wert)).not.toMatch(/[€$]|\bEUR\b/);
      }
    }
  });

  it('sollte für jeden Eintrag einen Deep-Link liefern', () => {
    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      expect(antwort.deepLink.startsWith('/')).toBe(true);
    }
  });

  it('sollte teure Einträge verweisen lassen statt rechnen', () => {
    for (const entry of questionCatalog.entries.filter((e) => e.aufwand === 'teuer')) {
      // `verweis` UND `szenario` erfüllen die Invariante: `antwort()` rechnet
      // in beiden Fällen NICHT — der Verweis öffnet die rechnende Fläche, das
      // Szenario reicht die erkannte Absicht durch, und die Monte-Carlo läuft
      // asynchron in der Fläche (WP-H). Verboten bleibt eine teure Rechnung
      // IM Register.
      // `zielrueckrechnung` (Welle 3) gehört in dieselbe Klasse wie
      // `szenario`: Die Antwort trägt die FRAGE, gerechnet wird asynchron in
      // der Fläche.
      expect(['verweis', 'szenario', 'zielrueckrechnung']).toContain(
        entry.antwort(alleSlots, daten).art,
      );
      // Ein teurer Eintrag darf keine Daten anfordern — sonst würde die
      // Fläche für eine Antwort laden, die sie gar nicht berechnet.
      expect(entry.needs).toEqual([]);
    }
  });

  it('sollte fehlende Pflicht-Slots benennen, statt zu raten', () => {
    const eintrag = questionCatalog.byId('ausgaben.haendler');
    expect(eintrag).toBeDefined();
    expect(fehlendeSlots(eintrag!, {})).toEqual(['haendler']);
    expect(fehlendeSlots(eintrag!, { haendler: 'lidl' })).toEqual([]);
  });

  it('sollte nur die Bedürfnisse der gefragten Einträge nennen', () => {
    expect(questionCatalog.needsFor(['schulden.restschuld'])).toEqual(['debts']);
    expect(questionCatalog.needsFor(['leistbarkeit.anschaffung'])).toEqual([]);
  });
});

/**
 * DIE tragende Invariante des Registers.
 *
 * Ohne sie driften genannte Zahl und verlinkte Liste auseinander, und der Chat
 * wird zur Quelle falscher Auskunft mit belastbar wirkendem Beleg — das
 * schlimmste denkbare Ergebnis dieses Pakets.
 */
/**
 * Der Wächter gegen den Fund, der diese Fixture überhaupt gefüllt hat.
 *
 * Die tragende Invariante darunter prüft nur, was hier belegt ist. Als Welle 2
 * fünf neue Kanäle öffnete, blieben sie in der Fixture leer — jeder Eintrag
 * darauf fiel in seinen „nichts da"-Zweig und lag damit ausserhalb JEDER
 * Zusicherung, ohne dass etwas rot wurde. Aufgefallen ist es erst im Browser,
 * an einer Antwort, die zwei Konten als „2 Buchungen" auswies.
 *
 * Dieser Test macht die nächste Kanal-Erweiterung sofort rot, statt sie
 * stumm aus der Prüfung fallen zu lassen.
 */
describe('Abfrage-Register: die Fixture bedient jeden angemeldeten Kanal', () => {
  const kanalBelegt: Record<DataNeed, boolean> = {
    transactions: daten.transactions !== undefined,
    categories: daten.categories !== undefined,
    accounts: daten.accounts !== undefined,
    allocations: daten.allocationsByTransaction !== undefined,
    contractDecisions: daten.contractDecisions !== undefined,
    debts: daten.debts !== undefined,
    budgets: daten.budgets !== undefined,
    settings: 'settings' in daten,
    specialCategories: daten.specialCategories !== undefined,
    portfolios: daten.portfolios !== undefined,
    netWorth: daten.netWorth !== undefined,
    taxReserve: daten.taxReserve !== undefined,
    merchantRules: daten.merchantRules !== undefined,
    netWorthHistory: daten.netWorthHistory !== undefined,
  };

  it('sollte jeden Kanal belegen, den irgendein Eintrag anmeldet', () => {
    const angemeldet = new Set<DataNeed>(questionCatalog.entries.flatMap((e) => [...e.needs]));
    const unbelegt = [...angemeldet].filter((kanal) => !kanalBelegt[kanal]);
    expect(unbelegt, 'Kanäle ohne Fixture-Beleg').toEqual([]);
  });

  it('sollte eine nicht-leere Menge je Kanal liefern, damit die Prüfung nicht trivial durchgeht', () => {
    // Ein belegter, aber leerer Kanal ist derselbe blinde Fleck mit anderem
    // Vorzeichen: Der Eintrag läuft wieder in seinen Leer-Zweig.
    expect(daten.specialCategories?.length ?? 0).toBeGreaterThan(0);
    expect(daten.portfolios?.length ?? 0).toBeGreaterThan(0);
    expect(daten.accounts?.length ?? 0).toBeGreaterThan(0);
    expect(daten.netWorth).not.toBeNull();
    expect(daten.taxReserve).not.toBeNull();
  });
});

describe('Abfrage-Register: Zahl und Deep-Link zeigen dieselbe Menge', () => {
  // Die harte Zusicherung gilt für Einträge, die ihren Link als QUELLE
  // ausweisen. `kontext` ist kein Schlupfloch, sondern eine echte
  // Unterscheidung — siehe `deepLinkArt` in `question-registry.ts`.
  const mitQuellLink = () =>
    questionCatalog.entries.filter((entry) => entry.antwort(alleSlots, daten).deepLinkArt === 'quelle');

  it('sollte mindestens einen Eintrag mit Quell-Deep-Link haben', () => {
    expect(mitQuellLink().length).toBeGreaterThan(0);
  });

  it('sollte die Zusicherung an einer NICHT-leeren Menge prüfen', () => {
    // Ohne diesen Test könnte die Invariante trivial durchgehen: Liefert ein
    // Eintrag 0 Buchungen und der Link ebenfalls 0, stimmen beide Seiten
    // überein, ohne dass irgendetwas geprüft wurde. Genau das ist hier
    // einmal passiert, als `filterAusSlots` noch Slots anwandte, die der
    // Eintrag gar nicht deklariert hatte.
    const nichtLeer = mitQuellLink().filter((e) => e.antwort(alleSlots, daten).anzahl > 0);
    expect(nichtLeer.length).toBeGreaterThan(0);
  });

  it('sollte jeden Quell-Link auf die gefilterte Buchungsliste zeigen lassen', () => {
    // Ein Quell-Link, der keinen Filterzustand trägt, könnte die Zusicherung
    // gar nicht einlösen — er zeigte immer die ganze Liste.
    for (const entry of mitQuellLink()) {
      expect(entry.antwort(alleSlots, daten).deepLink, entry.id).toMatch(/^\/transactions\?/);
    }
  });

  it('sollte für jeden Quell-Deep-Link dieselbe Anzahl und Summe ergeben wie die Antwort', () => {
    for (const entry of mitQuellLink()) {
      const antwort = entry.antwort(alleSlots, daten);
      const params = new URLSearchParams(antwort.deepLink.split('?')[1]);
      const ausLink = filterTransactions(
        transactions,
        categories,
        accounts,
        decodeDashboardFilters(params),
        JETZT,
      );

      expect(ausLink.length, `${entry.id}: Anzahl`).toBe(antwort.anzahl);

      if (antwort.art === 'geld' && antwort.wert !== null) {
        const summe = antwort.wert >= 0 && sumIncome(ausLink) === antwort.wert
          ? sumIncome(ausLink)
          : sumExpenses(ausLink);
        expect(summe, `${entry.id}: Summe`).toBeCloseTo(antwort.wert, 2);
      }
    }
  });

  it('sollte auch für rollende Spannen dieselbe Menge liefern', () => {
    // „letzte 30 Tage" darf im Deep-Link nicht still auf „Gesamt" zurückfallen
    // — die Antwort nennte sonst eine Summe über den ganzen Bestand.
    const slots: QuestionSlots = {
      ...alleSlots,
      zeitraum: { von: '2026-06-20', bis: '2026-07-20', rangeToken: '30d', label: '30' },
    };
    const antwort = questionCatalog.byId('ausgaben.haendler')!.antwort(slots, daten);
    const params = new URLSearchParams(antwort.deepLink.split('?')[1]);

    expect(params.get('range')).toBe('30d');
    const ausLink = filterTransactions(transactions, categories, accounts, decodeDashboardFilters(params), JETZT);
    expect(ausLink.length).toBe(antwort.anzahl);
    // Nur die Juli-Lidl-Buchungen, nicht die vom 11. Juni.
    expect(ausLink.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('sollte den Vertragslink auf den VERTRAG zeigen lassen, nicht auf die Buchungsliste', () => {
    // Bis `/contracts` einen `?merchant=`-Parameter bekam, musste dieser
    // Eintrag ersatzweise auf die Buchungsliste verlinken — also auf eine
    // ANDERE Menge als die, aus der seine Zahl stammt.
    const antwort = questionCatalog.byId('vertrag.jahreskosten')!.antwort(alleSlots, daten);

    expect(antwort.deepLink).toMatch(/^\/contracts\?merchant=/);
    // Kein Fingerprint in einer teilbaren URL — das wäre eine IBAN.
    expect(antwort.deepLink).not.toContain('iban');
    // Eigene Beschriftung: „genau diese Buchungen" wäre hier schlicht falsch.
    expect(antwort.deepLinkLabelKey).toBeTruthy();
  });

  it('[REGRESSION] sollte den Notiz-Treffer weder zählen noch verlinken', () => {
    // `t6` nennt „Lidl" in der Notiz. Die Antwort zählt ihn nicht — und der
    // Deep-Link darf ihn ebenfalls nicht zeigen, sonst stimmt die Summe der
    // verlinkten Liste nicht mit der genannten Zahl überein.
    const antwort = questionCatalog.byId('ausgaben.haendler')!.antwort(alleSlots, daten);
    const params = new URLSearchParams(antwort.deepLink.split('?')[1]);
    const ausLink = filterTransactions(transactions, categories, accounts, decodeDashboardFilters(params), JETZT);

    expect(ausLink.map((t) => t.id)).not.toContain('t6');
    expect(antwort.anzahl).toBe(ausLink.length);
  });
});
