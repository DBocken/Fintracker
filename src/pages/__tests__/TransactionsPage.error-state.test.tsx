/**
 * WP-9.2 — „leer" ist nicht „nicht ladbar".
 *
 * Befund aus der Zustands-Matrix (docs/aaa-plus/audits/state-coverage-matrix.md):
 * Das Muster `const { data: txs = [] } = useQuery(…)` steht an 122 Stellen im
 * Repo, der Fehlerzustand wird an fünf gelesen. Scheitert die Abfrage, greift
 * der Fallback `[]`, `isEmpty` wird wahr — und der Screen zeigt seinen
 * LEERZUSTAND: „Noch keine Buchungen — Importiere eine CSV deiner Bank."
 *
 * Das ist keine fehlende Rückmeldung, sondern eine falsche Auskunft. Der eine
 * Satz lädt zum Neuladen ein, der andere zum Neuanlegen von Daten, die längst
 * da sind.
 *
 * Der Test prüft die ZIELAUSSAGE (Fehlertext vorhanden) und nicht nur die
 * Abwesenheit des Leerzustands. Eine reine Abwesenheits-Prüfung bestünde auch
 * bei einer weißen Seite — und wäre beim ersten Anlauf genau daran
 * vorbeigelaufen, weil sie zuschlug, bevor die Abfrage überhaupt abgewiesen war.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import TransactionsPage from '../TransactionsPage';

describe('TransactionsPage — Fehlerzustand (WP-9.2)', () => {
  it('[REGRESSION] [ZUSTAND /transactions:fehler] sollte einen Ladefehler benennen statt „keine Daten" zu behaupten', async () => {
    renderWithProviders(<TransactionsPage />, { query: true });

    expect(
      await screen.findByText('Deine Buchungen konnten nicht geladen werden'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Buchungen')).toBeNull();
  });

  it('sollte zusichern, dass die Daten nicht verloren sind', async () => {
    // Der wichtigste Satz für eine local-first Finanz-App. Ohne ihn liest sich
    // ein Lesefehler wie ein Datenverlust.
    renderWithProviders(<TransactionsPage />, { query: true });
    expect(await screen.findByText(/nicht verloren/i)).toBeInTheDocument();
  });

  it('sollte einen Weg aus dem Fehler anbieten', async () => {
    // Eine Fehlermeldung ohne nächsten Schritt ist eine Sackgasse.
    renderWithProviders(<TransactionsPage />, { query: true });
    expect(
      await screen.findByRole('button', { name: 'Erneut versuchen' }),
    ).toBeInTheDocument();
  });
});
