import { describe, it, expect } from 'vitest';
import { getFeatureCopy } from '../feature-copy';
import { FEATURES, type FeatureKey } from '@/lib/tier';
import { translations, SUPPORTED_LOCALES } from '@/i18n/translations';

/**
 * [REGRESSION] Der Wortlaut jeder gesperrten Funktion muss in JEDER Sprache
 * existieren.
 *
 * Dieser Test leuchtet einen blinden Fleck aus, den es sonst nirgends gibt:
 * `getFeatureCopy` setzt seine Schlüssel dynamisch zusammen
 * (`upsell.features.${feature}.title`). `call-site-keys.test.ts` kann solche
 * Aufrufe grundsätzlich nicht auflösen und zählt sie nur; die Locale-Parität
 * prüft die Sprachbäume gegeneinander, nicht gegen die Menge der
 * `FeatureKey`s. Fehlt also ein Eintrag in ALLEN Sprachen gleichermaßen,
 * fällt er keinem der beiden auf.
 *
 * Genau so ist es passiert: `upsell.features.specialCategories` fehlte
 * vollständig, und `/transactions` zeigte Freinutzern statt der Upgrade-Story
 * die rohen Punkt-Strings. Aufgefallen ist das per Hand, nicht durch einen
 * Test — deshalb dieser hier.
 */
function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const ALL_FEATURES = Object.keys(FEATURES) as FeatureKey[];

describe('Wortlaut gesperrter Funktionen', () => {
  it('sollte jeden FeatureKey kennen — sonst stünden rohe Schlüssel im UI', () => {
    const missing: string[] = [];
    for (const feature of ALL_FEATURES) {
      for (const locale of SUPPORTED_LOCALES) {
        for (const part of ['title', 'eyebrow', 'benefit1', 'benefit2', 'benefit3']) {
          const key = `upsell.features.${feature}.${part}`;
          if (typeof resolve(locale, key) !== 'string') missing.push(`${locale}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('sollte Titel und drei Nutzenpunkte liefern, nicht den rohen Schlüssel', () => {
    // `t()` gibt bei unbekanntem Schlüssel den Schlüssel zurück — ein Ergebnis,
    // das noch wie ein Punkt-Pfad aussieht, ist also ein Fehlschlag und kein
    // Text.
    for (const feature of ALL_FEATURES) {
      const copy = getFeatureCopy((key) => {
        const value = resolve('de', key);
        return typeof value === 'string' ? value : key;
      }, feature);

      expect(copy.title, feature).not.toMatch(/^upsell\./);
      expect(copy.eyebrow, feature).not.toMatch(/^upsell\./);
      expect(copy.benefits, feature).toHaveLength(3);
      for (const benefit of copy.benefits) {
        expect(benefit, feature).not.toMatch(/^upsell\./);
      }
    }
  });
});
