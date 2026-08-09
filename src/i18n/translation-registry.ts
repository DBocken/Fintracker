import { de } from './translations/de';
import { DEFAULT_LOCALE, type Locale } from './locale';

export type { TranslationTree } from './translations/de';

/**
 * Lade-/Cache-Schicht für Sprachbäume (WP 4.5 / PERF-3).
 *
 * `de` ist der einzige STATISCH gebundene Baum — er ist `DEFAULT_LOCALE` und
 * zugleich der garantierte Fallback (AGENTS.md §6: „fehlt ein Overlay-Eintrag,
 * greift der Basistext" — dieselbe Zusicherung gilt jetzt auch, solange die
 * eigentliche Zielsprache noch nicht geladen ist). `en`/`ru`/`tlh` hängen NUR
 * an `import()` — das ist die Grenze, an der Vite/Rollup einen eigenen Chunk
 * bildet, der nicht im Startbündel landet.
 *
 * Bewusst KEIN Suspense: die Zielsprache zu laden, während schon gerendert
 * wird, ist kein Fehlerfall, den man werfen/fangen müsste — der Nutzer soll
 * NICHT auf einen leeren Screen warten. Solange der Chunk unterwegs ist,
 * liefert `readLocale()` `de` zurück (das ist exakt der bestehende
 * Overlay-Fallback-Mechanismus, nur eine Ebene höher). Sobald der Chunk da
 * ist, erhöht sich `version`; `I18nProvider` abonniert das über
 * `useSyncExternalStore` und rendert neu — die Sprache wechselt dann
 * sichtbar nach, ohne dass der Start darauf gewartet hätte.
 *
 * Nachgeladene Bäume sind bewusst locker typisiert (`LoadedTree`, nicht das
 * strikte `TranslationTree`): `walkPath` (I18nProvider.tsx) nimmt ohnehin nur
 * `unknown` entgegen, und `tlh` ist strukturell unvollständig — es ist
 * `INACTIVE_LOCALES`, taucht deshalb in keiner Paritätsprüfung auf und darf
 * das nach `docs/qualitaet-2026-08` auch bleiben. Ein striktes
 * `TranslationTree` hier würde `tlh` zu Unrecht als Typfehler zeigen, obwohl
 * sich am Laufzeitverhalten nichts ändert. Für `en`/`ru` (SUPPORTED_LOCALES)
 * sichert `locale-parity.test.ts` die Vollständigkeit weiterhin — nur eben
 * als Test, nicht als Compile-Zeit-Zwang.
 */
type LoadedTree = Record<string, unknown>;

const cache: Partial<Record<Locale, LoadedTree>> = { de };
const pending = new Map<Locale, Promise<LoadedTree>>();

/**
 * Dynamische Importe je Locale. `tlh` ist absichtlich enthalten — geladen
 * wird es trotzdem nie automatisch, weil `resolveInitialLocale`/`isLocale`
 * (I18nProvider.tsx) nur `SUPPORTED_LOCALES` akzeptieren und `tlh` dort nicht
 * auftaucht (`INACTIVE_LOCALES`). Erst eine ausdrückliche Reaktivierung in
 * `SUPPORTED_LOCALES` würde den Ladepfad überhaupt erreichbar machen.
 */
const LOADERS: Partial<Record<Locale, () => Promise<LoadedTree>>> = {
  en: () => import('./translations/en').then((m) => m.en),
  ru: () => import('./translations/ru').then((m) => m.ru),
  tlh: () => import('./translations/tlh').then((m) => m.tlh),
};

let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  listeners.forEach((fn) => fn());
}

/** `useSyncExternalStore`-Abonnement: wird nach jedem erfolgreich geladenen Chunk benachrichtigt. */
export function subscribeLocaleVersion(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Snapshot für `useSyncExternalStore` — ändert sich genau dann, wenn `readLocale` für irgendeine Sprache einen neuen Baum liefern würde. */
export function getLocaleVersion(): number {
  return version;
}

/**
 * Stößt das Laden einer Sprache an, falls nötig, und liefert die (neue oder
 * bereits laufende) Promise dafür zurück — `undefined`, wenn sie schon im
 * Cache steht (nichts zu tun) oder es keinen Lader dafür gibt.
 */
function startLoading(locale: Locale): Promise<LoadedTree> | undefined {
  if (cache[locale]) return undefined;

  const loader = LOADERS[locale];
  if (!loader) return undefined; // unbekannte/nicht ladbare Sprache

  if (!pending.has(locale)) {
    const promise = loader().then((tree) => {
      cache[locale] = tree;
      pending.delete(locale);
      bump();
      return tree;
    });
    pending.set(locale, promise);
  }
  return pending.get(locale);
}

/**
 * Liest den Baum einer Sprache synchron. Ist sie noch nicht geladen, wird der
 * Ladevorgang angestoßen (idempotent — parallele Aufrufe teilen sich dieselbe
 * Promise) und `undefined` zurückgegeben; der Aufrufer entscheidet über den
 * Fallback (siehe `readLocaleOrFallback`).
 */
export function readLocale(locale: Locale): LoadedTree | undefined {
  const hit = cache[locale];
  if (hit) return hit;
  startLoading(locale);
  return undefined;
}

/**
 * Wie `readLocale`, aber mit Fallback auf `DEFAULT_LOCALE` (immer synchron
 * verfügbar), solange die Zielsprache noch nicht eingetroffen ist.
 */
export function readLocaleOrFallback(locale: Locale): LoadedTree {
  return readLocale(locale) ?? cache[DEFAULT_LOCALE]!;
}

/**
 * Wartet, bis eine Sprache vollständig geladen ist, statt nur den Ladevorgang
 * anzustoßen. Zwei Verwender:
 *
 * 1. Tests (`vitest.setup.ts`): der Testlauf soll — anders als der Startpfad
 *    im Browser — ALLE Sprachen deterministisch synchron verfügbar sehen,
 *    unabhängig davon, welcher Test zuerst eine Sprache anfragt.
 * 2. Optionales Prefetching in der App (z. B. Sprachwähler-Hover), damit der
 *    tatsächliche Wechsel ohne sichtbare de-Fallback-Lücke passiert.
 *
 * Bereits geladene Sprachen lösen sofort auf.
 */
export function preloadLocale(locale: Locale): Promise<LoadedTree> {
  const hit = cache[locale];
  if (hit) return Promise.resolve(hit);
  return startLoading(locale) ?? Promise.resolve(cache[DEFAULT_LOCALE]!);
}

/**
 * Ausschließlich für Tests: verwirft alles außer `de` aus dem Cache und
 * setzt Ladezustand/Version zurück, damit ein Test wieder im „noch nicht
 * geladen"-Zustand startet — genau dem Fenster, das `vitest.setup.ts`s
 * Preload für den Rest der Suite absichtlich schließt (siehe Kommentar dort
 * und `__tests__/translation-lazy-loading.test.ts`, die einzige Datei, die
 * diese Funktion aufruft).
 */
export function resetTranslationCacheForTests(): void {
  for (const key of Object.keys(cache) as Locale[]) {
    if (key !== DEFAULT_LOCALE) delete cache[key];
  }
  pending.clear();
  version = 0;
}
