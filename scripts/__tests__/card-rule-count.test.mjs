/**
 * Die zwei Zähler der Karten-Ratsche.
 *
 * `analyzeCardRule` fragt je DATEI: Karten-Chrome vorhanden und nirgends ein
 * Klick-Signal? Eine Karte voller anklickbarer ZEILEN erfüllt das immer — und
 * genau die ist die tote Schachtel, die Prinzip 8 verbietet („niemals nur ein
 * verschachtelter Button in einer ansonsten toten Karte"). Gemessen auf der
 * Übersicht: `<Card>` umschliesst „Letzte Buchungen", angeklickt werden die
 * Zeilen darin, und der Wächter schwieg.
 *
 * Ob eine Karte „als Ganzes" klickbar ist, bleibt statisch unentscheidbar.
 * Entscheidbar ist die MENGE — und die ist das, was sinken muss.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeCardRule,
  zaehleKartenrahmen,
  zaehleBoxenInFokussiert,
} from '../card-rule-core.mjs';

const SEITE = 'src/pages/Uebersicht.tsx';
const FOKUSSIERT = 'src/features/coach/presentation/mobile/CoachFokussiert.tsx';

describe('zaehleKartenrahmen', () => {
  it('[REGRESSION] sollte die tote Karte um eine Liste anklickbarer Zeilen zählen', () => {
    // Der Befund von der Übersicht. `analyzeCardRule` schweigt hier, weil die
    // Datei ein Klick-Signal trägt — die Karte selbst ist trotzdem tot.
    const quelle = `
      <Card className="card-premium">
        <CardContent>
          <ul>{rows.map((r) => <li key={r.id} onClick={() => open(r)}>{r.name}</li>)}</ul>
        </CardContent>
      </Card>
    `;

    expect(analyzeCardRule(SEITE, quelle).violates).toBe(false);
    expect(zaehleKartenrahmen(SEITE, quelle)).toBe(1);
  });

  it('sollte InteractiveCard NICHT mitzählen — sie löst das Versprechen ein', () => {
    const quelle = `<InteractiveCard to="/debts">Schulden</InteractiveCard>`;
    expect(zaehleKartenrahmen(SEITE, quelle)).toBe(0);
  });

  it('sollte die Ad-hoc-Box mit bg-card mitzählen', () => {
    const quelle = `<div className="rounded-xl border bg-card p-4">Nur Text</div>`;
    expect(zaehleKartenrahmen(SEITE, quelle)).toBe(1);
  });

  it('sollte Kommentare nicht zählen', () => {
    // Dieselbe Lehre wie bei check:platform-parity: Ein Wächter, den man
    // durch Dokumentieren auslöst, erzieht zum Schweigen.
    const quelle = `
      // Vorher stand hier ein <Card> um die Liste.
      <ul />
    `;
    expect(zaehleKartenrahmen(SEITE, quelle)).toBe(0);
  });

  it('sollte Tests und die Baustein-Definitionen auslassen', () => {
    const quelle = `<Card />`;
    expect(zaehleKartenrahmen('src/pages/__tests__/X.test.tsx', quelle)).toBe(0);
    expect(zaehleKartenrahmen('src/components/ui/card.tsx', quelle)).toBe(0);
  });
});

describe('zaehleBoxenInFokussiert', () => {
  it('sollte in einer fokussierten Präsentation auch den Rahmen OHNE bg-card zählen', () => {
    // Regel 9 verbietet Boxen, nicht nur Karten: Auf einem Telefon erzeugt
    // schon der Rahmen eine Schachtelung, die es nicht gibt.
    const quelle = `<div className="rounded-lg border border-dashed p-6">Noch nichts</div>`;
    expect(zaehleBoxenInFokussiert(FOKUSSIERT, quelle)).toBe(1);
  });

  it('sollte eine Haarlinie erlauben', () => {
    // `border-t` trennt, es umschliesst nicht — ausdrücklich erlaubt.
    const quelle = `<section className="border-t border-border/60 pt-5">Frei bis Gehalt</section>`;
    expect(zaehleBoxenInFokussiert(FOKUSSIERT, quelle)).toBe(0);
  });

  it('sollte ein Bedienelement nicht als Box lesen', () => {
    // Ein Knopf mit Rundung und Rahmen ist ein Knopf. Ihn mitzuzählen hiesse,
    // jede Registerleiste zum Befund zu machen — und ein Wächter mit
    // Fehlalarmen wird abgeschaltet statt befolgt.
    const quelle = `<button className="min-h-11 rounded-lg border px-2">Status</button>`;
    expect(zaehleBoxenInFokussiert(FOKUSSIERT, quelle)).toBe(0);
  });

  it('sollte ausserhalb fokussierter Präsentationen nichts zählen', () => {
    const quelle = `<div className="rounded-xl border p-4">Kompakt darf</div>`;
    expect(zaehleBoxenInFokussiert('src/pages/Uebersicht.tsx', quelle)).toBe(0);
    expect(zaehleBoxenInFokussiert('src/features/coach/presentation/desktop/X.tsx', quelle)).toBe(0);
  });
});
