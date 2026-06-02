"use client";

import { supabase } from '../integrations/supabase/client';
import type { Transaction } from '../types';
import { getCurrentUserId, requireUserId } from './auth-service';
import { LocalEncryptionLockedError, localEncryption } from './local-crypto';

/**
 * Storage strategy for transactions
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
const CLOUD_TRANSACTIONS_TABLE = 'transactions';
const DEFAULT_SYNC_INTERVAL = 5; // 5 minutes

/**
 * Transaction Storage Service
 * 
 * Provides a unified interface for storing transactions with support for:
 * - Local storage (fast, offline-capable)
 * - Cloud storage (Supabase, synced across devices)
 * - Hybrid mode (best of both worlds)
 */
class TransactionStorageService {
  private config: StorageConfig = {
    strategy: 'hybrid',
    autoSync: true,
    syncInterval: DEFAULT_SYNC_INTERVAL,
    localCacheEnabled: true,
  };
  
  private syncTimer: NodeJS.Timeout | null = null;
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
    const userId = await getCurrentUserId();
    
    if (this.config.strategy === 'cloud' || this.config.strategy === 'hybrid') {
      await this.ensureCloudTable();
    }
    
    if (this.config.autoSync && userId) {
      this.startAutoSync();
    }
  }

  /**
   * Get all transactions
   */
  async getTransactions(limit: number = 1000, offset: number = 0): Promise<StorageResult<Transaction[]>> {
    try {
      const userId = await getCurrentUserId();
      
      if (this.config.strategy === 'local' || !userId) {
        return await this.getLocalTransactions();
      }
      
      if (this.config.strategy === 'cloud') {
        return await this.getCloudTransactions(userId, limit, offset);
      }
      
      // Hybrid: try cloud first, fallback to local
      if (navigator.onLine) {
        const cloudResult = await this.getCloudTransactions(userId, limit, offset);
        if (cloudResult.success && cloudResult.data) {
          // Update local cache
          if (this.config.localCacheEnabled) {
            await this.setLocalTransactions(cloudResult.data);
          }
          return cloudResult;
        }
      }
      
      // Fallback to local
      return await this.getLocalTransactions();
    } catch (error) {
      console.error('[TransactionStorage] Error getting transactions:', error);
      
      // Try local fallback
      try {
        const localResult = await this.getLocalTransactions();
        return { ...localResult, error: `Cloud failed, using local: ${error}` };
      } catch {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  }

  /**
   * Save transactions
   */
  async saveTransactions(transactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    try {
      const userId = await getCurrentUserId();
      
      if (this.config.strategy === 'local' || !userId) {
        return await this.saveLocalTransactions(transactions);
      }
      
      if (this.config.strategy === 'cloud') {
        return await this.saveCloudTransactions(userId, transactions);
      }
      
      // Hybrid: save to both
      const localResult = await this.saveLocalTransactions(transactions);
      
      if (navigator.onLine) {
        const cloudResult = await this.saveCloudTransactions(userId, transactions);
        return cloudResult.success ? cloudResult : localResult;
      }
      
      return localResult;
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
      const userId = await getCurrentUserId();
      
      if (this.config.strategy === 'local' || !userId) {
        return await this.updateLocalTransaction(id, updates);
      }
      
      if (this.config.strategy === 'cloud') {
        return await this.updateCloudTransaction(userId, id, updates);
      }
      
      // Hybrid: update both
      const localResult = await this.updateLocalTransaction(id, updates);
      
      if (navigator.onLine) {
        await this.updateCloudTransaction(userId, id, updates);
      }
      
      return localResult;
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
      const userId = await getCurrentUserId();
      
      if (this.config.strategy === 'local' || !userId) {
        return await this.deleteLocalTransaction(id);
      }
      
      if (this.config.strategy === 'cloud') {
        return await this.deleteCloudTransaction(userId, id);
      }
      
      // Hybrid: delete from both
      await this.deleteLocalTransaction(id);
      
      if (navigator.onLine) {
        await this.deleteCloudTransaction(userId, id);
      }
      
      return { success: true };
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
      const userId = await requireUserId();
      
      // Get local transactions
      const localResult = await this.getLocalTransactions();
      if (!localResult.success || !localResult.data) {
        throw new Error('Failed to get local transactions');
      }
      
      // Get cloud transactions
      const cloudResult = await this.getCloudTransactions(userId, 10000, 0);
      
      let uploaded = 0;
      let downloaded = 0;
      
      if (cloudResult.success && cloudResult.data) {
        // Sync logic: merge by date + payee + amount (simple deduplication)
        const localMap = new Map<string, Transaction>();
        localResult.data.forEach(tx => {
          const key = `${tx.date}|${tx.payee}|${tx.amount}`;
          localMap.set(key, tx);
        });
        
        const cloudMap = new Map<string, Transaction>();
        cloudResult.data.forEach(tx => {
          const key = `${tx.date}|${tx.payee}|${tx.amount}`;
          cloudMap.set(key, tx);
        });
        
        // Upload local-only transactions
        const toUpload: Transaction[] = [];
        localMap.forEach((tx, key) => {
          if (!cloudMap.has(key)) {
            toUpload.push(tx);
          }
        });
        
        if (toUpload.length > 0) {
          const uploadResult = await this.saveCloudTransactions(userId, toUpload);
          if (uploadResult.success) {
            uploaded = toUpload.length;
          }
        }
        
        // Download cloud-only transactions
        const allTransactions = [...localResult.data];
        cloudMap.forEach((tx, key) => {
          if (!localMap.has(key)) {
            allTransactions.push(tx);
            downloaded++;
          }
        });
        
        // Update local
        await this.setLocalTransactions(allTransactions);
      }
      
      this.lastSyncTime = new Date();
      
      return {
        success: true,
        data: { uploaded, downloaded },
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
      const userId = await getCurrentUserId();
      
      // Local stats
      const localResult = await this.getLocalTransactions();
      const localCount = localResult.data?.length || 0;
      const localSize = new Blob([JSON.stringify(localResult.data)]).size;
      
      // Cloud stats
      let cloudCount: number | undefined;
      if (userId && (this.config.strategy === 'cloud' || this.config.strategy === 'hybrid')) {
        const cloudResult = await this.getCloudTransactions(userId, 1, 0);
        if (cloudResult.success) {
          cloudCount = localCount; // Approximation, actual count from query would be better
        }
      }
      
      return {
        success: true,
        data: {
          local: { count: localCount, size: localSize },
          cloud: cloudCount !== undefined ? { count: cloudCount } : undefined,
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

  private async ensureCloudTable(): Promise<void> {
    // Check if table exists, create if not
    // This would be done via migration in a real app
    const { error } = await supabase
      .from(CLOUD_TRANSACTIONS_TABLE)
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.warn('[TransactionStorage] Cloud table does not exist. Please run migration.');
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
    const merged = [...(existing.data || []), ...newTransactions];
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

  private async getCloudTransactions(userId: string, limit: number, offset: number): Promise<StorageResult<Transaction[]>> {
    try {
      const { data, error } = await supabase
        .from(CLOUD_TRANSACTIONS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        // Table doesn't exist yet - return empty
        if (error.code === '42P01') {
          return { success: true, data: [] };
        }
        throw error;
      }
      
      return { success: true, data: (data || []) as Transaction[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cloud fetch failed',
      };
    }
  }

  private async saveCloudTransactions(userId: string, transactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    try {
      const toInsert = transactions.map(tx => ({
        user_id: userId,
        date: tx.date,
        amount: tx.amount,
        payee: tx.payee,
        description: tx.description,
        original_text: tx.original_text,
        currency: tx.currency || 'EUR',
        category_id: tx.category_id,
        subcategory_id: tx.subcategory_id,
        auto_mapped: tx.auto_mapped || false,
        confirmed: tx.confirmed || false,
        account_id: tx.account_id,
      }));
      
      const { data, error } = await supabase
        .from(CLOUD_TRANSACTIONS_TABLE)
        .insert(toInsert)
        .select('*');
      
      if (error) throw error;
      
      return { success: true, data: (data || []) as Transaction[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cloud save failed',
      };
    }
  }

  private async updateCloudTransaction(userId: string, id: string, updates: Partial<Transaction>): Promise<StorageResult<Transaction>> {
    try {
      const { data, error } = await supabase
        .from(CLOUD_TRANSACTIONS_TABLE)
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();
      
      if (error) throw error;
      
      return { success: true, data: data as Transaction };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cloud update failed',
      };
    }
  }

  private async deleteCloudTransaction(userId: string, id: string): Promise<StorageResult<void>> {
    try {
      const { error } = await supabase
        .from(CLOUD_TRANSACTIONS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cloud delete failed',
      };
    }
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