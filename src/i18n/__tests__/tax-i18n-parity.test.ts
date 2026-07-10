import { describe, it, expect } from 'vitest';
import { translations, SUPPORTED_LOCALES } from '../translations';
import { TAX_RUBRICS, TAX_CATEGORIES } from '@/data/tax-catalog';

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe('Tax i18n Vollständigkeit', () => {
  it('[REGRESSION] sollte jede Rubrik-name/-hint in allen Locales als String haben', () => {
    for (const rubric of TAX_RUBRICS) {
      for (const key of [rubric.nameKey, rubric.hintKey]) {
        for (const locale of SUPPORTED_LOCALES) {
          expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
        }
      }
    }
  });

  it('[REGRESSION] sollte jeden Kategorie-name (und ggf. -hint) in allen Locales als String haben', () => {
    for (const cat of TAX_CATEGORIES) {
      const keys = [cat.nameKey, ...(cat.hintKey ? [cat.hintKey] : [])];
      for (const key of keys) {
        for (const locale of SUPPORTED_LOCALES) {
          expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
        }
      }
    }
  });

  it('[REGRESSION] sollte die zentralen tax.*-Bereiche in allen Locales haben', () => {
    const keys = [
      'tax.page.title',
      'tax.page.rechenweg',
      'tax.page.creditExact',
      'tax.form.sectionTitle',
      'tax.commute.title',
      'tax.export.button',
      'tax.disclaimer.long',
      'tax.anlage.N',
      'tax.suggestReason.keyword',
      'nav.items.tax',
      'nav.subtitles.tax',
    ];
    for (const key of keys) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof resolve(locale, key), `${key} @ ${locale}`).toBe('string');
      }
    }
  });
});
