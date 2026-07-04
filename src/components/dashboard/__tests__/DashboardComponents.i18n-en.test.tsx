import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { TransactionFilters } from '../TransactionFilters';
import { TransactionStats } from '../TransactionStats';
import { BulkActions } from '../BulkActions';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock('@/components/categories/CategoryTwoStepSelect', () => ({
  CategoryTwoStepSelect: () => <div data-testid="cat-select" />,
}));

const noop = () => {};

/**
 * Render-Tests der migrierten Dashboard-Komponenten mit locale 'en':
 * bekannte deutsche Strings dürfen nicht mehr erscheinen, englische schon.
 */
function withEnglish(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

beforeEach(() => {
  window.localStorage.setItem('ausgabentracker_locale_v1', 'en');
});

describe('Dashboard-Komponenten mit locale en', () => {
  describe('TransactionFilters', () => {
    const renderFilters = () =>
      withEnglish(
        <TransactionFilters
          filterCat="all"
          setFilterCat={noop}
          filterAccount="all"
          setFilterAccount={noop}
          searchInput=""
          setSearchInput={noop}
          range="Gesamt"
          setRange={noop}
          customDays={30}
          setCustomDays={noop}
          customGran="daily"
          setCustomGran={noop}
          customPeriod=""
          setCustomPeriod={noop}
          periodOptions={[]}
          categories={[]}
          filterContract="all"
          setFilterContract={noop}
          filterEssential="all"
          setFilterEssential={noop}
          filterAusgabenklasse="all"
          setFilterAusgabenklasse={noop}
          showSearch={false}
          stacked
        />,
      );

    it('sollte englische Feld-Labels statt deutscher zeigen', () => {
      renderFilters();
      for (const label of ['Account', 'Category', 'Contracts', 'Essential', 'Spending class', 'Time range']) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      for (const german of ['Konto', 'Kategorie', 'Verträge', 'Essenziell', 'Ausgabenklasse', 'Zeitraum']) {
        expect(screen.queryByText(german)).toBeNull();
      }
    });

    it('sollte Platzhalter der Selects auf Englisch anzeigen', () => {
      renderFilters();
      expect(screen.getByText('All accounts')).toBeInTheDocument();
      expect(screen.getByText('All categories')).toBeInTheDocument();
      expect(screen.queryByText('Alle Konten')).toBeNull();
      expect(screen.queryByText('Alle Kategorien')).toBeNull();
    });

    it('sollte den Zeitraum-Wert „Gesamt" als englisches Label rendern', () => {
      renderFilters();
      expect(screen.getByText('All time')).toBeInTheDocument();
      expect(screen.queryByText('Gesamt')).toBeNull();
    });
  });

  describe('TransactionStats', () => {
    it('sollte Kennzahlen-Beschriftungen auf Englisch zeigen', () => {
      withEnglish(
        <TransactionStats
          income={100}
          expenses={50}
          balance={50}
          count={3}
          totalTransactions={10}
          currentBalance="1.234 €"
        />,
      );
      expect(screen.getByText('Income')).toBeInTheDocument();
      expect(screen.getByText('Expenses')).toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.queryByText('Einnahmen')).toBeNull();
      expect(screen.queryByText('Ausgaben')).toBeNull();
      expect(screen.queryByText('Kontostand')).toBeNull();
    });
  });

  describe('BulkActions', () => {
    it('sollte Aktions-Beschriftungen auf Englisch zeigen', () => {
      withEnglish(
        <BulkActions
          selectedCount={2}
          bulkCategory=""
          onBulkCategoryChange={noop}
          onApplyBulk={noop}
          onClearSelection={noop}
          onBulkDelete={noop}
          categories={[]}
        />,
      );
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(screen.getByText(/Assign/)).toBeInTheDocument();
      expect(screen.getByText(/Deselect/)).toBeInTheDocument();
      expect(screen.queryByText(/ausgewählt/)).toBeNull();
      expect(screen.queryByText(/Zuweisen/)).toBeNull();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte mit locale de weiterhin die deutschen Labels zeigen', () => {
      window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
      withEnglish(
        <TransactionStats
          income={100}
          expenses={50}
          balance={50}
          count={3}
          totalTransactions={10}
          currentBalance="1.234 €"
        />,
      );
      expect(screen.getByText('Einnahmen')).toBeInTheDocument();
      expect(screen.getByText('Kontostand')).toBeInTheDocument();
      expect(screen.queryByText('Income')).toBeNull();
    });
  });
});
