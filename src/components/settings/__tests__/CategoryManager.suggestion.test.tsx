/**
 * Kategorie-Vorschlag in der Kategorieverwaltung (WP 6.5b).
 *
 * Bis WP 6.5b fragte `CategoryManager` den Vorschlag selbst ab
 * (`useQuery(['category-suggestion'])`) — eine Fläche mit eigener Datenschicht
 * (AGENTS.md §3/§4). Seither kommt er als Eigenschaft aus dem ViewModel
 * `useSettingsOverview`. Dieser Test hält fest, was die Nutzerin davon sieht,
 * damit der Umzug keine Aussage verliert.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import type { HierarchicalCategory } from '@/types';
import { CategoryManager } from '../CategoryManager';

const LEBENSMITTEL: HierarchicalCategory = {
  id: 'food',
  user_id: 'u1',
  name: 'Lebensmittel',
  color: '#2e7d72',
  icon: '🛒',
  filters: [],
  parent_id: null,
};

function render(suggestion: { category: HierarchicalCategory; affectedCount: number } | null, locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
    <CategoryManager
      categories={[LEBENSMITTEL]}
      suggestion={suggestion}
      onCategorySave={vi.fn()}
      onCategoryDelete={vi.fn()}
      onCategoryEdit={vi.fn()}
      onApplySuggestion={vi.fn()}
    />,
    locale,
  );
}

describe('CategoryManager — Vorschlag von außen', () => {
  it('sollte einen übergebenen Vorschlag anzeigen', () => {
    render({ category: LEBENSMITTEL, affectedCount: 7 });

    expect(screen.getByText('Neue Regel gefunden')).toBeInTheDocument();
    expect(screen.getByText(/7 Transaktionen/)).toBeInTheDocument();
  });

  it('sollte ohne Vorschlag sagen, dass es keinen gibt — nicht einen leeren Vorschlag zeigen', () => {
    render(null);

    expect(screen.getByText('Noch keine Vorschläge')).toBeInTheDocument();
    expect(screen.queryByText('Neue Regel gefunden')).toBeNull();
  });

  it('sollte den Vorschlag auch auf Englisch anzeigen', () => {
    render({ category: LEBENSMITTEL, affectedCount: 7 }, 'en');

    expect(screen.getByText('New rule found')).toBeInTheDocument();
  });

  it('sollte auf Englisch ohne Vorschlag den Hinweis zeigen', () => {
    render(null, 'en');

    expect(screen.getByText('No suggestions yet')).toBeInTheDocument();
  });
});
