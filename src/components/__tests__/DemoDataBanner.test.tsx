/**
 * WP-8.3 — Der Demodaten-Banner darf den Seiteninhalt nicht nachtraeglich
 * nach unten schieben.
 *
 * Gefunden ueber die CLS-Messung des Performance-Laufs: `/dashboard` lag bei
 * 0,1002 gegen ein Budget von 0,1. Die Aufschluesselung der
 * `layout-shift`-Eintraege zeigte zwei Verschiebungen von je 41 px kurz nach
 * dem Laden — eine davon dieser Banner, der zwischen Kopfzeile und `main`
 * erscheint und alles darunter verschiebt.
 *
 * Die Ursache war KEINE langsame Abfrage: `isDemoDataActive()` liest
 * synchron aus dem localStorage. `useQuery` liefert aber im ersten Render
 * `undefined`, der Banner blieb also einen Durchlauf lang leer und erschien
 * erst danach. `initialData` schliesst genau diese Luecke — geraten wird
 * dabei nichts, es ist derselbe Aufruf.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, createHookWrapper } from '@/test-utils/render';
import { DEMO_ACTIVE_KEY } from '@/services/demo-data-service';
import DemoDataBanner from '../DemoDataBanner';

describe('DemoDataBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(DEMO_ACTIVE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(DEMO_ACTIVE_KEY);
    vi.restoreAllMocks();
  });

  it('[REGRESSION] sollte schon im ersten Render sichtbar sein, wenn Demodaten aktiv sind', () => {
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true');

    renderWithProviders(<DemoDataBanner />, { query: true });

    // Bewusst KEIN findBy/waitFor: Genau das Warten ist der Fehler. Ein
    // `await` hier wuerde den Test auch vor der Korrektur bestehen lassen.
    expect(screen.getByText('Du siehst Beispieldaten.')).toBeInTheDocument();
  });

  it('sollte ohne Demodaten nichts rendern', () => {
    // Gegenprobe: `initialData` darf den Banner nicht dauerhaft einblenden.
    const { container } = renderWithProviders(<DemoDataBanner />, { query: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('[REGRESSION] [PERF-5] sollte beim Entfernen die Finanz-Domäne neu laden, aber Trading unberührt lassen', async () => {
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
    const { wrapper, queryClient } = createHookWrapper({ locale: 'de' });
    queryClient.setQueryData(['accounts'], []);
    queryClient.setQueryData(['portfolios'], []);

    render(
      <MemoryRouter>
        <DemoDataBanner />
      </MemoryRouter>,
      { wrapper },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Beispieldaten entfernen' }));

    await waitFor(() => {
      expect(queryClient.getQueryState(['accounts'])?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(['portfolios'])?.isInvalidated).toBeFalsy();
  });
});
