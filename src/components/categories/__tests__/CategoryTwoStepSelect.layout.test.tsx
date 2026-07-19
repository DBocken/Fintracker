import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { CategoryTwoStepSelect } from '../CategoryTwoStepSelect';
import type { Category } from '@/types';

/**
 * Layout-Überlappungstests (Screenshot-Bug „Buchung aufteilen"):
 * Eine vom Aufrufer übergebene feste Höhenklasse (z. B. `h-8`) landete auf dem
 * mehrzeiligen Wrapper (Badges + Selects) und zwang ihn auf 32px — der Inhalt
 * lief über nachfolgende Elemente. Zusätzlich liefen die festen Trigger-
 * Breiten (`w-44`/`w-48`) auf mobilen Viewports horizontal über.
 *
 * jsdom hat keine Layout-Engine, daher prüfen die Tests die Klassen-
 * Invarianten, die Überlappung verursachen bzw. verhindern.
 */

const categories: Category[] = [
  { id: 'main-1', name: 'Haushalt', parent_id: null },
  { id: 'sub-1', name: 'Strom', parent_id: 'main-1' },
] as Category[];

const FIXED_HEIGHT_RE = /^h-\d+(\.\d+)?$/;
const FIXED_WIDTH_RE = /^w-\d+(\.\d+)?$/;

function classListOf(el: Element): string[] {
  return Array.from(el.classList);
}

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
  describe('Negativtests: überlappungsverursachende Muster ausgeschlossen', () => {
    it('[REGRESSION] sollte eine übergebene feste Höhenklasse nicht auf den mehrzeiligen Wrapper anwenden', () => {
      const { container } = renderSelect('de', 'h-8 text-sm');
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper).not.toBeNull();
      // Der Wrapper enthält Badge-Zeile + Select-Zeile — eine feste Höhe
      // lässt den Inhalt über nachfolgende Elemente laufen.
      expect(classListOf(wrapper).some((c) => FIXED_HEIGHT_RE.test(c))).toBe(false);
    });

    it('sollte auch ohne übergebene className keine feste Höhe auf dem Wrapper haben', () => {
      const { container } = renderSelect('de');
      const wrapper = container.firstElementChild as HTMLElement;
      expect(classListOf(wrapper).some((c) => FIXED_HEIGHT_RE.test(c))).toBe(false);
    });

    it('[MOBILE] sollte keine feste Breitenklasse ohne Breakpoint-Präfix an den Select-Triggern haben (kein horizontales Überlaufen auf schmalen Viewports)', () => {
      renderSelect();
      const triggers = screen.getAllByRole('combobox');
      expect(triggers.length).toBe(2);
      for (const trigger of triggers) {
        // `w-44`/`w-48` ohne `sm:`-Präfix summieren sich auf > 360px und
        // laufen auf Mobilgeräten aus dem Container.
        expect(classListOf(trigger).some((c) => FIXED_WIDTH_RE.test(c))).toBe(false);
      }
    });
  });

  describe('Positivtests: erwartetes responsives Layout vorhanden', () => {
    it('sollte die vom Aufrufer übergebene Größenklasse an die Select-Trigger weiterreichen', () => {
      renderSelect('de', 'h-8 text-sm');
      const triggers = screen.getAllByRole('combobox');
      for (const trigger of triggers) {
        expect(trigger).toHaveClass('h-8');
      }
    });

    it('[MOBILE] sollte die Selects auf mobiler Breite stapeln und volle Breite nutzen', () => {
      renderSelect();
      const [mainTrigger, subTrigger] = screen.getAllByRole('combobox');
      const selectRow = mainTrigger.closest('div.flex') as HTMLElement;
      expect(selectRow).not.toBeNull();
      expect(selectRow).toHaveClass('flex-col');
      expect(mainTrigger).toHaveClass('w-full', 'min-w-0');
      expect(subTrigger).toHaveClass('w-full', 'min-w-0');
    });

    it('sollte die Selects auf Desktop-Breite nebeneinander mit begrenzter Breite rendern', () => {
      renderSelect();
      const [mainTrigger, subTrigger] = screen.getAllByRole('combobox');
      const selectRow = mainTrigger.closest('div.flex') as HTMLElement;
      expect(selectRow).toHaveClass('sm:flex-row');
      expect(mainTrigger).toHaveClass('sm:w-44');
      expect(subTrigger).toHaveClass('sm:w-48');
    });

    it('sollte beide Stufen-Badges anzeigen (de)', () => {
      renderSelect('de');
      expect(screen.getByText('1. Hauptkategorie')).toBeInTheDocument();
      expect(screen.getByText('2. Unterkategorie oder nur Hauptkategorie')).toBeInTheDocument();
    });

  });

  describe('English locale', () => {
    it('should show both step badges without a collapsed wrapper (en)', () => {
      const { container } = renderSelect('en', 'h-8 text-sm');
      expect(screen.getByText('1. Main category')).toBeInTheDocument();
      expect(screen.getByText('2. Subcategory or main category only')).toBeInTheDocument();
      const wrapper = container.firstElementChild as HTMLElement;
      expect(classListOf(wrapper).some((c) => FIXED_HEIGHT_RE.test(c))).toBe(false);
    });
  });
});
