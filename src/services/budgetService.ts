import { Budget } from '../types';
import { saveBudgets } from '../lib/db';

export const BudgetService = {
  async createBudget(budget: Budget): Promise<void> {
    if (!budget.category.trim()) {
      throw new Error('category not empty');
    }
    if (budget.limit <= 0) {
      throw new Error('limit > 0');
    }
    await saveBudgets(budget);
  }
};
