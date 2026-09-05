/**
 * Die Symbolkachel einer Listenzeile bleibt, WO SIE ETWAS TRÄGT.
 *
 * Mit `iconColor` ist die Kachel der Träger der Kategoriefarbe — ohne sie wäre
 * die Farbe schlicht weg. Ohne `iconColor` ist sie eine getönte Fläche um ein
 * Symbol, also Dekoration; auf einem Telefon erzeugt genau das die
 * Schachtelung, die ADR Regel 9 verbietet.
 *
 * Der Befund kam aus dem Flächen-Entwurf für die Einstellungen: Sie umgeht
 * `ListRow` eigens, weil die Kachel dort stört. Ein Verzeichnis aus elf Zielen
 * braucht die Zeile, nicht die Kachel.
 *
 * Geprüft wird die Anweisung, nicht ihre gerechnete Wirkung — jsdom löst die
 * Dichte-Variante nicht auf.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListRow from '../ListRow';

function kachelVon(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('span[aria-hidden="true"]');
}

describe('ListRow — die Symbolkachel', () => {
  it('[MOBILE] sollte die ungetönte Kachel in fokussiert unsichtbar machen', () => {
    const { container } = render(<ListRow icon="⚙️" title="Sicherheit" />);
    const kachel = kachelVon(container);

    expect(kachel).not.toBeNull();
    expect(kachel!.className).toContain('bg-muted');
    expect(kachel!.className).toContain('fokussiert:bg-transparent');
  });

  it('sollte die GETÖNTE Kachel überall behalten', () => {
    // Hier trägt die Kachel die Kategoriefarbe. Sie auszublenden hiesse, eine
    // Information zu löschen statt eine Dekoration.
    const { container } = render(
      <ListRow icon="🍎" iconColor="#ff0000" title="Lebensmittel" />,
    );
    const kachel = kachelVon(container);

    expect(kachel!.className).not.toContain('bg-muted');
    expect(kachel!.className).not.toContain('fokussiert:bg-transparent');
    // jsdom normalisiert die Hex-Schreibweise mit Alpha zu rgba() — geprueft
    // wird deshalb die Wirkung (die Farbe steht als Inline-Stil da), nicht die
    // Schreibweise, in der sie notiert wurde.
    expect(kachel!.style.backgroundColor).toMatch(/rgba\(255,\s*0,\s*0/);
  });

  it('sollte den Kasten für die Ausrichtung behalten, auch ohne sichtbare Kachel', () => {
    // Verschwinden soll die Kachel, nicht die Bündigkeit: Ohne den 40er-Kasten
    // würden Zeilen mit und ohne Symbol unterschiedlich einrücken.
    const { container } = render(<ListRow icon="⚙️" title="Sicherheit" />);

    expect(kachelVon(container)!.className).toContain('h-10');
    expect(kachelVon(container)!.className).toContain('w-10');
  });

  it('sollte ohne Symbol gar keine Kachel rendern', () => {
    const { container } = render(<ListRow title="Sicherheit" />);

    expect(kachelVon(container)).toBeNull();
  });

  it('sollte als Zeile antippbar sein und das Mindestmaß halten', () => {
    // Regel 10: Die ZEILE ist die Aktion. Ein Trefferbereich unter 44 px wäre
    // vorhanden und trotzdem nicht bedienbar (AGENTS.md §4).
    const { container } = render(<ListRow title="Sicherheit" onClick={() => {}} />);
    const knopf = container.querySelector('button');

    expect(knopf).not.toBeNull();
    expect(knopf!.className).toContain('min-h-[44px]');
  });

  it('sollte den Klick genau einmal melden', async () => {
    const user = userEvent.setup();
    let treffer = 0;
    render(<ListRow title="Sicherheit" onClick={() => { treffer += 1 }} />);

    await user.click(screen.getByRole('button', { name: /Sicherheit/ }));

    expect(treffer).toBe(1);
  });
});
