import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const getPortfolioCashflows = vi.fn();
const upsertPortfolioCashflow = vi.fn();
const deletePortfolioCashflow = vi.fn();

vi.mock('@/services/portfolio-cashflow-service', () => ({
  getPortfolioCashflows: (id?: string) => getPortfolioCashflows(id),
  upsertPortfolioCashflow: (c: unknown) => upsertPortfolioCashflow(c),
  deletePortfolioCashflow: (id: string) => deletePortfolioCashflow(id),
}));

import { PortfolioCashflowsCard } from '../PortfolioCashflowsCard';

beforeEach(() => {
  vi.clearAllMocks();
  getPortfolioCashflows.mockResolvedValue([]);
  upsertPortfolioCashflow.mockResolvedValue({ id: 'neu' });
  deletePortfolioCashflow.mockResolvedValue(undefined);
});

describe('Ein- und Auszahlungen eines Depots', () => {
  it('[ZUSTAND /trading:leer] sollte erklären, wozu die Zahlungen dienen, statt 0 % zu zeigen', async () => {
    renderWithProviders(<PortfolioCashflowsCard portfolioId="p1" marktwert={1200} />, {
      locale: 'de',
      query: true,
    });

    expect(await screen.findByText(/dann kann ich die echte Rendite rechnen/i)).toBeInTheDocument();
    // Keine „0 %": Das wäre eine Aussage über eine Rendite, die niemand
    // gerechnet hat.
    expect(screen.queryByText(/0 % pro Jahr/)).not.toBeInTheDocument();
  });

  it('[ZUSTAND /trading:fehler] sollte einen Lesefehler benennen statt „noch nichts erfasst"', async () => {
    getPortfolioCashflows.mockRejectedValue(new Error('kaputt'));
    renderWithProviders(<PortfolioCashflowsCard portfolioId="p1" marktwert={1200} />, {
      locale: 'de',
      query: true,
    });

    expect(await screen.findByRole('button', { name: /erneut/i })).toBeInTheDocument();
    expect(screen.queryByText(/dann kann ich die echte Rendite/i)).not.toBeInTheDocument();
  });

  it('sollte aus erfassten Zahlungen die geldgewichtete Rendite zeigen', async () => {
    // 1.000 € rein, ein Jahr später 1.200 € wert → rund 20 % pro Jahr. Dieselbe
    // reine Funktion wie im Chat, nicht eine zweite Fassung daneben.
    getPortfolioCashflows.mockResolvedValue([
      { id: 'c1', portfolio_id: 'p1', date: '2025-08-27', amount: 1000, direction: 'deposit' },
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-27T12:00:00Z'));

    renderWithProviders(<PortfolioCashflowsCard portfolioId="p1" marktwert={1200} />, {
      locale: 'de',
      query: true,
    });

    expect(await screen.findByText(/Geldgewichtete Rendite: 20 % pro Jahr/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('sollte eine Zahlung erst auf Klick speichern', async () => {
    renderWithProviders(<PortfolioCashflowsCard portfolioId="p1" marktwert={1200} />, {
      locale: 'de',
      query: true,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Zahlung erfassen' }));
    fireEvent.change(await screen.findByLabelText('Betrag'), { target: { value: '1000' } });

    expect(upsertPortfolioCashflow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(upsertPortfolioCashflow).toHaveBeenCalledTimes(1));
    expect(upsertPortfolioCashflow.mock.calls[0][0]).toMatchObject({
      portfolio_id: 'p1',
      amount: 1000,
      direction: 'deposit',
    });
  });

  it('sollte ohne Depot nichts anbieten, statt in eine leere ID zu schreiben', async () => {
    renderWithProviders(<PortfolioCashflowsCard portfolioId={undefined} marktwert={0} />, {
      locale: 'de',
      query: true,
    });

    expect(await screen.findByRole('button', { name: 'Zahlung erfassen' })).toBeDisabled();
  });

  it('sollte bilingual funktionieren', async () => {
    renderWithProviders(<PortfolioCashflowsCard portfolioId="p1" marktwert={0} />, {
      locale: 'en',
      query: true,
    });
    expect(await screen.findByText('Deposits and withdrawals')).toBeInTheDocument();
  });
});
