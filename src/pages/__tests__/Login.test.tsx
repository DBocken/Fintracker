import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import Login from '../Login';
import { loadDemoData } from '@/services/demo-data-service';

vi.mock('@/services/demo-data-service', () => ({
  loadDemoData: vi.fn().mockResolvedValue(undefined),
}));

describe('Login – Demo-Einstieg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  // Im WP-4.6-Gate verifiziert: Der langlebige App-Router übernimmt eine per
  // history.replaceState gesetzte Ziel-URL nicht — die App landet auf der
  // Startseite /coach. Ein replaceState('/dashboard') erzeugte nur einen
  // kurzen URL/Inhalt-Widerspruch. Navigation gehört dem Router.
  it('[REGRESSION] sollte beim Demo-Start die URL dem Router überlassen (Deutsch)', async () => {
    const onStartAnonymous = vi.fn();
    renderWithProviders(<Login onStartAnonymous={onStartAnonymous} />, { locale: 'de' });

    fireEvent.click(screen.getByRole('button', { name: 'Demo ansehen' }));

    await waitFor(() => expect(onStartAnonymous).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe('/');
  });

  it('[REGRESSION] sollte beim Demo-Start die URL dem Router überlassen (Englisch)', async () => {
    const onStartAnonymous = vi.fn();
    renderWithProviders(<Login onStartAnonymous={onStartAnonymous} />, { locale: 'en' });

    fireEvent.click(screen.getByRole('button', { name: 'View demo' }));

    await waitFor(() => expect(onStartAnonymous).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe('/');
  });

  it('sollte die Beispieldaten laden, bevor die App übernimmt', async () => {
    const onStartAnonymous = vi.fn();
    renderWithProviders(<Login onStartAnonymous={onStartAnonymous} />, { locale: 'de' });

    fireEvent.click(screen.getByRole('button', { name: 'Demo ansehen' }));

    await waitFor(() => expect(onStartAnonymous).toHaveBeenCalledTimes(1));
    // Erst die Daten, dann der Branch-Wechsel — sonst mountet die App leer.
    const loadOrder = vi.mocked(loadDemoData).mock.invocationCallOrder[0];
    const startOrder = onStartAnonymous.mock.invocationCallOrder[0];
    expect(loadOrder).toBeLessThan(startOrder);
  });
});
