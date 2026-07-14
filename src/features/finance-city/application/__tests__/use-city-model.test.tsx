import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Category, Transaction } from '@/types';
import { useCityModel } from '../use-city-model';

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
}));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { getContractDecisionMap, type ContractDecision } from '@/services/contract-decision-service';

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
  vi.mocked(getContractDecisionMap).mockResolvedValue(new Map());
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

  it('[REGRESSION] sollte isLoading true halten, bis auch die Vertragsentscheidungen geladen sind', async () => {
    // Rennen beim ersten Mount: transactions/categories können (gecacht/schnell)
    // vor der dritten Query (contractDecisions) fertig sein. Würde isLoading dann
    // bereits false, mountete CityPage den Canvas und buildCityModelFromData liefe
    // mit der leeren EMPTY_CONTRACT_DECISIONS-Map — ein vom Nutzer als beendet/
    // verworfen markierter Vertrag bestünde kurz isFloorContract und poppte als
    // Etage rein/raus, sobald die echten Entscheidungen nachladen.
    let resolveDecisions!: (m: Map<string, ContractDecision>) => void;
    vi.mocked(getContractDecisionMap).mockReturnValue(
      new Promise<Map<string, ContractDecision>>((res) => {
        resolveDecisions = res;
      }),
    );

    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    // Sobald das Modell steht, sind transactions+categories geladen — die
    // Vertragsentscheidungen hängen aber noch (Promise offen).
    await waitFor(() => expect(result.current.model.districts).toHaveLength(1));
    expect(result.current.isLoading).toBe(true);

    resolveDecisions(new Map());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
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
