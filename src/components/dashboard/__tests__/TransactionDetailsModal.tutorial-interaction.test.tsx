import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionDetailsModal } from '../TransactionDetailsModal';
import { asTransactionId } from '@/lib/ids';
import type { Transaction } from '@/types';

/**
 * [REGRESSION] Die Tutorial-Führung öffnet die Buchungsdetails selbst
 * (`transactionDetails.panel`/`transactionSplit.why`, `openAnchor`) und
 * bedient sich danach über ihr EIGENES, freischwebendes Steuerungs-Popover
 * (`TutorialOverlay`, `data-tutorial-controls`) — ein zweites, separates
 * Radix-Portal neben diesem Dialog/Sheet.
 *
 * Ohne Ausnahme hält Radix jeden Klick dort für „außerhalb" und schließt
 * zuerst NUR den Dialog, statt den Klick durchzulassen: „Weiter" hätte immer
 * zwei Klicks gebraucht — der erste zum Schließen der Buchung, erst der
 * zweite hätte den Knopf getroffen.
 */

// Der Inhalt des Detail-Panels ist hier nicht der Prüfgegenstand.
vi.mock('@/components/dashboard/TransactionDetailsPanel', () => ({
  TransactionDetailsPanel: () => <div data-testid="details-panel" />,
}));

const transaction: Transaction = {
  id: asTransactionId('t-1'),
  date: '2026-07-02',
  amount: -12.5,
  payee: 'REWE',
  description: '',
  original_text: '',
  category_id: null,
  auto_mapped: false,
  confirmed: true,
};

function renderModal(onOpenChange: (open: boolean) => void, width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  return renderWithProviders(
    <>
      <div data-testid="fremdes-element" />
      <div data-tutorial-controls="">
        <button type="button" data-testid="tutorial-weiter">
          Weiter
        </button>
      </div>
      <TransactionDetailsModal
        open
        onOpenChange={onOpenChange}
        transaction={transaction}
        categories={[]}
        accounts={[]}
        onSave={vi.fn()}
      />
    </>,
    { query: true },
  );
}

function pointerDownOn(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

describe.each([
  ['mobil (Sheet)', 500],
  ['Desktop (Dialog)', 1024],
])('TransactionDetailsModal — Klicks auf den Tutorial-Popover (%s)', (_label, width) => {
  it('sollte bei einem gewöhnlichen Außenklick weiterhin schließen (Referenzverhalten)', async () => {
    const onOpenChange = vi.fn();
    renderModal(onOpenChange, width);
    await screen.findByTestId('details-panel');

    pointerDownOn(screen.getByTestId('fremdes-element'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('[REGRESSION] sollte bei einem Klick auf den Tutorial-Popover NICHT schließen', async () => {
    const onOpenChange = vi.fn();
    renderModal(onOpenChange, width);
    await screen.findByTestId('details-panel');

    pointerDownOn(screen.getByTestId('tutorial-weiter'));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
