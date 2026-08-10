/**
 * Hinweis „nicht verrechnet" (VE-1, WP 7.7).
 *
 * Der Baustein ist die sichtbare Hälfte der EUR-only-Entscheidung
 * (`docs/architecture/currency-eur-only.md`): Was nicht in die Summe eingeht,
 * verschwindet nicht, sondern wird benannt. Bilingual (de + en) über
 * `@/test-utils/render`.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { UnconvertedCurrencyNotice } from '../UnconvertedCurrencyNotice';

const ITEMS = [
  { key: 'aapl', label: 'AAPL', currency: 'USD', value: 892.5 },
  { key: 'msft', label: 'MSFT', currency: 'USD', value: 3001.6 },
];

const TITLE = {
  de: 'Fremdwährung nicht verrechnet',
  en: 'Foreign currency not included',
} as const;

describe('UnconvertedCurrencyNotice', () => {
  it.each(['de', 'en'] as const)('sollte in %s den Hinweis und jede Position benennen', (locale) => {
    renderWithI18n(<UnconvertedCurrencyNotice items={ITEMS} description="Beschreibung" />, locale);

    expect(screen.getByText(TITLE[locale])).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('sollte den Betrag in der FREMDwährung zeigen, nie als Euro', () => {
    renderWithI18n(<UnconvertedCurrencyNotice items={ITEMS} description="Beschreibung" />);

    // 892,50 $ — nicht 892,50 €: Die Zahl ist kein Euro-Betrag und darf auch
    // nicht so aussehen.
    const amount = screen.getByText(/892,50/);
    expect(amount.textContent).not.toContain('€');
  });

  it('sollte ohne Fundstellen gar nichts rendern', () => {
    const { container } = renderWithI18n(<UnconvertedCurrencyNotice items={[]} description="Beschreibung" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('[REGRESSION] sollte kein Karten-Chrome tragen — reines Readout (§9)', () => {
    const { container } = renderWithI18n(<UnconvertedCurrencyNotice items={ITEMS} description="Beschreibung" />);

    expect(container.querySelector('.shadow, .border')).toBeNull();
  });
});
