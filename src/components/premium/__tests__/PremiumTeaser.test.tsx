import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import PremiumTeaser from '../PremiumTeaser';

/**
 * Der Teaser tritt an die Stelle, an der eine Premium-Funktion für
 * Nicht-Berechtigte bisher **gar nicht** gerendert wurde (`fallback={null}`).
 * Zwei Eigenschaften tragen den ganzen Zweck und werden hier festgenagelt:
 *
 * 1. Die Funktion wird SICHTBAR — Name und Nutzen stehen da, ausgegraut.
 * 2. Es wird nur ein **Dummy** übertragen: die echte Funktion ist nicht im
 *    Baum, das Vorschaubild ist für Screenreader unsichtbar und nicht
 *    bedienbar. Ein ausgegrautes Original wäre weiterhin das Original.
 */
describe('PremiumTeaser', () => {
  it('sollte Name und Nutzen der gesperrten Funktion zeigen', () => {
    renderWithProviders(<PremiumTeaser feature="familyMode" />);

    expect(screen.getByText('Haushalts- & Paarmodus')).toBeTruthy();
    expect(
      screen.getByText('Gemeinsame Ausgaben fair aufteilen und ausgleichen.'),
    ).toBeTruthy();
  });

  it('sollte die Funktion als Premium kennzeichnen', () => {
    renderWithProviders(<PremiumTeaser feature="familyMode" />);

    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('sollte als Ganzes zur Freischaltung führen (Karten sind Aktionen)', () => {
    const { container } = renderWithProviders(<PremiumTeaser feature="familyMode" />);

    const link = container.querySelector('a[href="/settings"]');
    expect(link).toBeTruthy();
    // Die Karte SELBST ist der Link — kein toter Rahmen um einen inneren Knopf.
    expect(link?.getAttribute('data-premium-teaser')).not.toBeNull();
  });

  it('sollte die echte Funktion nicht rendern, sondern nur ein inertes Dummy', () => {
    const { container } = renderWithProviders(
      <PremiumTeaser feature="familyMode">
        <button type="button">Echte Premium-Aktion</button>
      </PremiumTeaser>,
    );

    // Das Dummy ist Dekoration: für Screenreader unsichtbar und nicht bedienbar.
    const preview = container.querySelector('[data-premium-preview]');
    expect(preview).toBeTruthy();
    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.className).toContain('pointer-events-none');
  });

  it('sollte einen Tutorial-Anker tragen, wenn einer vergeben wird', () => {
    const { container } = renderWithProviders(
      <PremiumTeaser feature="splitTransactions" tourId="split-teaser" />,
    );

    expect(container.querySelector('[data-tour-id="split-teaser"]')).toBeTruthy();
  });

  it('sollte englische Texte rendern', () => {
    renderWithProviders(<PremiumTeaser feature="familyMode" />, { locale: 'en' });

    expect(screen.getByText('Household & couple mode')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
  });
});
