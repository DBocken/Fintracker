import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { TaxRubricCard } from '../TaxRubricCard';
import type { TaxRubricReport } from '@/lib/tax-report';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
}

const creditReport: TaxRubricReport = {
  rubricId: '35a-handwerker',
  anlage: '35a',
  kind: 'credit',
  informationalOnly: false,
  costsTotal: 1800,
  eligibleCosts: 1200,
  credit: 240,
  capUtilization: 0.2,
  capCosts: 6000,
  calculation: {
    base: 1200,
    capCosts: 6000,
    cappedBase: 1200,
    rate: 0.2,
    rawCredit: 240,
    capCredit: 1200,
    credit: 240,
  },
  threshold: null,
  virtualItems: [],
  byCategory: [{ taxCategoryId: 'tax-35a3-handwerker', costs: 1800, refunds: 0, net: 1800, txCount: 1 }],
  transactionIds: ['t1'],
  warnings: [],
};

const deductionReport: TaxRubricReport = {
  rubricId: 'werbungskosten',
  anlage: 'N',
  kind: 'deduction',
  informationalOnly: false,
  costsTotal: 200,
  eligibleCosts: 0,
  credit: null,
  capUtilization: null,
  capCosts: null,
  calculation: null,
  threshold: { value: 1230, reached: false, remaining: 1030 },
  virtualItems: [],
  byCategory: [],
  transactionIds: [],
  warnings: [],
};

describe('TaxRubricCard', () => {
  describe('Normal Behavior', () => {
    it('sollte die exakte §35a-Ermäßigung auf Deutsch anzeigen', () => {
      renderWithI18n(<TaxRubricCard report={creditReport} />);
      expect(screen.getByText(/240,00/)).toBeInTheDocument();
      expect(screen.getByText('§35a/§35c')).toBeInTheDocument();
    });

    it('sollte die §35a-Ermäßigung auf Englisch anzeigen', () => {
      renderWithI18n(<TaxRubricCard report={creditReport} />, 'en');
      expect(screen.getByText(/tax credit|240/)).toBeInTheDocument();
    });

    it('sollte den Pauschbetrag-Rest bei Werbungskosten zeigen', () => {
      renderWithI18n(<TaxRubricCard report={deductionReport} />);
      expect(screen.getByText(/1\.030,00/)).toBeInTheDocument();
    });

    it('sollte beim Aufklappen die Kategorie-Summen zeigen', () => {
      renderWithI18n(<TaxRubricCard report={creditReport} />);
      fireEvent.click(screen.getByRole('button'));
      // Der Kategorie-Zähler „(1 Buchungen)" erscheint nur im aufgeklappten Panel.
      expect(screen.getByText(/1 Buchungen/)).toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte die Rubrik-/Anlage-Keys in de und en definieren', () => {
      const keys = ['tax.rubric.35aHandwerker.name', 'tax.anlage.35a', 'tax.page.creditExact'];
      for (const key of keys) {
        for (const locale of ['de', 'en'] as const) {
          let node: unknown = translations[locale];
          for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
          expect(typeof node, `${key} in ${locale}`).toBe('string');
        }
      }
    });
  });
});
