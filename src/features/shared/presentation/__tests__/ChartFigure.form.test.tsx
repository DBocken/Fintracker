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
    // Und eine Deckelung nach oben: Ein Verhältnis wächst mit der Breite.
    expect(schlitz.className).toContain('fokussiert:max-h-[320px]');
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

  it('[REGRESSION] [MOBILE] sollte neben der Form KEIN flex-1 ausgeben', () => {
    // Am Gerät gemessen: Stehen `flex-1` und die Dichte-Variante nebeneinander,
    // entscheidet die Reihenfolge im erzeugten Stylesheet, welche gewinnt — die
    // Variante steht in `:where(...)` und hat dieselbe Spezifität. Der Verlauf
    // wurde dadurch rund dreimal so hoch, wie sein Seitenverhältnis erlaubt.
    // Eine Klasse, die man überschreiben MUSS, gibt man gar nicht erst aus.
    expect(rendere('zeitreihe').className).not.toMatch(/(^|\s)flex-1(\s|$)/);
  });

  it('sollte ohne Form weiterhin die Fläche füllen', () => {
    // Die Gegenrichtung: Ohne Formangabe bleibt es beim bisherigen Verhalten,
    // sonst kollabierten alle bestehenden Diagramme auf null Höhe.
    expect(rendere(undefined).className).toContain('flex-1');
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
