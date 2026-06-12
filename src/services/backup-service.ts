import { supabase } from '../integrations/supabase/client';
import { requireUserId } from './auth-service';
import type { Category, Account, UserSettings } from '../types';
import { getCategories, getTransactions, getUserSettings, saveTransactions } from './transaction-service';
import { createAccount, getAccounts } from './account-service';
import { localEncryption, type EncryptedEnvelopeV1 } from './local-crypto';

/**
 * Complete backup data structure
 */
export interface BackupData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    transactions: any[];
    categories: Category[];
    accounts: Account[];
    settings: UserSettings;
  };
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
  private readonly BACKUP_VERSION = '1.0.0';

  /**
   * Create a complete backup of all user data
   */
  async createBackup(): Promise<BackupData> {
    const userId = await requireUserId();

    // Fetch all user data
    const [transactions, categories, accounts, settings] = await Promise.all([
      this.fetchTransactions(userId),
      getCategories(),
      getAccounts(),
      getUserSettings(),
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
    const data = backup || await this.createBackup();
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

    // Encrypted backup is independent of local-at-rest encryption toggle.
    // We temporarily enable the crypto context, encrypt the backup, and then restore the previous state.
    const prevCfg = localEncryption.getConfig();
    const prevUnlocked = localEncryption.isUnlocked();

    try {
      if (!prevCfg) {
        await localEncryption.enable(password);
      } else {
        await localEncryption.unlock(password);
      }

      const payload = await localEncryption.encryptJson(data);
      await this.downloadEncryptedFile(payload, data.timestamp);
    } finally {
      localEncryption.lock();
      if (!prevCfg) {
        localStorage.removeItem('ausgabentracker_local_encryption_check_v1');
        localStorage.removeItem('ausgabentracker_local_encryption_config_v1');
      } else {
        // Keep config; if it was unlocked before, we intentionally require re-unlock.
        void prevUnlocked;
      }
    }
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

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Ungültiges verschlüsseltes Backup (kein JSON)')
    }

    if (parsed?.type !== 'ausgabentracker.backup.enc' || parsed?.v !== 1 || !parsed?.payload) {
      throw new Error('Ungültiges verschlüsseltes Backup-Format')
    }

    // Decrypt without changing the user's local encryption configuration.
    const prevCfg = localEncryption.getConfig();
    const prevUnlocked = localEncryption.isUnlocked();

    try {
      if (!prevCfg) {
        await localEncryption.enable(password);
      } else {
        await localEncryption.unlock(password);
      }

      return await localEncryption.decryptJson<BackupData>(parsed.payload);
    } finally {
      localEncryption.lock();
      if (!prevCfg) {
        localStorage.removeItem('ausgabentracker_local_encryption_check_v1');
        localStorage.removeItem('ausgabentracker_local_encryption_config_v1');
      } else {
        void prevUnlocked;
      }
    }
  }

  /**
   * Validate backup structure
   */
  private validateBackup(data: any): data is BackupData {
    return (
      data &&
      typeof data === 'object' &&
      data.version &&
      data.timestamp &&
      data.userId &&
      data.data &&
      Array.isArray(data.data.transactions) &&
      Array.isArray(data.data.categories) &&
      Array.isArray(data.data.accounts) &&
      typeof data.data.settings === 'object'
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

  private async fetchTransactions(_userId: string): Promise<any[]> {
    try {
      return await getTransactions(10000);
    } catch (error) {
      console.error('[BackupService] Error fetching local transactions:', error);
      return [];
    }
  }

  private async restoreTransactions(
    _userId: string,
    transactions: any[]
  ): Promise<number> {
    if (transactions.length === 0) return 0;
    const restored = await saveTransactions(transactions.map((tx) => ({ ...tx, id: undefined })));
    return restored.length;
  }

  private async restoreCategories(
    userId: string,
    categories: Category[]
  ): Promise<number> {
    let restored = 0;
    
    for (const cat of categories) {
      try {
        const { error } = await supabase
          .from('categories')
          .insert({
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            filters: cat.filters,
            parent_id: cat.parent_id,
            attributes: cat.attributes,
            user_id: userId,
          });
        
        if (!error) {
          restored++;
        }
      } catch (error) {
        console.error('[BackupService] Error restoring category:', error);
      }
    }
    
    return restored;
  }

  private async restoreAccounts(
    _userId: string,
    accounts: Account[]
  ): Promise<number> {
    let restored = 0;
    
    for (const acc of accounts) {
      try {
        await createAccount({ ...acc, id: undefined });
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
      const { error } = await supabase
        .from('user_settings')
        .upsert(settings)
        .select('*')
        .single();

      return !error;
    } catch (error) {
      console.error('[BackupService] Error restoring settings:', error);
      return false;
    }
  }
}

// Singleton instance
export const backupService = new BackupService();