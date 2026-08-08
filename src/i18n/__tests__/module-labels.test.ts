import { describe, it, expect, afterEach } from 'vitest';
import { SKINS } from '@/skins/skins';
import { KPI_DEFINITIONS } from '@/lib/kpi-definitions';
import { SUPPORTED_LOCALES } from '../translations';
import { lookupTranslation } from '../I18nProvider';
import { t } from '../serviceT';

/**
 * Beschriftungen, die in `.ts`-Modulen statt in Komponenten stehen.
 *
 * Zwei getrennte Anliegen:
 * 1. Die Keys existieren in allen auswählbaren Sprachen.
 * 2. Ein Sprachwechsel wirkt NACH dem Import. Das ist der eigentliche Grund für
 *    das `labelKey`-Muster: `SKINS` und `KPI_DEFINITIONS` sind Modul-`const`.
 *    Stünde dort ein `t()`-Aufruf, würde er einmal beim Import aufgelöst und
 *    ein späterer Sprachwechsel bliebe wirkungslos.
 */

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

afterEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
});

describe('Beschriftungen aus .ts-Modulen', () => {
  it('sollte für jedes Theme Name und Beschreibung in allen Locales haben', () => {
    const missing: string[] = [];
    for (const skin of SKINS) {
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of [skin.nameKey, skin.descriptionKey]) {
          if (typeof lookupTranslation(locale, key) !== 'string') {
            missing.push(`${key} @ ${locale}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('sollte für jede Kennzahl die Beschriftung in allen Locales haben', () => {
    const missing: string[] = [];
    for (const kpi of KPI_DEFINITIONS) {
      for (const locale of SUPPORTED_LOCALES) {
        if (typeof lookupTranslation(locale, kpi.labelKey) !== 'string') {
          missing.push(`${kpi.labelKey} @ ${locale}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('sollte den deutschen Text als Fallback behalten', () => {
    // Der literale Wert bleibt im Modul stehen, damit ein fehlender Key nicht
    // den rohen Schlüssel auf den Bildschirm bringt.
    for (const skin of SKINS) {
      expect(skin.name.length).toBeGreaterThan(0);
      expect(skin.description.length).toBeGreaterThan(0);
    }
  });

  it('[REGRESSION] sollte einen Sprachwechsel NACH dem Modul-Import beruecksichtigen', () => {
    // Genau der Fehler, den das labelKey-Muster verhindert: waere die
    // Uebersetzung in der Modul-`const` aufgeloest, lieferten beide Aufrufe
    // denselben Text.
    const ruhe = SKINS.find((s) => s.id === 'ruhe');
    expect(ruhe).toBeDefined();

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'de');
    const german = t(ruhe!.nameKey, ruhe!.name);

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const english = t(ruhe!.nameKey, ruhe!.name);

    expect(german).toBe('Ruhe');
    expect(english).toBe('Calm');
    expect(german).not.toBe(english);
  });

  it('sollte Eigennamen in allen Sprachen gleich lassen', () => {
    // "Cyberpunk" ist ein Eigenname, kein uebersetzbares Wort — identische
    // Werte ueber die Locales sind hier Absicht.
    const cyberpunk = SKINS.find((s) => s.id === 'cyberpunk');
    expect(cyberpunk).toBeDefined();
    for (const locale of SUPPORTED_LOCALES) {
      expect(lookupTranslation(locale, cyberpunk!.nameKey)).toBe('Cyberpunk');
    }
  });
});
