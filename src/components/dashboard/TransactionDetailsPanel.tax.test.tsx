import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { Category, Transaction } from '@/types';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';

// Key-sensitiver Query-Mock: liefert Allocations nur für den 'allocations'-Key,
// damit der Split-Hinweis gezielt getestet werden kann.
let mockAllocations: unknown[] = [];
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey?: unknown[] } = {}) =>
    queryKey?.[0] === 'allocations' ? { data: mockAllocations } : { data: [] },
}));
vi.mock('@/components/categories/CategoryTwoStepSelect', () => ({
  CategoryTwoStepSelect: () => <div data-testid="cat-select" />,
}));
vi.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback ?? null}</>,
}));
vi.mock('@/services/transaction-service', () => ({
  explainCategorization: () => ({ categoryId: null, confidence: 0, reasons: [] }),
}));
vi.mock('@/services/audit-log-service', () => ({ safeAudit: vi.fn(), redactForAudit: (x: unknown) => x }));
vi.mock('@/services/merchant-rules-service', () => ({ getMerchantRules: vi.fn(), upsertMerchantRule: vi.fn() }));

import { TransactionDetailsPanel } from './TransactionDetailsPanel';

const CATS: Category[] = [{ id: 'food', name: 'Lebensmittel', parent_id: null } as Category];

function baseTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    date: '2025-05-10',
    amount: -1800,
    payee: 'Malerbetrieb',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function renderPanel(tx: Transaction, locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <TransactionDetailsPanel
          transaction={tx}
          categories={CATS}
          accounts={[]}
          allTransactions={[tx]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          layout="stacked"
        />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('TransactionDetailsPanel – Steuer-Sektion', () => {
  describe('Normal Behavior', () => {
    it('sollte die Steuer-Sektion auf Deutsch anzeigen', () => {
      renderPanel(baseTx());
      // Genau EINE Überschrift „Steuer"; das Feld-Label heißt „Steuer-Rubrik"
      // (kein doppeltes Label mehr).
      expect(screen.getAllByText('Steuer')).toHaveLength(1);
      expect(screen.getByText('Steuer-Rubrik')).toBeInTheDocument();
    });

    it('sollte die Steuer-Sektion auf Englisch anzeigen', () => {
      renderPanel(baseTx(), 'en');
      expect(screen.getAllByText('Taxes').length).toBeGreaterThan(0);
    });

    it('sollte das Arbeitskosten-Feld nur bei der Handwerker-Rubrik zeigen', () => {
      renderPanel(baseTx({ tax_category_id: 'tax-35a3-handwerker' }));
      expect(screen.getByLabelText(/davon Arbeitskosten/)).toBeInTheDocument();
    });

    it('sollte KEIN Arbeitskosten-Feld bei einer Nicht-Handwerker-Rubrik zeigen', () => {
      renderPanel(baseTx({ tax_category_id: 'tax-agb-krankheit' }));
      expect(screen.queryByLabelText(/davon Arbeitskosten/)).not.toBeInTheDocument();
    });

    it('sollte den Cashless-Hinweis bei §35a zeigen', () => {
      renderPanel(baseTx({ tax_category_id: 'tax-35a3-handwerker' }));
      expect(screen.getByText(/nur unbare Zahlung/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('[REGRESSION] sollte die Steuer-Sektion bei internen Überträgen ausblenden', () => {
      renderPanel(baseTx({ is_transfer: true }));
      // Sektionsüberschrift „Steuer" darf nicht erscheinen (nur der Transfer-Block).
      expect(screen.queryByText('Steuer')).not.toBeInTheDocument();
    });

    it('sollte bei aufgeteilten Buchungen den Gesamtbetrag-Hinweis zeigen (auch ohne Premium)', () => {
      // FeatureGate ist in diesem Test auf Fallback gemockt (= kein Premium):
      // Der Hinweis muss trotzdem erscheinen, weil Allocations ein Downgrade überleben.
      mockAllocations = [{ id: 'a1', transaction_id: 't1', amount_minor: -90000, category_id: 'food', source: 'manual' }];
      try {
        renderPanel(baseTx({ tax_category_id: 'tax-35a3-handwerker' }));
        expect(screen.getByText(/bezieht sich auf den Gesamtbetrag/)).toBeInTheDocument();
      } finally {
        mockAllocations = [];
      }
    });

    it('sollte den Split-Hinweis ohne Steuer-Markierung NICHT zeigen', () => {
      mockAllocations = [{ id: 'a1', transaction_id: 't1', amount_minor: -90000, category_id: 'food', source: 'manual' }];
      try {
        renderPanel(baseTx({}));
        expect(screen.queryByText(/bezieht sich auf den Gesamtbetrag/)).not.toBeInTheDocument();
      } finally {
        mockAllocations = [];
      }
    });
  });

  describe('Steuer-Default-Chip', () => {
    const HANDWERKER_CATS: Category[] = [
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: null } as Category,
      {
        id: 'local-cat-handwerker',
        name: 'Handwerker & Reparaturen',
        filters: [],
        parent_id: 'local-cat-wohnen',
        attributes: { default_tax_category_id: 'tax-35a3-handwerker' },
      } as Category,
    ];

    function renderWithHandwerker(tx: Transaction, locale: 'de' | 'en' = 'de') {
      return render(
        <I18nProvider initialLocale={locale}>
          <MemoryRouter>
            <TransactionDetailsPanel
              transaction={tx}
              categories={HANDWERKER_CATS}
              accounts={[]}
              allTransactions={[tx]}
              onSave={vi.fn()}
              onClose={vi.fn()}
              layout="stacked"
            />
          </MemoryRouter>
        </I18nProvider>,
      );
    }

    it('sollte den Kategorie-Default als Vorschlag anbieten und übernehmen', () => {
      renderWithHandwerker(
        baseTx({ category_id: 'local-cat-wohnen', subcategory_id: 'local-cat-handwerker' }),
      );
      // Chip mit Grund sichtbar …
      expect(screen.getByText(/ist als .* voreingestellt/)).toBeInTheDocument();
      // … Übernehmen setzt die Rubrik in den Entwurf → Arbeitskosten-Feld erscheint.
      fireEvent.click(screen.getByRole('button', { name: /Übernehmen/ }));
      expect(screen.getByLabelText(/davon Arbeitskosten/)).toBeInTheDocument();
      expect(screen.queryByText(/ist als .* voreingestellt/)).not.toBeInTheDocument();
    });

    it('sollte den Chip auf Englisch rendern', () => {
      renderWithHandwerker(
        baseTx({ category_id: 'local-cat-wohnen', subcategory_id: 'local-cat-handwerker' }),
        'en',
      );
      expect(screen.getByText(/is preset as/)).toBeInTheDocument();
    });

    it('sollte KEINEN Chip zeigen, wenn bereits markiert', () => {
      renderWithHandwerker(
        baseTx({
          category_id: 'local-cat-wohnen',
          subcategory_id: 'local-cat-handwerker',
          tax_category_id: 'tax-35a3-handwerker',
        }),
      );
      expect(screen.queryByText(/ist als .* voreingestellt/)).not.toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte die neuen Steuer-Form-Keys in de und en definieren', () => {
      const keys = ['tax.form.sectionTitle', 'tax.form.laborCostsLabel', 'tax.form.cashlessHint', 'tax.form.noteLabel'];
      for (const key of keys) {
        for (const locale of ['de', 'en'] as const) {
          let node: unknown = translations[locale];
          for (const part of key.split('.')) {
            node = (node as Record<string, unknown>)[part];
          }
          expect(typeof node, `${key} in ${locale}`).toBe('string');
        }
      }
    });
  });
});
