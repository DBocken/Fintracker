import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import { renderWithI18n } from '@/test-utils/render';
import { useDateFnsLocale } from '../useDateFnsLocale';
import {
  readDateFnsLocaleOrFallback,
  preloadDateFnsLocale,
  resetDateFnsLocaleCacheForTests,
} from '../date-fns-locale';

/**
 * Deckt genau das Fenster ab, das der date-fns-Locale-Preload in
 * `vitest.setup.ts` für den Rest der Suite absichtlich unsichtbar macht
 * (siehe Kommentar dort) — Pendant zu `translation-lazy-loading.test.tsx`
 * (WP 4.5 / PERF-3), diesmal für `date-fns-locale.ts` (WP 5.5b, Review-
 * Nachtrag zu `docs/qualitaet-2026-08/nachpruefung.md` 4.f: „Wo die
 * Testumgebung einen Zustand herstellt, muss mindestens ein Test ihn
 * ausdrücklich wieder aufheben."). Die Zeitspanne zwischen "Zielsprache
 * noch nicht geladen" und "Chunk eingetroffen" ist der einzige wirklich
 * NEUE Produktionspfad aus WP 5.5b — ohne diesen Test wären der de-Fallback
 * und die `useSyncExternalStore`-Nachrender-Mechanik in `useDateFnsLocale`
 * eine unbelegte Behauptung.
 *
 * Jeder Test hier ruft zuerst `resetDateFnsLocaleCacheForTests()`, damit die
 * globale Vorladung aus `vitest.setup.ts` für ihn aufgehoben ist — sonst wäre
 * `en` längst im Cache und das Fenster gar nicht beobachtbar.
 */

const WEDNESDAY = new Date('2026-07-01T12:00:00');

function WeekdayProbe() {
  const dateFnsLocale = useDateFnsLocale();
  return <div data-testid="probe">{format(WEDNESDAY, 'EEE', { locale: dateFnsLocale })}</div>;
}

describe('Lazy-date-fns-Locale-Ladung (WP 5.5b) — das ungeladene Fenster', () => {
  beforeEach(() => {
    resetDateFnsLocaleCacheForTests();
  });

  it('[REGRESSION] readDateFnsLocaleOrFallback liefert das deutsche Locale-Objekt, solange die Zielsprache noch laedt', () => {
    // 'en' ist frisch zurueckgesetzt, also nicht im Cache — kein leerer Text,
    // kein `undefined`, sondern das garantierte de-Fallback-Locale-Objekt.
    const label = format(WEDNESDAY, 'EEE', { locale: readDateFnsLocaleOrFallback('en') });
    expect(label).toBe('Mi.');
    expect(label).not.toBe('');
  });

  it('[REGRESSION] readDateFnsLocaleOrFallback liefert nach dem Laden das echte en-US-Locale-Objekt', async () => {
    expect(format(WEDNESDAY, 'EEE', { locale: readDateFnsLocaleOrFallback('en') })).toBe('Mi.'); // vor dem Laden: Fallback
    await preloadDateFnsLocale('en');
    expect(format(WEDNESDAY, 'EEE', { locale: readDateFnsLocaleOrFallback('en') })).toBe('Wed'); // danach: echte Sprache
  });

  it('[REGRESSION] eine gerenderte Flaeche zeigt zunaechst das deutsche Kuerzel und rendert nach dem Laden das englische nach', async () => {
    renderWithI18n(<WeekdayProbe />, 'en');

    // Erster Render: 'en' ist noch unterwegs, die Flaeche zeigt den
    // de-Fallback statt eines leeren/rohen Zustands.
    expect(screen.getByTestId('probe')).toHaveTextContent('Mi.');

    // Sobald der Chunk eintrifft, bumped date-fns-locale die Version;
    // useDateFnsLocale abonniert das ueber useSyncExternalStore und rendert neu.
    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('Wed');
    });
  });
});
