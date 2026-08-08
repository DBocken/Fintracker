import {
  LOCAL_STORE_SCHEMA_VERSION,
  LOCAL_STORE_SCHEMA_VERSION_KEY,
  parseStoredVersion,
} from '@/lib/store-compatibility';

/**
 * Echter Migrationsläufer für `LOCAL_STORE_SCHEMA_VERSION` (WP 1.3, RES-3).
 *
 * **Das Loch, das hier geschlossen wird.** `assertCompatibleStore()` in
 * `local-finance-store.ts` prüfte bei jedem Store-Zugriff die Version — der
 * `'migrate'`-Zweig schrieb aber nur die Zahl fest, transformierte nichts.
 * Strukturänderungen persistierter Daten (WP 4.1: Transaktions-Blob →
 * Monats-Chunks) hatten damit keinen Ort, an dem sie laufen konnten.
 *
 * **Warum eine eigene, asynchrone Funktion und nicht mehr Logik in
 * `assertCompatibleStore()`.** Diese Prüfung ist synchron und läuft bei
 * JEDEM Store-Zugriff (bewusst so — ein Rollback passiert zwischen zwei
 * Besuchen, nicht beim Start, siehe Kommentar dort). Eine Migration ist
 * dagegen asynchron (liest/schreibt IndexedDB, ggf. Crypto) und darf GENAU
 * EINMAL laufen. Beides in eine Funktion zu pressen, hieße entweder jeden
 * synchronen Zugriff async zu machen (bricht die App an tausend Stellen) oder
 * eine asynchrone Migration nebenläufig mehrfach anzustoßen. Deshalb: dieser
 * Läufer läuft einmal beim App-Start (siehe `App.tsx`), `assertCompatibleStore()`
 * fragt nur noch `hasPendingStoreMigrations()`, um zu wissen, ob echte
 * Schritte aussteht — sind keine definiert (heutiger Stand), bleibt sie beim
 * bisherigen harmlosen Verhalten (Version direkt festschreiben, nichts zu tun).
 *
 * **Die bestehenden Lazy-Feld-Migrationen** in `local-settings-service.ts`
 * (`migrateParentIds`, `backfillAusgabenklasse`, …) bleiben unberührt — sie
 * hängen an keinem Versionszähler und laufen weiter bei jedem Lesen. Nur NEUE
 * *strukturelle* Migrationen (die die Form einer ganzen Collection ändern)
 * gehen künftig über diesen Läufer.
 *
 * **Version wird je Schritt geschrieben, nicht am Ende.** Bricht die Kette
 * mittendrin ab (Tab geschlossen, Absturz, ein Schritt wirft), bleibt der
 * gespeicherte Stand auf der zuletzt erfolgreich abgeschlossenen Version
 * stehen — lesbar, und ein erneuter Lauf macht genau dort weiter.
 */
export interface StoreMigrationStep {
  /** Zielversion, die dieser Schritt herstellt. */
  readonly toVersion: number;
  /** Sprechender Name für Logs/Fehlermeldungen — kein UI-Text, kein i18n nötig. */
  readonly name: string;
  /** Die eigentliche Transformation. Darf synchron oder asynchron sein. */
  run(): Promise<void> | void;
}

/**
 * Die nummerierten strukturellen Migrationsschritte.
 *
 * Heute bewusst LEER: `LOCAL_STORE_SCHEMA_VERSION` steht auf 2, aber dieser
 * Sprung (von der impliziten "Version 1" ohne Marker) war die Einführung des
 * Markers selbst (WP-11.3), keine Strukturänderung — es gibt nichts zu
 * transformieren. `runStoreMigrations()` behandelt eine Lücke ohne jeden
 * definierten Schritt deshalb als "nichts zu tun" und schreibt die Zielversion
 * direkt fest (siehe dort).
 *
 * WP 4.1 (Transaktions-Blob → Monats-Chunks) trägt den ersten echten Schritt
 * ein — das Eintragen ist ein Einzeiler:
 *
 * ```ts
 * export const migrations: StoreMigrationStep[] = [
 *   {
 *     toVersion: 3,
 *     name: 'Transaktionen: Blob -> Monats-Chunks',
 *     run: async () => { ... },
 *   },
 * ];
 * ```
 *
 * (und `LOCAL_STORE_SCHEMA_VERSION` in `@/lib/store-compatibility` auf 3
 * anheben).
 */
export const migrations: StoreMigrationStep[] = [];

/**
 * Gibt es für den Bereich `(storedVersion, targetVersion]` mindestens einen
 * definierten Schritt? Reine Frage, kein I/O — von `assertCompatibleStore()`
 * (synchron, bei jedem Zugriff) UND vom Läufer selbst genutzt, damit beide
 * dieselbe Definition von "ausstehend" teilen.
 */
export function hasPendingStoreMigrations(
  storedVersion: number,
  targetVersion: number,
  steps: readonly StoreMigrationStep[] = migrations,
): boolean {
  return steps.some((step) => step.toVersion > storedVersion && step.toVersion <= targetVersion);
}

/**
 * Führt alle ausstehenden Migrationsschritte lückenlos aus, in Reihenfolge
 * der Zielversion, jeden genau einmal. Schreibt die erreichte Version nach
 * JEDEM erfolgreichen Schritt — ein Abbruch mittendrin hinterlässt einen
 * lesbaren Store auf dem zuletzt erfolgreichen Stand, kein "von vorn" und
 * kein "als wäre alles fertig".
 *
 * Ein zweiter Lauf, wenn der gespeicherte Stand bereits der Zielversion
 * entspricht, tut nichts (Idempotenz).
 *
 * @param steps Testbarkeit: synthetische Listen statt der echten `migrations`.
 * @param targetVersion Testbarkeit: synthetische Zielversion statt
 *   `LOCAL_STORE_SCHEMA_VERSION`.
 * @param versionKey Testbarkeit: eigener localStorage-Key statt
 *   `LOCAL_STORE_SCHEMA_VERSION_KEY`, damit Tests sich nicht gegenseitig den
 *   echten Marker überschreiben.
 */
export async function runStoreMigrations(
  steps: readonly StoreMigrationStep[] = migrations,
  targetVersion: number = LOCAL_STORE_SCHEMA_VERSION,
  versionKey: string = LOCAL_STORE_SCHEMA_VERSION_KEY,
): Promise<void> {
  if (typeof window === 'undefined') return;

  const storedRaw = localStorage.getItem(versionKey);
  let current = parseStoredVersion(storedRaw) ?? 1;

  if (current >= targetVersion) {
    // Bereits aktuell (oder neuer — das ist Sache von assertCompatibleStore /
    // StoreVersionTooNewError, nicht dieses Läufers). Nur fehlenden Marker
    // nachtragen, sonst nichts anfassen.
    if (storedRaw === null) localStorage.setItem(versionKey, String(current));
    return;
  }

  const relevant = steps
    .filter((step) => step.toVersion > current && step.toVersion <= targetVersion)
    .sort((a, b) => a.toVersion - b.toVersion);

  let expected = current + 1;
  for (const step of relevant) {
    if (step.toVersion !== expected) {
      throw new Error(
        // Bewusst englischer Entwicklertext und KEIN i18n-Schluessel: Das ist
        // ein Autorenfehler in dieser Datei (eine Luecke in der Schrittliste),
        // kein Zustand, in den ein Nutzer geraten kann. Ein uebersetzter Text
        // wuerde eine Nutzerlage vortaeuschen, die es nicht gibt.
        `Migration gap: no step defined for version ${expected} (next defined step is "${step.name}" to version ${step.toVersion}).`,
      );
    }
    await step.run();
    current = step.toVersion;
    localStorage.setItem(versionKey, String(current));
    expected += 1;
  }

  if (current < targetVersion) {
    // Kein einziger Schritt für den (restlichen) Bereich definiert — wie beim
    // heutigen Sprung 1 -> 2 gibt es strukturell nichts zu tun.
    current = targetVersion;
    localStorage.setItem(versionKey, String(current));
  }
}
