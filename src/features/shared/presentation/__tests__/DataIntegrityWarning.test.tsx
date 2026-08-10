/**
 * WP 1.2b — die Integritätsmeldung erreicht die Fläche.
 *
 * `data-integrity-report.ts` (WP 1.2 Teil A) zählt beim Lesen übersprungene,
 * beschädigte Items je Collection — bis hierher landete die Zahl nirgends.
 * Dieser Test prüft die AUSSAGE (Zahl + Handlungsoption), nicht nur, dass
 * irgendetwas mit `role="alert"` existiert: Ein Hinweis, der nur "Es gab ein
 * Problem" sagt, ist keine Auskunft, "3 Einträge konnten nicht gelesen
 * werden" schon.
 *
 * Gegenprobe: Kein übersprungenes Item ⇒ KEIN Hinweis — kein Dauerbanner, das
 * bei jedem sauberen Lesevorgang trotzdem aufploppt.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '@/test-utils/render';
import DataIntegrityWarning from '../DataIntegrityWarning';

describe('DataIntegrityWarning (WP 1.2b)', () => {
  it.each([
    ['de', '3 Einträge konnten nicht gelesen werden.', 'Backup prüfen'] as const,
    ['en', '3 entries could not be read.', 'Check backup'] as const,
  ])('sollte in %s die Anzahl und die Handlungsoption nennen', (locale, message, actionLabel) => {
    renderWithI18n(
      <MemoryRouter>
        <DataIntegrityWarning skippedCount={3} />
      </MemoryRouter>,
      locale,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('link', { name: actionLabel })).toBeInTheDocument();
  });

  it.each([
    ['de', 'Ein Eintrag konnte nicht gelesen werden.'] as const,
    ['en', 'One entry could not be read.'] as const,
  ])('sollte bei genau einem Fund in %s die Einzahl benutzen', (locale, message) => {
    // „1 Einträge" ist in jeder der drei Sprachen falsch — und genau ein
    // beschädigter Datensatz ist der haeufigste Fall, nicht der seltenste.
    renderWithI18n(
      <MemoryRouter>
        <DataIntegrityWarning skippedCount={1} />
      </MemoryRouter>,
      locale,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/^1 (Einträge|entries)/)).toBeNull();
  });

  it('sollte NICHTS anzeigen, wenn nichts übersprungen wurde (kein Dauerbanner)', () => {
    renderWithI18n(
      <MemoryRouter>
        <DataIntegrityWarning skippedCount={0} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/konnten nicht gelesen werden/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Backup prüfen' })).toBeNull();
  });
});
