import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';

const updateMock = vi.fn().mockResolvedValue({});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { tax_reserve_percent: 30 } }),
  useMutation: ({ mutationFn }: { mutationFn: (n: number) => Promise<unknown> }) => ({
    mutate: (n: number) => { updateMock(n); mutationFn(n); },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/utils/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock('@/services/transaction-service', () => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn().mockResolvedValue({}),
}));

import TaxReserveSettings from '../TaxReserveSettings';
import { updateUserSettings } from '@/services/transaction-service';

function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider initialLocale="de">{component}</I18nProvider>);
}

describe('TaxReserveSettings', () => {
  it('speichert den eingegebenen Prozentsatz', () => {
    renderWithI18n(<TaxReserveSettings />);
    const input = screen.getByLabelText(/Rücklage in %/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(screen.getByText('Speichern'));
    expect(updateUserSettings).toHaveBeenCalledWith({ tax_reserve_percent: 25 });
  });

  it('clampt Werte über 100', () => {
    renderWithI18n(<TaxReserveSettings />);
    const input = screen.getByLabelText(/Rücklage in %/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.click(screen.getByText('Speichern'));
    expect(updateUserSettings).toHaveBeenCalledWith({ tax_reserve_percent: 100 });
  });
});
