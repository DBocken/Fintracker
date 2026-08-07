/**
 * Leerzustand der Einnahmen-Fläche (WP-12.1).
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

import IncomePage from '../IncomePage';

describe('Leerzustand der Einnahmen-Fläche', () => {
  it('[ZUSTAND /income:leer] sollte ohne Einnahmen zum Anfangen einladen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<IncomePage />, { query: true, router: true });

    await screen.findByText('Noch keine Transaktionen', {}, { timeout: 4000 });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
