import { describe, it, expect } from 'vitest';
import { translations } from '@/i18n/translations';
import { lookupTranslation } from '@/i18n/I18nProvider';

/**
 * i18n-Abdeckung für die Dashboard-Komponenten-Scheibe (Filter, Stats,
 * Bulk-Aktionen, Listen, Detail-Modal, Datenqualität). Stellt sicher, dass
 * jeder Key in BEIDEN Sprachen existiert – kein einseitiger Key.
 */

/** Sammelt alle punktierten Blatt-Schlüssel eines Übersetzungsbaums. */
function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

// Alle Keys, die diese Scheibe neu einführt (Dashboard-Komponenten).
const NEW_DASHBOARD_KEYS = [
  // TransactionFilters
  'dashboard.filterAccountAria',
  'dashboard.allAccounts',
  'dashboard.budgetPool',
  'dashboard.filterCategoryAria',
  'dashboard.allCategories',
  'dashboard.filterContractAria',
  'dashboard.contracts',
  'dashboard.all',
  'dashboard.contractsOnly',
  'dashboard.withoutContracts',
  'dashboard.essential',
  'dashboard.filterEssentialAria',
  'dashboard.essentialOnly',
  'dashboard.notEssential',
  'dashboard.expenseClass',
  'dashboard.timeRange',
  'dashboard.filterRangeAria',
  'dashboard.period',
  'dashboard.selectPeriodAria',
  'dashboard.selectPeriodPlaceholder',
  'dashboard.noData',
  'dashboard.days',
  'dashboard.granularity',
  'dashboard.granularityAria',
  'dashboard.daily',
  'dashboard.weekly',
  'dashboard.monthly',
  'dashboard.searchLabel',
  'dashboard.searchTransactions',
  'dashboard.ranges.total',
  'dashboard.ranges.year',
  'dashboard.ranges.quarter',
  'dashboard.ranges.month',
  'dashboard.ranges.days7',
  'dashboard.ranges.days30',
  'dashboard.ranges.days90',
  'dashboard.ranges.months6',
  'dashboard.ranges.year1',
  'dashboard.ranges.custom',
  // AusgabenklasseFilter
  'dashboard.filterClassAria',
  'dashboard.allClasses',
  'dashboard.classDiscretionary',
  'dashboard.classSavings',
  'dashboard.classIncome',
  'dashboard.uncategorized',
  // TransactionStats
  'dashboard.balanceTitle',
  'dashboard.income',
  'dashboard.expenses',
  'dashboard.balance',
  'dashboard.transactions',
  'dashboard.of',
  // TransactionTable (Screenreader)
  'dashboard.expenseSr',
  'dashboard.incomeSr',
  // BulkActions
  'dashboard.selectedLabel',
  'dashboard.assign',
  'dashboard.deselect',
  // Dashboard
  'dashboard.coachCardAria',
  'dashboard.coachCardText',
  'dashboard.filter',
  'dashboard.resetFilters',
  'dashboard.cashflowTitle',
  'dashboard.cashflowDescription',
  'dashboard.recentTransactions',
  'dashboard.showAllTransactions',
  'dashboard.showAllPrefix',
  'dashboard.showAllSuffix',
  'dashboard.noTransactionsFound',
  'dashboard.noTransactionsFoundHint',
  'dashboard.reload',
  'dashboard.noTransactionsYet',
  'dashboard.noTransactionsYetHint',
  'dashboard.importCsv',
  'dashboard.connectBank',
  // TransactionDetailsModal
  'dashboard.transactionDetails',
  // DataQualityNotice
  'dashboard.dataQualityTitle',
  'dashboard.dataQualityBody',
  'dashboard.andPrefix',
  'dashboard.andMoreOne',
  'dashboard.andMoreMany',
];

describe('Dashboard-Komponenten i18n-Abdeckung', () => {
  describe('Normal Behavior', () => {
    it('sollte jeden neuen Dashboard-Key in DE und EN definieren', () => {
      const missing = NEW_DASHBOARD_KEYS.flatMap((key) => {
        const out: string[] = [];
        if (lookupTranslation('de', key) === undefined) out.push(`de:${key}`);
        if (lookupTranslation('en', key) === undefined) out.push(`en:${key}`);
        return out;
      });
      expect(missing).toEqual([]);
    });

    it('sollte für repräsentative Keys tatsächlich unterschiedliche DE/EN-Texte liefern', () => {
      for (const key of [
        'dashboard.allAccounts',
        'dashboard.timeRange',
        'dashboard.income',
        'dashboard.recentTransactions',
        'dashboard.ranges.total',
        'dashboard.dataQualityTitle',
      ]) {
        expect(lookupTranslation('de', key)).not.toBe(lookupTranslation('en', key));
      }
    });
  });

  describe('Edge Cases', () => {
    it('sollte im gesamten Übersetzungsbaum keine einseitigen Keys haben (DE ↔ EN strukturgleich)', () => {
      const deKeys = collectKeys(translations.de).sort();
      const enKeys = collectKeys(translations.en).sort();
      expect(enKeys).toEqual(deKeys);
    });
  });
});
