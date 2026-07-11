import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test-utils/render';
import { TaxCommuteCard } from '../TaxCommuteCard';
import * as profileService from '@/services/tax-profile-service';

vi.mock('@/utils/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));

const renderCard = (ui: React.ReactElement, locale: 'de' | 'en' = 'de') =>
  renderWithProviders(ui, { locale, router: false, query: true });

describe('TaxCommuteCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(profileService, 'getTaxYearProfile').mockResolvedValue(null);
  });

  it('sollte die Eingabefelder auf Deutsch rendern', () => {
    renderCard(<TaxCommuteCard year={2025} />);
    expect(screen.getByText('Arbeitsweg & Homeoffice')).toBeInTheDocument();
    expect(screen.getByLabelText(/Arbeitstage mit Fahrt/)).toBeInTheDocument();
  });

  it('sollte die Eingabefelder auf Englisch rendern', () => {
    renderCard(<TaxCommuteCard year={2025} />, 'en');
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

    renderCard(<TaxCommuteCard year={2025} />);
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
