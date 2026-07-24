import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Category, Transaction, TransactionAllocation } from '@/types';
import { useCityModel } from '../use-city-model';

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));
vi.mock('@/services/transaction-allocation-service', () => ({
  getAllocationMap: vi.fn(),
}));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { getAllocationMap } from '@/services/transaction-allocation-service';

const CAT_LEISURE = 'cat-leisure';
const CAT_STREAMING = 'cat-streaming';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_LEISURE, name: 'Freizeit', filters: [] },
  { id: CAT_STREAMING, name: 'Streaming', filters: [], parent_id: CAT_LEISURE },
];

const FIXTURE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-06-05',
    amount: -17.99,
    payee: 'Netflix',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: CAT_STREAMING,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransactions).mockResolvedValue(FIXTURE_TRANSACTIONS);
  vi.mocked(getCategories).mockResolvedValue(FIXTURE_CATEGORIES);
  vi.mocked(getAllocationMap).mockResolvedValue(new Map());
});

describe('useCityModel', () => {
  it('sollte aus echten Transaktionen/Kategorien ein CityModel mit den erwarteten Distrikten bauen', async () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEmpty).toBe(false);
    expect(result.current.model.districts).toHaveLength(1);
    expect(result.current.model.districts[0]).toMatchObject({ id: CAT_LEISURE, label: 'Freizeit' });
    expect(result.current.model.districts[0].subcategories[0]).toMatchObject({
      id: CAT_STREAMING,
      label: 'Streaming',
    });
  });

  it('sollte isLoading während des Ladens true liefern', () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('[REGRESSION] sollte eine einzelne, nicht wiederkehrende Buchung (z. B. Aldi, 1x) als eigene Etage im richtigen Gebäude liefern', async () => {
    // End-to-End über den echten Hook (WP-E2, Nutzer-Befund): eine EINMALIGE
    // Aldi-Buchung wurde bisher NIE eine Etage, weil Etagen aus `computeContracts`
    // kamen und das Händler mit weniger als `minCount` Buchungen überspringt.
    // Seit `buildMerchantFloorsByBuilding` ist Etage = Händler, unabhängig von
    // Wiederkehr — die einzelne Aldi-Buchung muss als eigene, beschriftete
    // Etage im Streaming-Gebäude (bzw. hier: im "Freizeit"-Direkt-Gebäude)
    // erscheinen.
    const aldi: Transaction = {
      id: 'tx-aldi',
      date: '2026-06-10',
      amount: -8.5,
      payee: 'Aldi',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      category_id: CAT_LEISURE,
    };
    vi.mocked(getTransactions).mockResolvedValue([aldi]);

    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const building = result.current.model.districts[0].subcategories[0];
    // toMatchObject: seit WP-D4 tragen Etagen zusätzlich ihre `bookings` (Sheet-Buchungsliste).
    expect(building.contracts).toMatchObject([{ id: expect.any(String), label: 'Aldi', amount: 8.5 }]);
  });

  it('sollte den Kleidungs-Anteil einer aufgeteilten Aldi-Buchung im Kleidungs-Viertel bauen', async () => {
    // Nutzer-Anforderung: „Wenn ich Kleidung immer bei Aldi kaufe und extra
    // einen Split mache, will ich den Anteil bei Kleidung sehen, nicht bei
    // Lebensmitteln." Die Stadt muss die Aufteilung also anteilsgenau bauen.
    const CAT_FOOD = 'cat-food';
    const CAT_CLOTHES = 'cat-clothes';
    vi.mocked(getCategories).mockResolvedValue([
      { id: CAT_FOOD, name: 'Lebensmittel', filters: [] },
      { id: CAT_CLOTHES, name: 'Kleidung', filters: [] },
    ] as Category[]);
    const aldi: Transaction = {
      id: 'tx-aldi',
      date: '2026-06-10',
      amount: -50,
      payee: 'Aldi',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
      category_id: CAT_FOOD,
    };
    vi.mocked(getTransactions).mockResolvedValue([aldi]);
    vi.mocked(getAllocationMap).mockResolvedValue(
      new Map([['tx-aldi', [
        { id: 'a-food', transaction_id: 'tx-aldi', amount_minor: -3700, category_id: CAT_FOOD, source: 'manual' },
        { id: 'a-clothes', transaction_id: 'tx-aldi', amount_minor: -1300, category_id: CAT_CLOTHES, source: 'manual' },
      ] as TransactionAllocation[]]]),
    );

    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.model.districts).toHaveLength(2));

    const byId = new Map(result.current.model.districts.map((d) => [d.id, d]));
    expect(byId.get(CAT_FOOD)?.subcategories[0].amount).toBe(37);
    // Das Kleidungs-Viertel existiert nur wegen des Anteils — mit Aldi als Etage.
    const clothes = byId.get(CAT_CLOTHES);
    expect(clothes?.subcategories[0].amount).toBe(13);
    expect(clothes?.subcategories[0].contracts).toMatchObject([{ label: 'Aldi', amount: 13 }]);
  });

  it('sollte bei leeren Transaktionen isEmpty=true liefern (kein Demo-Fallback)', async () => {
    vi.mocked(getTransactions).mockResolvedValue([]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.model.districts).toHaveLength(0);
  });

  it('[REGRESSION] sollte eine nachträgliche Kategorie-Zuweisung automatisch übernehmen (Stadt baut nach ["transactions"]-Invalidierung neu)', async () => {
    // Reproduziert die Nutzeranforderung „wenn ich eine Kategorie zuweise,
    // muss die Stadt das automatisch erkennen": eine zunächst UNkategorisierte
    // Buchung erzeugt keinen Distrikt (unkategorisierte Ausgaben haben keine
    // Hauptkategorie -> kein Stadtviertel). Nach der Zuweisung liefert die
    // Transaktions-Query (denselben Key, den der Detail-Sheet-Speichern-
    // Mutations-Hook invalidiert: `['transactions']`) die Buchung MIT Kategorie
    // -> die Stadt muss beim nächsten Fetch das neue Viertel enthalten.
    const uncategorized: Transaction = { ...FIXTURE_TRANSACTIONS[0], category_id: null };
    vi.mocked(getTransactions).mockResolvedValue([uncategorized]);

    const { wrapper, queryClient } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Unkategorisiert -> kein Hauptkategorie-Distrikt.
    expect(result.current.model.districts).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);

    // Kategorie zugewiesen: die Query liefert jetzt die kategorisierte Buchung.
    vi.mocked(getTransactions).mockResolvedValue([{ ...uncategorized, category_id: CAT_STREAMING }]);
    // Exakt die Invalidierung, die `useTransactionDetailEditing` beim Speichern
    // einer Kategorie auslöst — die Stadt-Query `['transactions', <limit>]`
    // fällt unter dieses Präfix.
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });

    await waitFor(() => expect(result.current.model.districts).toHaveLength(1));
    expect(result.current.model.districts[0]).toMatchObject({ id: CAT_LEISURE, label: 'Freizeit' });
    expect(result.current.isEmpty).toBe(false);
  });
});
