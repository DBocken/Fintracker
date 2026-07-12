import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import { makeSyntheticTransactions } from '@/test-utils/synthetic-transactions';
import { TransactionDayList } from '../TransactionDayList';

vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));

describe('TransactionDayList (Perf-Smoke, 10k Buchungen)', () => {
  it('sollte bei 10k Buchungen nur ein begrenztes DOM-Fenster rendern (Virtualisierung)', () => {
    const transactions = makeSyntheticTransactions(10_000);
    const { container } = renderWithI18n(
      <TransactionDayList
        transactions={transactions}
        categories={[]}
        accounts={[]}
        hiddenTransactions={new Set()}
        onOpenDetails={vi.fn()}
        endingBalance={5000}
        now={new Date('2026-07-01T12:00:00Z')}
      />,
    );

    // Robuster Virtualisierungs-Beweis: Zeitbudgets sind in CI flaky, die Zahl
    // gerenderter Knoten nicht. Ohne Fensterung wären es ~10k Buttons.
    const renderedRows = container.querySelectorAll('button').length;
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(300);
  });

  it('sollte die jüngsten Buchungen im gerenderten Fenster zeigen (Anfang der Liste)', () => {
    const transactions = makeSyntheticTransactions(10_000);
    const { container } = renderWithI18n(
      <TransactionDayList
        transactions={transactions}
        categories={[]}
        accounts={[]}
        hiddenTransactions={new Set()}
        onOpenDetails={vi.fn()}
        endingBalance={5000}
        now={new Date('2026-07-01T12:00:00Z')}
      />,
    );
    // Der neueste Tag (2026-07-01 = „Heute") muss im initialen Fenster stehen.
    expect(container.textContent).toContain('Heute');
  });
});
