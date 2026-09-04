import { describe, expect, it } from 'vitest';
import { MIN_TIPPZIEL_PX, findeKleineTippziele, varianteHoehenAus } from '../touch-target-core.mjs';

/**
 * Ratsche für zu kleine Tippziele (AGENTS.md §4).
 *
 * §4 verlangt heute, dass JEDES Feature auf beiden Plattformen existiert, und
 * `check:platform-parity` prüft davon genau eine Form: eine Fläche, die auf
 * schmalen Breiten ganz fehlt. Was dort nie stand: Ein Bedienelement kann
 * vorhanden und trotzdem unbedienbar sein, weil sein Trefferbereich kleiner
 * ist als eine Fingerkuppe. Feature-Parität, die man nicht treffen kann, ist
 * keine.
 *
 * Bewusst eine RATSCHE und kein Verbot: Der Bestand ist zu gross für einen
 * Commit, und ein Wächter, der ab morgen jeden Commit blockiert, wird
 * abgeschaltet statt befolgt (dieselbe Begründung wie bei `check:view-data`).
 */

describe('findeKleineTippziele', () => {
  it('sollte eine ausdrücklich verkleinerte Schaltfläche melden', () => {
    const quelle = `<button className="h-8 w-8 rounded-full" onClick={x} />`;
    const funde = findeKleineTippziele(quelle, 'src/components/Karte.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(32);
    expect(funde[0].herkunft).toBe('klasse');
  });

  it('sollte size-8 wie h-8 lesen', () => {
    const quelle = `<button className="size-8" />`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')[0].px).toBe(32);
  });

  it('sollte einen Willkürwert in px lesen', () => {
    const quelle = `<button className="h-[36px]" />`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')[0].px).toBe(36);
  });

  it('sollte die Grenze selbst durchlassen — h-11 sind 44px', () => {
    const quelle = `<button className="h-11 w-11" />`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte ein min-h als Boden anerkennen', () => {
    const quelle = `<button className="h-8 min-h-[44px] flex-col" />`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte die Button-Variante size="icon" als 40px lesen', () => {
    const quelle = `<Button size="icon" variant="ghost" aria-label="Loeschen"><Trash2 /></Button>`;
    const funde = findeKleineTippziele(quelle, 'src/components/Karte.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(40);
    expect(funde[0].herkunft).toBe('variante');
  });

  it('sollte die Button-Variante size="sm" als 36px lesen', () => {
    const quelle = `<Button size="sm">Speichern</Button>`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')[0].px).toBe(36);
  });

  it('sollte eine per Klasse überschriebene Variante nach der Klasse bewerten', () => {
    const quelle = `<Button size="icon" className="h-11 w-11" aria-label="x"><X /></Button>`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte einen Button ohne Größenangabe NICHT zählen', () => {
    const quelle = `<Button variant="outline">Weiter</Button>`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte nicht-interaktive Elemente in Ruhe lassen', () => {
    const quelle = `<div className="h-8 w-8 rounded-full bg-muted" />`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte Verweise (a) mitzählen', () => {
    const quelle = `<a href="/x" className="h-8">mehr</a>`;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toHaveLength(1);
  });

  it('sollte Tests nicht prüfen', () => {
    const quelle = `<button className="h-8" />`;
    expect(findeKleineTippziele(quelle, 'src/components/__tests__/Karte.test.tsx')).toEqual([]);
  });

  it('sollte einen auskommentierten Entwurf nicht melden', () => {
    const quelle = `
      // frueher: <button className="h-8" />
      <button className="h-11" />
    `;
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte die Grenze exportieren', () => {
    expect(MIN_TIPPZIEL_PX).toBe(44);
  });

  it('sollte die uebergebenen Variantenhoehen benutzen statt einer eigenen Kopie', () => {
    const quelle = `<Button size="sm">Speichern</Button>`;
    // Mit den alten Hoehen ist `sm` 36 px und damit ein Fund ...
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx', { sm: 36 })).toHaveLength(1);
    // ... mit einem 44-px-Boden in button.tsx ist derselbe Aufruf sauber.
    expect(findeKleineTippziele(quelle, 'src/components/Karte.tsx', { sm: 44 })).toEqual([]);
  });
});

/**
 * Die Variantenhoehen kommen aus `ui/button.tsx` selbst.
 *
 * Vorher hielt der Waechter eine KOPIE (`{ default: 40, sm: 36, ... }`),
 * waehrend `touch-target-budget.json` daneben versprach, die 186 Fundstellen
 * seien „EINE Entscheidung ueber die Hoehen der Varianten in ui/button.tsx —
 * danach erreicht die Zahl 0". Einloesen liess sich das nicht: Wer die
 * Entscheidung traf, aenderte `button.tsx`; der Waechter las weiter seine
 * Kopie und zaehlte unveraendert 186. Eine Ratsche, die ihre eigene Behebung
 * nicht bemerken kann, misst nichts — sie haelt nur fest.
 */
describe('varianteHoehenAus', () => {
  const BUTTON_QUELLE = `
    const buttonVariants = cva("inline-flex items-center", {
      variants: {
        variant: { default: "bg-primary", ghost: "hover:bg-accent" },
        size: {
          default: "h-10 px-4 py-2 fokussiert:min-h-11",
          sm: "h-9 rounded-md px-3 fokussiert:min-h-11",
          lg: "h-11 rounded-md px-8",
          icon: "h-10 w-10 fokussiert:min-h-11 fokussiert:min-w-11",
        },
      },
    })`;

  it('sollte den Boden unter dem Finger messen, nicht die optische Hoehe', () => {
    // `h-9` sind 36 px mit der Maus — unter dem Daumen greift `min-h-11`.
    // Genau diese Zahl ist die Frage dieses Waechters.
    expect(varianteHoehenAus(BUTTON_QUELLE)).toEqual({
      default: 44,
      sm: 44,
      lg: 44,
      icon: 44,
    });
  });

  it('sollte ohne Boden die optische Hoehe melden', () => {
    const ohneBoden = `
      variants: {
        size: {
          default: "h-10 px-4 py-2",
          sm: "h-9 rounded-md px-3",
        },
      }`;
    expect(varianteHoehenAus(ohneBoden)).toEqual({ default: 40, sm: 36 });
  });

  it('sollte null liefern, wenn kein size-Block da ist — nicht still 0 messen', () => {
    // Der Aufrufer faellt dann auf die hinterlegten Ersatzwerte zurueck.
    // Stillschweigend 0 zu messen hiesse: Ratsche aus, ohne dass es auffaellt.
    expect(varianteHoehenAus('const x = 1;')).toBeNull();
  });
});

/**
 * Der blinde Fleck: Ein `>` im Attribut beendet das Tag nicht.
 *
 * Die erste Fassung nahm `indexOf('>')` fuer das Ende des oeffnenden Tags.
 * Eine Pfeilfunktion (`onClick={() => …}`) enthaelt aber ein `>`, und der
 * Attributausschnitt endete dort. Stand `className` DAHINTER — die uebliche
 * Reihenfolge —, sah der Waechter ihn nie.
 *
 * Gemessen betraf das 20 Bedienelemente in zehn Dateien, darunter die Farb-
 * und Symbolknoepfe des Kategorie-Formulars mit je 32 px. Die Ratsche stand
 * auf 0 und behauptete damit, es gebe keinen Rueckfall mehr.
 */
describe('Tag-Ende: ein `>` im Attribut zaehlt nicht', () => {
  it('[REGRESSION] sollte className hinter einer Pfeilfunktion noch sehen', () => {
    const quelle = `
      <button
        type="button"
        onClick={() => onColorChange(option.value)}
        className="w-8 h-8 rounded"
      />`;
    const funde = findeKleineTippziele(quelle, 'a.tsx');

    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(32);
  });

  it('[REGRESSION] sollte auch den Boden hinter einer Pfeilfunktion noch sehen', () => {
    // Die Gegenrichtung: Waere nur die Hoehe sichtbar und der Boden nicht,
    // meldete der Waechter jede behobene Stelle erneut — und Fehlalarme
    // schalten Waechter ab, statt sie durchzusetzen.
    const quelle = `
      <button
        onClick={() => tue()}
        className="w-8 h-8 fokussiert:min-h-11 fokussiert:min-w-11"
      />`;

    expect(findeKleineTippziele(quelle, 'a.tsx')).toEqual([]);
  });

  it('sollte ein `>` in einem Vergleich innerhalb des Attributs ueberstehen', () => {
    const quelle = `
      <button
        disabled={anzahl > 3}
        className="h-8"
      />`;

    expect(findeKleineTippziele(quelle, 'a.tsx')).toHaveLength(1);
  });

  it('sollte ein `>` in einer Zeichenkette ueberstehen', () => {
    const quelle = `
      <button
        aria-label="mehr > weniger"
        className="h-8"
      />`;

    expect(findeKleineTippziele(quelle, 'a.tsx')).toHaveLength(1);
  });

  it('sollte ein selbstschliessendes Tag ohne Attribute nicht verschlucken', () => {
    // Gegenprobe, dass die neue Suche nicht ueber das Tag hinauslaeuft und
    // Klassen des NAECHSTEN Elements mitliest.
    const quelle = `
      <button className="h-8" />
      <button className="min-h-[44px]" />`;

    expect(findeKleineTippziele(quelle, 'a.tsx')).toHaveLength(1);
  });
});
