import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, getBottomNavItems } from '@/components/layout/nav-config';
import { translations, SUPPORTED_LOCALES } from '@/i18n/translations';
import { lookupTranslation } from '@/i18n/I18nProvider';

/**
 * Stellt sicher, dass jede Navigations-Beschriftung einen Übersetzungs-Key hat,
 * der in ALLEN unterstützten Sprachen aufgelöst werden kann. Verhindert, dass
 * der Sprach-Toggle Teile der Navigation unübersetzt lässt.
 */
describe('Navigation i18n-Abdeckung', () => {
  describe('Normal Behavior', () => {
    it('sollte für jede Nav-Gruppe einen labelKey in allen Sprachen haben', () => {
      for (const group of NAV_GROUPS) {
        expect(group.labelKey, `Gruppe ${group.id} ohne labelKey`).toBeTruthy();
        for (const locale of SUPPORTED_LOCALES) {
          expect(
            lookupTranslation(locale, group.labelKey!),
            `${group.labelKey} fehlt in ${locale}`,
          ).toBeTruthy();
        }
      }
    });

    it('sollte für jeden Nav-Eintrag einen labelKey in allen Sprachen haben', () => {
      const items = NAV_GROUPS.flatMap((g) => g.items);
      for (const item of items) {
        expect(item.labelKey, `Eintrag ${item.path} ohne labelKey`).toBeTruthy();
        for (const locale of SUPPORTED_LOCALES) {
          expect(
            lookupTranslation(locale, item.labelKey!),
            `${item.labelKey} fehlt in ${locale}`,
          ).toBeTruthy();
        }
      }
    });

    it('sollte Untertitel-Keys (falls vorhanden) in allen Sprachen auflösen', () => {
      const items = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.subtitleKey);
      for (const item of items) {
        for (const locale of SUPPORTED_LOCALES) {
          expect(
            lookupTranslation(locale, item.subtitleKey!),
            `${item.subtitleKey} fehlt in ${locale}`,
          ).toBeTruthy();
        }
      }
    });

    it('sollte für jeden Bottom-Nav-Eintrag einen shortLabelKey in allen Sprachen haben', () => {
      for (const item of getBottomNavItems()) {
        expect(item.shortLabelKey, `Bottom-Nav ${item.path} ohne shortLabelKey`).toBeTruthy();
        for (const locale of SUPPORTED_LOCALES) {
          expect(
            lookupTranslation(locale, item.shortLabelKey!),
            `${item.shortLabelKey} fehlt in ${locale}`,
          ).toBeTruthy();
        }
      }
    });
  });

  describe('Übersetzungs-Konsistenz', () => {
    it('sollte tatsächlich unterschiedliche Texte für DE und EN liefern (Stichprobe)', () => {
      // Beweis, dass der Toggle sichtbar wirkt: zentrale Begriffe unterscheiden sich.
      expect(lookupTranslation('de', 'nav.items.debts')).not.toBe(
        lookupTranslation('en', 'nav.items.debts'),
      );
      expect(lookupTranslation('de', 'shell.search')).not.toBe(
        lookupTranslation('en', 'shell.search'),
      );
    });

    it('sollte identische Key-Struktur in DE und EN haben (keine fehlenden Keys)', () => {
      const collectKeys = (obj: unknown, prefix = ''): string[] => {
        if (typeof obj !== 'object' || obj === null) return [prefix];
        return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
          collectKeys(v, prefix ? `${prefix}.${k}` : k),
        );
      };
      const deKeys = collectKeys(translations.de).sort();
      const enKeys = collectKeys(translations.en).sort();
      expect(enKeys).toEqual(deKeys);
    });
  });
});
