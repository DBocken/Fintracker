import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { expectNoLayoutOverlap } from '@/test-utils/layout-overlap';
import { CategoryTwoStepSelect } from '../CategoryTwoStepSelect';
import type { Category } from '@/types';

/**
 * Layout-Regression für den Screenshot-Bug „Buchung aufteilen": Die vom
 * Aufrufer übergebene Größenklasse (`h-8 text-sm`) landete auf dem
 * mehrzeiligen Wrapper und zwang Badges + Selects auf 32px — der Inhalt
 * überlappte nachfolgende Elemente. Die allgemeine Überlappungs-Invariante
 * (alle Seiten, Mobile + Desktop) prüft der Sweep in
 * `src/__tests__/layout-overlap.sweep.test.tsx`; hier steht nur der konkrete
 * Regressionsfall dieser Komponente.
 */

const categories: Category[] = [
  { id: 'main-1', name: 'Haushalt', parent_id: null },
  { id: 'sub-1', name: 'Strom', parent_id: 'main-1' },
] as Category[];

function renderSelect(locale: 'de' | 'en' = 'de', className?: string) {
  return renderWithI18n(
    <CategoryTwoStepSelect
      categories={categories}
      value="sub-1"
      onChange={() => {}}
      className={className}
    />,
    locale,
  );
}

describe('CategoryTwoStepSelect – Layout-Überlappung', () => {
  it('[REGRESSION] sollte mit übergebener kompakter Größenklasse keine Überlappung erzeugen (Mobile + Desktop)', () => {
    const { container } = renderSelect('de', 'h-8 text-sm');
    expectNoLayoutOverlap(container);
  });

  it('sollte die übergebene Größenklasse an die Select-Trigger statt an den mehrzeiligen Wrapper anlegen', () => {
    const { container } = renderSelect('de', 'h-8 text-sm');
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toHaveClass('h-8');
    for (const trigger of screen.getAllByRole('combobox')) {
      expect(trigger).toHaveClass('h-8');
    }
  });

  it('sollte beide Stufen-Badges anzeigen (de)', () => {
    renderSelect('de');
    expect(screen.getByText('1. Hauptkategorie')).toBeInTheDocument();
    expect(screen.getByText('2. Unterkategorie oder nur Hauptkategorie')).toBeInTheDocument();
  });

  describe('English locale', () => {
    it('should render both step badges without overlap (en)', () => {
      const { container } = renderSelect('en', 'h-8 text-sm');
      expect(screen.getByText('1. Main category')).toBeInTheDocument();
      expect(screen.getByText('2. Subcategory or main category only')).toBeInTheDocument();
      expectNoLayoutOverlap(container);
    });
  });
});
