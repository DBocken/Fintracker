import {
  readLocalFinanceList,
  writeLocalFinanceList,
} from './local-finance-store';

/**
 * Lokaler, append-only Audit-Verlauf für automatische und manuelle Änderungen.
 *
 * Leitidee: Nutzerentscheidungen schlagen Systementscheidungen, und jede Änderung
 * muss erklärbar und möglichst reversibel sein. Dieser Verlauf wird **ausschließlich
 * lokal** (IndexedDB via local-finance-store, optional verschlüsselt) gespeichert und
 * niemals an einen Server gesendet.
 *
 * Datensparsamkeit: Statt vollständiger Objekte werden nur die minimal nötigen,
 * whitelisteten Felder als `redactedBefore`/`redactedAfter` abgelegt.
 */

export type AuditActor = 'user' | 'system';

export type AuditEntityType =
  | 'transaction'
  | 'contract'
  | 'category'
  | 'account'
  | 'forecast'
  | 'merchant_rule'
  | 'automation_suggestion';

/**
 * Deterministische Undo-Metadaten. Damit lässt sich eine Änderung später gezielt
 * zurücknehmen, ohne aus heterogenen Logs raten zu müssen.
 */
export interface AuditReversal {
  operation: 'restore' | 'delete' | 'update' | 'custom';
  targetCollection: string;
  targetId: string;
}

export interface AuditLogEntry {
  id: string;
  actor: AuditActor;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  title: string;
  description?: string;
  /** Nur whitelistete, minimal nötige Felder (keine vollen Bankbeschreibungen). */
  redactedBefore?: Record<string, unknown> | null;
  redactedAfter?: Record<string, unknown> | null;
  reversible: boolean;
  reversal?: AuditReversal | null;
  created_at: string;
}

export interface GetAuditLogOptions {
  entityType?: AuditEntityType;
  entityId?: string;
  limit?: number;
}

/**
 * Reduziert ein Objekt auf eine Whitelist an Feldern, damit keine sensiblen
 * Roh-Finanzdaten im Audit-Log dupliziert werden.
 */
export function redactForAudit<T>(
  entity: T | null | undefined,
  fields: (keyof T)[],
): Record<string, unknown> | null {
  if (!entity) return null;
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (entity[field] !== undefined) {
      result[field as string] = entity[field];
    }
  }
  return result;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `audit_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export async function appendAuditLogEntry(
  entry: Omit<AuditLogEntry, 'id' | 'created_at'>,
): Promise<AuditLogEntry> {
  const full: AuditLogEntry = {
    ...entry,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  const entries = await readLocalFinanceList<AuditLogEntry>('auditLog');
  entries.push(full);
  await writeLocalFinanceList('auditLog', entries);
  return full;
}

export async function getAuditLogEntries(
  options: GetAuditLogOptions = {},
): Promise<AuditLogEntry[]> {
  const { entityType, entityId, limit } = options;
  let entries = await readLocalFinanceList<AuditLogEntry>('auditLog');

  if (entityType) entries = entries.filter((e) => e.entityType === entityType);
  if (entityId) entries = entries.filter((e) => e.entityId === entityId);

  // Neueste zuerst.
  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (typeof limit === 'number' && limit >= 0) {
    entries = entries.slice(0, limit);
  }
  return entries;
}

export async function clearAuditLog(): Promise<void> {
  await writeLocalFinanceList('auditLog', []);
}

/**
 * Fehlertolerante Hülle um `appendAuditLogEntry`: Audit-Schreibfehler dürfen die
 * auslösende Fachoperation niemals zum Scheitern bringen. Genau eine Stelle mit
 * try/catch statt verstreuter Wrapping-Logik.
 */
export async function safeAudit(
  entry: Omit<AuditLogEntry, 'id' | 'created_at'>,
): Promise<void> {
  try {
    await appendAuditLogEntry(entry);
  } catch (error) {
    console.warn('Audit log append failed (operation continues):', error);
  }
}
