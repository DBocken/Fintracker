import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { Account } from '@/types';
import { renderWithProviders } from '@/test-utils/render';

/**
 * Der Betrag einer Buchung ist das meistbenutzte Geldfeld der App.
 *
 * Er stand bis hierher in einem `<Input type="number">`. In einem deutschen
 * Browser (Chromium, `de-DE`) liefert so ein Feld für getipptes „12,50" den
 * Wert `"1250"` — das Komma wird geschluckt, BEVOR irgendein Parser es sieht.
 * Vor dieser Änderung stand hier sogar schon `parseGermanNumber`; es half
 * nichts, weil es nur den Tausenderpunkt abfängt und das Komma zu diesem
 * Zeitpunkt längst weg war. Deshalb prüfen diese Tests, was WIRKLICH
 * gespeichert wird, und nicht, ob ein Parser aufgerufen wurde.
 */
const createTransaction = vi.fn();
vi.mock('@/services/transaction-service', () => ({
  createTransaction: (...args: unknown[]) => createTransaction(...args),
  getCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/account-service', () => ({
  getAccounts: vi
    .fn()
    .mockResolvedValue([
      { id: 'acc-1', name: 'Girokonto', type: 'checking', icon: '🏦' } as Account,
    ]),
}));

vi.mock('@/components/tax/TaxCategorySelect', () => ({
  TaxCategorySelect: () => <div data-testid="tax-select" />,
}));

import { TransactionFormDialog } from '../TransactionFormDialog';

function betragsfeld(): HTMLInputElement {
  return document.getElementById('tx-amount') as HTMLInputElement;
}

async function öffneDialog() {
  renderWithProviders(<TransactionFormDialog open onOpenChange={() => {}} />, { query: true });
  await waitFor(() => expect(betragsfeld()).toBeInTheDocument());
}

describe('TransactionFormDialog – Betragseingabe (AGENTS.md §8)', () => {
  beforeEach(() => {
    createTransaction.mockReset();
    createTransaction.mockResolvedValue({ id: 'tx-1' });
  });

  it('[REGRESSION] sollte „12,50" als 12,50 € buchen, nicht als 1250 €', async () => {
    await öffneDialog();

    fireEvent.change(betragsfeld(), { target: { value: '12,50' } });
    fireEvent.click(screen.getByRole('button', { name: /Speichern|Save/i }));

    await waitFor(() =>
      expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: -12.5 })),
    );
  });

  it('[REGRESSION] sollte den Tausenderpunkt in „1.200" nicht als Komma lesen', async () => {
    await öffneDialog();

    fireEvent.change(betragsfeld(), { target: { value: '1.200' } });
    fireEvent.click(screen.getByRole('button', { name: /Speichern|Save/i }));

    await waitFor(() =>
      expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: -1200 })),
    );
  });

  it('[REGRESSION] sollte „1.234,56" mit Tausenderpunkt UND Komma korrekt lesen', async () => {
    await öffneDialog();

    fireEvent.change(betragsfeld(), { target: { value: '1.234,56' } });
    fireEvent.click(screen.getByRole('button', { name: /Speichern|Save/i }));

    await waitFor(() =>
      expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: -1234.56 })),
    );
  });

  it('sollte das Feld als Text mit Dezimal-Tastatur führen, nicht als Zahlenfeld', () => {
    // Das ist die Ursache, nicht das Symptom: Ein `type="number"`-Feld
    // verstümmelt die Eingabe schon im Browser. `inputMode="decimal"` hält
    // dabei die Zifferntastatur auf dem Mobilgerät.
    renderWithProviders(<TransactionFormDialog open onOpenChange={() => {}} />, { query: true });
    const feld = betragsfeld();
    expect(feld).toHaveAttribute('type', 'text');
    expect(feld).toHaveAttribute('inputmode', 'decimal');
  });

  it('sollte einen leeren Betrag nicht als 0-€-Buchung speichern', async () => {
    await öffneDialog();

    fireEvent.click(screen.getByRole('button', { name: /Speichern|Save/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Speichern|Save/i })).toBeEnabled());
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
