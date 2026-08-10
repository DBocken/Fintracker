import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { GlossaryTerm } from '../GlossaryTerm';

/**
 * Der Baustein muss beide Sprachstile bedienen, ohne eine der beiden Seiten
 * schlechter zu behandeln: in der Alltagssprache steht der Fachbegriff sichtbar
 * daneben, in der Fachsprache entfällt die Zeile.
 */

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  // matchMedia zurücksetzen, sonst leckt der Mobile-Fall in andere Tests.
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('GlossaryTerm', () => {
  it('sollte in der Alltagssprache den Alltagsbegriff zeigen', () => {
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'everyday');
    expect(screen.getByText('Verfügbares Geld')).toBeInTheDocument();
  });

  it('sollte in der Alltagssprache den Fachbegriff als Sekundaerzeile zeigen', () => {
    // Genau der Punkt, an dem sich niemand fuer dumm gehalten fuehlen soll.
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'everyday');
    expect(screen.getByText('Liquidität')).toBeInTheDocument();
  });

  it('sollte in der Fachsprache nur den Fachbegriff zeigen', () => {
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'technical');
    expect(screen.getByText('Liquidität')).toBeInTheDocument();
    expect(screen.queryByText('Verfügbares Geld')).not.toBeInTheDocument();
  });

  it('sollte die Sekundaerzeile auf Wunsch unterdruecken', () => {
    // Fuer breitenbegrenzte Flaechen wie Navigations-Labels.
    renderWithI18n(<GlossaryTerm termId="liquidity" hideSecondary />, 'de', 'everyday');
    expect(screen.getByText('Verfügbares Geld')).toBeInTheDocument();
    expect(screen.queryByText('Liquidität')).not.toBeInTheDocument();
  });

  it('sollte auf Englisch den englischen Alltagsbegriff zeigen', () => {
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'en', 'everyday');
    expect(screen.getByText('Money available now')).toBeInTheDocument();
    expect(screen.getByText('Liquidity')).toBeInTheDocument();
  });

  it('sollte fuer Locales ohne Overlay den Basisbegriff zeigen', () => {
    // `ru` hat kein Alltagssprache-Overlay — dann gibt es keine zweite Fassung
    // und auch keine Sekundaerzeile.
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'ru', 'everyday');
    expect(screen.getByText('Ликвидность')).toBeInTheDocument();
  });

  it('sollte die Erklaerung und den anderen Sprachstil im Panel zeigen', async () => {
    const user = userEvent.setup();
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'everyday');

    await user.click(screen.getByRole('button', { name: /Was bedeutet/ }));

    expect(
      await screen.findByText(/Das Geld, an das du sofort herankommst/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Auf Fachsprache umstellen/)).toBeInTheDocument();
  });

  it('sollte den Sprachstil aus dem Panel heraus umschalten koennen', async () => {
    const user = userEvent.setup();
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'everyday');

    await user.click(screen.getByRole('button', { name: /Was bedeutet/ }));
    await user.click(await screen.findByText(/Auf Fachsprache umstellen/));

    // Nach dem Wechsel ist der Fachbegriff die Hauptbezeichnung — sichtbar am
    // Auslöser. Das offene Panel zeigt dann folgerichtig die Alltagsfassung als
    // Gegenstueck und bietet den Rueckweg an.
    expect(
      await screen.findByRole('button', { name: 'Was bedeutet „Liquidität"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Auf Alltagssprache umstellen/)).toBeInTheDocument();
    expect(screen.getByText('Im Alltag:')).toBeInTheDocument();
  });

  it('[MOBILE] sollte auf schmalen Viewports ein Sheet statt eines Popovers oeffnen', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderWithI18n(<GlossaryTerm termId="liquidity" />, 'de', 'everyday');

    await user.click(screen.getByRole('button', { name: /Was bedeutet/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      await screen.findByText(/Das Geld, an das du sofort herankommst/),
    ).toBeInTheDocument();
  });
});
