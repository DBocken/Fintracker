export interface Transaction {
  date: string;
  amount: number;
  recipient: string;
  category: string | null;
  raw: Record<string, unknown>;
}

export type Operator = 'equals' | 'contains' | 'gt' | 'lt';

export interface RuleCondition {
  field: keyof Transaction;
  operator: Operator;
  value: unknown;
}

export interface Rule {
  conditions: RuleCondition[];
  category: string;
}

export interface Budget {
  category: string;
  limit: number;
  interval: 'monthly' | 'weekly' | 'yearly';
}
