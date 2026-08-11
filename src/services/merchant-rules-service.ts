import { t } from '../i18n/serviceT';
import { mutateLocalFinanceList, readLocalFinanceList } from './local-finance-store';
import { safeAudit, redactForAudit } from './audit-log-service';
import type { MerchantRule } from '@/lib/categorization';

export async function getMerchantRules(): Promise<MerchantRule[]> {
  return readLocalFinanceList<MerchantRule>('merchantRules');
}

export async function upsertMerchantRule(merchantPattern: string, categoryId: string): Promise<void> {
  const pattern = merchantPattern.trim();
  if (!pattern) return;

  const now = new Date().toISOString();
  // Halter-Objekt statt `let`: TypeScript verwirft die Typinformation einer
  // Variablen, die in einem Callback gesetzt wird (sie gilt danach als `null`);
  // eine Eigenschaft behält ihren deklarierten Typ.
  const vorher: { regel: MerchantRule | null; bestand: boolean } = { regel: null, bestand: false };

  // Lesen, Ändern und Schreiben in einem Lock (Issue #311): Zwei gleichzeitig
  // bestätigte Kategorisierungen liessen sonst eine der beiden Regeln fallen.
  const rules = await mutateLocalFinanceList<MerchantRule>('merchantRules', (aktuell) => {
    const existing = aktuell.find((r) => r.merchant_pattern === pattern);
    vorher.regel = existing ? { ...existing } : null;
    vorher.bestand = Boolean(existing);
    if (existing) {
      return aktuell.map((r) =>
        r.merchant_pattern === pattern ? { ...r, category_id: categoryId, updated_at: now } : r,
      );
    }
    return [
      ...aktuell,
      {
        id: crypto.randomUUID(),
        user_id: 'local',
        merchant_pattern: pattern,
        category_id: categoryId,
        created_at: now,
        updated_at: now,
      },
    ];
  });

  const saved = rules.find((r) => r.merchant_pattern === pattern);
  await safeAudit({
    actor: 'user',
    entityType: 'merchant_rule',
    entityId: saved?.id ?? pattern,
    action: vorher.bestand ? 'update' : 'create',
    title: vorher.bestand
      ? t('merchantRulesService.ruleUpdatedTitle', 'Händlerregel aktualisiert: {pattern}').replace('{pattern}', pattern)
      : t('merchantRulesService.ruleCreatedTitle', 'Händlerregel angelegt: {pattern}').replace('{pattern}', pattern),
    redactedBefore: redactForAudit(vorher.regel, ['merchant_pattern', 'category_id']),
    redactedAfter: redactForAudit(saved, ['merchant_pattern', 'category_id']),
    reversible: true,
    reversal: saved ? { operation: 'update', targetCollection: 'merchantRules', targetId: saved.id } : null,
  });
}

export async function deleteMerchantRule(id: string): Promise<void> {
  const geloescht: { regel: MerchantRule | null } = { regel: null };
  await mutateLocalFinanceList<MerchantRule>('merchantRules', (rules) => {
    geloescht.regel = rules.find((r) => r.id === id) ?? null;
    return rules.filter((r) => r.id !== id);
  });
  const removed = geloescht.regel;

  await safeAudit({
    actor: 'user',
    entityType: 'merchant_rule',
    entityId: id,
    action: 'delete',
    title: removed
      ? t('merchantRulesService.ruleDeletedWithPatternTitle', 'Händlerregel gelöscht: {pattern}').replace('{pattern}', removed.merchant_pattern)
      : t('merchantRulesService.ruleDeletedTitle', 'Händlerregel gelöscht'),
    redactedBefore: redactForAudit(removed, ['merchant_pattern', 'category_id']),
    redactedAfter: null,
    reversible: true,
    reversal: { operation: 'restore', targetCollection: 'merchantRules', targetId: id },
  });
}
