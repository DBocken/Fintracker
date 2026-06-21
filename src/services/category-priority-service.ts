import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';

export interface UserCategoryPriority {
  category_id: string;
  priority: number;
}

export async function getUserCategoryPriorities(_userId: string): Promise<UserCategoryPriority[]> {
  return readLocalFinanceList<UserCategoryPriority>('categoryPriorities');
}

export async function upsertUserCategoryPriorities(_userId: string, items: UserCategoryPriority[]): Promise<void> {
  if (!items.length) return;
  const current = await readLocalFinanceList<UserCategoryPriority>('categoryPriorities');
  const next = new Map(current.map((item) => [item.category_id, item]));
  items.forEach((item) => next.set(item.category_id, item));
  await writeLocalFinanceList('categoryPriorities', [...next.values()]);
}
