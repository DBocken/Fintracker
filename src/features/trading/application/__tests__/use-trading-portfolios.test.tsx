/**
 * ViewModel der Depotverwaltung (WP 6.3).
 *
 * `PortfolioManager` hielt Liste und Schreibvorgänge bis WP 6.3 selbst. Die
 * Zusicherungen sind beim Umzug dieselben geblieben; dieser Test hält sie an
 * ihrem neuen Ort fest — vor allem die, die eine falsche Auskunft verhindert:
 * Ein Lesefehler der Depotliste darf NICHT als „keine Depots" durchgehen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';

const getPortfolios = vi.fn();
const createPortfolio = vi.fn();
const setActivePortfolio = vi.fn();
const deletePortfolio = vi.fn();

vi.mock('@/services/portfolio-service', () => ({
  getPortfolios: () => getPortfolios(),
  createPortfolio: (input: unknown) => createPortfolio(input),
  setActivePortfolio: (id: string) => setActivePortfolio(id),
  deletePortfolio: (id: string) => deletePortfolio(id),
}));

import type { Portfolio } from '@/types';
import { useTradingPortfolios } from '../use-trading-portfolios';

const DEPOT: Portfolio = {
  id: 'p1',
  user_id: 'u1',
  name: 'Depot',
  type: 'manual',
  currency: 'EUR',
  is_active: true,
};

describe('useTradingPortfolios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sollte die Depotliste liefern', async () => {
    getPortfolios.mockResolvedValue([DEPOT]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTradingPortfolios(), { wrapper });

    await waitFor(() => expect(result.current.portfolios).toEqual([DEPOT]));
    expect(result.current.hasLoadError).toBe(false);
  });

  it('[REGRESSION] sollte einen Lesefehler als Fehler melden statt als leere Liste', async () => {
    getPortfolios.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTradingPortfolios(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
    // Die Fläche darf aus `portfolios === undefined` NICHT „keine Depots" machen.
    expect(result.current.portfolios).toBeUndefined();
  });

  it('sollte ein neues Depot als manuelles, nicht aktives Depot anlegen und die Fläche benachrichtigen', async () => {
    getPortfolios.mockResolvedValue([]);
    createPortfolio.mockResolvedValue({ ...DEPOT, name: 'Neu' });
    const onPortfolioChange = vi.fn();
    const onCreated = vi.fn();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(
      () => useTradingPortfolios({ onPortfolioChange, onCreated }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.createPortfolio({ name: 'Neu', currency: 'USD' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createPortfolio).toHaveBeenCalledWith({
      name: 'Neu',
      type: 'manual',
      currency: 'USD',
      is_active: false,
    });
    expect(onPortfolioChange).toHaveBeenCalledWith({ ...DEPOT, name: 'Neu' });
  });

  it('sollte beim Aktivieren sofort melden, nicht erst nach der Antwort des Speichers', async () => {
    // Bestandsverhalten: `onPortfolioChange` läuft synchron mit dem Auslösen,
    // damit die Fläche darüber nicht auf die Persistenz warten muss.
    getPortfolios.mockResolvedValue([DEPOT]);
    setActivePortfolio.mockResolvedValue(undefined);
    const onPortfolioChange = vi.fn();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTradingPortfolios({ onPortfolioChange }), { wrapper });
    await waitFor(() => expect(result.current.portfolios).toEqual([DEPOT]));

    act(() => result.current.activatePortfolio(DEPOT));

    expect(onPortfolioChange).toHaveBeenCalledWith(DEPOT);
    await waitFor(() => expect(setActivePortfolio).toHaveBeenCalledWith('p1'));
  });

  it('sollte ein Depot löschen', async () => {
    getPortfolios.mockResolvedValue([DEPOT]);
    deletePortfolio.mockResolvedValue(undefined);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTradingPortfolios(), { wrapper });
    await waitFor(() => expect(result.current.portfolios).toEqual([DEPOT]));

    act(() => result.current.deletePortfolio('p1'));

    await waitFor(() => expect(deletePortfolio).toHaveBeenCalledWith('p1'));
  });
});
