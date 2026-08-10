/**
 * WP-9.6 — der Ausweg muss einer sein.
 *
 * `FinanceErrorState` macht `onRetry` zur Pflicht, weil eine Fehlermeldung
 * ohne nächsten Schritt eine Sackgasse ist. Genau diese Pflicht lässt sich
 * aber mit `onRetry={() => {}}` erfüllen, ohne sie einzulösen: Der Compiler
 * ist zufrieden, der Wächter `check:query-errors` auch — und der Nutzer
 * bekommt eine Schaltfläche, die nichts tut. Das ist schlechter als keine
 * Schaltfläche, weil sie einen Ausweg VERSPRICHT.
 *
 * Beim Abarbeiten des Phase-9-Backlogs ist genau das sechsmal passiert. Kein
 * Typ und kein bestehender Test konnte es sehen, deshalb liest dieser Test den
 * Quelltext.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import FinanceErrorState from '../FinanceErrorState';

const SRC = join(process.cwd(), 'src');

/** Ein `onRetry`, dessen Rumpf leer ist — in allen üblichen Schreibweisen. */
const SACKGASSE = /onRetry=\{\s*(?:\(\s*\)|_?\w*)\s*=>\s*(?:\{\s*\}|undefined|null|void 0)\s*\}/;

function alleQuelldateien(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      alleQuelldateien(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('FinanceErrorState', () => {
  it.each([
    ['de', 'Erneut versuchen'],
    ['en', 'Try again'],
  ])('sollte in %s einen Weg aus dem Fehler anbieten', (locale, label) => {
    renderWithI18n(<FinanceErrorState onRetry={() => undefined} />, locale as 'de' | 'en');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('[REGRESSION] sollte nirgends mit leerem onRetry aufgerufen werden', () => {
    const treffer: string[] = [];

    for (const datei of alleQuelldateien(SRC)) {
      const inhalt = readFileSync(datei, 'utf8');
      if (!inhalt.includes('FinanceErrorState')) continue;
      for (const [index, zeile] of inhalt.split('\n').entries()) {
        if (SACKGASSE.test(zeile)) {
          treffer.push(`${datei.slice(SRC.length + 1)}:${index + 1}`);
        }
      }
    }

    expect(
      treffer,
      'Ein leerer onRetry-Rumpf verspricht einen Ausweg, den es nicht gibt — ' +
        'stattdessen `refetch` der zugehoerigen Abfrage aufrufen.',
    ).toEqual([]);
  });
});
