import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LOCALES } from '../translations';

/**
 * Parität für den Einzelunternehmer-Ausbau: Jeder Key, den Deutsch (Referenz)
 * im euer-Namespace und den EÜR-nahen Einzel-Keys hat, muss in ALLEN Locales
 * als String existieren — fehlende tlh/en-Strings werden zu Testfehlern statt
 * stiller Fallbacks.
 */

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Alle Blatt-Keys (Pfad-Notation) eines Teilbaums der Referenz-Locale. */
function leafKeys(node: unknown, prefix: string): string[] {
  if (typeof node === 'string') return [prefix];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('EÜR i18n Vollständigkeit (de = Referenz)', () => {
  it('[REGRESSION] sollte den kompletten euer-Namespace in allen Locales haben', () => {
    const reference = leafKeys(resolve('de', 'euer'), 'euer');
    expect(reference.length).toBeGreaterThan(30);
    for (const key of reference) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
      }
    }
  });

  it('[REGRESSION] sollte die EÜR-nahen Einzel-Keys in allen Locales haben', () => {
    const keys = [
      'nav.items.euer',
      'nav.subtitles.euer',
      'tax.euerPointer.title',
      'tax.euerPointer.body',
      'tax.rubric.betriebseinnahmen.name',
      'tax.rubric.betriebseinnahmen.hint',
      'budgetWaterfall.taxReserve',
      'budgets.waterfall.stepHints.taxReserve',
      'accounts.formDialog.businessLabel',
      'accounts.formDialog.businessHint',
      'accounts.manager.businessBadge',
      'taxReserveService.invalidAmount',
      'settings.businessMode.title',
      'settings.businessMode.description',
      'settings.businessMode.label',
    ];
    for (const key of keys) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
      }
    }
  });
});
