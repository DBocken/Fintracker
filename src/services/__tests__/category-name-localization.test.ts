import { describe, it, expect, afterEach } from 'vitest';
import { backfillCategoryNameKeys } from '@/lib/category-migrations';
import { localizeCategories } from '../local-settings-service';
import { DEFAULT_LOCAL_CATEGORIES } from '@/lib/default-categories';
import { REGEX_FALLBACK_RULES } from '@/data/merchant-keywords';
import type { Category } from '@/types';

/**
 * Kategorienamen sind BESCHRIFTUNGEN und folgen der Sprache; die Stichwörter in
 * `filters` sind SUCHMUSTER gegen deutschen Kontoauszugstext und dürfen niemals
 * übersetzt werden. Diese Trennung ist der Kern dieser Tests — eine übersetzte
 * `filters`-Liste würde die automatische Kategorisierung stillschweigend
 * zerstören.
 */

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

function setLocale(locale: string) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

afterEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
});

const lebensmittel = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-lebensmittel');
const supermarkt = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-supermarkt');

describe('Lokalisierbare Kategorienamen', () => {
  it('Test-Fixtures: Standard-Kategorien tragen einen name_key', () => {
    expect(lebensmittel?.name).toBe('Lebensmittel');
    expect(lebensmittel?.name_key).toBe('categoryNames.lebensmittel.name');
    expect(supermarkt?.filters.length).toBeGreaterThan(0);
  });

  it('[REGRESSION] sollte den Anzeigenamen der Sprache folgen lassen', () => {
    setLocale('de');
    expect(localizeCategories([lebensmittel!])[0].name).toBe('Lebensmittel');

    setLocale('en');
    expect(localizeCategories([lebensmittel!])[0].name).toBe('Groceries');

    setLocale('ru');
    expect(localizeCategories([lebensmittel!])[0].name).toBe('Продукты');
  });

  it('[REGRESSION] sollte die Such-Stichwoerter in JEDER Sprache unveraendert lassen', () => {
    // Der wichtigste Wächter: `filters` matchen deutschen Kontoauszugstext.
    // Eine Übersetzung würde die automatische Kategorisierung zerstören.
    const original = [...supermarkt!.filters];
    for (const locale of ['de', 'en', 'ru']) {
      setLocale(locale);
      const [localized] = localizeCategories([supermarkt!]);
      expect(localized.filters, `filters @ ${locale}`).toEqual(original);
    }
  });

  it('[REGRESSION] sollte eine umbenannte Kategorie nicht mehr uebersetzen', () => {
    // name_key === null heißt: die Nutzerin hat entschieden.
    const renamed: Category = { ...lebensmittel!, name: 'Mein Einkauf', name_key: null };
    setLocale('en');
    expect(localizeCategories([renamed])[0].name).toBe('Mein Einkauf');
  });

  it('sollte selbst angelegte Kategorien unberuehrt lassen', () => {
    const own: Category = { id: 'local-cat-custom-1', name: 'Pferdestall', filters: [] };
    setLocale('en');
    expect(localizeCategories([own])[0].name).toBe('Pferdestall');
  });

  it('sollte bei fehlendem Key auf den gespeicherten Namen zurueckfallen', () => {
    const unknown: Category = {
      id: 'local-cat-weg',
      name: 'Alter Name',
      name_key: 'categoryNames.gibtesnicht.name',
      filters: [],
    };
    setLocale('en');
    expect(localizeCategories([unknown])[0].name).toBe('Alter Name');
  });
});

describe('backfillCategoryNameKeys', () => {
  it('[REGRESSION] sollte unveraenderten Standard-Kategorien den Key nachtragen', () => {
    const stored: Category[] = [{ id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] }];
    const { categories, changed } = backfillCategoryNameKeys(stored);
    expect(changed).toBe(true);
    expect(categories[0].name_key).toBe('categoryNames.lebensmittel.name');
  });

  it('[REGRESSION] sollte umbenannte Standard-Kategorien in Ruhe lassen', () => {
    const stored: Category[] = [{ id: 'local-cat-lebensmittel', name: 'Essen', filters: [] }];
    const { categories, changed } = backfillCategoryNameKeys(stored);
    expect(changed).toBe(false);
    expect(categories[0].name_key).toBeUndefined();
    expect(categories[0].name).toBe('Essen');
  });

  it('sollte selbst angelegte Kategorien in Ruhe lassen', () => {
    const stored: Category[] = [{ id: 'local-cat-custom-9', name: 'Pferdestall', filters: [] }];
    const { changed } = backfillCategoryNameKeys(stored);
    expect(changed).toBe(false);
  });

  it('sollte nicht erneut schreiben, wenn der Key bereits gesetzt ist', () => {
    // `changed` steuert, ob die verschlüsselte Liste neu geschrieben wird (F-CAT).
    const stored: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', name_key: 'categoryNames.lebensmittel.name', filters: [] },
    ];
    expect(backfillCategoryNameKeys(stored).changed).toBe(false);
  });

  it('sollte ein explizites null (bewusst umbenannt) respektieren', () => {
    const stored: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', name_key: null, filters: [] },
    ];
    expect(backfillCategoryNameKeys(stored).changed).toBe(false);
  });
});

describe('Fallback-Regeln', () => {
  it('[INTEGRITY] sollte Kategorien ueber die stabile ID adressieren, nicht ueber den Namen', () => {
    // Vorher wurde auf den Anzeigenamen gematcht — das brach sowohl bei einer
    // Umbenennung als auch (seit der Lokalisierung) in jeder anderen Sprache.
    const ids = new Set(DEFAULT_LOCAL_CATEGORIES.map((c) => c.id));
    for (const rule of REGEX_FALLBACK_RULES) {
      expect(ids.has(`local-cat-${rule.categorySlug}`), rule.categorySlug).toBe(true);
    }
  });
});
