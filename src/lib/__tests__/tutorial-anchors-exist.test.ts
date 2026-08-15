import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TUTORIAL_STEPS } from '../tutorial-steps';

/**
 * [REGRESSION] Statischer Abgleich: jeder in `TUTORIAL_STEPS` verwendete
 * Anker (`anchor`/`openAnchor`) muss als `data-tour-id="…"` irgendwo unter
 * `src/` tatsächlich vorkommen.
 *
 * Ein fehlender Anker zur LAUFZEIT wird von `useAnchorRect` bewusst
 * abgefangen (der Schritt erscheint dann nur unverankert, mittig) — das ist
 * gewollte Resilienz gegen Refactorings, nicht Beliebigkeit. Dieser Test
 * fängt trotzdem die Klasse Fehler, die sonst niemand bemerkt: ein Tippfehler
 * im Anker-String, oder ein Anker, der beim Schreiben des Schritts nie
 * tatsächlich im Component ergänzt wurde. Beides macht den Schritt für IMMER
 * unverankert, ohne dass beim Schreiben irgendetwas rot wird.
 */
function collectDataTourIds(dir: string, found: Set<string>): void {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectDataTourIds(full, found);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    const content = readFileSync(full, 'utf8');
    // Erfasst sowohl `data-tour-id="x"` als auch bedingte Werte wie
    // `data-tour-id={cond ? 'x' : undefined}` — genommen wird das erste
    // Stringliteral nach dem Attribut, bis zum Ende des Tags.
    const regex = /data-tour-id=[^>]*?['"]([\w-]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      found.add(match[1]);
    }
  }
}

describe('Tutorial-Anker existieren wirklich (statischer Abgleich)', () => {
  it('sollte jeden verwendeten Anker als data-tour-id im Quelltext finden', () => {
    const srcRoot = join(__dirname, '..', '..');
    const present = new Set<string>();
    collectDataTourIds(srcRoot, present);

    const used = new Set<string>();
    for (const steps of Object.values(TUTORIAL_STEPS)) {
      for (const step of steps ?? []) {
        if (step.anchor) used.add(step.anchor);
        if (step.openAnchor) used.add(step.openAnchor);
      }
    }

    const missing = [...used].filter((id) => !present.has(id));
    expect(missing).toEqual([]);
  });
});
