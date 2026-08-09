import {
  LOCAL_STORE_SCHEMA_VERSION,
  LOCAL_STORE_SCHEMA_VERSION_KEY,
  parseStoredVersion,
} from '@/lib/store-compatibility';
import type { Transaction } from '@/types';
import { quarterKeyForDate, type QuarterKey } from '@/lib/transaction-quarter';
import { writeTransactionChunk } from './transaction-chunk-store';
import { readLegacyV3Transactions } from './transaction-storage-service';
import { LOCAL_FINANCE_KEYS } from './local-storage-keys';
import { idbRemove } from './idb-kv';
import { LocalEncryptionLockedError, localEncryption } from './local-crypto';

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
 * WP 4.1c (PERF-1): v3-Transaktions-Blob → v4-Quartals-Chunks.
 *
 * Vorgabe: `docs/architecture/transaction-storage-chunks.md` (ADR, Abschnitt
 * "Migration") — verbindlich, nicht neu zu entscheiden. Reihenfolge:
 *
 * 1. v3-Blob lesen und validieren (`readLegacyV3Transactions`, dieselbe
 *    Item-Validierung wie überall, WP 1.2: kaputte Items werden übersprungen
 *    und gezählt, nie die ganze Liste verworfen).
 * 2. Nach Quartal gruppieren, Chunks EINZELN schreiben
 *    (`writeTransactionChunk` — schreibt je Aufruf zuerst den Chunk, danach
 *    dessen Index-Eintrag; s. dort).
 * 3. ERST DANACH den v3-Schlüssel entfernen. Das ist der "Zeiger", der
 *    bestimmt, welche Ablage die Wahrheit ist (dieselbe Disziplin wie beim
 *    PBKDF2-Rewrap in WP 3.1): Bricht der Lauf vorher ab, bleibt v3
 *    unverändert die Wahrheit — `transaction-storage-service.ts`
 *    (`hasLegacyV3Blob`) liest dann weiterhin darüber, und halb geschriebene
 *    Chunks werden beim nächsten (kompletten) Lauf überschrieben, nie
 *    gelesen (Vollesen bestimmt seine Chunk-Menge über `idbKeys()`, nicht
 *    aus dem — bei einem Abbruch potenziell unvollständigen — Index).
 */
async function migrateTransactionsToQuarterlyChunks(): Promise<void> {
  // Denk-mit-Frage (WP 4.1c): Der Läufer selbst startet in der App nur, wenn
  // der Tresor entweder deaktiviert oder entsperrt ist (`App.tsx`,
  // `readyForStoreMigration` wartet auf `!locked`) — ein Absturz beim Start
  // wäre schlimmer als eine verzögerte Migration. Dieser Schritt könnte
  // dennoch direkt aufgerufen werden (Tests, ein künftiger zweiter
  // Aufrufer); ein klarer, typisierter Fehler ist einem Absturz beim Lesen
  // vorzuziehen.
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  const transactions = await readLegacyV3Transactions();

  const byQuarter = new Map<QuarterKey, Transaction[]>();
  for (const transaction of transactions) {
    const quarter = quarterKeyForDate(transaction.date);
    const list = byQuarter.get(quarter);
    if (list) list.push(transaction);
    else byQuarter.set(quarter, [transaction]);
  }

  for (const [quarter, items] of byQuarter) {
    await writeTransactionChunk(quarter, items);
  }

  // Schritt 3: der Zeiger wird umgelegt. Beide Ablagen (localStorage-Rest aus
  // einer evtl. noch nicht gelaufenen Lazy-Migration UND IndexedDB) werden
  // entfernt — dasselbe Muster wie `transactionStorage.clearLocalCache()`.
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LOCAL_FINANCE_KEYS.transactions);
  await idbRemove(LOCAL_FINANCE_KEYS.transactions);
}

/** Die nummerierten strukturellen Migrationsschritte. */
export const migrations: StoreMigrationStep[] = [
  {
    toVersion: 3,
    name: 'transactions-blob-to-quarter-chunks',
    run: migrateTransactionsToQuarterlyChunks,
  },
];

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
