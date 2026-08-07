/**
 * Leerzustand der Coach-Fläche (WP-12.1).
 *
 * Ohne Mock: Der Testspeicher startet leer, und genau das ist der Zustand,
 * den ein neuer Nutzer sieht. Die Gegenprobe auf `role="alert"` ist der
 * eigentliche Test — sie trennt „noch nichts erfasst" von „nicht ladbar".
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

import CoachPage from '../CoachPage';

describe('Leerzustand der Coach-Fläche', () => {
  it('[ZUSTAND /coach:leer] sollte ohne jede Buchung zum Anfangen einladen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<CoachPage />, { query: true, router: true });

    expect(await screen.findByText('Noch keine Transaktionen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
