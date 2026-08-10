import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import CommandPalette from '../CommandPalette';

/**
 * Die Befehls-/Schnellzugriffs-Palette hängt in `AppShell` und existiert damit
 * auf JEDER Fläche der App. Ihr `DialogContent` hatte keinen `DialogTitle` —
 * ein Dialog ohne zugänglichen Namen ist mit Screenreader nicht einzuordnen
 * ("Dialog" und sonst nichts), und Radix protokolliert dafür bei jedem Öffnen
 * einen `console.error`.
 *
 * WP 6.9 hat an derselben Stelle die *Beschreibung* geregelt
 * (`aria-describedby={undefined}`) und den fehlenden *Titel* übersehen.
 */

/** Der Text, mit dem Radix einen fehlenden Titel anmahnt. */
const RADIX_TITEL_WARNUNG = /requires a `DialogTitle`/;

vi.mock('@/hooks/useNavVisibility', () => ({
  useNavVisibility: () => ({ enabled: null, unlocked: null }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function oeffnePalette() {
  act(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  });
}

describe('CommandPalette — zugänglicher Name', () => {
  it.each([
    ['de', 'Schnellzugriff'],
    ['en', 'Quick access'],
  ] as const)('sollte den Dialog in %s benennen', (locale, name) => {
    renderWithProviders(<CommandPalette />, { locale, query: true });
    oeffnePalette();

    expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
  });

  it('sollte den Namen nicht sichtbar setzen — das Suchfeld bleibt der visuelle Anker', () => {
    renderWithProviders(<CommandPalette />, { query: true });
    oeffnePalette();

    const titel = screen.getByText('Schnellzugriff');
    expect(titel).toHaveClass('sr-only');
  });

  it('sollte beim Öffnen keine Radix-Konsolenmeldung zum fehlenden Titel auslösen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(<CommandPalette />, { query: true });
    oeffnePalette();

    const meldungen = [...warn.mock.calls, ...error.mock.calls].map((args) => String(args[0]));
    expect(meldungen.filter((m) => RADIX_TITEL_WARNUNG.test(m))).toEqual([]);
  });
});
