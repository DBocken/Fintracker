import { Transaction, Rule, RuleCondition } from '../types';
import { getRules, saveTransactions } from '../lib/db';

function evaluateCondition(tx: Transaction, cond: RuleCondition): boolean {
  const fieldValue = (tx as Record<string, unknown>)[cond.field as string];
  if (fieldValue == null) return false;
  switch (cond.operator) {
    case 'equals':
      return fieldValue === cond.value;
    case 'contains':
      return typeof fieldValue === 'string' && String(fieldValue).includes(String(cond.value));
    case 'gt':
      return Number(fieldValue) > Number(cond.value);
    case 'lt':
      return Number(fieldValue) < Number(cond.value);
    default:
      return false;
  }
}

export const CategorizationService = {
  async applyRules(transactions: Transaction[]): Promise<Transaction[]> {
    const rules: Rule[] = await getRules();
    transactions.forEach(tx => {
      for (const rule of rules) {
        const matches = rule.conditions.every(cond => evaluateCondition(tx, cond));
        if (matches) {
          tx.category = rule.category;
          break;
        }
      }
    });
    await saveTransactions(transactions);
    return transactions;
  }
};
