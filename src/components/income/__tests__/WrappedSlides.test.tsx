import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
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

  describe('English locale', () => {
    it('renders intro slide with year and navigates on click', () => {
      renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />, 'en');
      expect(screen.getByText('Your income year 2025')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Tap to continue/ }));
      expect(screen.getByText('This much came in')).toBeInTheDocument();
    });

    it('navigates with arrow keys and closes with Escape (en)', () => {
      const onClose = vi.fn();
      renderWithI18n(<WrappedSlides stats={stats()} onClose={onClose} />, 'en');
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByText('This much came in')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByText('Your income year 2025')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('[REGRESSION] navigates through all slides in English', () => {
      renderWithI18n(
        <WrappedSlides stats={stats()} onClose={() => {}} />,
        'en'
      );
      // Intro
      expect(screen.getByText('Your income year 2025')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Total
      expect(screen.getByText('This much came in')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Best month
      expect(screen.getByText('Your strongest month')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Growth
      expect(screen.getByText('Fastest growing')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Loyal
      expect(screen.getByText('Your most loyal stream')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Diversity
      expect(screen.getByText('Your income sources')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Final
      expect(screen.getByText('Your income mix 2025')).toBeInTheDocument();
    });

    it('exports on final slide with correct filename (en)', async () => {
      renderWithI18n(<WrappedSlides stats={stats()} onClose={() => {}} />, 'en');
      for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByText('Download PNG'));
      await Promise.resolve();
      expect(exportNodeAsPng).toHaveBeenCalledWith(expect.anything(), 'einkommens-jahr-2025.png');
    });
  });
});
