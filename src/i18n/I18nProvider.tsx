import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './locale';
import { readLocaleOrFallback, subscribeLocaleVersion, getLocaleVersion } from './translation-registry';
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
 *
 * WP 4.5 / PERF-3: `locale` ist evtl. noch nicht geladen (nur `de` ist
 * statisch gebunden) — `readLocaleOrFallback` liefert dann synchron den
 * deutschen Baum zurück und stößt das Nachladen im Hintergrund an. Sobald der
 * Chunk eintrifft, sorgt `subscribeLocaleVersion` (siehe `I18nProvider`
 * unten) für einen Re-Render, der hier automatisch den echten Baum liest.
 */
export function lookupTranslation(locale: Locale, key: string): string | undefined {
  const node = walkPath(readLocaleOrFallback(locale), key);
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

  // WP 4.5 / PERF-3: `en`/`ru`/`tlh` sind nur per `import()` verfügbar. Bis der
  // Chunk der aktiven Sprache eintrifft, liefert `t()` den de-Fallback
  // (`lookupTranslation`/`readLocaleOrFallback`). Dieses Abonnement erzwingt
  // eine neue `value`-Referenz, SOBALD der Chunk da ist — sonst würde der
  // Context-Value trotz neuer Übersetzungsdaten unverändert bleiben und
  // Consumer würden nie neu rendern (React vergleicht Context-Konsum über die
  // Referenz von `value`, nicht über ihren Inhalt).
  const localeVersion = useSyncExternalStore(subscribeLocaleVersion, getLocaleVersion, getLocaleVersion);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return lookupWorded(locale, key, wording) ?? fallback ?? key;
    },
    [locale, wording],
  );

  const value = useMemo<I18nContextValue>(() => {
    // Siehe Kommentar bei `localeVersion` oben — bewusst referenziert, nicht
    // weil der Wert selbst gebraucht wird, sondern um die Memoisierung bei
    // jedem nachgeladenen Sprach-Chunk aufzubrechen.
    void localeVersion;
    return { locale, setLocale, t, wording, setWording };
  }, [locale, setLocale, t, wording, setWording, localeVersion]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
