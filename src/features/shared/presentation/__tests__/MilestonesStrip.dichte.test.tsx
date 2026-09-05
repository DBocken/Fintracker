/**
 * Meilensteine: ein wiederholter Eintrag bekommt keine Karte je Stück.
 *
 * ADR Regel 10 gilt in BEIDEN Dichten — aber sie verbietet nicht dieselbe
 * Sache zweimal. Ein Rahmen ordnet, was NEBENeinander liegt: In der kompakten
 * Dichte stehen die Meilensteine als Raster, dort trennt die Tönung wirklich
 * zwischen erreicht und gesperrt. In der fokussierten stehen sie
 * untereinander, und dann ordnet die Reihenfolge — die Tönung erzeugt nur die
 * Schachtelung, die Regel 9 verbietet.
 *
 * Die AUSSAGE der Tönung (erreicht / noch nicht) darf dabei nicht verloren
 * gehen. Sie lebt in fokussiert über die Deckkraft und das Schloss-Symbol
 * weiter, die ohnehin schon da waren.
 *
 * Geprüft wird die Anweisung, nicht ihre gerechnete Wirkung — jsdom löst die
 * Dichte-Varianten nicht auf.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import MilestonesStrip from '../MilestonesStrip';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof MilestonesStrip>;

const MEILENSTEINE = [
  {
    definition: { key: 'emergency_fund_1m', title: 'Ein Monat Puffer', icon: '🛟' },
    achieved: true,
  },
  {
    definition: { key: 'debt_free', title: 'Schuldenfrei', icon: '🎉' },
    achieved: false,
  },
] as unknown as Props['milestones'];

function klassenAllerEintraege(container: HTMLElement): string[] {
  // Die Einträge sind die Kinder des Rasters; das Raster selbst trägt `grid`.
  const raster = Array.from(container.querySelectorAll<HTMLElement>('div')).filter((el) =>
    el.className.includes('grid'),
  );
  return raster.flatMap((r) => Array.from(r.children).map((c) => (c as HTMLElement).className));
}

describe('MilestonesStrip — Rahmen nur, wo etwas nebeneinander liegt', () => {
  it.each(['full', 'compact'] as const)(
    '[MOBILE] sollte in der Fassung "%s" die Tönung an die kompakte Dichte binden',
    (variant) => {
      const { container } = renderWithProviders(
        <MilestonesStrip milestones={MEILENSTEINE} variant={variant} />,
        { router: true },
      );

      const klassen = klassenAllerEintraege(container);
      expect(klassen.length).toBeGreaterThan(0);

      for (const k of klassen) {
        // Keine ungebundene Tönung und keine ungebundene Rundung mehr.
        expect(k).not.toMatch(/(^|\s)bg-positive\/5/);
        expect(k).not.toMatch(/(^|\s)bg-muted\/20/);
        expect(k).not.toMatch(/(^|\s)rounded-lg/);
      }

      // Aber sie ist nicht verschwunden — sie hängt jetzt an der Dichte.
      expect(klassen.some((k) => k.includes('kompakt:bg-positive/5'))).toBe(true);
      expect(klassen.some((k) => k.includes('kompakt:bg-muted/20'))).toBe(true);
    },
  );

  it('[REGRESSION] [MOBILE] sollte kein sm: benutzen, weil sm in fokussiert aktiv wäre', () => {
    // Die fokussierte Dichte reicht bis 768 px, `sm` beginnt bei 640. Zwischen
    // beiden Werten wäre `sm:grid-cols-2` in fokussiert AKTIV und bräuchte eine
    // Gegenregel. `kompakt:` beginnt an genau der Schwelle und lässt die Frage
    // gar nicht entstehen — dieselbe Lehre wie bei InfoStatStrip.
    const { container } = renderWithProviders(
      <MilestonesStrip milestones={MEILENSTEINE} variant="full" />,
      { router: true },
    );

    expect(container.innerHTML).not.toContain('sm:');
  });

  it('sollte den gesperrten Meilenstein weiterhin als gesperrt ausweisen', () => {
    // Die Tönung trug eine Aussage. Fällt sie in fokussiert weg, muss die
    // Aussage anderswo weiterleben — sonst ist das keine Anpassung, sondern
    // ein Informationsverlust.
    const { container } = renderWithProviders(
      <MilestonesStrip milestones={MEILENSTEINE} variant="full" />,
      { router: true },
    );

    const klassen = klassenAllerEintraege(container);
    expect(klassen.some((k) => k.includes('opacity-70'))).toBe(true);
    // Das Schloss-Symbol ist der zweite, von der Dichte unabhängige Träger.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('sollte die Meilensteine auf Englisch ebenso zeigen', () => {
    const { container } = renderWithProviders(
      <MilestonesStrip milestones={MEILENSTEINE} variant="full" />,
      { router: true, locale: 'en' },
    );

    expect(container.textContent).toContain('Schuldenfrei');
  });
});

describe('MilestonesStrip — Rohrender ohne Provider', () => {
  it('sollte ohne Router nicht rendern müssen', () => {
    // Nur ein Rauchtest: Die Komponente darf nicht abstürzen, wenn sie
    // irgendwo ohne Zusatzkontext gerendert wird.
    expect(() => render(<div />)).not.toThrow();
  });
});
