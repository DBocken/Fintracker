import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { TaxCommuteCard } from '../TaxCommuteCard';
import * as profileService from '@/services/tax-profile-service';

vi.mock('@/utils/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));

function renderWithProviders(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
    </QueryClientProvider>,
  );
}

describe('TaxCommuteCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(profileService, 'getTaxYearProfile').mockResolvedValue(null);
  });

  it('sollte die Eingabefelder auf Deutsch rendern', () => {
    renderWithProviders(<TaxCommuteCard year={2025} />);
    expect(screen.getByText('Arbeitsweg & Homeoffice')).toBeInTheDocument();
    expect(screen.getByLabelText(/Arbeitstage mit Fahrt/)).toBeInTheDocument();
  });

  it('sollte die Eingabefelder auf Englisch rendern', () => {
    renderWithProviders(<TaxCommuteCard year={2025} />, 'en');
    expect(screen.getByText('Commute & home office')).toBeInTheDocument();
  });

  it('sollte die Eingaben je Jahr speichern', async () => {
    const saveSpy = vi.spyOn(profileService, 'saveTaxYearProfile').mockResolvedValue({
      id: 'tax-profile-2025',
      year: 2025,
      commuteDaysPerYear: 220,
      commuteOneWayKm: 30,
      homeofficeDays: 0,
    });

    renderWithProviders(<TaxCommuteCard year={2025} />);
    fireEvent.change(screen.getByLabelText(/Arbeitstage mit Fahrt/), { target: { value: '220' } });
    fireEvent.change(screen.getByLabelText(/einfache Entfernung/), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(2025, {
        commuteDaysPerYear: 220,
        commuteOneWayKm: 30,
        homeofficeDays: null,
      }),
    );
  });
});
