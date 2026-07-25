import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LOCALES } from '../translations';
import { SUPPORTED_WORDINGS, BASE_WORDING } from '../wording';
import { overlayFor } from '../overlays';

/**
 * Wächter für die Alltagssprache-Overlays.
 *
 * Ein Overlay führt NIE einen neuen Key ein — es ersetzt nur den Wert eines
 * Keys, den der Basisbaum schon hat. Diese Tests halten das fest, damit ein
 * Overlay nicht still an der Basis vorbeiwächst.
 */

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Menge der `{platzhalter}` eines Strings. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** Wert eines punktierten Keys innerhalb eines Overlays. */
function valueAt(overlay: object, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], overlay);
}

/** Alle vorhandenen Overlays als (wording, locale, overlay)-Tripel. */
function allOverlays() {
  const out: Array<{ wording: string; locale: string; overlay: object }> = [];
  for (const wording of SUPPORTED_WORDINGS) {
    for (const locale of SUPPORTED_LOCALES) {
      const overlay = overlayFor(wording, locale);
      if (overlay) out.push({ wording, locale, overlay });
    }
  }
  return out;
}

describe('Alltagssprache-Overlays', () => {
  it('sollte für das Basis-Register kein Overlay besitzen', () => {
    // Der Basisbaum IST die Fachsprache — ein Overlay dafür wäre eine
    // zweite Wahrheit über denselben Text.
    for (const locale of SUPPORTED_LOCALES) {
      expect(overlayFor(BASE_WORDING, locale)).toBeUndefined();
    }
  });

  it('sollte für jeden Overlay-Key einen Basis-String haben', () => {
    const orphans: string[] = [];
    for (const { wording, locale, overlay } of allOverlays()) {
      for (const key of leafKeys(overlay)) {
        if (typeof resolve(locale, key) !== 'string') {
          orphans.push(`${key} @ ${locale}/${wording}`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('sollte dieselben Platzhalter wie der Basistext verwenden', () => {
    // `replaceTemplate` (format.ts) ersetzt einen unbekannten Platzhalter still
    // durch "" — aus einem vertippten {monat} statt {month} wird "Noch  Tage",
    // ohne Fehler und ohne Warnung. Deshalb ist das der wertvollste Wächter.
    const mismatches: string[] = [];
    for (const { wording, locale, overlay } of allOverlays()) {
      for (const key of leafKeys(overlay)) {
        const base = resolve(locale, key);
        const value = valueAt(overlay, key);
        if (typeof base !== 'string' || typeof value !== 'string') continue;
        const expected = placeholders(base);
        const actual = placeholders(value);
        if (expected.join('|') !== actual.join('|')) {
          mismatches.push(`${key} @ ${locale}/${wording}: erwartet [${expected}], gefunden [${actual}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('sollte sich vom Basistext unterscheiden, wo ein Eintrag existiert', () => {
    // Ein Overlay-Eintrag, der den Basistext wiederholt, ist toter Ballast und
    // täuscht Abdeckung vor.
    const identical: string[] = [];
    for (const { wording, locale, overlay } of allOverlays()) {
      for (const key of leafKeys(overlay)) {
        const base = resolve(locale, key);
        if (typeof base === 'string' && base === valueAt(overlay, key)) {
          identical.push(`${key} @ ${locale}/${wording}`);
        }
      }
    }
    expect(identical).toEqual([]);
  });
});
