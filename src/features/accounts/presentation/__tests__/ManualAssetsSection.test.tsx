import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const getManualAssets = vi.fn();
const upsertManualAsset = vi.fn();
const deleteManualAsset = vi.fn();

vi.mock('@/services/manual-asset-service', async () => {
  const echt = await vi.importActual<typeof import('@/services/manual-asset-service')>(
    '@/services/manual-asset-service',
  );
  return {
    ...echt,
    getManualAssets: () => getManualAssets(),
    upsertManualAsset: (a: unknown) => upsertManualAsset(a),
    deleteManualAsset: (id: string) => deleteManualAsset(id),
  };
});

import { ManualAssetsSection } from '../ManualAssetsSection';

const JETZT = new Date('2026-08-27T10:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  getManualAssets.mockResolvedValue([]);
  upsertManualAsset.mockResolvedValue({ id: 'neu' });
  deleteManualAsset.mockResolvedValue(undefined);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(JETZT);
});

describe('Weitere Vermögenswerte', () => {
  it('[ZUSTAND /accounts:leer] sollte ohne Werte erklären, was fehlt, statt eine 0 zu zeigen', async () => {
    renderWithProviders(<ManualAssetsSection />, { locale: 'de', query: true });

    expect(await screen.findByText(/größte Posten ihres Vermögens/i)).toBeInTheDocument();
    // Kein „0,00 €": Eine Null behauptet, es sei nichts da — hier ist nur
    // nichts ERFASST, und das ist etwas anderes.
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it('[ZUSTAND /accounts:fehler] sollte einen Lesefehler benennen statt „noch nichts erfasst"', async () => {
    getManualAssets.mockRejectedValue(new Error('kaputt'));
    renderWithProviders(<ManualAssetsSection />, { locale: 'de', query: true });

    expect(await screen.findByRole('button', { name: /erneut/i })).toBeInTheDocument();
    expect(screen.queryByText(/größte Posten/i)).not.toBeInTheDocument();
  });

  it('sollte Werte mit Summe zeigen', async () => {
    getManualAssets.mockResolvedValue([
      { id: 'a1', user_id: 'local', name: 'Eigentumswohnung', kind: 'property', value: 250000, valued_at: '2026-06-01' },
      { id: 'a2', user_id: 'local', name: 'Kombi', kind: 'vehicle', value: 15000, valued_at: '2026-06-01' },
    ]);
    renderWithProviders(<ManualAssetsSection />, { locale: 'de', query: true });

    expect(await screen.findByText('Eigentumswohnung')).toBeInTheDocument();
    expect(screen.getByText(/Zusammen:/)).toHaveTextContent('265.000');
  });

  it('[REGRESSION] sollte eine über ein Jahr alte Schätzung als solche benennen', async () => {
    // Ein manuell gepflegter Wert veraltet. Ihn ohne sein Alter auszuweisen
    // wäre dieselbe stille Falschaussage wie ein Kontostand ohne Anker.
    getManualAssets.mockResolvedValue([
      { id: 'a1', user_id: 'local', name: 'Kombi', kind: 'vehicle', value: 15000, valued_at: '2024-01-10' },
    ]);
    renderWithProviders(<ManualAssetsSection />, { locale: 'de', query: true });

    expect(await screen.findByText(/Eine Schätzung ist älter als ein Jahr/i)).toBeInTheDocument();
  });

  it('sollte einen neuen Wert erst auf Klick speichern', async () => {
    renderWithProviders(<ManualAssetsSection />, { locale: 'de', query: true });

    fireEvent.click(await screen.findByRole('button', { name: 'Wert erfassen' }));
    fireEvent.change(await screen.findByLabelText('Bezeichnung'), {
      target: { value: 'Eigentumswohnung' },
    });
    fireEvent.change(screen.getByLabelText('Geschätzter Wert'), { target: { value: '250000' } });

    // Vor dem Klick ist nichts geschrieben.
    expect(upsertManualAsset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(upsertManualAsset).toHaveBeenCalledTimes(1));
    expect(upsertManualAsset.mock.calls[0][0]).toMatchObject({
      name: 'Eigentumswohnung',
      value: 250000,
      // Der Stichtag ist gesetzt, nicht null — ein Wert ohne ihn wäre eine
      // stille Behauptung über heute.
      valued_at: '2026-08-27',
    });
  });

  it('sollte bilingual funktionieren', async () => {
    renderWithProviders(<ManualAssetsSection />, { locale: 'en', query: true });
    expect(await screen.findByText('Other assets')).toBeInTheDocument();
  });
});
