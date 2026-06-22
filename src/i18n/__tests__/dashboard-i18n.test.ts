import { describe, it, expect } from 'vitest';
import { translations } from '@/i18n/translations';
import { lookupTranslation } from '@/i18n/I18nProvider';

/**
 * Stellt sicher, dass alle Dashboard- und Transaktions-Strings in beide Sprachen übersetzt sind.
 */
describe('Dashboard & Transactions i18n-Abdeckung', () => {
  it('sollte alle dashboard.* Keys in DE & EN haben', () => {
    const deKeys = Object.keys(translations.de.dashboard || {});
    const enKeys = Object.keys(translations.en.dashboard || {});
    expect(enKeys.sort()).toEqual(deKeys.sort());
  });

  it('sollte alle transactions.* Keys in DE & EN haben', () => {
    const deKeys = Object.keys(translations.de.transactions || {});
    const enKeys = Object.keys(translations.en.transactions || {});
    expect(enKeys.sort()).toEqual(deKeys.sort());
  });

  it('sollte tatsächlich unterschiedliche Texte für DE und EN liefern', () => {
    if (translations.de.dashboard?.selectAll && translations.en.dashboard?.selectAll) {
      expect(lookupTranslation('de', 'dashboard.selectAll')).not.toBe(
        lookupTranslation('en', 'dashboard.selectAll'),
      );
    }
  });
});
