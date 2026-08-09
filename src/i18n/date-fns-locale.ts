import { de as deDateFnsLocale } from 'date-fns/locale/de';
import type { Locale as DateFnsLocale } from 'date-fns';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { resolveInitialLocale } from './I18nProvider';

/**
 * Lade-/Cache-Schicht für `date-fns`-Locale-Objekte — Pendant zu
 * `translation-registry.ts` (WP 4.5 / PERF-3), nur für Wochentags-/Monats-
 * namen statt Übersetzungstexte (WP 5.5b).
 *
 * Hintergrund: Vor WP 5.5b verdrahtete jede Aufrufstelle `format(...)` fest
 * mit `{ locale: de }` (`date-fns/locale`) — ein englischer Nutzer sah
 * trotzdem „Mi" statt „Wed" im Wochentagskürzel. Diese Datei ist die EINE
 * Stelle, die das `date-fns`-Locale aus der App-Sprache ableitet, statt es
 * je Aufrufstelle zu importieren.
 *
 * `de` ist bewusst STATISCH gebunden (wie `de` in `translation-registry.ts`):
 * es ist `DEFAULT_LOCALE` und der garantierte Fallback, solange die Ziel-
 * sprache noch nicht geladen ist. `en`/`ru` hängen nur an `import()` — NICHT
 * am Barrel `date-fns/locale`, das alle ~100 Locales in einen einzigen Chunk
 * zöge, sondern über die schlanken Re-Export-Module in `./date-fns-locales/`
 * (nicht direkt `date-fns/locale/en-US` bzw. `/ru`): der von Rollup daraus
 * gebildete Chunk-Name würde sonst mit dem gleichnamigen i18n-Sprachbaum-
 * Chunk aus `translation-registry.ts` kollidieren — Begründung im
 * Kopfkommentar von `./date-fns-locales/enUSLocale.ts`.
 * `tlh` hat kein `date-fns`-Locale; da `resolveInitialLocale`/`isLocale`
 * (I18nProvider.tsx) ohnehin nur `SUPPORTED_LOCALES` (`de`/`en`/`ru`)
 * liefern, wird `tlh` hier nie angefragt (siehe auch `LOADERS` unten, das
 * `tlh` konsequent ausspart).
 */

const cache: Partial<Record<Locale, DateFnsLocale>> = { de: deDateFnsLocale };
const pending = new Map<Locale, Promise<DateFnsLocale>>();

const LOADERS: Partial<Record<Locale, () => Promise<DateFnsLocale>>> = {
  en: () => import('./date-fns-locales/enUSLocale').then((m) => m.enUS),
  ru: () => import('./date-fns-locales/ruLocale').then((m) => m.ru),
};

let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  listeners.forEach((fn) => fn());
}

/** `useSyncExternalStore`-Abonnement: wird nach jedem geladenen Locale-Chunk benachrichtigt. */
export function subscribeDateFnsLocaleVersion(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Snapshot für `useSyncExternalStore`. */
export function getDateFnsLocaleVersion(): number {
  return version;
}

function startLoading(locale: Locale): Promise<DateFnsLocale> | undefined {
  if (cache[locale]) return undefined;

  const loader = LOADERS[locale];
  if (!loader) return undefined; // unbekannt/nicht ladbar (z. B. tlh)

  if (!pending.has(locale)) {
    const promise = loader().then((loaded) => {
      cache[locale] = loaded;
      pending.delete(locale);
      bump();
      return loaded;
    });
    pending.set(locale, promise);
  }
  return pending.get(locale);
}

/**
 * Liest das `date-fns`-Locale-Objekt einer Sprache synchron. Ist sie noch
 * nicht geladen, wird das Laden angestoßen und `undefined` zurückgegeben —
 * der Aufrufer entscheidet über den Fallback (siehe `readDateFnsLocaleOrFallback`).
 */
export function readDateFnsLocale(locale: Locale): DateFnsLocale | undefined {
  const hit = cache[locale];
  if (hit) return hit;
  startLoading(locale);
  return undefined;
}

/**
 * Wie `readDateFnsLocale`, aber mit Fallback auf `DEFAULT_LOCALE` (immer
 * synchron verfügbar), solange die Zielsprache noch nicht eingetroffen ist.
 */
export function readDateFnsLocaleOrFallback(locale: Locale): DateFnsLocale {
  return readDateFnsLocale(locale) ?? cache[DEFAULT_LOCALE]!;
}

/**
 * Für Code ohne React-Kontext (`src/services/`, `src/lib/`,
 * `transaction-day-groups.ts` u. Ä.) — Pendant zu `serviceT` (`t()` aus
 * `src/i18n/serviceT.ts`): liest die aktive Sprache bei jedem Aufruf frisch
 * aus demselben Weg wie `serviceT` (`resolveInitialLocale`, localStorage).
 */
export function resolveDateFnsLocale(): DateFnsLocale {
  return readDateFnsLocaleOrFallback(resolveInitialLocale());
}

/**
 * Wartet, bis das `date-fns`-Locale-Objekt einer Sprache vollständig
 * geladen ist, statt nur das Laden anzustoßen — Pendant zu `preloadLocale`
 * (`translation-registry.ts`). Verwender: `vitest.setup.ts` (deterministisches
 * Vorladen für die MEHRHEIT der Suite) — siehe
 * `__tests__/date-fns-locale-lazy-loading.test.ts` für das Fenster, das
 * dieses Vorladen bewusst wieder aufhebt.
 */
export function preloadDateFnsLocale(locale: Locale): Promise<DateFnsLocale> {
  const hit = cache[locale];
  if (hit) return Promise.resolve(hit);
  return startLoading(locale) ?? Promise.resolve(cache[DEFAULT_LOCALE]!);
}

/**
 * Ausschließlich für Tests: verwirft alles außer `de` aus dem Cache und
 * setzt Ladezustand/Version zurück, damit ein Test wieder im „noch nicht
 * geladen"-Zustand startet — genaue Entsprechung zu
 * `resetTranslationCacheForTests()` (`translation-registry.ts`). Einziger
 * Aufrufer: `__tests__/date-fns-locale-lazy-loading.test.ts`.
 */
export function resetDateFnsLocaleCacheForTests(): void {
  for (const key of Object.keys(cache) as Locale[]) {
    if (key !== DEFAULT_LOCALE) delete cache[key];
  }
  pending.clear();
  version = 0;
}

/**
 * Wochentagskürzel-Format-Token, locale-bewusst statt einheitlich (Review zu
 * WP 5.5b): `EEEEEE` (date-fns „short", 2-stellig) liefert für Deutsch
 * („Mi") und Russisch („пт") genau die im jeweiligen Sprachraum übliche
 * Kurzform — für Englisch aber nur „We" statt der gewohnten 3-stelligen
 * Abkürzung („Wed"). Nur Englisch bekommt deshalb `EEE` („abbreviated",
 * 3-stellig); Deutsch und Russisch bleiben beim angestammten `EEEEEE` und
 * damit optisch UNVERÄNDERT gegenüber dem Stand vor WP 5.5b — der Auftrag
 * verlangte nur, dass das Kürzel der App-Sprache folgt, keine sichtbare
 * Änderung für deutsche oder russische Bestandsnutzer.
 */
export function weekdayAbbrevToken(locale: Locale): 'EEE' | 'EEEEEE' {
  return locale === 'en' ? 'EEE' : 'EEEEEE';
}
