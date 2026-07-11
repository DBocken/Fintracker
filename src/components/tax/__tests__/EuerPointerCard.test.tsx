import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { EuerPointerCard } from '../EuerPointerCard';

function renderCard(locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <EuerPointerCard />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('EuerPointerCard', () => {
  it('sollte als ganze Karte nach /euer verlinken (Karten-Regel)', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/euer');
  });

  it('sollte deutsche Texte rendern', () => {
    renderCard('de');
    expect(screen.getByText(/Einnahmenüberschussrechnung/)).toBeInTheDocument();
  });

  it('sollte englische Texte rendern', () => {
    renderCard('en');
    expect(screen.getByText(/EÜR/)).toBeInTheDocument();
  });
});
