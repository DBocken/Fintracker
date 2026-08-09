import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import MobileNav, { OPEN_NAV_SHEET_EVENT } from '@/components/layout/MobileNav';
import { KpiCustomizeSheet } from '@/components/kpi/KpiCustomizeSheet';
import { TransactionDetailsModal } from '@/components/dashboard/TransactionDetailsModal';
import { asTransactionId } from '@/lib/ids';
import type { Transaction } from '@/types';

/**
 * Gegenstück zu `dialog-description.test.tsx` für die Sheets.
 *
 * WP 6.9 hat den Gewinn ausdrücklich darauf gestützt, dass ein NEUER Dialog
 * ohne Beschreibung wieder eine Radix-Warnung auslöst, statt von einer
 * hartcodierten Lüge stummgeschaltet zu werden. Drei Sheets warnten bei jedem
 * Öffnen dauerhaft — genau das deckt dieses Signal wieder zu: Wer die Konsole
 * gewohnheitsmäßig voll sieht, liest die vierte Warnung nicht mehr.
 *
 * Deshalb wird hier je Sheet zugesichert, dass es entweder etwas Wahres sagt
 * (`SheetDescription`) oder ausdrücklich nichts (`aria-describedby={undefined}`).
 */

/** Genau der Text, mit dem Radix eine fehlende Beschreibung anmahnt. */
const RADIX_WARNUNG = /Missing `Description` or `aria-describedby=\{undefined\}`/;

vi.mock('@/hooks/useNavVisibility', () => ({
  useNavVisibility: () => ({ enabled: null, unlocked: null }),
}));

// Der Inhalt des Detail-Sheets ist hier nicht der Prüfgegenstand (er hat eine
// eigene Testdatei) — gestubbt, damit der Test nur die Sheet-Verdrahtung sieht.
vi.mock('@/components/dashboard/TransactionDetailsPanel', () => ({
  TransactionDetailsPanel: () => <div data-testid="details-panel" />,
}));

const konsolenMeldungen: string[] = [];

function radixMeldungen(): string[] {
  return konsolenMeldungen.filter((m) => RADIX_WARNUNG.test(m));
}

beforeEach(() => {
  konsolenMeldungen.length = 0;
  const sammeln = (...args: unknown[]) => {
    konsolenMeldungen.push(String(args[0]));
  };
  vi.spyOn(console, 'warn').mockImplementation(sammeln);
  vi.spyOn(console, 'error').mockImplementation(sammeln);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MobileNav — Sheet-Beschreibung', () => {
  it('sollte beim Öffnen keine Radix-Warnung zur fehlenden Beschreibung auslösen', () => {
    renderWithProviders(<MobileNav />, { query: true });
    act(() => {
      window.dispatchEvent(new Event(OPEN_NAV_SHEET_EVENT));
    });

    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    expect(radixMeldungen()).toEqual([]);
  });
});

describe('KpiCustomizeSheet — Sheet-Beschreibung', () => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    value: { order: [], active: [] },
    onSave: vi.fn(),
    onReset: vi.fn(),
  };

  it('sollte keine Radix-Warnung zur fehlenden Beschreibung auslösen', () => {
    renderWithProviders(<KpiCustomizeSheet {...props} />, { query: true });

    expect(radixMeldungen()).toEqual([]);
  });

  it.each([
    ['de', 'Wähle die Kennzahlen für dein Dashboard und bringe sie in die gewünschte Reihenfolge.'],
    ['en', 'Choose the metrics for your dashboard and put them in the order you want.'],
  ] as const)('sollte in %s eine echte Beschreibung mit dem Sheet verknüpfen', (locale, text) => {
    renderWithProviders(<KpiCustomizeSheet {...props} />, { locale, query: true });

    const sheet = screen.getByRole('dialog');
    const beschreibungsId = sheet.getAttribute('aria-describedby');
    expect(beschreibungsId).toBeTruthy();
    expect(document.getElementById(beschreibungsId!)?.textContent).toBe(text);
  });
});

describe('TransactionDetailsModal — Sheet-Beschreibung (mobil)', () => {
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

  it('sollte auf schmaler Breite keine Radix-Warnung zur fehlenden Beschreibung auslösen', () => {
    // Unter 768px wählt die Komponente das Bottom-Sheet statt des Dialogs.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });

    renderWithProviders(
      <TransactionDetailsModal
        open
        onOpenChange={vi.fn()}
        transaction={transaction}
        categories={[]}
        accounts={[]}
        onSave={vi.fn()}
      />,
      { query: true },
    );

    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    expect(radixMeldungen()).toEqual([]);
  });
});
