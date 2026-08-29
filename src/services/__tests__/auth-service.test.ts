import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wächter für die Anbieter-Naht (WP 2.2, ADR `supabase-abloesung.md`).
 *
 * Der Zweck dieser Datei ist nicht, `supabase.auth` nachzuprogrammieren —
 * es ist, die **Form der Naht** festzuschreiben, bevor der Anbieter wechselt.
 * Jede Zusicherung hier ist eine, auf die sich die Aufrufstellen verlassen
 * dürfen, und die ein Hanko-Backend genauso erfüllen muss wie Supabase:
 *
 * - `getAccessToken()` wirft nie — „nicht angemeldet" ist in einer
 *   local-first App ein normaler Zustand, kein Fehler.
 * - `getCurrentUserId()` liefert `null` statt eines leeren Strings; ein
 *   leerer String wäre eine Kennung, die auf jeden Nutzer passt.
 * - `signOut()` schluckt Anbieterfehler nicht, aber es lässt den lokalen
 *   Zustand nicht in der Schwebe.
 */

const authMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: authMock },
}));

import {
  getCurrentUserId,
  requireUserId,
  getAccessToken,
  signOut,
} from '../auth-service';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.signOut.mockResolvedValue({ error: null });
});

describe('auth-service — Naht zum Identitätsanbieter', () => {
  describe('getCurrentUserId', () => {
    it('sollte die Nutzerkennung der aktiven Sitzung liefern', async () => {
      authMock.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      await expect(getCurrentUserId()).resolves.toBe('u-1');
    });

    it('sollte null liefern, wenn niemand angemeldet ist', async () => {
      authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(getCurrentUserId()).resolves.toBeNull();
    });

    it('sollte null liefern statt zu werfen, wenn der Anbieter einen Fehler meldet', async () => {
      authMock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'offline' } });
      await expect(getCurrentUserId()).resolves.toBeNull();
    });
  });

  describe('requireUserId', () => {
    it('sollte die Kennung liefern, wenn jemand angemeldet ist', async () => {
      authMock.getUser.mockResolvedValue({ data: { user: { id: 'u-2' } }, error: null });
      await expect(requireUserId()).resolves.toBe('u-2');
    });

    it('sollte werfen, wenn niemand angemeldet ist', async () => {
      authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(requireUserId()).rejects.toThrow();
    });
  });

  describe('getAccessToken', () => {
    it('sollte das Zugangstoken der aktiven Sitzung liefern', async () => {
      authMock.getSession.mockResolvedValue({
        data: { session: { access_token: 'tok-1' } },
        error: null,
      });
      await expect(getAccessToken()).resolves.toBe('tok-1');
    });

    it('sollte null liefern statt zu werfen, wenn keine Sitzung besteht', async () => {
      authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
      await expect(getAccessToken()).resolves.toBeNull();
    });

    it('sollte null liefern statt zu werfen, wenn der Anbieter einen Fehler meldet', async () => {
      authMock.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'kaputt' } });
      await expect(getAccessToken()).resolves.toBeNull();
    });
  });

  describe('signOut', () => {
    it('sollte die Sitzung beim Anbieter beenden', async () => {
      await signOut();
      expect(authMock.signOut).toHaveBeenCalledTimes(1);
    });

    it('sollte einen Fehler des Anbieters weitergeben, statt ihn zu verschlucken', async () => {
      authMock.signOut.mockResolvedValue({ error: { message: 'Netz weg' } });
      await expect(signOut()).rejects.toThrow();
    });
  });
});
