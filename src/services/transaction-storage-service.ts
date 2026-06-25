import type { Transaction } from '../types';
import { getCurrentUserId } from './auth-service';
import { LocalEncryptionLockedError, localEncryption } from './local-crypto';

/**
 * Storage strategy for transactions. Cloud/hybrid are retained for UI compatibility,
 * but sensitive transaction data is now always persisted locally.
 */
export type StorageStrategy = 'local' | 'cloud' | 'hybrid';

/**
 * Configuration for transaction storage
 */
export interface StorageConfig {
  strategy: StorageStrategy;
  autoSync: boolean;
  syncInterval: number; // minutes
  localCacheEnabled: boolean;
}

/**
 * Result of storage operations
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

// Constants
const LOCAL_TRANSACTIONS_KEY = 'ausgabentracker_transactions_v3';
const DEFAULT_SYNC_INTERVAL = 5; // 5 minutes

/**
 * Transaction Storage Service
 *
 * Sensitive transaction data is local-first and never written to Supabase in
 * plaintext. Cross-device sync is handled by encrypted snapshots.
 */
class TransactionStorageService {
  private config: StorageConfig = {
    strategy: 'local',
    autoSync: false,
    syncInterval: DEFAULT_SYNC_INTERVAL,
    localCacheEnabled: true,
  };

  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;

  /**
   * Configure the storage service
   */
  configure(config: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * Initialize the storage service
   * - Creates table if needed (for cloud storage)
   * - Sets up auto-sync
   */
  async initialize(): Promise<void> {
    this.stopAutoSync();
  }

  /**
   * Get all transactions
   */
  async getTransactions(limit: number = 1000, offset: number = 0): Promise<StorageResult<Transaction[]>> {
    try {
      const localResult = await this.getLocalTransactions();
      const rows = localResult.data || [];
      // Nach Datum absteigend sortieren, BEVOR das Limit greift. Sonst schneidet
      // ein Limit (z. B. 2000) einen beliebigen Ausschnitt in Speicher-/Import-
      // reihenfolge ab und verliert die jüngsten Buchungen – wodurch laufende
      // Verträge (Gehalt, Energie) fälschlich als beendet/nicht erkannt gelten.
      const sorted = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return { success: true, data: sorted.slice(offset, offset + limit) };
    } catch (error) {
      console.error('[TransactionStorage] Error getting transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Save transactions
   */
  async saveTransactions(transactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    try {
      return await this.saveLocalTransactions(transactions);
    } catch (error) {
      console.error('[TransactionStorage] Error saving transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a single transaction
   */
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<StorageResult<Transaction>> {
    try {
      return await this.updateLocalTransaction(id, updates);
    } catch (error) {
      console.error('[TransactionStorage] Error updating transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<StorageResult<void>> {
    try {
      const result = await this.deleteLocalTransaction(id);
      // Aufteilungen sind kontoneutrale Kategoriedaten der Buchung und werden
      // mitgelöscht, damit keine verwaisten Aufteilungen zurückbleiben.
      const { deleteAllocationsForTransactions } = await import('./transaction-allocation-service');
      await deleteAllocationsForTransactions([id]);
      return result;
    } catch (error) {
      console.error('[TransactionStorage] Error deleting transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync local and cloud storage
   */
  async sync(): Promise<StorageResult<{ uploaded: number; downloaded: number }>> {
    if (this.syncInProgress) {
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      this.syncInProgress = true;
      this.lastSyncTime = new Date();
      return {
        success: true,
        data: { uploaded: 0, downloaded: 0 },
        error: 'Cloud-Klartextsync wurde deaktiviert. Bitte verschlüsselte Snapshots verwenden.',
      };
    } catch (error) {
      console.error('[TransactionStorage] Sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Export transactions to CSV
   */
  async exportToCSV(transactions?: Transaction[]): Promise<StorageResult<string>> {
    try {
      const txs = transactions || await this.getAllTransactions();

      if (!txs || txs.length === 0) {
        return { success: false, error: 'No transactions to export' };
      }

      const sanitizeCell = (value: unknown) => {
        const s = String(value ?? '');
        // Prevent Excel formula injection.
        if (/^[=+\-@]/.test(s)) return `'${s}`;
        return s;
      };

      const headers = ['date', 'payee', 'description', 'amount', 'currency', 'category', 'subcategory_id'];
      const rows = txs.map(tx =>
        headers.map(h => {
          if (h === 'amount') return sanitizeCell(tx[h].toString().replace('.', ','));
          return sanitizeCell(tx[h as keyof Transaction] || '');
        }).join(';')
      );

      const csv = [headers.join(';'), ...rows].join('\n');

      return { success: true, data: csv };
    } catch (error) {
      console.error('[TransactionStorage] Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get storage stats
   */
  async getStorageStats(): Promise<StorageResult<{
    local: { count: number; size: number };
    cloud?: { count: number };
    lastSync: Date | null;
  }>> {
    try {
      await getCurrentUserId();
      
      // Local stats only: Supabase no longer stores plaintext transactions.
      const localResult = await this.getLocalTransactions();
      const localCount = localResult.data?.length || 0;
      const localSize = new Blob([JSON.stringify(localResult.data)]).size;
      
      return {
        success: true,
        data: {
          local: { count: localCount, size: localSize },
          cloud: { count: 0 },
          lastSync: this.lastSyncTime,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear local cache
   */
  async clearLocalCache(): Promise<StorageResult<void>> {
    try {
      localStorage.removeItem(LOCAL_TRANSACTIONS_KEY);
      const { idbRemove } = await import('./idb-kv');
      await idbRemove(LOCAL_TRANSACTIONS_KEY);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==================== Private Methods ====================

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval * 60 * 1000);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async getLocalTransactions(): Promise<StorageResult<Transaction[]>> {

    try {
      if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
        throw new LocalEncryptionLockedError();
      }

      const data = await localEncryption.loadAndMaybeDecrypt<Transaction[]>(LOCAL_TRANSACTIONS_KEY);
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read local storage',
      };
    }
  }

  private async setLocalTransactions(transactions: Transaction[]): Promise<void> {
    if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
      throw new LocalEncryptionLockedError();
    }

    await localEncryption.encryptAndStore(LOCAL_TRANSACTIONS_KEY, transactions);
  }

  private async saveLocalTransactions(newTransactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    const existing = await this.getLocalTransactions();
    const merged = [...(existing.data || [])];
    const knownIds = new Set(merged.map((transaction) => transaction.id).filter(Boolean));
    for (const transaction of newTransactions) {
      // Import-IDs sind stabil. Ein identischer Reimport darf weder eine zweite
      // Buchung erzeugen noch zwischenzeitliche manuelle Änderungen überschreiben.
      if (transaction.id && knownIds.has(transaction.id)) continue;
      merged.push(transaction);
      if (transaction.id) knownIds.add(transaction.id);
    }
    await this.setLocalTransactions(merged);
    return { success: true, data: newTransactions };
  }

  private async updateLocalTransaction(id: string, updates: Partial<Transaction>): Promise<StorageResult<Transaction>> {
    const existing = await this.getLocalTransactions();
    if (!existing.data) {
      return { success: false, error: 'No transactions found' };
    }
    
    const updated = existing.data.map(tx => 
      tx.id === id ? { ...tx, ...updates } : tx
    );
    
    await this.setLocalTransactions(updated);
    
    const updatedTx = updated.find(tx => tx.id === id);
    return updatedTx 
      ? { success: true, data: updatedTx }
      : { success: false, error: 'Transaction not found' };
  }

  private async deleteLocalTransaction(id: string): Promise<StorageResult<void>> {
    const existing = await this.getLocalTransactions();
    if (!existing.data) {
      return { success: false, error: 'No transactions found' };
    }
    
    const filtered = existing.data.filter(tx => tx.id !== id);
    await this.setLocalTransactions(filtered);
    
    return { success: true };
  }

  private async getAllTransactions(): Promise<Transaction[]> {

    const result = await this.getTransactions(10000, 0);
    return result.data || [];
  }
}

// Singleton instance
export const transactionStorage = new TransactionStorageService();

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  transactionStorage.initialize();
}
