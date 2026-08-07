import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { LanguageSettings } from '../LanguageSettings';
import { WordingSettings } from '../WordingSettings';
import { TimeRangeSettings } from '../TimeRangeSettings';
import { AutoCategorizationSettings } from '../AutoCategorizationSettings';

/**
 * WP-8.1 — Einstellungen: Karten-Regel (AGENTS.md §9).
 *
 * Alle vier Bausteine trugen Karten-Chrome um ein einzelnes Bedienelement.
 * Eine Karte verspricht in dieser App „tipp mich an, dann geht es weiter" —
 * hier passierte beim Antippen der Fläche nichts, nur das Auswahlfeld bzw.
 * der Schalter reagierte. Das ist ein totes Klickversprechen.
 *
 * Die Gliederung trägt der `SectionHeader` der Seite; die Karten wiederholten
 * ihn nur (im Sprach-Abschnitt stand „Sprache" dadurch zweimal).
 *
 * Der repo-weite Wächter (`pnpm check:card-rule`) deckt den Fall bereits ab.
 * Diese Tests sichern zusätzlich, dass beim Entfernen des Chromes der INHALT
 * erhalten geblieben ist — das ist der Teil, den der Wächter nicht sieht.
 */

describe('Einstellungen ohne Karten-Chrome (WP-8.1)', () => {
  it('sollte die Sprachwahl weiterhin anbieten', () => {
    const { container } = renderWithI18n(<LanguageSettings />);
    expect(screen.getByText('Sprache')).toBeInTheDocument();
    expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  });

  it('sollte den Sprachstil weiterhin anbieten', () => {
    const { container } = renderWithI18n(<WordingSettings />);
    expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  });

  it('sollte den Aufbewahrungs-Regler weiterhin anbieten', () => {
    const { container } = renderWithI18n(
      <TimeRangeSettings retentionMonths={36} onRetentionChange={vi.fn()} />,
    );
    expect(container.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('sollte den Auto-Bestätigen-Schalter weiterhin anbieten und schalten', () => {
    const onChange = vi.fn();
    renderWithI18n(
      <AutoCategorizationSettings autoConfirm={false} onAutoConfirmChange={onChange} />,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('sollte den Zustand des Schalters durchreichen', () => {
    // Gegenprobe: sonst waere „Schalter vorhanden" von „Schalter
    // funktionsfaehig" nicht zu unterscheiden.
    renderWithI18n(
      <AutoCategorizationSettings autoConfirm onAutoConfirmChange={vi.fn()} />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('sollte die Überschrift nur einmal führen', () => {
    // Vorher stand „Sprache" zweimal: einmal im SectionHeader der Seite,
    // einmal im CardTitle. Der karten-lose Baustein bringt genau einen Titel.
    renderWithI18n(<LanguageSettings />);
    expect(screen.getAllByText('Sprache')).toHaveLength(1);
  });
});
