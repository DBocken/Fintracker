import { SUPPORTED_LOCALES, type Locale } from './translations';

export interface LocaleOption {
  value: Locale;
  flag: string;
  /**
   * Endonym — der Name der Sprache in ihrer eigenen Sprache. Bewusst NICHT
   * über `t()` übersetzt: eine Sprachauswahl muss auch dann lesbar sein, wenn
   * man die gerade aktive Sprache nicht versteht. Das ist der Sinn der Liste.
   */
  label: string;
  /** Übersetzter Name für Fließtext/Beschriftungen außerhalb der Auswahl. */
  labelKey: string;
}

const LOCALE_META: Record<Locale, Omit<LocaleOption, 'value'>> = {
  de: { flag: '🇩🇪', label: 'Deutsch', labelKey: 'settings.languageGerman' },
  en: { flag: '🇬🇧', label: 'English', labelKey: 'settings.languageEnglish' },
  tlh: { flag: '⚔️', label: 'tlhIngan Hol', labelKey: 'settings.languageKlingon' },
  ru: { flag: '🇷🇺', label: 'Русский', labelKey: 'settings.languageRussian' },
};

/**
 * Einzige Quelle für jeden Sprachwähler (Header-Dropdown, Einstellungen).
 * Leitet sich aus `SUPPORTED_LOCALES` ab — eine Sprache aktivieren oder
 * deaktivieren ist damit eine Änderung an genau einer Stelle statt an dreien.
 */
export const LOCALE_OPTIONS: LocaleOption[] = SUPPORTED_LOCALES.map((value) => ({
  value,
  ...LOCALE_META[value],
}));
