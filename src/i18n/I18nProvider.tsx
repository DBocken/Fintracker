import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translations,
  type Locale,
} from './translations';

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value);
}

/** Bestimmt die Startsprache: gespeicherte Wahl → Browser-Sprache → Default. */
export function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const browser = window.navigator?.language?.slice(0, 2).toLowerCase();
  if (isLocale(browser)) return browser;
  return DEFAULT_LOCALE;
}

/** Tiefen-Lookup eines punktierten Schlüssels in der Übersetzungstabelle. */
export function lookupTranslation(locale: Locale, key: string): string | undefined {
  const segments = key.split('.');
  let node: unknown = translations[locale];
  for (const segment of segments) {
    if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return lookupTranslation(locale, key) ?? fallback ?? key;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
