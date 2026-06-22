import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';
import { safeAudit, redactForAudit } from './audit-log-service';

/**
 * Vom Nutzer gelernte Zuordnung: ein normalisierter Händlername wird beim
 * nächsten Mal automatisch der angegebenen Kategorie zugeordnet (Stufe 1 der
 * Kategorisierung, siehe categorizeTransaction).
 */
export interface MerchantRule {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category_id: string;
  created_at?: string;
  updated_at?: string;
}

export async function getMerchantRules(): Promise<MerchantRule[]> {
  return readLocalFinanceList<MerchantRule>('merchantRules');
}

export async function upsertMerchantRule(merchantPattern: string, categoryId: string): Promise<void> {
  const pattern = merchantPattern.trim();
  if (!pattern) return;

  const now = new Date().toISOString();
  const rules = await readLocalFinanceList<MerchantRule>('merchantRules');
  const existing = rules.find((r) => r.merchant_pattern === pattern);
  const before = existing ? { ...existing } : null;
  if (existing) {
    existing.category_id = categoryId;
    existing.updated_at = now;
  } else {
    rules.push({
      id: crypto.randomUUID(),
      user_id: 'local',
      merchant_pattern: pattern,
      category_id: categoryId,
      created_at: now,
      updated_at: now,
    });
  }
  await writeLocalFinanceList('merchantRules', rules);

  const saved = rules.find((r) => r.merchant_pattern === pattern);
  await safeAudit({
    actor: 'user',
    entityType: 'merchant_rule',
    entityId: saved?.id ?? pattern,
    action: existing ? 'update' : 'create',
    title: existing ? `Händlerregel aktualisiert: ${pattern}` : `Händlerregel angelegt: ${pattern}`,
    redactedBefore: redactForAudit(before, ['merchant_pattern', 'category_id']),
    redactedAfter: redactForAudit(saved, ['merchant_pattern', 'category_id']),
    reversible: true,
    reversal: saved ? { operation: 'update', targetCollection: 'merchantRules', targetId: saved.id } : null,
  });
}

export async function deleteMerchantRule(id: string): Promise<void> {
  const rules = await readLocalFinanceList<MerchantRule>('merchantRules');
  const removed = rules.find((r) => r.id === id) ?? null;
  await writeLocalFinanceList('merchantRules', rules.filter((r) => r.id !== id));

  await safeAudit({
    actor: 'user',
    entityType: 'merchant_rule',
    entityId: id,
    action: 'delete',
    title: removed ? `Händlerregel gelöscht: ${removed.merchant_pattern}` : 'Händlerregel gelöscht',
    redactedBefore: redactForAudit(removed, ['merchant_pattern', 'category_id']),
    redactedAfter: null,
    reversible: true,
    reversal: { operation: 'restore', targetCollection: 'merchantRules', targetId: id },
  });
}
