/**
 * WP-9.4 — „kein Treffer" ist der dritte Fall.
 *
 * Neben „nichts erfasst" (FinanceEmptyState) und „nicht ladbar"
 * (FinanceErrorState) gibt es den Fall, in dem Daten da sind und nur der
 * Filter nichts trifft. Bis hierher lautete der Text „Passe Filter oder
 * Suchbegriff an" — richtig, aber unbrauchbar: Bei sieben möglichen
 * Dimensionen ist das der Unterschied zwischen einem Hinweis und einem
 * Ratespiel.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import type { Account, Category } from '@/types';
import FilteredEmptyState from '../FilteredEmptyState';

const CATEGORIES = [{ id: 'cat-1', name: 'Wohnen' }] as Category[];
const ACCOUNTS = [{ id: 'acc-1', name: 'Girokonto' }] as Account[];

function setup(active: Parameters<typeof FilteredEmptyState>[0]['active'], locale: 'de' | 'en' = 'de') {
  const onReset = vi.fn();
  renderWithI18n(
    <FilteredEmptyState
      active={active}
      categories={CATEGORIES}
      accounts={ACCOUNTS}
      onReset={onReset}
    />,
    locale,
  );
  return { onReset };
}

describe('FilteredEmptyState (WP-9.4)', () => {
  it('sollte sagen, dass Buchungen vorhanden sind', () => {
    // DER entscheidende Satz. Er trennt diesen Zustand von „du hast noch
    // nichts erfasst" — und genau diese Verwechslung ist der Befund.
    setup([]);
    expect(screen.getByText(/Es gibt Buchungen/)).toBeInTheDocument();
  });

  it('sollte den Suchbegriff wörtlich nennen', () => {
    setup([{ dimension: 'search', value: 'Miete' }]);
    expect(screen.getByText('Suche „Miete“')).toBeInTheDocument();
  });

  it('sollte die Kategorie mit ihrem Namen nennen, nicht mit der ID', () => {
    setup([{ dimension: 'category', value: 'cat-1' }]);
    expect(screen.getByText('Kategorie Wohnen')).toBeInTheDocument();
  });

  it('sollte das Konto mit seinem Namen nennen', () => {
    setup([{ dimension: 'account', value: 'acc-1' }]);
    expect(screen.getByText('Konto Girokonto')).toBeInTheDocument();
  });

  it('sollte bei unbekannter ID die ID stehen lassen', () => {
    // Etwa nach dem Löschen einer Kategorie. Ein technischer Schlüssel ist
    // besser als ein leerer Platzhalter, der aussieht, als greife der Filter
    // gar nicht.
    setup([{ dimension: 'category', value: 'cat-geloescht' }]);
    expect(screen.getByText('Kategorie cat-geloescht')).toBeInTheDocument();
  });

  it('sollte mehrere Filter alle zeigen', () => {
    // Wird nur einer genannt, sucht der Nutzer den Fehler an der falschen
    // Stelle.
    setup([
      { dimension: 'search', value: 'Miete' },
      { dimension: 'category', value: 'cat-1' },
      { dimension: 'range', value: 'Monat' },
    ]);
    expect(screen.getByText('Suche „Miete“')).toBeInTheDocument();
    expect(screen.getByText('Kategorie Wohnen')).toBeInTheDocument();
    expect(screen.getByText('Zeitraum Monat')).toBeInTheDocument();
  });

  it('sollte das Zurücksetzen auslösen', async () => {
    const user = userEvent.setup();
    const { onReset } = setup([{ dimension: 'search', value: 'Miete' }]);

    await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('should say the same thing in English', () => {
    setup([{ dimension: 'search', value: 'Rent' }], 'en');
    expect(screen.getByText(/There are transactions/)).toBeInTheDocument();
    expect(screen.getByText('Search “Rent”')).toBeInTheDocument();
  });
});
