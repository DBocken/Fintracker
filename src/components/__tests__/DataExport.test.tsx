/**
 * Datenexport — geprüft wird die AUSSAGE des erzeugten Berichts, nicht sein
 * Aufbau.
 *
 * Der Befund kam aus der Bildprüfung 2026-09: Der PDF-Bericht schrieb
 * Gesamteinnahmen, Gesamtausgaben und Saldo auf die erste Seite und nannte
 * dazu nur das EXPORTdatum. Der gewählte Zeitraum („Letzte 30 Tage") stand
 * nirgends. Wer die Datei später öffnet oder weitergibt, sah damit drei
 * Beträge, die wie ein Gesamtbestand aussehen, obwohl sie ein Ausschnitt sind.
 *
 * AGENTS.md nennt das unter „Rechnen, schliessen, prüfen" ausdrücklich: Eine
 * Summe ohne Zeitraum ist eine stille Behauptung. Bei steuerlich verwertbaren
 * Zahlen ist es der teuerste Fall — nichts wird rot, und die Zahl ist trotzdem
 * falsch verstanden.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import type { Transaction } from '@/types';

// Der erzeugte Bericht wird über die Aufrufe an das PDF-Dokument geprüft.
// Ein echtes jsPDF liefe in jsdom auf Canvas-Operationen hinaus, die nichts
// über den INHALT aussagen — und der Inhalt ist der Befund.
const textAufrufe: string[] = [];
const gespeichert: string[] = [];

vi.mock('jspdf', () => ({
  default: class {
    setFontSize() {}
    setFont() {}
    text(inhalt: string) {
      textAufrufe.push(inhalt);
    }
    save(name: string) {
      gespeichert.push(name);
    }
  },
}));

vi.mock('jspdf-autotable', () => ({ default: () => {} }));

const HEUTE = new Date('2026-01-15T12:00:00.000Z');

function buchung(datum: string, betrag: number): Transaction {
  return {
    id: `tx-${datum}-${betrag}`,
    date: datum,
    amount: betrag,
    payee: 'Muster',
    description: 'Testbuchung',
    category_id: null,
    account_id: 'acc-1',
  } as unknown as Transaction;
}

// Eine Buchung im Fenster der letzten 30 Tage, eine weit davor. Damit
// unterscheidet sich der Ausschnitt nachweislich vom Gesamtbestand.
const BUCHUNGEN = [buchung('2026-01-10', -100), buchung('2025-03-02', -900)];

vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: () => Promise.resolve(BUCHUNGEN),
}));

vi.mock('@/services/transaction-storage-service', () => ({
  transactionStorage: { getStorageStats: () => Promise.resolve({ count: BUCHUNGEN.length }) },
}));

vi.mock('@/utils/toast', () => ({ showSuccess: () => {}, showError: () => {} }));

async function exportiereAls(zeitraum: string) {
  const user = userEvent.setup();
  const { DataExport } = await import('../DataExport');
  renderWithProviders(<DataExport />, { router: true, query: true });

  await user.click(await screen.findByRole('button', { name: zeitraum }));
  await user.click(screen.getByRole('button', { name: /PDF/ }));
  await user.click(screen.getByRole('button', { name: /exportieren/i }));

  await waitFor(() => expect(gespeichert.length).toBeGreaterThan(0));
}

describe('Datenexport — der Bericht nennt seinen Zeitraum', () => {
  beforeEach(() => {
    textAufrufe.length = 0;
    gespeichert.length = 0;
    vi.setSystemTime(HEUTE);
  });

  it('[REGRESSION] sollte den gewählten Zeitraum in den Bericht schreiben', async () => {
    await exportiereAls('30 Tage');

    // Der Kern des Befunds: Ohne diese Zeile stehen drei Beträge im Bericht,
    // deren Geltungsbereich nur der Exportierende kennt.
    expect(textAufrufe.some((z) => z.includes('Zeitraum: 30 Tage'))).toBe(true);
  });

  it('[REGRESSION] sollte den Zeitraum auch bei „Alle Daten" ausweisen', async () => {
    // Gerade hier ist das Schweigen am gefährlichsten: „Alle Daten" ist die
    // Vorgabe, also der Fall, in dem am ehesten jemand die Datei weitergibt.
    // Eine Zahl, die den Gesamtbestand meint, muss das SAGEN — sonst ist sie
    // von einem Ausschnitt nicht zu unterscheiden.
    await exportiereAls('Alle Daten');

    expect(textAufrufe.some((z) => z.includes('Zeitraum: Alle Daten'))).toBe(true);
  });

  it('sollte den Zeitraum vor den Summen nennen, nicht danach', async () => {
    // Die Reihenfolge ist die Aussage: Wer die Summen zuerst liest, hat sie
    // bereits eingeordnet, bevor die Einschränkung kommt.
    await exportiereAls('30 Tage');

    const zeitraumIndex = textAufrufe.findIndex((z) => z.includes('Zeitraum:'));
    const summeIndex = textAufrufe.findIndex((z) => z.includes('Gesamteinnahmen'));

    expect(zeitraumIndex).toBeGreaterThanOrEqual(0);
    expect(summeIndex).toBeGreaterThan(zeitraumIndex);
  });

  it('sollte den Bericht auf Englisch ebenso beschriften', async () => {
    const user = userEvent.setup();
    const { DataExport } = await import('../DataExport');
    renderWithProviders(<DataExport />, { router: true, query: true, locale: 'en' });

    await user.click(await screen.findByRole('button', { name: 'All data' }));
    await user.click(screen.getByRole('button', { name: /PDF/ }));
    await user.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => expect(gespeichert.length).toBeGreaterThan(0));
    expect(textAufrufe.some((z) => z.includes('Period: All data'))).toBe(true);
  });
});
