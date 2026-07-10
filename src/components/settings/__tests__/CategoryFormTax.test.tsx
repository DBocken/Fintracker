import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { CategoryForm } from '../CategoryForm';
import type { CategoryAttributes } from '../../../types';

function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(<I18nProvider initialLocale={locale}>{component}</I18nProvider>);
}

function openAdvanced(triggerLabel: RegExp) {
  fireEvent.click(screen.getByText(triggerLabel));
}

function renderForm(attributes: CategoryAttributes = {}, locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
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
      onAttributesChange={vi.fn()}
      onSave={vi.fn()}
      onReset={vi.fn()}
    />,
    locale,
  );
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
