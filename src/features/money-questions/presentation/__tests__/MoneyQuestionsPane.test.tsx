import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

const getTransactions = vi.fn();
const getCategories = vi.fn();
const getAccounts = vi.fn();
const getDebts = vi.fn();
const getBudgets = vi.fn();
const getContractDecisionMap = vi.fn();

vi.mock('@/services/transaction-service', () => ({
  getTransactions: (...a: unknown[]) => getTransactions(...a),
  getCategories: () => getCategories(),
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

  it('sollte bei fehlendem Händler erst wählen lassen und dann nachfragen — nie eine Zahl nennen', async () => {
    // Seit dem Marge-Gate (WP-F.2) ist „Wieviel habe ich ausgegeben?" ehrlich
    // mehrdeutig: Händler- und Kategorie-Deutung liegen gleichauf, also wählt
    // der Nutzer zuerst die Deutung — und DANN folgt die Slot-Rückfrage.
    // Zwei Schritte statt einer geratenen Zahl.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('Wieviel habe ich ausgegeben?');

    expect(await screen.findByText(/Was genau meinst du\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ausgaben bei einem Händler/i }));

    expect(await screen.findByText(/Welchen Händler meinst du\?/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /buchungen/i })).not.toBeInTheDocument();
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

  it('sollte eine erschlossene Kategorie BENENNEN und korrigierbar lassen', async () => {
    // Erschlossen heisst: stand nicht im Text. Ohne den Hinweis wäre das eine
    // stille Behauptung — wer „essen" meinte und „Freizeit" bekäme, merkte es
    // nie.
    renderWithProviders(<Fixture />, { locale: 'de', query: true });
    await screen.findByLabelText(/Frage zu deinen Finanzen/i);

    frage('wieviel habe ich im Juli 2026 fuer essen ausgegeben?');

    expect(await screen.findByText(/So habe ich das verstanden/i)).toBeInTheDocument();
    expect(screen.getByText(/Essen & Trinken/)).toBeInTheDocument();
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
});
