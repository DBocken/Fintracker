import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { renderWithProviders, createHookWrapper } from '@/test-utils/render';
import DataSourceDialog from '../DataSourceDialog';
import { getLocalUserSettings, updateLocalUserSettings } from '@/services/local-settings-service';
import { localEncryption } from '@/services/local-crypto';
import { DEMO_ACTIVE_KEY } from '@/services/demo-data-service';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

beforeEach(() => {
  localStorage.clear();
  localEncryption.lock();
  navigate.mockClear();
});

function renderDialog(locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<DataSourceDialog />, { locale, query: true });
}

describe('DataSourceDialog', () => {
  it('sollte beim allerersten Start nach der Datenquelle fragen', async () => {
    renderDialog();
    expect(await screen.findByText('Womit möchtest du anfangen?')).toBeInTheDocument();
  });

  it('sollte alle drei Wege anbieten — auch den Bankweg', async () => {
    renderDialog();
    // Der Bankweg fehlte bisher an jeder Stelle, an der die App nach Daten
    // fragte (Anmeldeseite, leerer Zustand).
    expect(await screen.findByText(/Datei von meiner Bank/)).toBeInTheDocument();
    expect(screen.getByText(/Bank direkt verbinden/)).toBeInTheDocument();
    expect(screen.getByText(/Erst mal umsehen/)).toBeInTheDocument();
  });

  it('sollte die Wege auf Englisch benennen', async () => {
    renderDialog('en');
    expect(await screen.findByText(/file from my bank/)).toBeInTheDocument();
    expect(screen.getByText(/Connect my bank directly/)).toBeInTheDocument();
  });

  it('sollte nach getroffener Wahl nicht erneut fragen', async () => {
    await updateLocalUserSettings({ tutorial_source: 'csv' });
    renderDialog();
    await waitFor(() => {
      expect(screen.queryByText('Womit möchtest du anfangen?')).not.toBeInTheDocument();
    });
  });

  it('sollte nach dem Überspringen nicht erneut fragen', async () => {
    // `null` = gefragt und übersprungen. Ohne diesen Zustand käme die Weiche
    // bei jedem Start wieder.
    await updateLocalUserSettings({ tutorial_source: null });
    renderDialog();
    await waitFor(() => {
      expect(screen.queryByText('Womit möchtest du anfangen?')).not.toBeInTheDocument();
    });
  });

  it('sollte den Dateiweg speichern und dorthin führen', async () => {
    renderDialog();
    await userEvent.click(await screen.findByText(/Datei von meiner Bank/));
    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_source).toBe('csv');
    });
    expect(navigate).toHaveBeenCalledWith('/csv');
  });

  it('sollte den Bankweg zur Kontoverwaltung führen', async () => {
    renderDialog();
    await userEvent.click(await screen.findByText(/Bank direkt verbinden/));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/accounts'));
  });

  it('sollte beim Überspringen den Zustand festhalten', async () => {
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: /Später entscheiden/ }));
    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_source).toBeNull();
    });
  });

  it('[REGRESSION] [PERF-5] sollte beim Dateiweg keine Finanz-Domäne neu laden — es hat sich nichts geändert', async () => {
    const { wrapper, queryClient } = createHookWrapper({ locale: 'de' });
    queryClient.setQueryData(['accounts'], []);

    render(
      <MemoryRouter>
        <DataSourceDialog />
      </MemoryRouter>,
      { wrapper },
    );

    await userEvent.click(await screen.findByText(/Datei von meiner Bank/));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/csv'));

    // Der Dateiweg ändert weder Konten noch Buchungen — eine Invalidierung
    // der Finanz-Domäne wäre reine Verschwendung (PERF-5).
    expect(queryClient.getQueryState(['accounts'])?.isInvalidated).toBeFalsy();
  });

  it('[REGRESSION] [PERF-5] sollte beim Demoweg die Finanz-Domäne neu laden, aber Trading unberührt lassen', async () => {
    const { wrapper, queryClient } = createHookWrapper({ locale: 'de' });
    queryClient.setQueryData(['accounts'], []);
    queryClient.setQueryData(['portfolios'], []);

    render(
      <MemoryRouter>
        <DataSourceDialog />
      </MemoryRouter>,
      { wrapper },
    );

    await userEvent.click(await screen.findByText(/Erst mal umsehen/));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'));

    expect(queryClient.getQueryState(['accounts'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['portfolios'])?.isInvalidated).toBeFalsy();
  });

  it('sollte nicht fragen, wenn die Demo schon über die Anmeldeseite lief', async () => {
    // Wer dort „Demo ansehen" gewählt hat, hat die Frage faktisch beantwortet.
    // Ein zweites Mal fragen wäre Gedächtnisverlust.
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true');
    renderDialog();
    await waitFor(async () => {
      expect((await getLocalUserSettings()).tutorial_source).toBe('demo');
    });
    expect(screen.queryByText('Womit möchtest du anfangen?')).not.toBeInTheDocument();
  });
});
