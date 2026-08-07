import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOCAL_STORE_SCHEMA_VERSION,
  LOCAL_STORE_SCHEMA_VERSION_KEY,
  readLocalFinanceList,
  writeLocalFinanceList,
} from '../local-finance-store';
import { StoreVersionTooNewError } from '@/lib/store-compatibility';

/**
 * [INTEGRITY] WP-11.3 — die Verdrahtung, nicht die Logik.
 *
 * `store-compatibility.test.ts` prüft die Entscheidung. Dieser Test prüft, dass
 * sie überhaupt jemand fragt: Eine korrekte Funktion, die niemand aufruft, ist
 * genau der Zustand, aus dem dieses Arbeitspaket kommt — die Schema-Version
 * gab es seit Langem, gelesen hat sie nie jemand.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('[INTEGRITY] Lokale Ablage aus einer neueren Version', () => {
  it('sollte das LESEN verweigern statt halb zu verstehen', async () => {
    localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION + 1));

    await expect(readLocalFinanceList('transactions')).rejects.toBeInstanceOf(
      StoreVersionTooNewError,
    );
  });

  it('[REGRESSION] sollte vor allem das SCHREIBEN verweigern', async () => {
    // Der teure Fall: Lesen verliert nichts, Schreiben schon. Eine aeltere App
    // wuerde alle Felder wegschreiben, die sie nicht kennt.
    localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION + 1));

    await expect(writeLocalFinanceList('transactions', [])).rejects.toBeInstanceOf(
      StoreVersionTooNewError,
    );
  });

  it('sollte die eigene Version festschreiben, sobald sie zustaendig ist', async () => {
    // Ohne Eintrag ist die Ablage aelter als diese Pruefung — danach steht dort
    // eine Zahl, und der naechste Rollback trifft auf eine Aussage.
    await readLocalFinanceList('transactions');

    expect(localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY)).toBe(
      String(LOCAL_STORE_SCHEMA_VERSION),
    );
  });

  it('sollte den gleichen Stand unangetastet durchlassen', async () => {
    localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION));

    await expect(readLocalFinanceList('transactions')).resolves.toEqual([]);
  });
});
