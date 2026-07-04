import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { BudgetOverrideForm } from '../ForecastPlanner';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';

/** Karten-Chrome = sichtbarer Rahmen (`border`-Breiten-Utility) oder Schatten.
 * Hintergrund-Tönung zum Bündeln zählt NICHT als Karte (Usability-Audit). */
function hasCardChrome(el: Element): boolean {
  const tokens = el.className.split(/\s+/);
  const hasBorderUtil = tokens.some((c) => /^border(-(x|y|t|r|b|l|s|e))?$/.test(c));
  const hasShadow = tokens.some((c) => /^shadow(-|$)/.test(c));
  return hasBorderUtil || hasShadow;
}

const overrides = { categoryBudgets: {} } as unknown as ForecastOverrides;

describe('ForecastPlanner Prinzip 8 (Karten sind Aktionen)', () => {
  it('[REGRESSION] Budget-Zeilen sollen keinen Karten-Rahmen tragen (kein Rahmen um ein einzelnes Feld)', () => {
    const { container } = render(
      <I18nProvider>
        <BudgetOverrideForm
          variableExpenses={[
            { category: 'Wohnen', monthlyAmount: 1071.08, confidence: 0.75 },
            { category: 'Lebensmittel', monthlyAmount: 158.06, confidence: 0.75 },
          ]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    // Jede Budget-Zeile (direktes Kind der Liste) darf kein Karten-Chrome haben.
    const rows = Array.from(container.querySelectorAll(':scope > div > div'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(hasCardChrome(row)).toBe(false);
    }
  });

  it('sollte die Kategorien und ihre Eingabefelder weiterhin rendern', () => {
    const { getByText, getAllByRole } = render(
      <I18nProvider>
        <BudgetOverrideForm
          variableExpenses={[{ category: 'Wohnen', monthlyAmount: 1071.08 }]}
          overrides={overrides}
          onChange={() => {}}
        />
      </I18nProvider>,
    );
    expect(getByText('Wohnen')).toBeInTheDocument();
    expect(getAllByRole('spinbutton').length).toBe(1);
  });
});
