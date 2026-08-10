import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { CloudMcpSyncCard } from '../CloudMcpSyncCard';

/**
 * WP 3.5 (SEC-5) — MCP-Klartext in der UI kennzeichnen.
 *
 * `cloud-mcp-sync-service.ts` legt den Aggregat-Snapshot als Klartext-`jsonb`
 * bei Supabase ab (nur RLS-geschützt) — das war bisher nur in `docs/mcp-poc.md`
 * ehrlich dokumentiert, nicht auf der Opt-in-Fläche selbst. Diese Tests
 * sichern, dass der Hinweis auf der Karte steht, BEVOR irgendetwas aktiviert
 * wird, und dass er den Umfang konkret benennt statt vage zu bleiben.
 */

// Unauthenticated rendern reicht: Der Hinweis muss schon sichtbar sein, bevor
// überhaupt ein Login stattfindet — das ist der früheste Zeitpunkt "vor der
// Zustimmung", den es auf dieser Fläche gibt.
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ user: null, status: 'anonymous', session: null }),
}));

describe('CloudMcpSyncCard – Klartext-Hinweis (SEC-5)', () => {
  it('sollte vor jeder Zustimmung benennen, dass die Aggregate bei Supabase unverschlüsselt liegen', () => {
    renderWithProviders(<CloudMcpSyncCard />, { router: false });

    // Konkreter Text, nicht nur "irgendein Hinweis": unverschlüsselt/Klartext
    // UND die Schutz-Grenze (nur Datenbank-Zugriffsregel, keine Verschlüsselung).
    expect(
      screen.getByText(
        'Diese Aggregate — inklusive der Namen deiner Kategorien und Budgets — liegen bei Supabase unverschlüsselt vor und sind nur durch eine Datenbank-Zugriffsregel geschützt, nicht durch Verschlüsselung.',
      ),
    ).toBeInTheDocument();
  });

  it('sollte den Hinweis auch anzeigen, wenn (noch) nicht eingeloggt ist – kein Login-Dialog davor', () => {
    // Gegenprobe: Der Hinweis darf nicht hinter dem Login oder der doppelten
    // Bestätigung versteckt sein. In diesem Test wird nichts angeklickt.
    renderWithProviders(<CloudMcpSyncCard />, { router: false });
    expect(
      screen.getByText(/unverschlüsselt vor und sind nur durch eine Datenbank-Zugriffsregel geschützt/),
    ).toBeInTheDocument();
  });

  it('sollte den Hinweis auf Englisch (Alltagssprache) zeigen', () => {
    renderWithProviders(<CloudMcpSyncCard />, { router: false, locale: 'en' });
    expect(
      screen.getByText(
        'These aggregates — including the names you gave your categories and budgets — are stored unencrypted at Supabase and protected only by a database access rule, not by encryption.',
      ),
    ).toBeInTheDocument();
  });
});
