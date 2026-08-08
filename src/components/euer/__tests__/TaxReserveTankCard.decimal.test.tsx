import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

/**
 * Der Rücklagenbetrag wandert direkt in die Steuerrücklage — die Zahl, an der
 * jemand abliest, ob das Finanzamt gedeckt ist.
 *
 * Das Feld war ein `<Input type="number">`. In einem deutschen Browser wird
 * daraus für getipptes „150,75" der Wert `"15075"`: Statt 150,75 € stünden
 * 15.075 € im Tank, der Füllstand zeigte „gut gepolstert", und die Rücklage
 * wäre in Wirklichkeit um Faktor 100 zu klein. Davor stand hier ein
 * `Number(amount.replace(',', '.'))` — es lief ins Leere, weil das Komma das
 * Feld nie verlassen hat.
 */
const addTaxReserveMovement = vi.fn();
vi.mock('@/services/tax-reserve-service', () => ({
  addTaxReserveMovement: (...args: unknown[]) => addTaxReserveMovement(...args),
  deleteTaxReserveMovement: vi.fn(),
}));

import { TaxReserveTankCard } from '../TaxReserveTankCard';

function betragsfeld(): HTMLInputElement {
  return document.getElementById('tank-amount-2026') as HTMLInputElement;
}

async function öffneBereich() {
  renderWithProviders(
    <TaxReserveTankCard year={2026} businessIncomeYtd={40000} percent={30} reserve={null} />,
    { query: true },
  );
  fireEvent.click(screen.getAllByRole('button')[0]);
  await waitFor(() => expect(betragsfeld()).toBeInTheDocument());
}

describe('TaxReserveTankCard – Betragseingabe (AGENTS.md §8)', () => {
  beforeEach(() => {
    addTaxReserveMovement.mockReset();
    addTaxReserveMovement.mockResolvedValue(undefined);
  });

  it('[REGRESSION] sollte „150,75" als 150,75 € zurücklegen, nicht als 15075 €', async () => {
    await öffneBereich();

    fireEvent.change(betragsfeld(), { target: { value: '150,75' } });
    fireEvent.click(screen.getByRole('button', { name: /Zurückgelegt|Set aside/i }));

    await waitFor(() =>
      expect(addTaxReserveMovement).toHaveBeenCalledWith(2026, expect.objectContaining({ amount: 150.75 })),
    );
  });

  it('[REGRESSION] sollte eine gezahlte Steuer mit demselben Betrag negativ buchen', async () => {
    await öffneBereich();

    fireEvent.change(betragsfeld(), { target: { value: '1.234,56' } });
    fireEvent.click(screen.getByRole('button', { name: /Steuer gezahlt|Tax paid/i }));

    await waitFor(() =>
      expect(addTaxReserveMovement).toHaveBeenCalledWith(2026, expect.objectContaining({ amount: -1234.56 })),
    );
  });

  it('sollte bei leerem Feld nicht buchbar sein', async () => {
    await öffneBereich();

    expect(screen.getByRole('button', { name: /Zurückgelegt|Set aside/i })).toBeDisabled();
    expect(addTaxReserveMovement).not.toHaveBeenCalled();
  });
});
