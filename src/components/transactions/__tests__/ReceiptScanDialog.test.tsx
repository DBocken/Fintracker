import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { ReceiptScanDialog } from '../ReceiptScanDialog';

/**
 * Die Fläche belegt den Betrag aus dem OCR-Text vor. Genau dort entscheidet
 * sich, ob die Summenprüfung des Parsers etwas wert ist: Ein Betrag, dem der
 * Parser selbst widerspricht, darf nicht in ein Feld geschrieben werden, das
 * man nur noch bestätigen muss.
 */

const ocrImages = vi.fn();
vi.mock('@/services/letter-ocr-service', () => ({ ocrImages: (...a: unknown[]) => ocrImages(...a) }));
vi.mock('@/services/transaction-service', () => ({ getCategories: vi.fn().mockResolvedValue([]) }));

const showWarning = vi.fn();
vi.mock('@/utils/toast', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  showWarning: (m: string) => showWarning(m),
}));

async function scanne(text: string) {
  ocrImages.mockResolvedValue([{ text }]);
  renderWithProviders(
    <ReceiptScanDialog open onOpenChange={() => {}} cashAccountId="acc-cash" />,
    { query: true },
  );
  // `document`, nicht `container`: Radix rendert den Dialoginhalt in ein
  // Portal. Und `fireEvent` statt `userEvent.upload`, weil das Eingabefeld
  // bewusst `hidden` ist — angestoßen wird es von der Schaltfläche daneben.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const datei = new File(['x'], 'beleg.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [datei], configurable: true });
  fireEvent.change(input);
}

describe('ReceiptScanDialog', () => {
  beforeEach(() => {
    ocrImages.mockReset();
    showWarning.mockReset();
  });

  it('sollte den Betrag vorbelegen, wenn die Zeilen ihn bestätigen', async () => {
    await scanne(['REWE', 'Apfel 2 x 1,99 3,98', 'Brot 2,49', 'SUMME EUR 6,47'].join('\n'));

    await waitFor(() => expect(screen.getByDisplayValue('6,47')).toBeInTheDocument());
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('[REGRESSION] sollte bei widersprüchlicher Summe KEINEN Betrag vorbelegen', async () => {
    // 3,98 + 2,49 = 6,47, der Beleg behauptet 4,47. Welcher der beiden Werte
    // falsch gelesen wurde, ist nicht entscheidbar — also wird geraten oder
    // gefragt, und Raten ist hier die teurere Variante.
    await scanne(['REWE', 'Apfel 2 x 1,99 3,98', 'Brot 2,49', 'SUMME EUR 4,47'].join('\n'));

    await waitFor(() => expect(showWarning).toHaveBeenCalledTimes(1));
    expect(screen.queryByDisplayValue('4,47')).not.toBeInTheDocument();
  });

  it('sollte eine unvollständige Zeilenerkennung nicht zum Anlass nehmen zu warnen', async () => {
    // Der Normalfall: Die Zeilenerkennung lässt aus, was sie nicht sicher
    // erkennt. Hier zu warnen hiesse, bei fast jedem Beleg zu warnen.
    await scanne(['REWE', 'Brot 2,49', 'SUMME EUR 18,95'].join('\n'));

    await waitFor(() => expect(screen.getByDisplayValue('18,95')).toBeInTheDocument());
    expect(showWarning).not.toHaveBeenCalled();
  });
});
