import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { useI18n } from '../useI18n';
import { lookupTranslation } from '../I18nProvider';
import { t as serviceT } from '../serviceT';
import { preloadLocale, resetTranslationCacheForTests } from '../translation-registry';

/**
 * Deckt genau das Fenster ab, das `vitest.setup.ts`s Sprach-Preload für den
 * Rest der Suite absichtlich unsichtbar macht (siehe Kommentar dort): die
 * Zeitspanne zwischen "Zielsprache noch nicht geladen" und "Chunk
 * eingetroffen". Das ist der einzige wirklich NEUE Produktionspfad aus WP 4.5
 * (PERF-3) — ohne diesen Test wäre der de-Fallback und die
 * `useSyncExternalStore`-Re-Render-Mechanik in `translation-registry.ts`
 * eine unbelegte Behauptung.
 *
 * Jeder Test hier ruft zuerst `resetTranslationCacheForTests()`, damit die
 * globale Vorladung aus `vitest.setup.ts` für ihn aufgehoben ist — sonst wäre
 * `en` längst im Cache und das Fenster gar nicht beobachtbar.
 */

function SaveLabel() {
  const { t } = useI18n();
  return <div data-testid="probe">{t('common.save')}</div>;
}

describe('Lazy-Sprachladung (WP 4.5 / PERF-3) — das ungeladene Fenster', () => {
  beforeEach(() => {
    resetTranslationCacheForTests();
  });

  it('[REGRESSION] lookupTranslation liefert den deutschen Fallback, solange die Zielsprache noch laedt', () => {
    // 'en' ist frisch zurueckgesetzt, also nicht im Cache — kein roher Key,
    // kein `undefined`, sondern der garantierte de-Fallback.
    expect(lookupTranslation('en', 'common.save')).toBe('Speichern');
  });

  it('[REGRESSION] lookupTranslation liefert nach dem Laden den echten Text', async () => {
    expect(lookupTranslation('en', 'common.save')).toBe('Speichern'); // vor dem Laden: Fallback
    await preloadLocale('en');
    expect(lookupTranslation('en', 'common.save')).toBe('Save'); // danach: echte Sprache
  });

  it('[REGRESSION] eine Flaeche zeigt zunaechst den deutschen Fallback und rendert nach dem Laden die echte Sprache nach', async () => {
    renderWithI18n(<SaveLabel />, 'en');

    // Erster Render: 'en' ist noch unterwegs, die Flaeche zeigt den
    // de-Fallback statt eines leeren/rohen Zustands.
    expect(screen.getByTestId('probe')).toHaveTextContent('Speichern');

    // Sobald der Chunk eintrifft, bumped translation-registry die Version;
    // I18nProvider abonniert das ueber useSyncExternalStore und rendert neu.
    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('Save');
    });
  });

  it('[REGRESSION] serviceT liefert vor dem Laden den deutschen Fallback und danach den echten Text', async () => {
    window.localStorage.setItem('ausgabentracker_locale_v1', 'en');

    expect(serviceT('common.save')).toBe('Speichern');
    await preloadLocale('en');
    expect(serviceT('common.save')).toBe('Save');
  });
});
