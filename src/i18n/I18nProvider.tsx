import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translations,
  type Locale,
} from './translations';
import {
  BASE_WORDING,
  WORDING_STORAGE_KEY,
  resolveInitialWording,
  type Wording,
} from './wording';
import { overlayFor } from './overlays';

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  /** Aktueller Sprachstil — Alltags- oder Fachsprache. */
  wording: Wording;
  setWording: (wording: Wording) => void;
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

/** Läuft einen punktierten Schlüssel in einem beliebigen Übersetzungsbaum ab. */
function walkPath(root: unknown, key: string): unknown {
  let node: unknown = root;
  for (const segment of key.split('.')) {
    if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return node;
}

/**
 * Tiefen-Lookup eines punktierten Schlüssels in der Übersetzungstabelle.
 * Liefert immer den Basistext (= Fachsprache). Signatur und Verhalten bleiben
 * bewusst unverändert: würde diese Funktion das Register mit auflösen, wechselten
 * `serviceT` und bestehende Tests still mit.
 */
export function lookupTranslation(locale: Locale, key: string): string | undefined {
  const node = walkPath(translations[locale], key);
  return typeof node === 'string' ? node : undefined;
}

/**
 * Register-bewusster Lookup: erst das Overlay des Sprachstils, sonst die Basis.
 * Ein Overlay-Miss ist der Normalfall und kein Fehler — Register `technical`
 * und Locales ohne Overlay fallen vollständig auf `lookupTranslation` zurück.
 */
export function lookupWorded(
  locale: Locale,
  key: string,
  wording: Wording,
): string | undefined {
  if (wording !== BASE_WORDING) {
    const overlay = overlayFor(wording, locale);
    if (overlay) {
      const hit = walkPath(overlay, key);
      if (typeof hit === 'string') return hit;
    }
  }
  return lookupTranslation(locale, key);
}

export function I18nProvider({
  children,
  initialLocale,
  initialWording,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialWording?: Wording;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? resolveInitialLocale());
  const [wording, setWordingState] = useState<Wording>(
    () => initialWording ?? resolveInitialWording(),
  );

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

  const setWording = useCallback((next: Wording) => {
    setWordingState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WORDING_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return lookupWorded(locale, key, wording) ?? fallback ?? key;
    },
    [locale, wording],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, wording, setWording }),
    [locale, setLocale, t, wording, setWording],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
