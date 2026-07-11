import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import ShareCard from '../ShareCard';
import ShareCardDialog from '../ShareCardDialog';
import type { ShareCardData } from '@/lib/share-card';
import type { IncomeStream, IncomeStreamsResult } from '@/lib/income-streams';

vi.mock('@/lib/png-export', () => ({ exportNodeAsPng: vi.fn() }));
import { exportNodeAsPng } from '@/lib/png-export';

const data: ShareCardData = {
  slices: [
    { key: 'a', label: 'YouTube', percent: 60, isOther: false },
    { key: 'b', label: 'Patreon', percent: 30, isOther: false },
    { key: '__other', label: '', percent: 10, isOther: true },
  ],
  streamCount: 5,
  diversification: 'moderate',
  hasData: true,
};

describe('ShareCard', () => {
  it('rendert alle Slice-Labels und Prozentwerte (de)', () => {
    renderWithI18n(<ShareCard data={data} format="square" />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Patreon')).toBeInTheDocument();
    expect(screen.getByText('Sonstige')).toBeInTheDocument();
    expect(screen.getByText('60 %')).toBeInTheDocument();
  });

  it('rendert englische Texte korrekt', () => {
    renderWithI18n(<ShareCard data={data} format="square" />, 'en');
    expect(screen.getByText('How I earn my money')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('[REGRESSION] sollte niemals Beträge oder ein Euro-Zeichen enthalten (story)', () => {
    const { container } = renderWithI18n(<ShareCard data={data} format="story" />);
    expect(container.textContent).not.toMatch(/€|EUR/);
    expect(container.textContent).not.toMatch(/\d[.,]\d{3}/); // keine Tausender-Beträge
  });

  it('[REGRESSION] sollte niemals Beträge oder ein Euro-Zeichen enthalten (square)', () => {
    const { container } = renderWithI18n(<ShareCard data={data} format="square" />);
    expect(container.textContent).not.toMatch(/€|EUR/);
  });

  it('setzt die festen Export-Maße je Format', () => {
    const { container: story } = renderWithI18n(<ShareCard data={data} format="story" />);
    expect((story.firstChild as HTMLElement).style.height).toBe('1920px');
    const { container: square } = renderWithI18n(<ShareCard data={data} format="square" />);
    expect((square.firstChild as HTMLElement).style.height).toBe('1080px');
  });
});

describe('ShareCardDialog', () => {
  function stream(key: string, total: number): IncomeStream {
    return {
      key, label: key, counterparty: key, mainCategoryId: null, mainCategoryName: '', isSalary: false,
      cadence: 'regelmaessig', monthlyAverage: total / 12, totalInWindow: total, lastDateISO: '2024-12-01',
      lastAmount: total / 12, monthsActive: 12, trend: 'flat', confidence: 0.9, share: 0,
      transactionCount: 12, nextDateISO: null, nextAmount: null, monthlyTotals: {},
    };
  }
  const result: IncomeStreamsResult = {
    streams: [stream('YouTube', 6000), stream('Patreon', 4000)],
    totalIncome: 10000, largestShare: 0.6, diversification: 'moderate', windowMonths: 12,
  };

  describe('German locale', () => {
    it('exportiert im Story-Format mit korrektem Dateinamen', async () => {
      renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />, 'de');
      fireEvent.click(screen.getByText('PNG herunterladen'));
      await Promise.resolve();
      expect(exportNodeAsPng).toHaveBeenCalledWith(expect.anything(), 'einkommensmix-story.png');
    });

    it('wechselt beim Formatwechsel den Dateinamen auf Quadrat', async () => {
      renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />, 'de');
      fireEvent.click(screen.getByText('Quadrat 1:1'));
      fireEvent.click(screen.getByText('PNG herunterladen'));
      await Promise.resolve();
      expect(exportNodeAsPng).toHaveBeenLastCalledWith(expect.anything(), 'einkommensmix-quadrat.png');
    });
  });

  describe('English locale', () => {
    it('renders UI strings in English', () => {
      renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />, 'en');
      expect(screen.getByText('Share income mix')).toBeInTheDocument();
      expect(screen.getByText('Shows percentages only – no amounts.')).toBeInTheDocument();
      expect(screen.getByText('Download PNG')).toBeInTheDocument();
      expect(screen.getByText('Square 1:1')).toBeInTheDocument();
    });

    it('exports in square format with correct filename (en)', async () => {
      renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />, 'en');
      fireEvent.click(screen.getByText('Square 1:1'));
      fireEvent.click(screen.getByText('Download PNG'));
      await Promise.resolve();
      expect(exportNodeAsPng).toHaveBeenCalledWith(expect.anything(), 'einkommensmix-quadrat.png');
    });
  });
});
