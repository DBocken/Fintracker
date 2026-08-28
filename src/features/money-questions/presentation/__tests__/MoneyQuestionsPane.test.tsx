import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, within, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import * as semantikDienst from '@/services/semantic-intent-service';

// `vi.mocked` statt roher Importe: Der Modul-Export trägt die ECHTE Signatur,
// die Mock-Methoden hängen erst am Doppel. Ohne das ist die Datei zwar grün
// in Vitest und rot im Typecheck — gefunden hat es der Build.
const modellStatus = vi.mocked(semantikDienst.modellStatus);
const modellLoeschen = vi.mocked(semantikDienst.modellLoeschen);
const semantikVorschlaegeFuer = vi.mocked(semantikDienst.semantikVorschlaegeFuer);
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { getQuestionConfirmations } from '@/services/question-confirmation-service';

const getTransactions = vi.fn();
const getCategories = vi.fn();
const getAccounts = vi.fn();
const getDebts = vi.fn();
const getBudgets = vi.fn();
const getContractDecisionMap = vi.fn();
// Kanäle der Welle 2. Sie werden hier mitgemockt, weil das ViewModel sie
// LÄDT — ein ungemockter Dienst liefe gegen IndexedDB und machte aus jeder
// Antwort eine Quellen-Absage.
const getAllocationMap = vi.fn();
const getUserSettings = vi.fn();
const getSpecialCategories = vi.fn();
const getSpecialCategoryAssignments = vi.fn();
const getPortfolios = vi.fn();
const getPositions = vi.fn();
const getNetWorthBreakdown = vi.fn();
const getTaxReserveState = vi.fn();
// Kanäle der Welle 4. Ohne Mock liefe der Dienst gegen IndexedDB — und weil
// der Zahlungsstrom in DERSELBEN Abfrage wie die Depots liegt, riss er die
// ganze Depot-Antwort mit. Genau der Grund, aus dem dieser Block existiert.
const getPortfolioCashflows = vi.fn();
const getNetWorthHistory = vi.fn();

/**
 * Der Semantik-Dienst wird gemockt: Er liest Cache Storage und lädt im
 * Ernstfall 135 MB — beides gehört nicht in einen Flächen-Test. Geprüft
 * wird hier, was die Fläche AUS dem Stand macht.
 */
vi.mock('@/services/semantic-intent-service', async (echt) => {
  const original = await echt<typeof import('@/services/semantic-intent-service')>();
  return {
    ...original,
    modellStatus: vi.fn(async () => ({
      installiert: false,
      dateien: 0,
      bytes: 0,
      unvollstaendig: false,
    })),
    modellLoeschen: vi.fn(async () => {}),
    semantikVorschlaegeFuer: vi.fn(async () => []),
  };
});

vi.mock('@/services/transaction-service', () => ({
  getTransactions: (...a: unknown[]) => getTransactions(...a),
  getCategories: () => getCategories(),
  getUserSettings: () => getUserSettings(),
}));
vi.mock('@/services/transaction-allocation-service', () => ({
  getAllocationMap: () => getAllocationMap(),
}));
vi.mock('@/services/special-category-service', () => ({
  getSpecialCategories: () => getSpecialCategories(),
  getSpecialCategoryAssignments: () => getSpecialCategoryAssignments(),
}));
vi.mock('@/services/portfolio-service', () => ({
  getPortfolios: () => getPortfolios(),
  getPositions: (...a: unknown[]) => getPositions(...a),
}));
vi.mock('@/services/net-worth-service', () => ({
  getNetWorthBreakdown: () => getNetWorthBreakdown(),
}));
vi.mock('@/services/portfolio-cashflow-service', async () => {
  const echt = await vi.importActual<typeof import('@/services/portfolio-cashflow-service')>(
    '@/services/portfolio-cashflow-service',
  );
  return { ...echt, getPortfolioCashflows: () => getPortfolioCashflows() };
});
vi.mock('@/services/net-worth-history-service', async () => {
  const echt = await vi.importActual<typeof import('@/services/net-worth-history-service')>(
    '@/services/net-worth-history-service',
  );
  return { ...echt, getNetWorthHistory: () => getNetWorthHistory() };
});
vi.mock('@/services/tax-reserve-service', () => ({
  getTaxReserveState: (...a: unknown[]) => getTaxReserveState(...a),
}));
vi.mock('@/services/account-service', () => ({ getAccounts: () => getAccounts() }));
vi.mock('@/services/debt-service', () => ({ getDebts: () => getDebts() }));
vi.mock('@/services/budget-service', () => ({ getBudgets: () => getBudgets() }));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: () => getContractDecisionMap(),
}));

import { MoneyQuestionsPane } from '../MoneyQuestionsPane';
import { useMoneyQuestions } from '../../application/use-money-questions';

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
    id: asTransactionId(overrides.id ?? `mq-${seq}`),
  };
}

/** Kategorien, deren Namen NICHT dem entsprechen, was ein Nutzer tippt. */
const KATEGORIEN = [
  { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: ['supermarkt'] },
  { id: 'local-cat-freizeit', name: 'Freizeit', filters: [] },
  // Trägt „essen" im NAMEN — genau der abstrakte Begriff aus dem Bericht.
  { id: 'local-cat-essenundtrinken', name: 'Essen & Trinken', filters: [] },
] as never[];

const BUCHUNGEN: Transaction[] = [
  tx({ id: 'l1', payee: 'LIDL SAGT DANKE 1234', amount: -30, date: '2026-07-05' }),
  tx({ id: 'l2', payee: 'LIDL SAGT DANKE 5678', amount: -20, date: '2026-07-12' }),
  tx({ id: 'l3', payee: 'LIDL SAGT DANKE 9012', amount: -25, date: '2026-06-11' }),
  // Notiz nennt Lidl — darf die Antwort NICHT erhöhen.
  tx({ id: 'p1', payee: 'Parkhaus Mitte', amount: -4, date: '2026-07-09', tax_note: 'bei Lidl geparkt' }),
  // Je eine Buchung in den ZWEI Kategorien, die der Oberbegriff „Essen"
  // umspannt — die Gruppensumme ist damit prüfbar (WP-G).
  tx({ id: 'g1', payee: 'REWE', amount: -40, date: '2026-07-08', category_id: 'local-cat-lebensmittel' }),
  tx({ id: 'g2', payee: 'Pizzeria Roma', amount: -60, date: '2026-07-15', category_id: 'local-cat-essenundtrinken' }),
  // Fremde Kategorie im selben Zeitraum — darf NICHT mitgezählt werden.
  tx({ id: 'g3', payee: 'Kino', amount: -15, date: '2026-07-16', category_id: 'local-cat-freizeit' }),
];

/** Testhülle, damit die Fläche mit festem „jetzt" reproduzierbar rendert. */
function Fixture() {
  const model = useMoneyQuestions(JETZT);
  return <MoneyQuestionsPane model={model} />;
}

function frage(text: string) {
  fireEvent.change(screen.getByLabelText(/Frage zu deinen Finanzen/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Frage stellen/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  getTransactions.mockResolvedValue(BUCHUNGEN);
  getCategories.mockResolvedValue(KATEGORIEN);
  getAccounts.mockResolvedValue([]);
  getDebts.mockResolvedValue([]);
  getBudgets.mockResolvedValue([]);
  getContractDecisionMap.mockResolvedValue(new Map());
  getAllocationMap.mockResolvedValue(new Map());
  getUserSettings.mockResolvedValue(null);
  getSpecialCategories.mockResolvedValue([]);
  getSpecialCategoryAssignments.mockResolvedValue([]);
  getPortfolios.mockResolvedValue([]);
  getPositions.mockResolvedValue([]);
  getNetWorthBreakdown.mockResolvedValue(null);
  getTaxReserveState.mockResolvedValue(null);
  getPortfolioCashflows.mockResolvedValue([]);
  getNetWorthHistory.mockResolvedValue([]);
});

describe('Nachfragen-Fläche', () => {
  it('[ZUSTAND /fragen:leer] sollte ohne Buchungen erklären, dass es nichts auszuwerten gibt — statt 0 € zu behaupten', async () => {
    getTransactions.mockResolvedValue([]);

    renderWithProviders(<Fixture />, { locale: 'de', query: true });

    // Der gefährliche Fehler wäre eine Zahl. „Noch keine Daten" ist eine
    // andere Aussage als „0 € ausgegeben".
    expect(await screen.findByText(/noch keine|keine daten|noch nichts/i)).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it('[ZUSTAND /fragen:fehler] sollte einen Lesefehler benennen, statt eine Antwort zu zeigen', async () => {
    getTransactions.mockRejectedValue(new Error('IndexedDB kaputt'));

    renderWithProviders(<Fixture />, { locale: 'de', query: true });

    expect(await screen.findByRole('button', { name: /erneut|nochmal|wiederhol/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Frage zu deinen Finanzen/i)).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte die Aufteilung einer Buchung TATSÄCHLICH laden, nicht nur anmelden', async () => {
    // Der Fund der Welle 2: `allocations` stand ab WP-C in `needs`, und
    // geladen hat es niemand — `daten.allocationsByTransaction` war IMMER
    // `undefined`. Weil die Einträge auf eine leere Map zurückfielen, zählte
    // eine gesplittete Buchung mit ihrem VOLLEN Betrag gegen das Budget.
    //
    // Deshalb steht dieser Test hier und nicht bei den Budget-Einträgen: Die
    // Rechnung war die ganze Zeit richtig. Falsch war der Weg dorthin, und
    // den sieht nur ein Test, der die Fläche mit ihren echten Abfragen fährt.
    getTransactions.mockResolvedValue([
      tx({ id: 'split-1', payee: 'REWE', amount: -100, date: '2026-07-08', category_id: null }),
    ]);
    getBudgets.mockResolvedValue([
      { id: 'b1', user_id: 'local', category_id: 'local-cat-lebensmittel', limit: 300, period: 'monthly' },
    ] as never);
    getAllocationMap.mockResolvedValue(
      new Map([
        [
          'split-1',
          [
            { id: 'a1', transaction_id: 'split-1', category_id: 'local-cat-lebensmittel', amount_minor: -4000 },
            { id: 'a2', transaction_id: 'split-1', category_id: 'local-cat-freizeit', amount_minor: -6000 },
          ],
        ],
      ]),
    );

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wie viel Budget habe ich noch übrig?');

    // 300 − 40 = 260 €. Ohne den geladenen Split wären es 200 € gewesen.
    expect(await screen.findByText(/260,00/)).toBeInTheDocument();
    expect(screen.queryByText(/200,00/)).not.toBeInTheDocument();
  });

  it('sollte eine unlesbare Quelle BENENNEN, statt sie als leer auszugeben', async () => {
    // „0 €" und „konnte ich nicht lesen" sind verschiedene Aussagen. Die
    // zweite als die erste auszugeben ist genau der Fehler, den der
    // Split-Kanal jahrelang unsichtbar gemacht hat.
    getAllocationMap.mockRejectedValue(new Error('IndexedDB kaputt'));
    getBudgets.mockResolvedValue([
      { id: 'b1', user_id: 'local', category_id: 'local-cat-lebensmittel', limit: 300, period: 'monthly' },
    ] as never);

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wie viel Budget habe ich noch übrig?');

    expect(await screen.findByText(/nicht lesen/i)).toBeInTheDocument();
    expect(screen.getByText(/Aufteilungen/i)).toBeInTheDocument();
  });

  it('sollte trotz einer unlesbaren Quelle jede Frage beantworten, die sie NICHT braucht', async () => {
    // Der Grund für den Zustand je Kanal: Bis Welle 1 hing der Fehlerzustand
    // an einer Liste aller Abfragen — ein Lesefehler irgendwo sperrte alles.
    // Mit fünf weiteren Kanälen wäre das ein Ausfall statt einer Vorsicht.
    getAllocationMap.mockRejectedValue(new Error('IndexedDB kaputt'));

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wieviel habe ich im Juli 2026 bei lidl sagt danke ausgegeben?');

    expect(await screen.findByText(/50,00/)).toBeInTheDocument();
  });

  it('[REGRESSION] sollte einen Prozentsatz gerundet zeigen, nicht roh', async () => {
    // Das Register liefert die Zahl UNGERUNDET — Runden ist eine
    // Darstellungsfrage. Ohne die Formatierung stünde „Das sind
    // 19.999999999999996 Prozent." auf dem Bildschirm; dieselbe Sorte Fund
    // wie das rohe „2026-08" und das rohe „all" aus Welle 1.
    getPortfolios.mockResolvedValue([{ id: 'p1', name: 'Depot', currency: 'EUR' }]);
    getPositions.mockResolvedValue([
      { id: 'x1', portfolio_id: 'p1', symbol: 'SAP', name: 'SAP SE', quantity: 10, entry_price: 100, last_price: 120, currency: 'EUR' },
    ]);

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wie viel Gewinn habe ich in meinem Depot?');

    // In dieser Fixture ohne Depot-Vokabular bietet der Router die Deutung
    // zur Auswahl an — die Formatierung wird danach geprüft, sie ist der
    // Gegenstand dieses Tests.
    fireEvent.click(await screen.findByRole('button', { name: /Gewinn oder Verlust im Depot/i }));

    expect(await screen.findByText(/20 Prozent/)).toBeInTheDocument();
    expect(screen.queryByText(/19,999|19\.999/)).not.toBeInTheDocument();
  });

  it('sollte eine Händlerfrage mit Zahl und Deep-Link beantworten', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wieviel habe ich im Juli 2026 bei lidl sagt danke ausgegeben?');

    // 30 + 20 aus dem Juli; die Juni-Buchung und der Notiz-Treffer zählen nicht.
    expect(await screen.findByText(/50,00/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /genau diese buchungen/i });
    expect(link.getAttribute('href')).toContain('merchant=lidl+sagt+danke');
    expect(link.getAttribute('href')).toContain('range=2026-07');
  });

  it('sollte „Wieviel habe ich ausgegeben?" als Gesamtsumme deuten', async () => {
    // Die Geschichte dieses Tests erzählt die Router-Entwicklung: In WP-D
    // wurde hier der Händler-Slot erfragt, seit dem Marge-Gate (F.2) die
    // Deutung gewählt — und seit Stufe 2 (F.4) entscheidet der Klassifikator
    // den Gleichstand: Ohne Händler und ohne Kategorie IST die Frage die nach
    // der Gesamtsumme. Genau das antwortet die Fläche jetzt direkt.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wieviel habe ich ausgegeben?');

    expect(await screen.findByText('Antwort')).toBeInTheDocument();
    expect(screen.getByText(/Alle Ausgaben zusammen/i)).toBeInTheDocument();
  });

  it('sollte bei einem WIRKLICH unbekannten Wort die eigenen Kategorien zur Auswahl stellen', async () => {
    // „essen" wird inzwischen erschlossen (siehe [REGRESSION] oben). Für die
    // Rückfrage braucht es deshalb einen Begriff, den weder Kategoriename noch
    // Stichwortkatalog noch das gelernte Modell kennen — dann ist eine
    // Rückfrage mit Kandidaten die richtige Antwort statt einer Sackgasse.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer quastelhuber ausgegeben?');

    // Ohne auflösbaren Begriff sind Händler- und Kategorie-Deutung gleichauf:
    // erst die Deutung wählen, dann kommt die Kategorien-Auswahl.
    fireEvent.click(await screen.findByRole('button', { name: /Ausgaben in einer Kategorie/i }));

    expect(await screen.findByText(/Welche Kategorie meinst du\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lebensmittel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Freizeit' })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte einen ABSTRAKTEN Begriff der Kategorie zuordnen, statt nachzufragen', async () => {
    // Der Kern der Chat-Bedienung: „für essen" nennt die Kategorie nicht beim
    // Namen. Der reine Namensvergleich kann das prinzipiell nicht — der
    // getippte Begriff ist kürzer als „Essen & Trinken".
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer essen ausgegeben?');

    expect(await screen.findByText('Antwort')).toBeInTheDocument();
    expect(screen.queryByText(/Welche Kategorie meinst du/i)).not.toBeInTheDocument();
  });

  it('sollte eine erschlossene Kategorie BENENNEN und einzeln abwählbar machen', async () => {
    // Erschlossen heisst: stand nicht im Text. Ohne den Hinweis wäre das eine
    // stille Behauptung — wer „essen" meinte und „Freizeit" bekäme, merkte es
    // nie. Seit WP-G ist es eine GRUPPE, und jede Kategorie darin ist ein
    // eigener Chip: Eine Sammelangabe liesse sich weder prüfen noch
    // korrigieren, und eine ungeprüfte Menge macht die Summe darüber zu einer
    // Behauptung.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer essen ausgegeben?');

    expect(await screen.findByText(/So habe ich das verstanden/i)).toBeInTheDocument();
    const chips = screen.getByRole('group', { name: /Erkannte Kategorien/i });
    expect(within(chips).getByRole('button', { name: /Essen & Trinken/ })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /Andere Kategorie wählen/i }),
    ).toBeInTheDocument();
  });

  it('sollte eine WÖRTLICH genannte Kategorie nicht als erschlossen ausweisen', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer Lebensmittel ausgegeben?');

    expect(await screen.findByText('Antwort')).toBeInTheDocument();
    expect(screen.queryByText(/So habe ich das verstanden/i)).not.toBeInTheDocument();
  });

  it('sollte nach der Auswahl antworten und den erkannten Zeitraum behalten', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer quastelhuber ausgegeben?');
    fireEvent.click(await screen.findByRole('button', { name: /Ausgaben in einer Kategorie/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lebensmittel' }));

    // Der Zeitraum aus der ursprünglichen Frage darf durch die Rückfrage nicht
    // verloren gehen — sonst antwortete die Fläche über den Gesamtbestand.
    // Geprüft am Deep-Link, weil er beides trägt: die gewählte Kategorie UND
    // den Zeitraum. (Der Antwortsatz selbst hängt davon ab, ob es Treffer
    // gibt — hier gibt es keine, und dann sagt die Fläche das auch.)
    const link = await screen.findByRole('link', { name: /genau diese buchungen/i });
    expect(link.getAttribute('href')).toContain('cat=local-cat-lebensmittel');
    expect(link.getAttribute('href')).toContain('range=2026-07');
  });

  it('sollte eine unverstandene Frage als solche benennen, statt etwas zu behaupten', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wie wird das Wetter morgen?');

    expect(await screen.findByText(/kann ich noch nicht beantworten/i)).toBeInTheDocument();
  });

  it('[ZUSTAND /fragen:gefiltert-leer] sollte „keine Buchung" sagen statt 0,00 € zu zeigen', async () => {
    // Ein berechneter Nullbetrag und eine leere Treffermenge sehen identisch
    // aus, meinen aber Gegensätzliches: „du hast dafür nichts ausgegeben"
    // gegen „dazu liegt mir nichts vor".
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    // „lidl sagt danke" ist im Vokabular (drei Buchungen), aber im MAI gibt es
    // keine — genau der Fall, in dem 0,00 € wie ein Ergebnis aussähe.
    frage('wieviel habe ich im Mai 2026 bei lidl sagt danke ausgegeben?');

    expect(await screen.findByText(/keine Buchung/i)).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
    // Der Link bleibt: Wer nachsehen will, soll es können.
    expect(screen.getByRole('link', { name: /Buchungen ansehen/i })).toBeInTheDocument();
  });

  it('[REGRESSION] [ZUSTAND /fragen:geladen] sollte eine gerechnete Antwort nicht als „keine Buchung" ausgeben', async () => {
    // Browser-Fund am Prod-Build: „Wie lange reicht mein Geld?" behauptete
    // „Dazu gibt es keine Buchung", während direkt darunter Guthaben und
    // Monatsverbrauch standen — die Fläche widersprach sich selbst.
    //
    // Ursache: Die Leer-Regel las `anzahl === 0` als „nichts gefunden". Bei
    // diesem Eintrag ist die 0 aber Absicht: Der Wert entsteht aus Saldo und
    // Schnitt, es gibt gar keine Treffermenge. Nur ein Quell-Link macht
    // `anzahl` zu einer Buchungszahl.
    getAccounts.mockResolvedValue([
      {
        id: 'a1',
        user_id: 'local',
        name: 'Girokonto',
        type: 'checking',
        currency: 'EUR',
        color: '#000',
        icon: 'wallet',
        is_budget_pool_member: true,
        order_index: 0,
        opening_balance: 3000,
        opening_balance_date: '2026-01-01',
      },
    ]);
    getNetWorthBreakdown.mockResolvedValue({
      cash: 3000,
      investments: 0,
      receivables: 0,
      debts: 0,
      netWorth: 3000,
      accountBalances: { a1: 3000 },
      accountSources: [{ id: 'a1', name: 'Girokonto', balance: 3000, source: 'local' }],
      portfolioSources: [],
      unconvertedInvestments: [],
      debtSources: [],
      receivableSources: [],
    });

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wie lange reicht mein geld?');

    expect(await screen.findByText(/So viele Monate reicht dein verfügbares Geld/i)).toBeInTheDocument();
    expect(screen.queryByText(/keine Buchung/i)).not.toBeInTheDocument();
    // Die Begründung nennt beide Größen, aus denen die Zahl entstand.
    expect(screen.getByText(/Verfügbar auf Giro, Bar und Wallet/i)).toBeInTheDocument();
    // Und die Zahl in deutscher Schreibweise: `String(1.5)` schrieb „1.5".
    // Geprüft an der FORM, nicht am Wert — der hängt an den Demo-Buchungen.
    expect(screen.getByText(/^\d+(,\d)?$/)).toBeInTheDocument();
  });

  it('sollte OHNE installiertes Modell sagen, dass es noch nicht auf dem Gerät ist', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    expect(await screen.findByText(/Noch nicht auf diesem Gerät/i)).toBeInTheDocument();
    // Der Löschen-Knopf steht TROTZDEM da: Ein halb geladenes oder
    // beschädigtes Modell ist genau der Fall, in dem gelöscht werden muss —
    // und in dem der Stand womöglich „nicht installiert" meldet.
    expect(screen.getByRole('button', { name: /Modell löschen/i })).toBeEnabled();
  });

  it('sollte ein installiertes Modell mit Grösse und Speicherort BESTÄTIGEN', async () => {
    modellStatus.mockResolvedValue({
      installiert: true,
      dateien: 2,
      bytes: 135_000_000,
      unvollstaendig: false,
    });
    renderWithProviders(<Fixture />, { locale: 'de', query: true });

    expect(await screen.findByText(/Installiert/i)).toBeInTheDocument();
    expect(screen.getByText(/135 MB in 2 Dateien/i)).toBeInTheDocument();
    // Der Ort steht im Klartext — der Nutzer soll wissen, wo es liegt.
    expect(screen.getByText(/transformers-cache/i)).toBeInTheDocument();
  });

  it('sollte ein installiertes Modell auf Knopfdruck löschen und den Stand neu lesen', async () => {
    modellStatus.mockResolvedValue({
      installiert: true,
      dateien: 2,
      bytes: 135_000_000,
      unvollstaendig: false,
    });
    renderWithProviders(<Fixture />, { locale: 'de', query: true });

    const knopf = await screen.findByRole('button', { name: /Modell löschen/i });
    modellStatus.mockResolvedValue({
      installiert: false,
      dateien: 0,
      bytes: 0,
      unvollstaendig: false,
    });
    fireEvent.click(knopf);

    // Erst auf die Wirkung warten — die Mutation läuft asynchron.
    expect(await screen.findByText(/Noch nicht auf diesem Gerät/i)).toBeInTheDocument();
    expect(modellLoeschen).toHaveBeenCalledTimes(1);
  });

  it('sollte das Stufe-3-Opt-in mit Grössenangabe anbieten und beim Einschalten das Geräte-Flag setzen', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    const schalter = await screen.findByRole('switch', { name: /Besser verstehen/i });
    expect(schalter).not.toBeChecked();
    // Die Einwilligung nennt die Grösse — 135 MB sind im Mobilfunknetz eine
    // echte Entscheidung, kein Detail.
    expect(screen.getByText(/135 MB/)).toBeInTheDocument();
    fireEvent.click(schalter);
    expect(localStorage.getItem('semantic-intent-opt-in')).toBe('1');
  });

  it('sollte eine Deutung des lokalen Modells als solche AUSWEISEN', async () => {
    // Stufe 3 liefert eine Auswahl; nach dem Klick muss die Antwort sagen,
    // wer die Frage gedeutet hat — sonst ist nicht erkennbar, ob das
    // Modell überhaupt beteiligt war.
    localStorage.setItem('semantic-intent-opt-in', '1');
    semantikVorschlaegeFuer.mockResolvedValue([{ klasse: 'ausgaben.gesamt', score: 0.94 }]);
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('voellig krumm formuliertes zeug xyzzy');
    const vorschlag = await screen.findByRole('button', { name: /Ausgaben/i });
    fireEvent.click(vorschlag);

    // Die Meldung ist der Punkt PLUS die Beschriftung — eine Farbe allein
    // wäre keine Information.
    const marke = await screen.findByText(/Vom lokalen Modell gedeutet/i);
    expect(marke).toBeInTheDocument();
    const punkt = marke.parentElement?.querySelector('span[data-modell]');
    expect(punkt, 'der aufleuchtende Punkt fehlt').not.toBeNull();
    expect(punkt?.getAttribute('data-modell')).toBe('an');
    expect(punkt?.className).toContain('modell-punkt-auf');
    // Der Ruhezustand steht ohne Animation da — sonst wäre die Auskunft
    // für Menschen mit reduzierter Bewegung weg.
    expect(punkt?.className).toContain('shadow-');
    expect(punkt?.className).toContain('motion-safe:');
  });

  it('sollte eine Antwort des DETERMINISTISCHEN Routers NICHT dem Modell zuschreiben', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wieviel habe ich im Juli 2026 bei lidl sagt danke ausgegeben?');
    await screen.findByText(/50,00/);
    // Die Marke ist sichtbar, aber INAKTIV — Abwesenheit wäre keine Aussage.
    expect(screen.queryByText(/Vom lokalen Modell gedeutet/i)).not.toBeInTheDocument();
    const matt = await screen.findByText(/Ohne lokales Modell erkannt/i);
    expect(matt).toBeInTheDocument();
    const punkt = matt.parentElement?.querySelector('span[data-modell]');
    expect(punkt?.getAttribute('data-modell')).toBe('aus');
    expect(punkt?.className).not.toContain('modell-punkt-auf');
  });

  it('sollte den ECHTEN Fehlertext zeigen, wenn das Modell nicht lädt', async () => {
    // Ein generisches „konnte nicht geladen werden" ist für den Nutzer eine
    // Sackgasse und für die Fehlersuche wertlos — genau daran ist die erste
    // Ferndiagnose gescheitert.
    localStorage.setItem('semantic-intent-opt-in', '1');
    semantikVorschlaegeFuer.mockRejectedValue(new Error('Unable to load from onnx/model_quantized.onnx'));
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('voellig krumm formuliertes zeug xyzzy');

    expect(await screen.findByText(/Das lokale Modell konnte nicht geladen werden/i)).toBeInTheDocument();
    expect(await screen.findByText(/model_quantized\.onnx/i)).toBeInTheDocument();
  });

  it('sollte OHNE Opt-in bei einer unverstandenen Frage KEIN Modell laden', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);
    frage('vollkommen unverständliches zeug xyzzy');
    expect(await screen.findByText(/kann ich noch nicht beantworten/i)).toBeInTheDocument();
    // Kein Lade-Hinweis: Stufe 3 ist aus, es wird nichts nachgereicht. (Die
    // Opt-in-Karte selbst bleibt sichtbar — gemeint ist der Fortschrittstext.)
    expect(screen.queryByText(/wird geladen/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sollte bilingual funktionieren', async () => {
    renderWithProviders(<Fixture />, { locale: 'en', query: true });

    expect(await screen.findByLabelText(/Question about your finances/i)).toBeInTheDocument();
  });

  it('sollte eine Beispielfrage aus den EIGENEN Händlern vorschlagen', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });

    // Kein erfundener Händler im Platzhalter — nur einer, den es wirklich
    // gibt. Das Eingabefeld erscheint schon WÄHREND des Ladens (die Fläche
    // soll nicht erst leer dastehen), der Vorschlag also erst danach.
    expect(await screen.findByPlaceholderText(/lidl sagt danke/i)).toBeInTheDocument();
  });

  it('sollte aus einer Kandidaten-Wahl LERNEN und dieselbe Frage künftig direkt deuten', async () => {
    // Die Lernschleife (WP-F.5) end-to-end: Der Klick auf einen Kandidaten
    // ist das Label. Beim NÄCHSTEN Öffnen der Fläche (frischer Render, wie
    // ein neuer Besuch) wiegt die gespeicherte Bestätigung (Gewicht 3) schwer
    // genug, dass die Stufe 2 den Gleichstand entscheidet — statt der
    // Kandidaten-Auswahl kommt sofort die Slot-Rückfrage der gelernten
    // Familie.
    localStorage.clear();
    const erste = renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer quastelhuber ausgegeben?');
    fireEvent.click(await screen.findByRole('button', { name: /Ausgaben in einer Kategorie/i }));
    await screen.findByText(/Welche Kategorie meinst du\?/i);
    await waitFor(async () => {
      expect(await getQuestionConfirmations()).toHaveLength(1);
    });
    erste.unmount();

    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);
    frage('wieviel habe ich im Juli 2026 fuer quastelhuber ausgegeben?');

    expect(await screen.findByText(/Welche Kategorie meinst du\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/Was genau meinst du\?/i)).not.toBeInTheDocument();
  });

  it('sollte einen Oberbegriff über MEHRERE Kategorien summieren und genau die verlinken', async () => {
    // Der Kern von WP-G: „Essen" ist beim Nutzer keine Kategorie, sondern
    // eine Gruppe über zwei Hauptkategorien. 40 € (Lebensmittel) + 60 €
    // (Essen & Trinken) = 100 €; die 15 € Freizeit im selben Zeitraum bleiben
    // draussen. Der Deep-Link trägt GENAU dieselbe Menge — sonst nennte die
    // Fläche eine Zahl und zeigte eine andere Liste.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer essen ausgegeben?');

    expect(await screen.findByText('100,00 €')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /genau diese buchungen/i });
    const cat = new URL(link.getAttribute('href')!, 'https://x').searchParams.get('cat');
    expect(cat?.split(',').sort()).toEqual(
      ['local-cat-essenundtrinken', 'local-cat-lebensmittel'],
    );
  });

  it('sollte nach dem Abwählen einer Kategorie neu rechnen', async () => {
    // Die Gruppe ist korrigierbar, und die Korrektur wirkt sofort auf die
    // Zahl — sonst wäre der Chip Zierde.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer essen ausgegeben?');
    await screen.findByText('100,00 €');

    const chips = screen.getByRole('group', { name: /Erkannte Kategorien/i });
    fireEvent.click(within(chips).getByRole('button', { name: /Essen & Trinken/ }));

    expect(await screen.findByText('40,00 €')).toBeInTheDocument();
  });
});

/**
 * Der Klick muss sichtbar etwas auslösen.
 *
 * Nutzerbefund (28.08.): „ich brauch ein minimales Feedback, dass eine
 * Abfrage neu durchlief, wenn ich den Button klicke, sonst denk ich, es
 * passiert nicht." Der Grund ist strukturell und nicht behebbar durch
 * Schnelligkeit: Die Router-Stufen 0–2 sind rein und synchron. Dieselbe
 * Frage erzeugt dieselbe Antwort — der Bildschirm ist danach Pixel für
 * Pixel derselbe wie davor, und ein funktionierender Knopf ist von einem
 * toten nicht zu unterscheiden.
 */
describe('Rückmeldung, dass gerechnet wurde', () => {
  it('sollte den Absende-Knopf für die Dauer der Berechnung als beschäftigt zeigen', async () => {
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    const knopf = () => screen.getByRole('button', { name: /Frage stellen/i });
    expect(knopf()).toHaveAttribute('data-rechnet', 'nein');

    frage('Wieviel habe ich ausgegeben');
    expect(knopf()).toHaveAttribute('data-rechnet', 'ja');
    expect(knopf()).toHaveAttribute('aria-busy', 'true');

    // Und sie endet auch wieder — eine Marke, die stehen bleibt, ist
    // dieselbe Falschaussage wie gar keine.
    await waitFor(() => expect(knopf()).toHaveAttribute('data-rechnet', 'nein'));
  });

  it('sollte bei leerer Frage NICHT beschäftigt tun', async () => {
    // Nichts abgeschickt heisst nichts gerechnet. Eine Marke ohne Lauf wäre
    // genau die Beruhigung ohne Deckung, gegen die sie gebaut ist.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);
    fireEvent.click(screen.getByRole('button', { name: /Frage stellen/i }));
    expect(screen.getByRole('button', { name: /Frage stellen/i })).toHaveAttribute(
      'data-rechnet',
      'nein',
    );
  });
});
