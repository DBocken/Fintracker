import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Der Abmelde-Vorgang als Fachlogik (WP 2.2).
 *
 * **Warum das ein Service ist und keine Komponente.** Die Reihenfolge ist
 * nicht beliebig: Erst die lokalen Daten löschen, dann die Sitzung beenden.
 * Andersherum meldet der `AuthProvider` auf das `SIGNED_OUT`-Ereignis hin ab,
 * leert Caches und sperrt den Vault — und das Löschen liefe gegen einen
 * bereits gesperrten Bestand. Diese Reihenfolge lag bis hierher in einem
 * `onClick`-Handler und war damit nur über ein gerendertes Dialogfeld
 * prüfbar. Sie ist Fachlogik, kein Bedienelement.
 */

const authMock = vi.hoisted(() => ({ signOut: vi.fn() }));
const resetMock = vi.hoisted(() => ({ clearAllLocalData: vi.fn() }));
const anonMock = vi.hoisted(() => ({ clearAnonymousMode: vi.fn() }));

vi.mock('../auth-service', () => authMock);
vi.mock('../local-data-reset', () => resetMock);
vi.mock('@/lib/anonymous-mode', () => anonMock);

import { endSession } from '../session-service';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.signOut.mockResolvedValue(undefined);
  resetMock.clearAllLocalData.mockResolvedValue(undefined);
});

describe('endSession', () => {
  it('sollte ohne Löschwunsch nur die Sitzung beenden', async () => {
    await endSession({ wipeLocalData: false });

    expect(resetMock.clearAllLocalData).not.toHaveBeenCalled();
    expect(anonMock.clearAnonymousMode).not.toHaveBeenCalled();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });

  it('sollte mit Löschwunsch die lokalen Daten und den anonymen Modus entfernen', async () => {
    await endSession({ wipeLocalData: true });

    expect(resetMock.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(anonMock.clearAnonymousMode).toHaveBeenCalledTimes(1);
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });

  it('sollte die lokalen Daten VOR dem Abmelden löschen', async () => {
    const reihenfolge: string[] = [];
    resetMock.clearAllLocalData.mockImplementation(async () => {
      reihenfolge.push('loeschen');
    });
    authMock.signOut.mockImplementation(async () => {
      reihenfolge.push('abmelden');
    });

    await endSession({ wipeLocalData: true });

    expect(reihenfolge).toEqual(['loeschen', 'abmelden']);
  });

  it('sollte nicht abmelden, wenn das Löschen fehlschlägt', async () => {
    resetMock.clearAllLocalData.mockRejectedValue(new Error('IndexedDB weg'));

    await expect(endSession({ wipeLocalData: true })).rejects.toThrow();
    expect(authMock.signOut).not.toHaveBeenCalled();
  });

  it('sollte einen Fehler beim Abmelden weitergeben', async () => {
    authMock.signOut.mockRejectedValue(new Error('Netz weg'));

    await expect(endSession({ wipeLocalData: false })).rejects.toThrow();
  });
});
