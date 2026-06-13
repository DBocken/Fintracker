import { supabase } from '../integrations/supabase/client';
import { getCurrentUserId } from './auth-service';
import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';

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
  const maybeUid = await getCurrentUserId();
  if (!maybeUid) return readLocalFinanceList<MerchantRule>('merchantRules');

  const { data, error } = await supabase
    .from('user_merchant_rules')
    .select('*')
    .eq('user_id', maybeUid);

  if (error) throw new Error(error.message);
  return (data || []) as MerchantRule[];
}

export async function upsertMerchantRule(merchantPattern: string, categoryId: string): Promise<void> {
  const pattern = merchantPattern.trim();
  if (!pattern) return;

  const maybeUid = await getCurrentUserId();
  const now = new Date().toISOString();

  if (!maybeUid) {
    const rules = await readLocalFinanceList<MerchantRule>('merchantRules');
    const existing = rules.find((r) => r.merchant_pattern === pattern);
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
    return;
  }

  const { error } = await supabase
    .from('user_merchant_rules')
    .upsert(
      {
        user_id: maybeUid,
        merchant_pattern: pattern,
        category_id: categoryId,
        updated_at: now,
      },
      { onConflict: 'user_id,merchant_pattern' }
    );

  if (error) throw new Error(error.message);
}

export async function deleteMerchantRule(id: string): Promise<void> {
  const maybeUid = await getCurrentUserId();

  if (!maybeUid) {
    const rules = await readLocalFinanceList<MerchantRule>('merchantRules');
    await writeLocalFinanceList('merchantRules', rules.filter((r) => r.id !== id));
    return;
  }

  const { error } = await supabase
    .from('user_merchant_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', maybeUid);

  if (error) throw new Error(error.message);
}
