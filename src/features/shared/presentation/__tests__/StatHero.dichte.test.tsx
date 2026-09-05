/**
 * Der Hero-Wert steht in fokussiert ohne Kasten.
 *
 * Auf dem Geraet gut sichtbar: Der Kontostand der Uebersicht sitzt in einem
 * lila Verlaufskasten mit Rundung und 20 px Polsterung. ADR Regel 9 verbietet
 * Boxen in der fokussierten Dichte — und der Verlauf ist Dekoration, waehrend
 * die AUSSAGE die Zahl darin ist.
 *
 * In kompakt bleibt der Kasten: Dort ordnet er den Hero gegen die Kacheln
 * daneben. Auf einem Telefon steht nichts daneben, das er ordnen koennte.
 *
 * Geprueft wird die Anweisung, nicht ihre gerechnete Wirkung — jsdom loest die
 * Dichte-Varianten nicht auf.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test-utils/render';
import StatHero from '../StatHero';

function heroVon(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('StatHero — kein Kasten in fokussiert', () => {
  it('[MOBILE] sollte Verlauf, Rundung und Polsterung an die kompakte Dichte binden', () => {
    const { container } = renderWithProviders(
      <StatHero label="Kontostand" value="2.806,66 €" />,
      { router: true },
    );
    const klassen = heroVon(container).className;

    // Keine ungebundene Box mehr.
    expect(klassen).not.toMatch(/(^|\s)rounded-xl/);
    expect(klassen).not.toMatch(/(^|\s)bg-gradient-to-br/);
    expect(klassen).not.toMatch(/(^|\s)p-5/);

    // Aber sie ist nicht verschwunden — sie haengt jetzt an der Dichte.
    expect(klassen).toContain('kompakt:rounded-xl');
    expect(klassen).toContain('kompakt:bg-gradient-to-br');
    expect(klassen).toContain('kompakt:p-5');
  });

  it('sollte den Verlauf vollstaendig binden, nicht nur seine Richtung', () => {
    // `bg-gradient-to-br` ohne `from-`/`via-`/`to-` waere ein Verlauf ohne
    // Farben — und umgekehrt blieben ungebundene Farbstopps wirkungslose
    // Klassen im Markup. Beide Haelften gehoeren zusammen.
    const { container } = renderWithProviders(
      <StatHero label="Kontostand" value="2.806,66 €" />,
      { router: true },
    );
    const klassen = heroVon(container).className;

    for (const teil of ['from-brand/10', 'via-premium/15', 'to-transparent']) {
      expect(klassen).toContain(`kompakt:${teil}`);
      expect(klassen).not.toMatch(new RegExp(`(^|\\s)${teil.replace('/', '\\/')}`));
    }
  });

  it('sollte die Zahl unveraendert gross lassen', () => {
    // Der Kasten faellt, die Aussage nicht. Faellt beides, ist es keine
    // Anpassung, sondern ein Verlust.
    const { container } = renderWithProviders(
      <StatHero label="Kontostand" value="2.806,66 €" />,
      { router: true },
    );

    const wert = container.querySelector('.hero-value');
    expect(wert).not.toBeNull();
    expect(wert!.textContent).toContain('2.806,66');
    expect(wert!.className).toContain('font-bold');
  });

  it('sollte Beschriftung und Zusatz behalten', () => {
    const { getByText } = renderWithProviders(
      <StatHero label="Kontostand" value="2.806,66 €" caption="Du gibst weniger aus als du einnimmst" />,
      { router: true },
    );

    expect(getByText('Kontostand')).toBeInTheDocument();
    expect(getByText('Du gibst weniger aus als du einnimmst')).toBeInTheDocument();
  });
});
