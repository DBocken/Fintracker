import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import AddPositionDialog from '../AddPositionDialog';

vi.mock('@/services/portfolio-service', () => ({
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
}));

vi.mock('@/services/user-settings-service', () => ({
  getPreferredMarketProvider: vi.fn().mockResolvedValue('yahoo'),
}));

const fetchQuoteMock = vi.fn();
vi.mock('@/services/quote-service', async () => {
  const actual = await vi.importActual<typeof import('@/services/quote-service')>('@/services/quote-service');
  return { ...actual, fetchQuote: (...args: unknown[]) => fetchQuoteMock(...args) };
});

function renderDialog(locale: 'de' | 'en' = 'de') {
  const queryClient = new QueryClient();
  return render(
    <I18nProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <AddPositionDialog open portfolioId="pf-1" onOpenChange={() => {}} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('AddPositionDialog — Kurs-Verifikation', () => {
  beforeEach(() => {
    fetchQuoteMock.mockReset();
  });

  describe('Normal Behavior', () => {
    it('sollte bei gefundenem Kurs Preis und Währung anzeigen', async () => {
      fetchQuoteMock.mockResolvedValue({ symbol: 'AAPL', price: 512.3, currency: 'USD', provider: 'yahoo' });
      renderDialog();

      fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByRole('button', { name: /Kurs prüfen/i }));

      await waitFor(() => expect(screen.getByText(/512,30/)).toBeInTheDocument());
      expect(fetchQuoteMock).toHaveBeenCalledWith('AAPL', 'yahoo');
    });

    it('[REGRESSION] sollte das Symbol börsennormalisiert anfragen (XETRA → .DE)', async () => {
      fetchQuoteMock.mockResolvedValue({ symbol: 'VOW3.DE', price: 95.1, currency: 'EUR', provider: 'yahoo' });
      renderDialog();

      fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'VOW3' } });
      fireEvent.change(screen.getByLabelText(/Börse/), { target: { value: 'XETRA' } });
      fireEvent.click(screen.getByRole('button', { name: /Kurs prüfen/i }));

      await waitFor(() => expect(fetchQuoteMock).toHaveBeenCalledWith('VOW3.DE', 'yahoo'));
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei nicht gefundenem Kurs einen klaren Hinweis zeigen', async () => {
      fetchQuoteMock.mockResolvedValue(null);
      renderDialog();

      fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'UNKNOWN123' } });
      fireEvent.click(screen.getByRole('button', { name: /Kurs prüfen/i }));

      await waitFor(() => expect(screen.getByText(/kein Kurs gefunden/i)).toBeInTheDocument());
    });

    it('sollte bei leerem Symbol die Prüfung nicht auslösen', () => {
      renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /Kurs prüfen/i }));
      expect(fetchQuoteMock).not.toHaveBeenCalled();
    });

    it('sollte einen Netzwerkfehler als Fehlermeldung anzeigen statt abzustürzen', async () => {
      fetchQuoteMock.mockRejectedValue(new Error('network down'));
      renderDialog();

      fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByRole('button', { name: /Kurs prüfen/i }));

      await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());
    });
  });

  describe('English Locale', () => {
    it('sollte englische Texte korrekt rendern', async () => {
      fetchQuoteMock.mockResolvedValue({ symbol: 'AAPL', price: 512.3, currency: 'USD', provider: 'yahoo' });
      renderDialog('en');

      fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByRole('button', { name: /Check quote/i }));

      await waitFor(() => expect(screen.getByText(/512,30/)).toBeInTheDocument());
      expect(fetchQuoteMock).toHaveBeenCalledWith('AAPL', 'yahoo');
    });
  });
});

describe('AddPositionDialog — Dezimaleingaben (AGENTS.md §8)', () => {
  // Stückzahl und Einstiegskurs waren `<Input type="number">`. In einem
  // deutschen Browser wird aus getipptem „12,50" der Wert „1250" — der
  // Einstiegskurs stünde dann um Faktor 100 zu hoch im Depot und jede
  // Performance-Rechnung darauf wäre falsch, ohne dass etwas auffällt.
  it('[REGRESSION] sollte Stückzahl und Einstiegskurs mit deutschem Komma speichern', async () => {
    const { createPosition } = await import('@/services/portfolio-service');
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Symbol/), { target: { value: 'AAPL' } });
    fireEvent.change(document.getElementById("quantity") as HTMLInputElement, { target: { value: '2,5' } });
    fireEvent.change(document.getElementById("entryPrice") as HTMLInputElement, { target: { value: '123,45' } });
    fireEvent.click(screen.getByRole('button', { name: /Hinzufügen|Speichern/i }));

    await waitFor(() =>
      expect(createPosition).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 2.5, entry_price: 123.45 }),
      ),
    );
  });
});
