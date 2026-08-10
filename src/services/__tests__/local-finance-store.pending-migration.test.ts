import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * [INTEGRITY] WP 1.3 — `assertCompatibleStore()` darf im `'migrate'`-Zweig
 * nicht mehr stillschweigend die Version festschreiben, SOBALD echte
 * Migrationsschritte ausstehen.
 *
 * Eigene Datei statt eines Zusatzfalls in `local-finance-store.rollback.test.ts`:
 * Das reale `migrations`-Array ist heute leer, also gibt es dort nichts
 * "Ausstehendes" zu provozieren. Hier wird `hasPendingStoreMigrations`
 * gemockt, um genau diesen (heute nur hypothetischen, ab WP 4.1 realen) Fall
 * zu prüfen, ohne die anderen — unveränderten — Tests zu berühren.
 */

vi.mock('../local-store-migrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../local-store-migrations')>();
  return { ...actual, hasPendingStoreMigrations: vi.fn(() => true) };
});

import {
  LOCAL_STORE_SCHEMA_VERSION_KEY,
  readLocalFinanceList,
  writeLocalFinanceList,
} from '../local-finance-store';
import { StoreMigrationPendingError } from '@/lib/store-compatibility';

beforeEach(() => {
  localStorage.clear();
  // WP 4.1c: `vitest.setup.ts` pinnt den Schema-Version-Marker nach jedem
  // `localStorage.clear()` automatisch auf die aktuelle Version (Begründung
  // dort — ohne das würde der jetzt echte Migrationsschritt aus WP 4.1c
  // praktisch jeden anderen Test mit `StoreMigrationPendingError` sprengen).
  // Diese Datei testet genau den GEGENTEILIGEN Zustand (Marker fehlt) und
  // hebt den Auto-Pin deshalb bewusst wieder auf.
  localStorage.removeItem(LOCAL_STORE_SCHEMA_VERSION_KEY);
});

describe('[INTEGRITY] Lokale Ablage mit ausstehender Migration', () => {
  it('[REGRESSION] sollte das LESEN verweigern statt die Version stumm festzuschreiben', async () => {
    await expect(readLocalFinanceList('transactions')).rejects.toBeInstanceOf(
      StoreMigrationPendingError,
    );
    // Der eigentliche Befund: die alte Implementierung schrieb hier einfach
    // die Zielversion fest, obwohl nichts transformiert wurde.
    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBeNull();
  });

  it('[REGRESSION] sollte auch das SCHREIBEN verweigern', async () => {
    await expect(writeLocalFinanceList('transactions', [])).rejects.toBeInstanceOf(
      StoreMigrationPendingError,
    );
    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBeNull();
  });

  it('sollte nach erfolgreichem Migrationslauf wieder normal lesen (Marker manuell gesetzt, wie es runStoreMigrations täte)', async () => {
    // Simuliert das Ergebnis eines abgeschlossenen runStoreMigrations()-Laufs:
    // Marker steht auf der aktuellen Version, hasPendingStoreMigrations bleibt
    // gemockt "true" (die Prüfung selbst ist hier nicht der Punkt) — der
    // eigentliche Kompatibilitätsstatus wird davon unabhängig 'ok', sobald der
    // gespeicherte Stand der unterstützten Version entspricht.
    const { LOCAL_STORE_SCHEMA_VERSION } = await import('../local-finance-store');
    localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION));

    await expect(readLocalFinanceList('transactions')).resolves.toEqual([]);
  });
});
