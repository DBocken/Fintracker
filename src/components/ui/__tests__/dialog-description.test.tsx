import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../sheet';

/**
 * WP 6.9 — die Dialog-Beschreibung log in jedem Dialog.
 *
 * `ui/dialog.tsx` rendert(e) als Default eine `sr-only`-Beschreibung mit dem
 * Text „Dialog content for account management". Sie stand in JEDEM Dialog der
 * App: im Budget-Dialog, im Schulden-Dialog, im Backup-Dialog. Schlimmer noch,
 * sie belegte dieselbe `id`, auf die Radix `aria-describedby` zeigt — eine
 * ECHTE Beschreibung an der Aufrufstelle wurde deshalb nicht vorgelesen,
 * sondern die falsche, weil `getElementById` das erste Element mit der id
 * liefert und die Default-Beschreibung vor `children` steht.
 */
const FALSCHE_BESCHREIBUNG = 'Dialog content for account management';

/** Genau der Text, mit dem Radix eine fehlende Beschreibung anmahnt. */
const RADIX_WARNUNG = /Missing `Description` or `aria-describedby=\{undefined\}`/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DialogContent — Beschreibung (WP 6.9)', () => {
  it.each(['de', 'en'] as const)(
    '[REGRESSION] sollte in %s keine erfundene Beschreibung in einen Dialog ohne Beschreibung schreiben',
    (locale) => {
      renderWithI18n(
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Budget</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
        locale,
      );

      expect(screen.queryByText(FALSCHE_BESCHREIBUNG)).toBeNull();
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    },
  );

  it.each(['de', 'en'] as const)(
    '[REGRESSION] sollte in %s die echte Beschreibung der Aufrufstelle verlinken statt sie zu überschreiben',
    (locale) => {
      renderWithI18n(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Budget</DialogTitle>
              <DialogDescription>Monatsbudget für Lebensmittel ändern</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
        locale,
      );

      const dialog = screen.getByRole('dialog');
      const beschreibungsId = dialog.getAttribute('aria-describedby');
      expect(beschreibungsId).toBeTruthy();
      expect(document.getElementById(beschreibungsId!)?.textContent).toBe(
        'Monatsbudget für Lebensmittel ändern',
      );
      expect(screen.queryByText(FALSCHE_BESCHREIBUNG)).toBeNull();
    },
  );

  it('sollte weder mit noch ohne Beschreibung eine Radix-Konsolenwarnung auslösen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderWithI18n(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Ohne Beschreibung</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    unmount();

    renderWithI18n(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mit Beschreibung</DialogTitle>
            <DialogDescription>Erklärt, was hier passiert</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const meldungen = [...warn.mock.calls, ...error.mock.calls].map((args) => String(args[0]));
    expect(meldungen.filter((m) => RADIX_WARNUNG.test(m))).toEqual([]);
  });
});

describe('Schließen-Beschriftung (WP 6.9)', () => {
  it.each([
    ['de', 'Schließen'],
    ['en', 'Close'],
  ] as const)('sollte den Dialog-Schließer in %s benennen', (locale, name) => {
    renderWithI18n(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Budget</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
      locale,
    );

    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it.each([
    ['de', 'Schließen'],
    ['en', 'Close'],
  ] as const)('sollte den Sheet-Schließer in %s benennen', (locale, name) => {
    renderWithI18n(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Filter</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
      locale,
    );

    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
});
