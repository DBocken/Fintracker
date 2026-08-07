import {
  readLocalFinanceList,
  writeLocalFinanceList,
  upsertLocalFinanceItem,
  deleteLocalFinanceItem,
} from './local-finance-store';
import type { AutomationSuggestion, AutomationSuggestionStatus } from '@/lib/automation-suggestion-model';

export async function getAutomationSuggestions(): Promise<AutomationSuggestion[]> {
  return readLocalFinanceList<AutomationSuggestion>('automationSuggestions');
}

export async function getPendingAutomationSuggestions(): Promise<AutomationSuggestion[]> {
  const all = await getAutomationSuggestions();
  return all.filter((s) => s.status === 'pending');
}

export async function upsertAutomationSuggestion(
  suggestion: AutomationSuggestion,
): Promise<AutomationSuggestion> {
  return upsertLocalFinanceItem<AutomationSuggestion>('automationSuggestions', suggestion);
}

export async function updateAutomationSuggestionStatus(
  id: string,
  status: AutomationSuggestionStatus,
): Promise<void> {
  const all = await getAutomationSuggestions();
  const index = all.findIndex((s) => s.id === id);
  if (index < 0) return;
  all[index] = { ...all[index], status, updated_at: new Date().toISOString() };
  await writeLocalFinanceList('automationSuggestions', all);
}

export async function deleteAutomationSuggestion(id: string): Promise<void> {
  await deleteLocalFinanceItem<AutomationSuggestion>('automationSuggestions', id);
}
