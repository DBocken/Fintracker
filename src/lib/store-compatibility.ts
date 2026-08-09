/**
 * Rückwärtsgang für die lokale Ablage (WP-11.3) — reine Logik, kein I/O.
 *
 * **Das Loch, das hier geschlossen wird.** `LOCAL_STORE_SCHEMA_VERSION` gab es
 * seit Langem als Konstante mit einem Kommentar („damit ein späterer
 * Migrationshook erkennt, ob er laufen muss") — gelesen oder geschrieben hat
 * sie **niemand**. Sie war eine Absichtserklärung, kein Mechanismus.
 *
 * **Warum das gerade bei Rollback zählt.** Phase 11 nennt „Rollback". In einer
 * Cloud-App heisst das: alte Version wieder ausrollen, fertig — die Daten
 * liegen auf dem Server und der kennt sein Schema. Hier liegen sie auf dem
 * Gerät. Wird eine Auslieferung zurückgenommen, trifft eine **ältere** App auf
 * **neuere** Daten. Ohne Prüfung liest sie, was sie versteht, ignoriert den
 * Rest — und schreibt beim nächsten Speichern die unverstandenen Felder weg.
 * Das ist kein Absturz, sondern stiller Datenverlust, und er fällt erst
 * Wochen später auf.
 *
 * Deshalb gibt es genau drei Ausgänge, und einer davon ist „nicht anfassen".
 */

/**
 * Schema-Version des lokalen Finanzspeichers. Wird erhöht, sobald bestehende
 * Datenstrukturen migrationsbedürftig erweitert werden. Reine Neuanlage
 * weiterer Collections braucht keine Migration.
 *
 * Liegt bewusst hier (reine Logik) und nicht in `local-finance-store.ts`
 * (I/O-Service): Sowohl der synchrone Kompatibilitäts-Check bei jedem
 * Store-Zugriff als auch der asynchrone Migrationsläufer
 * (`src/services/local-store-migrations.ts`, WP 1.3) brauchen dieselbe Zahl —
 * eine Ablage in einem der beiden Services hätte den jeweils anderen zu einem
 * Import nach "oben" gezwungen. `local-finance-store.ts` re-exportiert die
 * Konstante weiterhin, damit bestehende Importe funktionsfähig bleiben.
 */
import { t } from '../i18n/serviceT';

export const LOCAL_STORE_SCHEMA_VERSION = 3;
export const LOCAL_STORE_SCHEMA_VERSION_KEY = 'ausgabentracker_store_schema_version';

export type StoreCompatibility =
  /** Gleicher Stand — nichts zu tun. */
  | { status: 'ok' }
  /** Ablage ist älter: Diese Version darf und muss sie hochziehen. */
  | { status: 'migrate'; from: number; to: number }
  /**
   * Ablage ist NEUER als diese Version. Nicht lesen, nicht schreiben, nicht
   * „so gut es geht". Ein Rollback darf Daten kosten, aber keine zerstören.
   */
  | { status: 'refuse'; stored: number; supported: number };

/**
 * Erstinstallation und beschädigter Eintrag laufen bewusst zusammen: In beiden
 * Fällen gibt es nichts zu retten, und ein Schreiben ist gefahrlos.
 */
export function parseStoredVersion(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export function checkStoreCompatibility(
  storedRaw: string | null,
  supported: number,
): StoreCompatibility {
  const stored = parseStoredVersion(storedRaw);

  // Kein Eintrag: entweder Erstinstallation oder eine Ablage aus der Zeit vor
  // dieser Prüfung. Beides ist Version 1 — die Alternative wäre, bestehende
  // Nutzer auszusperren, und das für eine Buchführung, die es längst gibt.
  if (stored === null) return supported === 1 ? { status: 'ok' } : { status: 'migrate', from: 1, to: supported };

  if (stored === supported) return { status: 'ok' };
  if (stored < supported) return { status: 'migrate', from: stored, to: supported };
  return { status: 'refuse', stored, supported };
}

/**
 * Der Fehler, den eine zu alte App wirft. Eigene Klasse, damit die Oberfläche
 * ihn von „Speicher kaputt" unterscheiden kann: Hier ist nichts kaputt, die
 * App ist nur die falsche.
 */
export class StoreVersionTooNewError extends Error {
  readonly stored: number;
  readonly supported: number;

  constructor(stored: number, supported: number) {
    super(`Lokale Daten haben Schema-Version ${stored}, diese App versteht ${supported}.`);
    this.name = 'StoreVersionTooNewError';
    this.stored = stored;
    this.supported = supported;
  }
}

/**
 * Der Fehler, den ein Store-Zugriff wirft, wenn echte Migrationsschritte
 * (`src/services/local-store-migrations.ts`) noch nicht gelaufen sind (WP 1.3).
 *
 * Warum werfen statt "so gut es geht" lesen: Sobald ein Schritt tatsächlich
 * die Datenform ändert, würde altes Code-Verständnis auf neu geformte Daten
 * (oder umgekehrt) treffen und stillschweigend falsche Werte liefern — genau
 * das Kriterium aus WP 1.3 verbietet das. Der Fehler ist bewusst von
 * `StoreVersionTooNewError` unterschieden: Hier ist die App die richtige
 * Version, nur der einmalige Migrationslauf beim Start ist noch nicht
 * (oder noch nicht erfolgreich) durchgelaufen — die Oberfläche kann das von
 * "Speicher kaputt" und "App zu alt" unterscheiden.
 */
export class StoreMigrationPendingError extends Error {
  readonly from: number;
  readonly to: number;

  constructor(from: number, to: number) {
    // Über i18n, nicht hartkodiert: Dieser Fehler kann den Nutzer erreichen
    // (App.tsx wirft ihn in den ErrorBoundary), anders als die
    // Entwicklermeldung von StoreVersionTooNewError darunter. Die
    // Allowlist deckt Altbestand, niemals Nachschub — `check:i18n --staged`
    // prüft geänderte Zeilen ohne Ausnahmeliste.
    super(
      t('storeCompatibility.migrationPending', 'Lokale Daten warten auf Migration.')
        .replace('{from}', String(from))
        .replace('{to}', String(to)),
    );
    this.name = 'StoreMigrationPendingError';
    this.from = from;
    this.to = to;
  }
}
