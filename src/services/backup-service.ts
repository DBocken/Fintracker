import { getCurrentUserId } from './auth-service';
import { t } from '../i18n/serviceT';
import { logger } from '@/utils/logger';
import type { Category, Account, UserSettings } from '../types';
import {
  getCategories,
  getAllTransactions,
  getUserSettings,
  saveTransactions,
  updateUserSettings,
} from './transaction-service';
import { LOCAL_USER_ID, restoreLocalCategories } from './local-settings-service';
import { createAccount, getAccounts } from './account-service';
import {
  encryptJsonWithPassword,
  decryptJsonWithPassword,
  type EncryptedEnvelopeV1,
} from './local-crypto';
import {
  mutateLocalFinanceList,
  LOCAL_FINANCE_KEYS,
  readLocalFinanceList,
  type LocalFinanceKey,
} from './local-finance-store';
import { validateCollectionItems } from '@/lib/schemas/collection-schemas';
import { canonicalJsonStringify } from '@/lib/stable-json';

/**
 * Collections, die bereits typisiert in `data` liegen (Transaktionen/Konten)
 * bzw. nicht im lokalen Finanz-Store leben (Kategorien/Einstellungen). Sie
 * werden NICHT zusätzlich generisch gesichert, um Doppelungen zu vermeiden.
 */
const TYPED_BACKUP_KEYS = new Set<string>(['transactions', 'accounts']);

function isLocalFinanceKey(key: string): key is LocalFinanceKey {
  return Object.prototype.hasOwnProperty.call(LOCAL_FINANCE_KEYS, key);
}

/** Broker-Zugangsdaten, die nie im Klartext (unverschlüsseltes Backup) landen dürfen. */
const PORTFOLIO_SECRET_FIELDS = ['apiKey', 'userKey'];

/**
 * Gibt eine Kopie der Backup-Daten zurück, in der die Broker-Zugangsdaten
 * (eToro apiKey/userKey in portfolios.provider_config) entfernt sind. Wird nur
 * für den UNVERSCHLÜSSELTEN Export genutzt; verschlüsselte Backups behalten sie
 * (dort sind sie geschützt). Wiederhergestellte Portfolios müssen dann neu
 * verbunden werden (T1.10 / F-DEBT-1).
 */
export function redactPortfolioSecrets(data: BackupData): BackupData {
  const portfolios = data.collections?.portfolios;
  if (!Array.isArray(portfolios)) return data;

  const redacted = portfolios.map((p) => {
    const entry = p as { provider_config?: Record<string, unknown> };
    if (!entry.provider_config) return p;
    const cfg = { ...entry.provider_config };
    let touched = false;
    for (const field of PORTFOLIO_SECRET_FIELDS) {
      if (field in cfg) {
        delete cfg[field];
        touched = true;
      }
    }
    return touched ? { ...entry, provider_config: cfg } : p;
  });

  return { ...data, collections: { ...data.collections, portfolios: redacted } };
}

/**
 * Snapshot ALLER übrigen lokalen Collections (Schulden, Forderungen, Akten,
 * Budgets, Meilensteine, Zuordnungen …). Früher fehlten diese im Backup —
 * eine Wiederherstellung verlor sie still. Jetzt vollständig.
 */
export async function snapshotLocalCollections(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const key of Object.keys(LOCAL_FINANCE_KEYS) as LocalFinanceKey[]) {
    if (TYPED_BACKUP_KEYS.has(key)) continue;
    out[key] = await readLocalFinanceList<unknown>(key);
  }
  return out;
}

function itemId(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const id = (item as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Stellt die generischen Collections wieder her — NICHT-destruktiver Merge per
 * stabiler `id`: vorhandene Einträge bleiben unverändert, fehlende Backup-Items
 * werden ergänzt. Ein erneuter Restore desselben Backups erzeugt keine Duplikate.
 */
export async function restoreLocalCollections(
  collections: Record<string, unknown[]> | undefined,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  if (!collections) return results;

  for (const [key, items] of Object.entries(collections)) {
    if (!isLocalFinanceKey(key) || TYPED_BACKUP_KEYS.has(key)) continue;
    if (!Array.isArray(items) || items.length === 0) continue;

    // Serialisiert (Issue #311): Ein Restore läuft neben der laufenden App —
    // eine gleichzeitige Nutzeraktion auf derselben Collection ginge sonst
    // unter, und zwar ausgerechnet beim Wiederherstellen von Daten.
    let additionCount = 0;
    await mutateLocalFinanceList<unknown>(key, (current) => {
      const existingIds = new Set(current.map(itemId).filter((id): id is string => id !== null));
      const additions = items.filter((item) => {
        const id = itemId(item);
        return id !== null && !existingIds.has(id);
      });
      additionCount = additions.length;
      return additions.length === 0 ? current : [...current, ...additions];
    });

    if (additionCount === 0) continue;
    results[key] = additionCount;
  }
  return results;
}

/**
 * Prüfsumme über die Backup-Nutzlast (WP 1.5, RES-5). Deckt bewusst nur
 * `data` + `collections` ab — die eigentlichen wiederherstellbaren
 * Finanzdaten — nicht `version`/`timestamp`/`userId`: Diese Metadaten dürfen
 * sich zwischen Export und einer späteren Prüfung ändern (z. B. Zeitstempel-
 * Normalisierung), ohne dass ein unverändertes Backup als "manipuliert" gilt.
 */
export interface BackupChecksum {
  algorithm: 'sha256';
  /** Hex-kodierter SHA-256-Digest über die kanonisierte (schlüsselsortierte) Nutzlast. */
  value: string;
}

/**
 * Complete backup data structure
 */
export interface BackupData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    transactions: import('../types').Transaction[];
    categories: Category[];
    accounts: Account[];
    settings: UserSettings;
  };
  /**
   * Alle übrigen lokalen Collections (Schulden, Forderungen, Akten, Budgets,
   * Meilensteine, Zuordnungen …), generisch nach Store-Key. Optional für
   * Abwärtskompatibilität mit Backups vor v1.1.
   */
  collections?: Record<string, unknown[]>;
  /**
   * SHA-256-Prüfsumme über `data`+`collections` (WP 1.5, RES-5). Optional für
   * Abwärtskompatibilität mit Backups vor v1.2 — ein Backup OHNE Prüfsumme
   * bleibt importierbar (siehe {@link verifyBackupChecksum}), nur mit
   * Hinweis. Ein Nutzer, dessen einziges (altes) Backup deswegen abgelehnt
   * würde, hätte durch diese Änderung Daten verloren statt gewonnen.
   */
  checksum?: BackupChecksum;
}

/** Nutzlast, über die {@link computeBackupChecksum} hasht. */
type BackupPayload = Pick<BackupData, 'data' | 'collections'>;

/**
 * Berechnet die SHA-256-Prüfsumme über die Backup-Nutzlast. Kanonisiert die
 * Nutzlast vorher über `canonicalJsonStringify` (Schlüssel rekursiv
 * sortiert), damit die Prüfsumme gegen harmlose Neuordnung der JSON-Schlüssel
 * stabil ist und nur auf tatsächliche Inhaltsänderungen reagiert.
 * `collections` wird dabei auf `{}` normalisiert, wenn nicht gesetzt — ein
 * Backup mit `collections: undefined` und eines mit `collections: {}` sind
 * inhaltlich gleich und müssen dieselbe Prüfsumme ergeben.
 */
export async function computeBackupChecksum(payload: BackupPayload): Promise<string> {
  const canonical = canonicalJsonStringify({ data: payload.data, collections: payload.collections ?? {} });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type BackupChecksumVerification = 'ok' | 'missing' | 'mismatch';

/**
 * Verifiziert die Prüfsumme eines Backups gegen seine Nutzlast (WP 1.5,
 * RES-5). Reine, unabhängig testbare Funktion — kein Zugriff auf
 * die Nutzer-Auflösung/Storage, daher ohne Auth-Mock testbar.
 *
 * - `'missing'`: kein `checksum`-Feld (Backup vor v1.2) — Aufrufer entscheidet,
 *   ob trotzdem importiert wird (ja, mit Hinweis — Vorentschieden #2).
 * - `'mismatch'`: Prüfsumme vorhanden, passt aber nicht zur Nutzlast —
 *   Nutzlast ist beschädigt oder wurde verändert.
 * - `'ok'`: Prüfsumme passt.
 */
export async function verifyBackupChecksum(backup: Pick<BackupData, 'data' | 'collections' | 'checksum'>): Promise<BackupChecksumVerification> {
  if (!backup.checksum) return 'missing';
  const expected = await computeBackupChecksum({ data: backup.data, collections: backup.collections });
  return expected === backup.checksum.value ? 'ok' : 'mismatch';
}

/** Aktuelle Backup-Formatversion. Modul-Konstante statt Klassenfeld (siehe {@link isVersionCompatible}). */
export const BACKUP_VERSION = '1.2.0';

/**
 * Prüft Backup-Strukturkompatibilität rein über die Major-Version (WP 1.5,
 * RES-5 — bewusst Major-basiert, siehe Vorentschieden #4: ein Minor-Sprung
 * darf neue, optionale Felder mitbringen, ohne alte Backups abzulehnen).
 *
 * War bis WP 1.5 eine `private`-Methode von `BackupService` — von außen
 * nicht testbar, obwohl der Vergleich selbst kein internen Zustand braucht.
 * Jetzt eine eigenständige Modul-Funktion (wie `isForeignBackup` daneben):
 * kein Grund, dafür eine Instanz zu erzeugen oder die Nutzer-Auflösung zu
 * mocken, nur um diese eine Zeile zu testen.
 */
export function isVersionCompatible(backupVersion: string, currentVersion: string = BACKUP_VERSION): boolean {
  const [major] = backupVersion.split('.').map(Number);
  const [currentMajor] = currentVersion.split('.').map(Number);
  return major === currentMajor;
}

/**
 * Liefert einen lokalisierten Warnhinweis, wenn Backup- und aktuelle Version
 * denselben Major-Stand haben, sich aber im Minor unterscheiden — sonst
 * `null`. Ergänzt `isVersionCompatible` (Vorentschieden #4): Kompatibilität
 * bleibt Major-basiert, ein Minor-Unterschied lehnt nichts ab, verdient aber
 * einen Hinweis (neuere/ältere App-Version könnte Felder anders befüllen).
 */
export function getVersionMinorMismatchWarning(
  backupVersion: string,
  currentVersion: string = BACKUP_VERSION,
): string | null {
  const [, backupMinor] = backupVersion.split('.').map(Number);
  const [, currentMinor] = currentVersion.split('.').map(Number);
  if (!Number.isFinite(backupMinor) || !Number.isFinite(currentMinor) || backupMinor === currentMinor) {
    return null;
  }
  return t(
    'backup.service.versionMinorMismatch',
    'Die Backup-Version {backupVersion} unterscheidet sich von der aktuellen Version {currentVersion} — einzelne Felder könnten fehlen oder abweichen.',
  )
    .replace('{backupVersion}', backupVersion)
    .replace('{currentVersion}', currentVersion);
}

/**
 * Prüft die Top-Level-Struktur eines Backups (WP 1.2/1.5). War bis WP 1.5
 * eine `private`-Methode von `BackupService` — siehe Begründung bei
 * {@link isVersionCompatible}, dieselbe Testbarkeits-Lücke, dieselbe Lösung.
 */
export function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    !!d.version &&
    !!d.timestamp &&
    !!d.userId &&
    !!d.data &&
    typeof d.data === 'object' &&
    Array.isArray((d.data as Record<string, unknown>).transactions) &&
    Array.isArray((d.data as Record<string, unknown>).categories) &&
    Array.isArray((d.data as Record<string, unknown>).accounts) &&
    typeof (d.data as Record<string, unknown>).settings === 'object'
  );
}

export type EncryptedBackupFileV1 = {
  type: 'ausgabentracker.backup.enc';
  v: 1;
  timestamp: string;
  payload: EncryptedEnvelopeV1;
};

/**
 * Prüft, ob ein Backup einem anderen Konto gehört. Reine Funktion für die
 * UI-Vorwarnung und Tests (Issue #30).
 */
export function isForeignBackup(backup: Pick<BackupData, 'userId'>, currentUserId: string): boolean {
  return !!backup.userId && backup.userId !== currentUserId;
}

/**
 * Verhältnis der Besitzer-Kennung eines Backups zur aktuellen Kennung.
 *
 * `isForeignBackup` daneben kennt nur „gleich/ungleich" — und genau das war
 * seit WP 7.3 zu grob: Anonym erstellte Sicherungen tragen seither
 * `LOCAL_USER_ID`. Meldet sich derselbe Mensch später an und spielt seine
 * EIGENE Datei ein, sind die Kennungen ungleich, und die Oberfläche behauptete
 * „mit einem anderen Benutzerkonto erstellt". Vor WP 7.3 war der Pfad
 * unerreichbar (anonyme Sicherung warf), die Falschaussage ist also neu und
 * von uns erzeugt.
 *
 * Drei Fälle statt zwei — und die Einstufung gehört hierher, weil nur der
 * Service beide Kennungen kennt; die Oberfläche sah bisher nur `FOREIGN_BACKUP`
 * und konnte deshalb gar nichts anderes sagen.
 */
export type BackupOwnership =
  /** Gleiche Kennung — keine Rückfrage nötig. */
  | 'same'
  /** Ohne angemeldetes Konto erstellt und wird jetzt einem Konto zugeordnet. */
  | 'localToAccount'
  /** Andere Konto-Kennung — der echte Fremdfall. */
  | 'otherAccount';

/** Besitzverhältnis ohne den Fall „gleich" — die beiden bestätigungspflichtigen. */
export type ForeignBackupOwnership = Exclude<BackupOwnership, 'same'>;

export function classifyBackupOwnership(
  backup: Pick<BackupData, 'userId'>,
  currentUserId: string,
): BackupOwnership {
  // Bewusst der direkte Vergleich (wie bisher in `restoreBackup`) und nicht
  // `isForeignBackup`: Letzteres wertet eine LEERE Kennung als „nicht fremd"
  // und würde hier still ein anderes Ergebnis liefern als der Merge-Schutz.
  if (backup.userId === currentUserId) return 'same';
  // In diesem Zweig ist `currentUserId` zwangsläufig eine andere Kennung, also
  // ein angemeldetes Konto — die lokale Herkunft allein entscheidet.
  return backup.userId === LOCAL_USER_ID ? 'localToAccount' : 'otherAccount';
}

/**
 * Fehler, der eine nicht bestätigte Wiederherstellung abbricht.
 *
 * Die Meldung bleibt wörtlich `FOREIGN_BACKUP`: Aufrufstellen und Tests prüfen
 * seit Issue #30 genau diese Zeichenkette. Neu ist nur das mitgeführte
 * Besitzverhältnis — additiv, damit vorhandene Prüfungen unverändert greifen.
 */
export class ForeignBackupError extends Error {
  readonly ownership: ForeignBackupOwnership;

  constructor(ownership: ForeignBackupOwnership) {
    super('FOREIGN_BACKUP');
    this.name = 'ForeignBackupError';
    this.ownership = ownership;
  }
}

/**
 * Liest das Besitzverhältnis aus einem abgefangenen Fehler — `null`, wenn der
 * Fehler nichts damit zu tun hat.
 *
 * Ein roher `Error('FOREIGN_BACKUP')` (älterer Stand, Testdoubles) wird
 * weiterhin als Fremdkonto gelesen: dieselbe Auskunft wie vor dieser Änderung.
 */
export function backupOwnershipFromError(error: unknown): ForeignBackupOwnership | null {
  if (error instanceof ForeignBackupError) return error.ownership;
  if (error instanceof Error && error.message === 'FOREIGN_BACKUP') return 'otherAccount';
  return null;
}

/**
 * Besitzer-Kennung für Sicherung und Wiederherstellung — angemeldet die
 * Konto-Kennung, sonst `LOCAL_USER_ID`.
 *
 * Bis WP 7.3 stand hier `requireUserId()`, das ohne angemeldete Sitzung wirft.
 * Damit war die Sicherung ausgerechnet im Normalfall dieser App unbenutzbar:
 * local-first, anonym gestartet, Daten in IndexedDB (AGENTS.md §1). Sichtbar
 * wurde es erst im echten Browser (E2E, WP 7.3) — die Karte „Aktueller
 * Datenbestand" meldete „Deine Daten konnten nicht geladen werden", und der
 * Export lieferte gar keine Datei. Die Unit-Suite sah nichts davon, weil jeder
 * bestehende Backup-Test `requireUserId` auf eine feste Kennung mockt und
 * damit nur den angemeldeten Fall beschreibt.
 *
 * `(await getCurrentUserId()) || LOCAL_USER_ID` ist dabei keine Erfindung
 * dieser Datei, sondern die Form, die neun weitere Services bereits benutzen
 * (`account-service`, `debt-service`, `claim-service`, `portfolio-service`, …)
 * — und es ist genau die Kennung, unter der diese Services anonym schreiben.
 * Damit greift auch der Kategorie-Filter in `createBackup()` wieder
 * (`user_id === userId`), der anonym vorher nie zutreffen konnte.
 *
 * Der Fremd-Backup-Schutz bleibt: Eine Datei mit fremder Konto-Kennung trifft
 * auf `LOCAL_USER_ID` und wird weiterhin als fremd erkannt.
 */
async function resolveBackupUserId(): Promise<string> {
  return (await getCurrentUserId()) || LOCAL_USER_ID;
}

/**
 * Backup service for exporting and importing complete user data
 */
class BackupService {
  /**
   * Create a complete backup of all user data
   */
  async createBackup(): Promise<BackupData> {
    const userId = await resolveBackupUserId();

    // Fetch all user data
    const [transactions, categories, accounts, settings, collections] = await Promise.all([
      this.fetchTransactions(userId),
      getCategories(),
      getAccounts(),
      getUserSettings(),
      snapshotLocalCollections(),
    ]);

    const data = {
      transactions: transactions || [],
      categories: categories.filter(c => c.user_id === userId || !c.user_id),
      accounts: accounts,
      settings,
    };

    // Prüfsumme über die Nutzlast (WP 1.5, RES-5) — schützt gegen teilkorrupte,
    // aber strukturell gültige Dateien, die sonst "erfolgreich" importieren.
    const checksum: BackupChecksum = {
      algorithm: 'sha256',
      value: await computeBackupChecksum({ data, collections }),
    };

    return {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      userId,
      data,
      collections,
      checksum,
    };
  }

  /**
   * Download backup as UNENCRYPTED JSON file.
   *
   * Klartext-Export ist bewusst kein Standardweg mehr (Issue #30): Er enthält
   * den kompletten Finanzdatensatz im Klartext. Aufrufer müssen das explizit
   * bestätigen (`acknowledgeUnencrypted`), sonst wird der Export verweigert.
   */
  async downloadBackup(
    backup?: BackupData,
    options?: { acknowledgeUnencrypted?: boolean },
  ): Promise<void> {
    if (!options?.acknowledgeUnencrypted) {
      throw new Error(t('backup.service.unencryptedExportWarning'));
    }
    // Broker-Zugangsdaten (eToro apiKey/userKey) NIE in einen Klartext-Export
    // schreiben — deutlich sensibler als die übrigen Finanzdaten (T1.10 / F-DEBT-1).
    const redacted = redactPortfolioSecrets(backup || await this.createBackup());
    // Prüfsumme NACH der Redaktion neu berechnen (WP 1.5): `createBackup()`
    // hat sie über die volle, unredigierte Nutzlast berechnet. Ohne diesen
    // Schritt würde ein Restore genau dieser (unveränderten) Exportdatei
    // fälschlich 'mismatch' melden, weil die entfernten Broker-Secrets die
    // Nutzlast verändert haben, ohne dass die Prüfsumme mitgezogen wurde.
    const data: BackupData = redacted.checksum
      ? {
          ...redacted,
          checksum: {
            algorithm: 'sha256',
            value: await computeBackupChecksum({ data: redacted.data, collections: redacted.collections }),
          },
        }
      : redacted;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `ausgabentracker_backup_${date}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async downloadEncryptedBackup(password: string, backup?: BackupData): Promise<void> {
    const data = backup || await this.createBackup();

    // Standalone-Verschlüsselung (Issue #36): unabhängig von der lokalen
    // At-Rest-Verschlüsselung, ohne deren Zustand anzufassen. Gleiche
    // Envelope wie das Vault-Format — eine Implementierung für beides.
    const payload = await encryptJsonWithPassword(data, password);
    await this.downloadEncryptedFile(payload, data.timestamp);
  }

  private async downloadEncryptedFile(payload: EncryptedEnvelopeV1, timestampIso: string) {
    const file: EncryptedBackupFileV1 = {
      type: 'ausgabentracker.backup.enc',
      v: 1,
      timestamp: timestampIso,
      payload,
    };

    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `ausgabentracker_backup_${date}.enc.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Read backup file from user upload
   */
  async readBackupFile(file: File): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const data = JSON.parse(json);

          // Validate backup structure
          if (!validateBackup(data)) {
            throw new Error(t('backup.service.invalidFormat'));
          }

          resolve(data);
        } catch (error) {
          reject(new Error(t('backup.service.readError')));
        }
      };

      reader.onerror = () => {
        reject(new Error(t('backup.service.fileReadError')));
      };
      
      reader.readAsText(file);
    });
  }

  async readEncryptedBackupFile(file: File, password: string): Promise<BackupData> {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error(t('backup.service.fileReadError')));
      reader.readAsText(file);
    });

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error(t('backup.service.invalidEncryptedJson'))
    }

    if (parsed?.type !== 'ausgabentracker.backup.enc' || parsed?.v !== 1 || !parsed?.payload) {
      throw new Error(t('backup.service.invalidEncryptedFormat'))
    }

    // Standalone-Entschlüsselung — verändert die lokale
    // Verschlüsselungs-Konfiguration des Nutzers nicht (Issue #36).
    return await decryptJsonWithPassword<BackupData>(parsed.payload as import('./local-crypto').EncryptedEnvelopeV1, password);
  }

  /**
   * Restore data from backup.
   *
   * Fremd-Backups (andere user_id) werden nicht still importiert (Issue #30):
   * ohne `allowForeign` wirft die Methode FOREIGN_BACKUP, damit die UI eine
   * ausdrückliche Warnung/Bestätigung anzeigen kann.
   *
   * WP 1.5 (RES-5): zusätzlich Prüfsumme verifizieren (manipulierte, aber
   * strukturell gültige Dateien werden abgelehnt — fehlende Prüfsumme bei
   * älteren Backups bleibt dagegen nur ein Hinweis, kein Ablehnungsgrund) und
   * jedes Item der abgedeckten Collections gegen sein Schema prüfen
   * (überspringen + zählen, nie alles-oder-nichts — dieselbe Registry wie
   * WP 1.2, `@/lib/schemas/collection-schemas`).
   */
  async restoreBackup(
    backupData: BackupData,
    options?: { allowForeign?: boolean },
  ): Promise<{
    success: boolean;
    message: string;
    /** Lokalisierte Hinweise, die den Import NICHT verhindert haben (fehlende Prüfsumme, Minor-Versionsunterschied, übersprungene Items). */
    warnings: string[];
    details: {
      transactions: number;
      categories: number;
      accounts: number;
      settings: boolean;
      collections: number;
      /** Anzahl der Items, die ihr Collection-Schema nicht erfüllt haben und deshalb NICHT importiert wurden. */
      skippedItems: number;
    };
  }> {
    try {
      const userId = await resolveBackupUserId();
      const warnings: string[] = [];

      // Validate version compatibility (Major-basiert, Vorentschieden #4).
      if (!isVersionCompatible(backupData.version)) {
        throw new Error(t('backup.service.versionIncompatible', 'Backup-Version {version} ist nicht kompatibel').replace('{version}', backupData.version));
      }
      const minorMismatchWarning = getVersionMinorMismatchWarning(backupData.version);
      if (minorMismatchWarning) warnings.push(minorMismatchWarning);

      // Prüfsumme verifizieren (WP 1.5, RES-5). 'mismatch' bricht ab —
      // 'missing' (altes Backup vor v1.2) bleibt importierbar, nur mit Hinweis
      // (Vorentschieden #2: sonst verliert ein Nutzer mit genau einem alten
      // Backup durch diese Änderung Daten statt sie zu schützen).
      const checksumStatus = await verifyBackupChecksum(backupData);
      if (checksumStatus === 'mismatch') {
        throw new Error(
          t(
            'backup.service.checksumMismatch',
            'Die Prüfsumme des Backups stimmt nicht mit dem Inhalt überein — die Datei ist beschädigt oder wurde verändert.',
          ),
        );
      }
      if (checksumStatus === 'missing') {
        warnings.push(
          t(
            'backup.service.checksumMissing',
            'Dieses Backup enthält keine Prüfsumme (älteres Format) — der Inhalt konnte nicht automatisch verifiziert werden.',
          ),
        );
      }

      // Check if backup belongs to current user.
      const ownership = classifyBackupOwnership(backupData, userId);
      if (ownership !== 'same' && !options?.allowForeign) {
        throw new ForeignBackupError(ownership);
      }

      let results = {
        transactions: 0,
        categories: 0,
        accounts: 0,
        settings: false,
        collections: 0,
        skippedItems: 0,
      };

      // Item-Validierung (WP 1.2/1.5, RES-2/RES-5): kaputte Items werden VOR
      // dem Schreiben übersprungen und gezählt, statt sie in den Store zu
      // schreiben und erst beim nächsten Lesen zu bemerken ("nicht Monate
      // später"). Bewusst NICHT über `recordSkipped`/`data-integrity-report`
      // gemeldet: dieser Bericht gilt für den JEWEILS LETZTEN Lesevorgang
      // einer Collection (siehe dortige Doku) — `restoreTransactions`/
      // `restoreLocalCollections` lesen dieselbe Collection intern selbst
      // (`getTransactions`, `readLocalFinanceList`), und jeder GENUINE
      // Folge-Lesevorgang danach liest den jetzt bereinigten Bestand (0
      // übersprungen, korrekt) — würde also den hier gesetzten Befund sofort
      // wieder überschreiben. Der Restore-Befund gehört stattdessen in den
      // Rückgabewert dieser Methode (`details.skippedItems`/`warnings`),
      // der nicht durch einen späteren, unabhängigen Lesevorgang veraltet.
      const { valid: validTransactions, skippedCount: skippedTransactions } = validateCollectionItems(
        'transactions',
        backupData.data.transactions,
      );
      results.skippedItems += skippedTransactions;

      const { valid: validAccounts, skippedCount: skippedAccounts } = validateCollectionItems(
        'accounts',
        backupData.data.accounts,
      );
      results.skippedItems += skippedAccounts;

      // Restore transactions
      if (validTransactions.length > 0) {
        results.transactions = await this.restoreTransactions(
          userId,
          validTransactions
        );
      }

      // Restore categories (only user-owned categories). Kategorien sind
      // NICHT in der Schema-Registry abgedeckt (Vorentschieden #3 aus WP 1.2 —
      // siehe `collection-schemas.ts`), deshalb keine Item-Validierung hier.
      const userCategories = backupData.data.categories.filter((c: Category) => c.user_id);
      if (userCategories.length > 0) {
        results.categories = await this.restoreCategories(userId, userCategories);
      }

      // Restore accounts
      if (validAccounts.length > 0) {
        results.accounts = await this.restoreAccounts(userId, validAccounts);
      }

      // Restore settings
      if (backupData.data.settings) {
        results.settings = await this.restoreSettings(userId, backupData.data.settings);
      }

      // Übrige Collections: Items je Collection gegen ihr Schema prüfen,
      // dann nicht-destruktiv per stabiler ID mergen.
      const validatedCollections = backupData.collections
        ? Object.fromEntries(
            Object.entries(backupData.collections).map(([key, items]) => {
              if (!Array.isArray(items)) return [key, items];
              const { valid, skippedCount } = validateCollectionItems(key, items);
              results.skippedItems += skippedCount;
              return [key, valid];
            }),
          )
        : undefined;
      const restoredCollections = await restoreLocalCollections(validatedCollections);
      results.collections = Object.values(restoredCollections).reduce((sum, n) => sum + n, 0);

      if (results.skippedItems > 0) {
        warnings.push(
          results.skippedItems === 1
            ? t('backup.service.itemsSkippedOne', 'Ein Eintrag im Backup war beschädigt und wurde beim Wiederherstellen übersprungen.')
            : t(
                'backup.service.itemsSkipped',
                '{count} Einträge im Backup waren beschädigt und wurden beim Wiederherstellen übersprungen.',
              ).replace('{count}', String(results.skippedItems)),
        );
      }

      return {
        success: true,
        // Der Zusatz in Klammern muss dasselbe sagen wie die Rückfrage davor —
        // sonst bestätigt man „aus der Nutzung ohne Konto" und liest danach
        // „aus anderem Benutzerkonto".
        message:
          ownership === 'same'
            ? t('backup.service.restoreSuccess')
            : ownership === 'localToAccount'
              ? t('backup.service.restoreSuccessLocal')
              : t('backup.service.restoreSuccessForeign'),
        warnings,
        details: results,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'FOREIGN_BACKUP') {
        throw error;
      }

      throw new Error(
        t('backup.service.restoreFailed', 'Wiederherstellung fehlgeschlagen: {error}').replace('{error}', error instanceof Error ? error.message : t('backup.service.unknownError', 'Unbekannter Fehler'))
      );
    }
  }

  /**
   * Get backup info without downloading
   */
  async getBackupInfo(): Promise<{
    date: string;
    transactionCount: number;
    categoryCount: number;
    accountCount: number;
    estimatedSize: number;
  }> {
    const backup = await this.createBackup();
    const json = JSON.stringify(backup);
    
    return {
      date: backup.timestamp,
      transactionCount: backup.data.transactions.length,
      categoryCount: backup.data.categories.length,
      accountCount: backup.data.accounts.length,
      estimatedSize: new Blob([json]).size,
    };
  }

  // ==================== Private Methods ====================

  private async fetchTransactions(_userId: string): Promise<import('../types').Transaction[]> {
    try {
      return await getAllTransactions();
    } catch (error) {
      logger.error(`[BackupService] Error fetching local transactions: ${error instanceof Error ? error.message : String(error)}`, { source: 'backup' });
      return [];
    }
  }

  private async restoreTransactions(
    _userId: string,
    transactions: import('../types').Transaction[]
  ): Promise<number> {
    if (transactions.length === 0) return 0;
    // Merge per ID (VE-5): Original-IDs behalten, damit der Idempotenz-Guard des
    // Stores greift — ein Restore auf bestehende Daten verdoppelt keine Buchungen
    // und wiederhergestellte Buchungen behalten gültige Kategorie-/Konto-Bezüge (T1.4).
    // `saveTransactions` gibt die gespeicherten Inputs zurück; für die Restore-
    // Zusammenfassung zählen wir daher nur tatsächlich neue Backup-IDs.
    const existingIds = new Set((await getAllTransactions()).map((tx) => tx.id));
    const newTransactions = transactions.filter((tx) => tx.id && !existingIds.has(tx.id));
    if (newTransactions.length === 0) return 0;

    await saveTransactions(transactions);
    return newTransactions.length;
  }

  private async restoreCategories(
    _userId: string,
    categories: Category[]
  ): Promise<number> {
    // Merge per ID (Original-IDs erhalten), damit Transaktionsbezüge intakt bleiben.
    try {
      return await restoreLocalCategories(categories);
    } catch (error) {
      logger.error(`[BackupService] Error restoring categories: ${error instanceof Error ? error.message : String(error)}`, { source: 'backup' });
      return 0;
    }
  }

  private async restoreAccounts(
    _userId: string,
    accounts: Account[]
  ): Promise<number> {
    // Merge per ID: bereits vorhandene Konten überspringen, fehlende mit ihrer
    // Original-ID anlegen (kein Duplikat, keine ID-Neuvergabe).
    const existingIds = new Set((await getAccounts()).map((a) => a.id));
    let restored = 0;

    for (const acc of accounts) {
      if (acc.id && existingIds.has(acc.id)) continue;
      try {
        await createAccount({ ...acc });
        if (acc.id) existingIds.add(acc.id);
        restored++;
      } catch (error) {
        logger.error(`[BackupService] Error restoring local account: ${error instanceof Error ? error.message : String(error)}`, { source: 'backup' });
      }
    }

    return restored;
  }

  private async restoreSettings(
    _userId: string,
    settings: UserSettings
  ): Promise<boolean> {
    try {
      await updateUserSettings(settings);
      return true;
    } catch (error) {
      logger.error(`[BackupService] Error restoring settings: ${error instanceof Error ? error.message : String(error)}`, { source: 'backup' });
      return false;
    }
  }
}

// Singleton instance
export const backupService = new BackupService();
