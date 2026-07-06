import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { WrappedStats } from '@/lib/income-wrapped';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock('@/lib/png-export', () => ({ exportNodeAsPng: vi.fn() }));
import { exportNodeAsPng } from '@/lib/png-export';

import WrappedSlides from '../wrapped/WrappedSlides';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(<I18nProvider initialLocale={locale}>{component}</I18nProvider>);
}

function stats(overrides: Partial<WrappedStats> = {}): WrappedStats {
  return {
    year: 2025, partialYear: false, totalIncome: 42000, transactionCount: 24,
    bestMonth: { month: '2025-12', total: 5000 },
    fastestGrowingStream: { key: 'tw', label: 'Twitch', growthPercent: 200 },
    mostRegularStream: { key: 'sal', label: 'Muster GmbH', monthsActive: 12, transactionCount: 12 },
    streamCount: 3, largestShare: 0.7, diversification: 'moderate',
    shareCard: {
      slices: [
        { key: 'a', label: 'Gehalt', percent: 70, isOther: false },
        { key: 'b', label: 'Twitch', percent: 30, isOther: false },
      ],
      streamCount: 3, diversification: 'moderate', hasData: true,
    },
    ...overrides,
  };
}

describe('WrappedSlides', () => {
  it('rendert die Intro-Slide mit Jahr und blättert per Klick weiter', () => {
    renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />);
    expect(screen.getByText('Dein Einkommens-Jahr 2025')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tippe, um weiterzublättern/ }));
    expect(screen.getByText('So viel kam rein')).toBeInTheDocument();
  });

  it('navigiert mit Pfeiltasten und schließt mit Escape', () => {
    const onClose = vi.fn();
    renderWithI18n(<WrappedSlides stats={stats()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('So viel kam rein')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Dein Einkommens-Jahr 2025')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('[REGRESSION] überspringt fehlende Slides ohne Absturz (keine Wachstums-/Loyal-Slide)', () => {
    renderWithI18n(
      <WrappedSlides stats={stats({ fastestGrowingStream: null, mostRegularStream: null })} onClose={() => {}} />,
    );
    // Durch alle Slides klicken bis zur finalen.
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Dein Einkommens-Mix 2025')).toBeInTheDocument();
  });

  it('exportiert auf der finalen Slide mit korrektem Dateinamen', async () => {
    renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(screen.getByText('PNG herunterladen'));
    await Promise.resolve();
    expect(exportNodeAsPng).toHaveBeenCalledWith(expect.anything(), 'einkommens-jahr-2025.png');
  });

  it('[REGRESSION] die Share-Card in der finalen Slide enthält kein Euro-Zeichen', () => {
    renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    // Die eingebettete ShareCard (nur Prozente) darf kein € tragen.
    const finalTitle = screen.getByText('Dein Einkommens-Mix 2025');
    const slide = finalTitle.closest('div');
    expect(within(slide as HTMLElement).queryByText(/€/)).not.toBeInTheDocument();
  });

  it('rendert englische Texte', () => {
    renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />, 'en');
    expect(screen.getByText('Your income year 2025')).toBeInTheDocument();
  });
});
