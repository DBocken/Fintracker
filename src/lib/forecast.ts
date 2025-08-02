export interface RecurringItem {
  amount: number; // positive for income, negative for expense
  category: string;
  start?: Date;
  end?: Date;
}

export interface Budget {
  category: string;
  limit: number;
}

export interface ForecastParams {
  initialBalance: number;
  incomes?: RecurringItem[];
  contracts?: RecurringItem[];
  budgets?: Budget[];
  months?: number;
}

export interface ForecastMonth {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

/**
 * Calculates a forecast for at least six months. Parameters such as
 * regular income, contracts or category budgets can be added or removed.
 */
export function calculateForecast({
  initialBalance,
  incomes = [],
  contracts = [],
  budgets = [],
  months = 6,
}: ForecastParams): ForecastMonth[] {
  const result: ForecastMonth[] = [];
  let balance = initialBalance;
  const period = Math.max(months, 6);

  for (let i = 0; i < period; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);

    const activeIncomes = incomes.filter(
      (item) => (!item.start || item.start <= date) && (!item.end || item.end >= date)
    );
    const activeContracts = contracts.filter(
      (item) => (!item.start || item.start <= date) && (!item.end || item.end >= date)
    );

    const income = activeIncomes.reduce((sum, item) => sum + item.amount, 0);

    const expensesByCategory: Record<string, number> = {};
    activeContracts.forEach((item) => {
      const current = expensesByCategory[item.category] ?? 0;
      expensesByCategory[item.category] = current + Math.abs(item.amount);
    });

    budgets.forEach((b) => {
      if (expensesByCategory[b.category] != null) {
        expensesByCategory[b.category] = Math.min(expensesByCategory[b.category], b.limit);
      }
    });

    const expenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);

    balance += income - expenses;

    result.push({
      month: date.toLocaleString('de-DE', { month: 'short' }),
      income,
      expenses,
      balance,
    });
  }

  return result;
}

