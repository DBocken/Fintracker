import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import ShareCard from '../ShareCard';
import ShareCardDialog from '../ShareCardDialog';
import type { ShareCardData } from '@/lib/share-card';
import type { IncomeStream, IncomeStreamsResult } from '@/lib/income-streams';

vi.mock('@/lib/png-export', () => ({ exportNodeAsPng: vi.fn() }));
import { exportNodeAsPng } from '@/lib/png-export';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(<I18nProvider initialLocale={locale}>{component}</I18nProvider>);
}

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

  it('rendert den englischen Titel', () => {
    renderWithI18n(<ShareCard data={data} format="square" />, 'en');
    expect(screen.getByText('How I earn my money')).toBeInTheDocument();
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

  it('exportiert im Story-Format mit korrektem Dateinamen', async () => {
    renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText('PNG herunterladen'));
    await Promise.resolve();
    expect(exportNodeAsPng).toHaveBeenCalledWith(expect.anything(), 'einkommensmix-story.png');
  });

  it('wechselt beim Formatwechsel den Dateinamen auf Quadrat', async () => {
    renderWithI18n(<ShareCardDialog result={result} open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText('Quadrat 1:1'));
    fireEvent.click(screen.getByText('PNG herunterladen'));
    await Promise.resolve();
    expect(exportNodeAsPng).toHaveBeenLastCalledWith(expect.anything(), 'einkommensmix-quadrat.png');
  });
});
