import { describe, expect, it } from 'vitest';
import { MIN_TIPPZIEL_PX, findeKleineTippziele } from '../touch-target-core.mjs';

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
});
