import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { translations } from '@/i18n/translations';
import { CategoryForm } from '../CategoryForm';
import type { CategoryAttributes } from '../../../types';

function openAdvanced(triggerLabel: RegExp) {
  fireEvent.click(screen.getByText(triggerLabel));
}

function renderForm(
  attributes: CategoryAttributes = {},
  locale: 'de' | 'en' = 'de',
  onAttributesChange = vi.fn(),
) {
  renderWithI18n(
    <CategoryForm
      name="Handwerker"
      color="#1d5c54"
      icon="🔧"
      filters={[]}
      parentId="local-cat-wohnen"
      editingCategory={null}
      attributes={attributes}
      onNameChange={vi.fn()}
      onColorChange={vi.fn()}
      onIconChange={vi.fn()}
      onAddFilter={vi.fn()}
      onRemoveFilter={vi.fn()}
      onAttributesChange={onAttributesChange}
      onSave={vi.fn()}
      onReset={vi.fn()}
    />,
    locale,
  );
  return { onAttributesChange };
}

describe('CategoryForm Steuer-Rubrik', () => {
  describe('Normal Behavior', () => {
    it('sollte das Steuer-Rubrik-Feld auf Deutsch rendern', () => {
      renderForm();
      openAdvanced(/Erweiterte Eigenschaften/);
      expect(screen.getByText('Steuer-Rubrik (Vorschlag)')).toBeInTheDocument();
      // "Keine Vorauswahl" wird im Trigger angezeigt, wenn nichts gesetzt ist.
      expect(screen.getByText('Keine Vorauswahl')).toBeInTheDocument();
    });

    it('sollte das Steuer-Rubrik-Feld auf Englisch rendern', () => {
      renderForm({}, 'en');
      openAdvanced(/Advanced properties/);
      expect(screen.getByText('Tax category (suggestion)')).toBeInTheDocument();
      expect(screen.getByText('No preset')).toBeInTheDocument();
    });

    it('sollte die voreingestellte Rubrik als Trigger-Wert anzeigen', () => {
      renderForm({ default_tax_category_id: 'tax-35a3-handwerker' });
      openAdvanced(/Erweiterte Eigenschaften/);
      expect(screen.getByText('Handwerkerleistung')).toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte die neuen i18n-Keys in de und en definieren', () => {
      const keys = [
        'categoryForm.defaultTaxCategoryLabel',
        'categoryForm.defaultTaxCategoryHint',
        'categoryForm.defaultTaxCategoryNone',
        'tax.form.notTaxRelevant',
        'tax.rubric.35aHandwerker.name',
        'tax.cat.handwerker.name',
      ];
      for (const key of keys) {
        for (const locale of ['de', 'en'] as const) {
          let node: unknown = translations[locale];
          for (const part of key.split('.')) {
            expect(node, `${key} missing in ${locale}`).toBeDefined();
            node = (node as Record<string, unknown>)[part];
          }
          expect(typeof node, `${key} in ${locale} should be a string`).toBe('string');
        }
      }
    });
  });
});

describe('CategoryForm – Monatsbudget (AGENTS.md §8)', () => {
  // Das Budgetfeld war ein `<Input type="number">`. In einem deutschen Browser
  // wird aus getipptem „250,50" der Wert „25050" — ein Kategoriebudget, das
  // hundertmal zu hoch steht, schlägt nie an. Eine Warnung, die nicht kommt,
  // sieht genauso aus wie „alles in Ordnung".
  it('[REGRESSION] sollte „250,50" als Monatsbudget 250,50 melden, nicht als 25050', () => {
    const { onAttributesChange } = renderForm();
    openAdvanced(/Erweiterte Eigenschaften/);

    const budget = document.getElementById('category-budget-monat') as HTMLInputElement;
    fireEvent.change(budget, { target: { value: '250,50' } });

    expect(onAttributesChange).toHaveBeenCalledWith({ budget_monat: 250.5 });
  });

  it('sollte ein geleertes Budgetfeld als „nicht gesetzt" melden, nicht als 0', () => {
    // 0 € Budget und „kein Budget" sind verschiedene Aussagen: Das eine warnt
    // bei jedem Cent, das andere gar nicht.
    const { onAttributesChange } = renderForm({ budget_monat: 300 });
    openAdvanced(/Erweiterte Eigenschaften/);

    const budget = document.getElementById('category-budget-monat') as HTMLInputElement;
    fireEvent.change(budget, { target: { value: '' } });

    expect(onAttributesChange).toHaveBeenCalledWith({ budget_monat: null });
  });
});
