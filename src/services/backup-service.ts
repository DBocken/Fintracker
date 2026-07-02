import { requireUserId } from './auth-service';
import type { Category, Account, UserSettings } from '../types';
import {
  getCategories,
  getTransactions,
  getUserSettings,
  saveTransactions,
  updateUserSettings,
} from './transaction-service';
import { restoreLocalCategories } from './local-settings-service';
import { createAccount, getAccounts } from './account-service';
import {
  encryptJsonWithPassword,
  decryptJsonWithPassword,
  type EncryptedEnvelopeV1,
} from './local-crypto';
import {
  LOCAL_FINANCE_KEYS,
  readLocalFinanceList,
  writeLocalFinanceList,
  type LocalFinanceKey,
} from './local-finance-store';

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

/**
 * Stellt die generischen Collections wieder her — NICHT-destruktiv: es werden
 * nur LEERE Collections befüllt (Wiederherstellung auf neuem Gerät / nach
 * Datenverlust). Bestehende Daten werden nie überschrieben oder dupliziert.
 */
export async function restoreLocalCollections(
  collections: Record<string, unknown[]> | undefined,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  if (!collections) return results;

  for (const [key, items] of Object.entries(collections)) {
    if (!isLocalFinanceKey(key) || TYPED_BACKUP_KEYS.has(key)) continue;
    if (!Array.isArray(items) || items.length === 0) continue;

    const current = await readLocalFinanceList<unknown>(key);
    if (current.length > 0) continue; // bestehende Daten unangetastet lassen

    await writeLocalFinanceList(key, items);
    results[key] = items.length;
  }
  return results;
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
 * Backup service for exporting and importing complete user data
 */
class BackupService {
  private readonly BACKUP_VERSION = '1.1.0';

  /**
   * Create a complete backup of all user data
   */
  async createBackup(): Promise<BackupData> {
    const userId = await requireUserId();

    // Fetch all user data
    const [transactions, categories, accounts, settings, collections] = await Promise.all([
      this.fetchTransactions(userId),
      getCategories(),
      getAccounts(),
      getUserSettings(),
      snapshotLocalCollections(),
    ]);

    return {
      version: this.BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        transactions: transactions || [],
        categories: categories.filter(c => c.user_id === userId || !c.user_id),
        accounts: accounts,
        settings,
      },
      collections,
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
      throw new Error(
        'Unverschlüsselter Export muss ausdrücklich bestätigt werden. Nutze bevorzugt das verschlüsselte Backup.',
      );
    }
    // Broker-Zugangsdaten (eToro apiKey/userKey) NIE in einen Klartext-Export
    // schreiben — deutlich sensibler als die übrigen Finanzdaten (T1.10 / F-DEBT-1).
    const data = redactPortfolioSecrets(backup || await this.createBackup());
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
          if (!this.validateBackup(data)) {
            throw new Error('Ungültiges Backup-Format');
          }
          
          resolve(data);
        } catch (error) {
          reject(new Error('Fehler beim Lesen der Backup-Datei'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Fehler beim Lesen der Datei'));
      };
      
      reader.readAsText(file);
    });
  }

  async readEncryptedBackupFile(file: File, password: string): Promise<BackupData> {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file);
    });

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error('Ungültiges verschlüsseltes Backup (kein JSON)')
    }

    if (parsed?.type !== 'ausgabentracker.backup.enc' || parsed?.v !== 1 || !parsed?.payload) {
      throw new Error('Ungültiges verschlüsseltes Backup-Format')
    }

    // Standalone-Entschlüsselung — verändert die lokale
    // Verschlüsselungs-Konfiguration des Nutzers nicht (Issue #36).
    return await decryptJsonWithPassword<BackupData>(parsed.payload as import('./local-crypto').EncryptedEnvelopeV1, password);
  }

  /**
   * Validate backup structure
   */
  private validateBackup(data: unknown): data is BackupData {
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

  /**
   * Restore data from backup.
   *
   * Fremd-Backups (andere user_id) werden nicht still importiert (Issue #30):
   * ohne `allowForeign` wirft die Methode FOREIGN_BACKUP, damit die UI eine
   * ausdrückliche Warnung/Bestätigung anzeigen kann.
   */
  async restoreBackup(
    backupData: BackupData,
    options?: { allowForeign?: boolean },
  ): Promise<{
    success: boolean;
    message: string;
    details: {
      transactions: number;
      categories: number;
      accounts: number;
      settings: boolean;
      collections: number;
    };
  }> {
    try {
      const userId = await requireUserId();

      // Validate version compatibility
      if (!this.isVersionCompatible(backupData.version)) {
        throw new Error(`Backup-Version ${backupData.version} ist nicht kompatibel`);
      }

      // Check if backup belongs to current user.
      const belongsToCurrentUser = backupData.userId === userId;
      if (!belongsToCurrentUser && !options?.allowForeign) {
        throw new Error('FOREIGN_BACKUP');
      }

      let results = {
        transactions: 0,
        categories: 0,
        accounts: 0,
        settings: false,
        collections: 0,
      };

      // Restore transactions
      if (backupData.data.transactions.length > 0) {
        results.transactions = await this.restoreTransactions(
          userId,
          backupData.data.transactions
        );
      }

      // Restore categories (only user-owned categories)
      const userCategories = backupData.data.categories.filter((c: Category) => c.user_id);
      if (userCategories.length > 0) {
        results.categories = await this.restoreCategories(userId, userCategories);
      }

      // Restore accounts
      if (backupData.data.accounts.length > 0) {
        results.accounts = await this.restoreAccounts(userId, backupData.data.accounts);
      }

      // Restore settings
      if (backupData.data.settings) {
        results.settings = await this.restoreSettings(userId, backupData.data.settings);
      }

      // Übrige Collections nicht-destruktiv wiederherstellen (nur leere füllen).
      const restoredCollections = await restoreLocalCollections(backupData.collections);
      results.collections = Object.values(restoredCollections).reduce((sum, n) => sum + n, 0);

      return {
        success: true,
        message: belongsToCurrentUser 
          ? 'Backup erfolgreich wiederhergestellt' 
          : 'Backup erfolgreich wiederhergestellt (aus anderem Benutzerkonto)',
        details: results,
      };
    } catch (error) {
      throw new Error(
        `Wiederherstellung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
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

  private isVersionCompatible(backupVersion: string): boolean {
    // Simple version check - in production, implement semver comparison
    const [major] = backupVersion.split('.').map(Number);
    const [currentMajor] = this.BACKUP_VERSION.split('.').map(Number);
    return major === currentMajor;
  }

  private async fetchTransactions(_userId: string): Promise<import('../types').Transaction[]> {
    try {
      return await getTransactions(10000);
    } catch (error) {
      console.error('[BackupService] Error fetching local transactions:', error);
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
    const restored = await saveTransactions(transactions);
    return restored.length;
  }

  private async restoreCategories(
    _userId: string,
    categories: Category[]
  ): Promise<number> {
    // Merge per ID (Original-IDs erhalten), damit Transaktionsbezüge intakt bleiben.
    try {
      return await restoreLocalCategories(categories);
    } catch (error) {
      console.error('[BackupService] Error restoring categories:', error);
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
        console.error('[BackupService] Error restoring local account:', error);
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
      console.error('[BackupService] Error restoring settings:', error);
      return false;
    }
  }
}

// Singleton instance
export const backupService = new BackupService();
