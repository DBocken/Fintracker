/**
 * Das Seitenverhältnis eines Diagramms ist eine Eigenschaft der Visualisierung,
 * keine Zahl an der Aufrufstelle.
 *
 * Gemessen bei 360 px: In einer Karte mit Inhaltsbereich bleiben nur 264 px
 * Breite (zweimal `p-4` = 64 px Polsterung). Gegen feste Höhen von 288, 300,
 * 256 und 250 px standen damit sechs Diagramme hochkant — darunter der Verlauf
 * über Monate, dessen X-Achse eine Zeitachse ist.
 *
 * Geprüft wird die ANWEISUNG, nicht ihre gerechnete Wirkung: In jsdom gibt es
 * kein Stylesheet, das `fokussiert:` auflöst, und `aspect-ratio` rechnet dort
 * ohnehin nicht. Dieselbe Begründung wie bei den Safe-Area-Tests.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ChartFigure } from '../ChartFigure';

type Zeile = { monat: string };

function rendere(form?: 'zeitreihe' | 'verteilung' | 'fluss') {
  const { container } = render(
    <I18nProvider initialLocale="de">
      <ChartFigure<Zeile>
        form={form}
        caption="Verlauf"
        columns={[{ key: 'monat', label: 'Monat', format: (r) => r.monat }]}
        rows={[{ monat: 'Jan' }]}
        rowKey={(r) => r.monat}
      >
        <div data-testid="diagramm" />
      </ChartFigure>
    </I18nProvider>,
  );
  // Der Diagramm-Schlitz ist der für Hilfstechnik ausgeblendete Behälter.
  return container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
}

describe('ChartFigure — die Form bestimmt das Seitenverhältnis', () => {
  it('[MOBILE] sollte eine Zeitreihe breiter als hoch setzen', () => {
    // Eine Zeitachse braucht waagerechten Raum: Sonst ist die Steigung
    // zwischen zwei Punkten nicht mehr ablesbar.
    const schlitz = rendere('zeitreihe');

    expect(schlitz.className).toContain('fokussiert:aspect-[16/9]');
    // Ohne das Aufheben der Höhe kann das Verhältnis nicht greifen — die
    // Aufrufstelle gibt eine feste Höhe vor.
    expect(schlitz.className).toContain('fokussiert:h-auto');
  });

  it('[MOBILE] sollte eine Verteilung quadratisch setzen', () => {
    expect(rendere('verteilung').className).toContain('fokussiert:aspect-square');
  });

  it('sollte einem Fluss KEIN Seitenverhältnis aufzwingen', () => {
    // Die Höhe eines Sankey hängt an der Zahl der Knoten, nicht an der Breite:
    // Zehn Kategorien brauchen zehnmal Platz für eine Beschriftung, ob die
    // Fläche nun 264 oder 900 px breit ist. Ein Verhältnis wäre hier
    // Scheingenauigkeit.
    const schlitz = rendere('fluss');

    expect(schlitz.className).not.toContain('aspect-');
  });

  it('sollte ohne Formangabe nichts ändern', () => {
    // Bestehende Diagramme dürfen sich nicht von selbst umstellen — die Form
    // wird an der Aufrufstelle entschieden, wenn ihre Fläche umgebaut wird.
    const schlitz = rendere(undefined);

    expect(schlitz.className).not.toContain('aspect-');
    expect(schlitz.className).not.toContain('h-auto');
  });

  it('sollte das Verhältnis nur in fokussiert setzen', () => {
    // In der kompakten Dichte ist Platz genug; dort bleibt es bei der Höhe der
    // Aufrufstelle. Eine pauschale Regel hätte den Desktop mitverändert.
    const klassen = rendere('zeitreihe').className;

    for (const klasse of klassen.split(/\s+/).filter((k) => k.includes('aspect-'))) {
      expect(klasse.startsWith('fokussiert:')).toBe(true);
    }
  });
});
