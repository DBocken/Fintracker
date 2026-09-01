import type { Transaction } from '../types';
import { getCurrentUserId } from './auth-service';
import { LocalEncryptionLockedError, VaultCorruptError, localEncryption } from './local-crypto';
import { escapeCsvCell } from '@/lib/csv-utils';
import { t } from '@/i18n/serviceT';
import { logger } from '@/utils/logger';
import { transactionSchema } from '@/lib/schemas/transaction.schema';
import { recordSkipped } from './data-integrity-report';
import { idbGet, idbRemove } from './idb-kv';
import { quarterKeyForDate, type QuarterKey } from '@/lib/transaction-quarter';
import { withKeyLock } from '@/lib/key-mutex';
import { TRANSACTION_STORE_LOCK_KEY } from './local-storage-keys';
import {
  clearAllTransactionChunks,
  readAllTransactionChunks,
  readTransactionChunk,
  writeTransactionChunk,
} from './transaction-chunk-store';

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
 * WP 4.1c (PERF-1): Ist der v3-Blob (noch) die Wahrheit?
 *
 * ADR-Zitat (`docs/architecture/transaction-storage-chunks.md`, "Migration"):
 * "Der Zeiger, der bestimmt, welche Ablage gilt, wird als Letztes umgelegt."
 * Genau dieser Zeiger ist die physische Anwesenheit des v3-Schlüssels — der
 * Migrationsschritt (`local-store-migrations.ts`) entfernt ihn ausschließlich
 * als LETZTEN Schritt, nachdem alle Chunks (und ihr Index) geschrieben sind.
 * Solange er existiert, ist v3 die Wahrheit (auch wenn durch einen
 * abgebrochenen Migrationslauf bereits halb geschriebene Chunks daneben
 * liegen — die werden dann NICHT gelesen, siehe ADR). Verschwindet er, ist
 * v4 die Wahrheit.
 *
 * Das ist bewusst KEINE Migration-bei-Lesezugriff (die ADR verbietet das
 * ausdrücklich): Es wird nichts transformiert oder geschrieben, nur
 * festgestellt, WESSEN Daten aktuell gelten — dieselbe Unterscheidung wie
 * zwischen einer Migration und der (erlaubten) Versions-Prüfung in
 * `assertCompatibleStore()`. Reine Existenzprüfung ohne Entschlüsselung
 * (roh über `idbGet`, plus den localStorage-Fallback von
 * `local-crypto.readDataRaw`, den ein noch nicht gelesener Alt-Schlüssel
 * dort haben könnte) — billig genug, um sie bei jedem Zugriff zu stellen.
 */
async function hasLegacyV3Blob(): Promise<boolean> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_TRANSACTIONS_KEY) != null) {
    return true;
  }
  return (await idbGet(LOCAL_TRANSACTIONS_KEY)) != null;
}

/**
 * Liest und validiert den v3-Blob roh. Von ZWEI Stellen genutzt: dem Legacy-
 * Lesepfad dieses Service (solange `hasLegacyV3Blob()` wahr ist) UND dem
 * Migrationsschritt selbst (`local-store-migrations.ts`, WP 4.1c) — deshalb
 * eine eigene Exportfunktion statt einer Methode auf `transactionStorage`,
 * damit der Migrationsläufer sie ohne Umweg über die Klasseninstanz
 * importieren kann. Dieselbe Item-Validierung wie überall (WP 1.2): kaputte
 * Items werden übersprungen und gezählt, nie die ganze Liste verworfen. Ein
 * kaputter GESAMT-Envelope (`VaultCorruptError`) wird NICHT abgefangen —
 * er wirft durch (WP 1.1: Korruption ist ein Fehlerzustand, keine Leerliste).
 */
export async function readLegacyV3Transactions(): Promise<Transaction[]> {
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  const data = await localEncryption.loadAndMaybeDecrypt<Transaction[]>(LOCAL_TRANSACTIONS_KEY);
  if (data === null) return [];
  // Spiegelbildlich zu local-finance-store.readLocalFinanceList (RES-1):
  // gültiges JSON ohne Array ist ein beschädigter Bestand, keine Leerliste.
  if (!Array.isArray(data)) throw new VaultCorruptError(LOCAL_TRANSACTIONS_KEY);

  const valid: Transaction[] = [];
  let skipped = 0;
  for (const item of data) {
    const result = transactionSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data as Transaction);
    } else {
      skipped += 1;
    }
  }
  recordSkipped('transactions', skipped);
  return valid;
}

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
  /**
   * Liest Buchungen, datum-absteigend.
   *
   * `limit === undefined` heisst **alle** — nicht „nimm den Standardwert"
   * (Audit 2026-09, F2). Vorher stand hier `limit = 1000`, und jede
   * Aufrufstelle musste eine Zahl raten; keine prüfte, ob sie gegriffen hat.
   * Ein Ausschnitt sieht aber aus wie ein Bestand: Der Klassifikator trainiert
   * dann auf 1.000 Buchungen, die Vertragserkennung sieht keine
   * Jahresverträge, und eine Steuersumme ist schlicht falsch.
   */
  async getTransactions(limit?: number, offset: number = 0): Promise<StorageResult<Transaction[]>> {
    try {
      const localResult = await this.getLocalTransactions();
      // [REGRESSION] WP 4.1c: `getLocalTransactions()` wirft nie (siehe dort),
      // sondern kapselt jeden Fehler bereits in `{ success: false }` — ein
      // gesperrter Tresor ODER ein korrupter Bestand (VaultCorruptError, egal
      // ob v3-Blob oder ein einzelner v4-Chunk) landete deshalb bislang HIER:
      // `localResult.data` ist dann `undefined`, `rows` wurde lautlos zu `[]`,
      // und diese Methode meldete `{ success: true, data: [] }` — die exakte
      // RES-1-Fehlklasse, nur eine Ebene höher und ohne eigenen Test bislang,
      // weil `transaction-service.ts::getTransactions()` sich auf `success`
      // verlässt, das hier nie `false` wurde. Ein Fehlschlag muss ein
      // Fehlschlag bleiben, nicht in einen leeren Erfolg übersetzt werden.
      if (!localResult.success) {
        return { success: false, error: localResult.error };
      }
      const rows = localResult.data || [];
      // Nach Datum absteigend sortieren, BEVOR das Limit greift. Sonst schneidet
      // ein Limit (z. B. 2000) einen beliebigen Ausschnitt in Speicher-/Import-
      // reihenfolge ab und verliert die jüngsten Buchungen – wodurch laufende
      // Verträge (Gehalt, Energie) fälschlich als beendet/nicht erkannt gelten.
      const sorted = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const beschnitten = limit === undefined ? sorted.slice(offset) : sorted.slice(offset, offset + limit);
      return { success: true, data: beschnitten };
    } catch (error) {
      logger.error(`[TransactionStorage] Error getting transactions: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
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
      logger.error(`[TransactionStorage] Error saving transactions: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
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
      logger.error(`[TransactionStorage] Error updating transaction: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
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
      // Anlass-Zuordnungen (Sonderkategorien) sind ebenfalls kontoneutrale
      // Zusatzdaten der Buchung und werden mitgelöscht (keine Waisen).
      const { deleteAssignmentsForTransactions } = await import('./special-category-service');
      await deleteAssignmentsForTransactions([id]);
      return result;
    } catch (error) {
      logger.error(`[TransactionStorage] Error deleting transaction: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
      };
    }
  }

  /**
   * Sync local and cloud storage
   */
  async sync(): Promise<StorageResult<{ uploaded: number; downloaded: number }>> {
    if (this.syncInProgress) {
      return { success: false, error: t('transactionStorage.syncInProgress') };
    }

    try {
      this.syncInProgress = true;
      this.lastSyncTime = new Date();
      return {
        success: true,
        data: { uploaded: 0, downloaded: 0 },
        error: t('transactionStorage.cloudSyncDisabled'),
      };
    } catch (error) {
      logger.error(`[TransactionStorage] Sync error: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
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
        return { success: false, error: t('transactionStorage.noTransactionsExport') };
      }

      const headers = ['date', 'payee', 'description', 'amount', 'currency', 'category', 'subcategory_id'];
      const rows = txs.map(tx =>
        headers.map(h => {
          if (h === 'amount') return escapeCsvCell(tx[h].toString().replace('.', ','));
          return escapeCsvCell(tx[h as keyof Transaction] || '');
        }).join(';')
      );

      const csv = [headers.join(';'), ...rows].join('\n');

      return { success: true, data: csv };
    } catch (error) {
      logger.error(`[TransactionStorage] Export error: ${error instanceof Error ? error.message : String(error)}`, { source: 'transaction-storage' });
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorageServiceLib.unknownError', 'Unknown error'),
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
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
      };
    }
  }

  /**
   * Clear local cache
   */
  async clearLocalCache(): Promise<StorageResult<void>> {
    try {
      localStorage.removeItem(LOCAL_TRANSACTIONS_KEY);
      await idbRemove(LOCAL_TRANSACTIONS_KEY);
      // WP 4.1c: seit dem Umschalten auf die Chunk-Ablage ist der v3-Schlüssel
      // nur noch EINE von zwei möglichen Wahrheiten (`hasLegacyV3Blob`) — ein
      // Test/Aufrufer, der einen vollständigen Reset erwartet, braucht auch
      // die v4-Chunks + deren Index leer, sonst leckt Bestand aus einem
      // vorherigen Lauf (Test, Session) in den nächsten (mehrere bestehende
      // Testdateien riefen diese Methode bereits für genau diesen Zweck auf).
      await clearAllTransactionChunks();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.unknownError'),
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

  /**
   * WP 4.1c: Fassade bleibt — Signatur/Verhalten dieser Methode ändern sich
   * nicht, nur WOHER sie liest. `hasLegacyV3Blob()` entscheidet, welche der
   * beiden Ablagen aktuell die Wahrheit ist (s. dort); kein lazy-migrierender
   * Zweig, nur ein Auswahlzweig zwischen zwei vollständigen Implementierungen.
   */
  private async getLocalTransactions(): Promise<StorageResult<Transaction[]>> {
    try {
      const valid = (await hasLegacyV3Blob())
        ? await readLegacyV3Transactions()
        : await readAllTransactionChunks();
      return { success: true, data: valid };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : t('transactionStorage.failedToReadLocalStorage'),
      };
    }
  }

  /** Legacy-Schreibpfad (v3-Blob) — unverändert, nur noch für den Fall genutzt, dass v3 noch nicht migriert ist. */
  private async setLocalTransactions(transactions: Transaction[]): Promise<void> {
    if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
      throw new LocalEncryptionLockedError();
    }

    await localEncryption.encryptAndStore(LOCAL_TRANSACTIONS_KEY, transactions);
  }

  private async saveLocalTransactions(newTransactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    // Die Weiche steht VOR dem Lock, und das ist keine Kosmetik: Nähme diese
    // Methode erst den Lock und riefe dann die Chunk-Schwester, die denselben
    // Schlüssel nimmt, wartete sie auf sich selbst — `withKeyLock` ist nicht
    // reentrant (`lib/key-mutex.ts`). Jeder Schreibvorgang bliebe dauerhaft
    // hängen, und zwar auf jeder Installation ohne v3-Blob, also im Normalfall.
    if (!(await hasLegacyV3Blob())) return this.saveLocalTransactionsChunked(newTransactions);

    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
      const existing = await this.getLocalTransactions();
      const merged = [...(existing.data || [])];
      const knownIds = new Set(merged.map((transaction) => transaction.id).filter(Boolean));
      for (const transaction of newTransactions) {
        // Import-IDs sind stabil. Ein identischer Reimport darf weder eine zweite
        // Buchung erzeugen noch zwischenzeitliche manuelle Änderungen überschreiben.
        // Die Prüfung steht INNERHALB des Locks — davor wäre sie Zierde, weil
        // zwei gleichzeitige Aufrufe beide an ihr vorbeikämen (AGENTS.md §2).
        if (transaction.id && knownIds.has(transaction.id)) continue;
        merged.push(transaction);
        if (transaction.id) knownIds.add(transaction.id);
      }
      await this.setLocalTransactions(merged);
      return { success: true, data: newTransactions };
    });
  }

  private async updateLocalTransaction(id: string, updates: Partial<Transaction>): Promise<StorageResult<Transaction>> {
    // Weiche vor dem Lock — siehe `saveLocalTransactions`.
    if (!(await hasLegacyV3Blob())) return this.updateLocalTransactionChunked(id, updates);

    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
      const existing = await this.getLocalTransactions();
      if (!existing.data) {
        return { success: false, error: t('transactionStorage.noTransactionsFound') };
      }

      const updated = existing.data.map(tx =>
        tx.id === id ? { ...tx, ...updates } : tx
      );

      await this.setLocalTransactions(updated);

      const updatedTx = updated.find(tx => tx.id === id);
      return updatedTx
        ? { success: true, data: updatedTx }
        : { success: false, error: t('transactionStorage.transactionNotFound') };
    });
  }

  private async deleteLocalTransaction(id: string): Promise<StorageResult<void>> {
    // Weiche vor dem Lock — siehe `saveLocalTransactions`.
    if (!(await hasLegacyV3Blob())) return this.deleteLocalTransactionChunked(id);

    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
      const existing = await this.getLocalTransactions();
      if (!existing.data) {
        return { success: false, error: t('transactionStorage.noTransactionsFound') };
      }

      const filtered = existing.data.filter(tx => tx.id !== id);
      await this.setLocalTransactions(filtered);

      return { success: true };
    });
  }

  // ---- WP 4.1c: Chunk-basierte Gegenstücke (aktiv, sobald v3 migriert ist) ----
  //
  // "Einzeländerung" (ADR-Messung 1) heißt hier konkret: `updateTransaction`/
  // `deleteTransaction` sollen nur DAS BETROFFENE Quartal neu ver-/entschlüsseln,
  // nicht den Gesamtbestand. Dafür muss zuerst geklärt werden, IN WELCHEM
  // Quartal die Buchung mit gegebener `id` heute liegt — die Signatur kennt nur
  // die ID, nicht das Datum. Die Antwort kommt aus `readAllTransactionChunks()`:
  // im realistischen Ablauf (Liste anzeigen → eine Zeile bearbeiten) ist der
  // Chunk-Cache zu diesem Zeitpunkt bereits warm (die Liste wurde gerade erst
  // geladen), und ein warmes Vollesen kostet laut ADR "0 Vorgänge" — die
  // Quartalssuche ist dann faktisch gratis. Nur bei einem kalten Cache (Edit
  // ohne vorherige Listenansicht) kostet sie so viel wie ein kaltes Vollesen;
  // das ist kein Rückschritt gegenüber v3, wo JEDE Einzeländerung ohnehin den
  // gesamten Blob entschlüsseln musste.

  private async saveLocalTransactionsChunked(newTransactions: Transaction[]): Promise<StorageResult<Transaction[]>> {
    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
    const existing = await readAllTransactionChunks();
    const knownIds = new Set(existing.map((transaction) => transaction.id).filter(Boolean));

    const byQuarter = new Map<QuarterKey, Transaction[]>();
    for (const transaction of newTransactions) {
      if (transaction.id && knownIds.has(transaction.id)) continue;
      const quarter = quarterKeyForDate(transaction.date);
      const list = byQuarter.get(quarter);
      if (list) list.push(transaction);
      else byQuarter.set(quarter, [transaction]);
      if (transaction.id) knownIds.add(transaction.id);
    }

    for (const [quarter, additions] of byQuarter) {
      const current = await readTransactionChunk(quarter);
      await writeTransactionChunk(quarter, [...current, ...additions]);
    }

    return { success: true, data: newTransactions };
    });
  }

  private async updateLocalTransactionChunked(id: string, updates: Partial<Transaction>): Promise<StorageResult<Transaction>> {
    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
    const all = await readAllTransactionChunks();
    const existing = all.find((tx) => tx.id === id);
    if (!existing) {
      return { success: false, error: t('transactionStorage.transactionNotFound') };
    }

    const updated: Transaction = { ...existing, ...updates };
    const oldQuarter = quarterKeyForDate(existing.date);
    const newQuarter = quarterKeyForDate(updated.date);

    if (oldQuarter === newQuarter) {
      const chunk = await readTransactionChunk(oldQuarter);
      await writeTransactionChunk(oldQuarter, chunk.map((tx) => (tx.id === id ? updated : tx)));
    } else {
      // Das Datum wurde mitgeändert — die Buchung wandert ins neue Quartal.
      const oldChunk = await readTransactionChunk(oldQuarter);
      await writeTransactionChunk(oldQuarter, oldChunk.filter((tx) => tx.id !== id));
      const newChunk = await readTransactionChunk(newQuarter);
      await writeTransactionChunk(newQuarter, [...newChunk, updated]);
    }

    return { success: true, data: updated };
    });
  }

  private async deleteLocalTransactionChunked(id: string): Promise<StorageResult<void>> {
    return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
    const all = await readAllTransactionChunks();
    const existing = all.find((tx) => tx.id === id);
    if (!existing) {
      // Kein Treffer: spiegelt das Legacy-Verhalten (kein Fehler, No-Op).
      return { success: true };
    }

    const quarter = quarterKeyForDate(existing.date);
    const chunk = await readTransactionChunk(quarter);
    await writeTransactionChunk(quarter, chunk.filter((tx) => tx.id !== id));

    return { success: true };
    });
  }

  private async getAllTransactions(): Promise<Transaction[]> {
    const result = await this.getTransactions(undefined, 0);
    return result.data || [];
  }
}

// Singleton instance
export const transactionStorage = new TransactionStorageService();

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  transactionStorage.initialize();
}
