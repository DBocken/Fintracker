import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  runStoreMigrations,
  hasPendingStoreMigrations,
  type StoreMigrationStep,
} from '../local-store-migrations';

/**
 * [INTEGRITY] WP 1.3 — der echte Migrationsläufer.
 *
 * Ausschließlich synthetische Schritte (AGENTS-Vorgabe): `migrations` in
 * `local-store-migrations.ts` ist heute leer (WP 4.1 trägt den ersten echten
 * Schritt ein), daher testet dieses File den Läufer selbst, nicht eine echte
 * Transformation.
 */

const TEST_KEY = 'test_store_schema_version_wp13';

describe('runStoreMigrations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sollte je Schritt einen Roundtrip von alter in neue Form durchführen', async () => {
    localStorage.setItem('wp13_legacy_blob', JSON.stringify({ shape: 'alt' }));
    const steps: StoreMigrationStep[] = [
      {
        toVersion: 2,
        name: 'alte Form -> neue Form',
        run: () => {
          const raw = localStorage.getItem('wp13_legacy_blob');
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            'wp13_legacy_blob',
            JSON.stringify({ ...parsed, shape: 'neu', migrated: true }),
          );
        },
      },
    ];

    await runStoreMigrations(steps, 2, TEST_KEY);

    expect(JSON.parse(localStorage.getItem('wp13_legacy_blob')!)).toEqual({
      shape: 'neu',
      migrated: true,
    });
    expect(localStorage.getItem(TEST_KEY)).toBe('2');
  });

  it('sollte bei gespeicherter Version 1 und aktueller Version 3 beide Schritte lückenlos in Reihenfolge genau einmal ausführen', async () => {
    const order: string[] = [];
    // Bewusst in "falscher" Deklarationsreihenfolge, damit ein Sortieren nach
    // Ziel-Version und nicht nach Listenposition geprüft wird.
    const steps: StoreMigrationStep[] = [
      {
        toVersion: 3,
        name: 'dritter Schritt',
        run: () => {
          order.push('3');
        },
      },
      {
        toVersion: 2,
        name: 'zweiter Schritt',
        run: () => {
          order.push('2');
        },
      },
    ];
    localStorage.setItem(TEST_KEY, '1');

    await runStoreMigrations(steps, 3, TEST_KEY);

    expect(order).toEqual(['2', '3']);
    expect(localStorage.getItem(TEST_KEY)).toBe('3');
  });

  it('sollte beim zweiten Lauf nichts mehr tun (Idempotenz)', async () => {
    const run = vi.fn();
    const steps: StoreMigrationStep[] = [{ toVersion: 2, name: 'einmalig', run }];

    await runStoreMigrations(steps, 2, TEST_KEY);
    expect(run).toHaveBeenCalledTimes(1);

    await runStoreMigrations(steps, 2, TEST_KEY);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION] sollte bei Abbruch mitten im Lauf die zuletzt erfolgreiche Version festhalten und beim Retry dort weitermachen', async () => {
    const order: string[] = [];
    let failStep3 = true;
    const steps: StoreMigrationStep[] = [
      {
        toVersion: 2,
        name: 'Schritt 2',
        run: () => {
          order.push('2');
        },
      },
      {
        toVersion: 3,
        name: 'Schritt 3',
        run: () => {
          if (failStep3) throw new Error('Schritt 3 kaputt (simulierter Absturz)');
          order.push('3');
        },
      },
    ];
    localStorage.setItem(TEST_KEY, '1');

    await expect(runStoreMigrations(steps, 3, TEST_KEY)).rejects.toThrow(
      'Schritt 3 kaputt (simulierter Absturz)',
    );

    // Kern des Pakets: weder auf 1 (ganze Kette wiederholen) noch auf 3
    // (als hätte Schritt 3 funktioniert) — genau auf dem zuletzt
    // erfolgreichen Stand.
    expect(localStorage.getItem(TEST_KEY)).toBe('2');
    expect(order).toEqual(['2']);

    failStep3 = false;
    await runStoreMigrations(steps, 3, TEST_KEY);

    // Schritt 2 läuft NICHT erneut, Schritt 3 setzt genau dort an.
    expect(order).toEqual(['2', '3']);
    expect(localStorage.getItem(TEST_KEY)).toBe('3');
  });

  it('sollte eine Lücke zwischen definierten Schritten erkennen und ablehnen', async () => {
    // Schritt für Version 2 fehlt — Version 3 wird trotzdem angeboten. Das ist
    // ein Autorenfehler, kein "nichts zu tun".
    const steps: StoreMigrationStep[] = [{ toVersion: 3, name: 'nur Schritt 3', run: () => {} }];

    await expect(runStoreMigrations(steps, 3, TEST_KEY)).rejects.toThrow();
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('sollte ohne definierte Schritte die Zielversion direkt festschreiben (heutiger Zustand von LOCAL_STORE_SCHEMA_VERSION)', async () => {
    await runStoreMigrations([], 2, TEST_KEY);
    expect(localStorage.getItem(TEST_KEY)).toBe('2');
  });

  it('sollte einen bereits aktuellen Stand unangetastet lassen', async () => {
    localStorage.setItem(TEST_KEY, '2');
    const run = vi.fn();
    await runStoreMigrations([{ toVersion: 2, name: 'sollte nicht laufen', run }], 2, TEST_KEY);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('hasPendingStoreMigrations', () => {
  it('sollte true liefern, wenn mindestens ein definierter Schritt im Bereich liegt', () => {
    const steps: StoreMigrationStep[] = [{ toVersion: 3, name: 'x', run: () => {} }];
    expect(hasPendingStoreMigrations(2, 3, steps)).toBe(true);
    expect(hasPendingStoreMigrations(3, 3, steps)).toBe(false);
    expect(hasPendingStoreMigrations(1, 2, steps)).toBe(false);
  });

  it('sollte bei leerer Schrittliste immer false liefern', () => {
    expect(hasPendingStoreMigrations(1, 2, [])).toBe(false);
  });
});
