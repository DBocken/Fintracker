import { describe, it, expect } from 'vitest';
import { COLLECTION_SCHEMAS, COVERED_COLLECTION_COUNT, type CollectionSchemaKey } from '../collection-schemas';
// Test-Dateien sind von der Schichtgrenze `lib → services` ausgenommen
// (siehe scripts/layers-core.mjs `isTestFile`) — hier wird die Kopplung
// zwischen dem lib-eigenen `CollectionSchemaKey` und der echten
// `LOCAL_FINANCE_KEYS`-Registry geprüft, die Produktionsdatei importiert
// diesen Service bewusst NICHT.
import { LOCAL_FINANCE_KEYS } from '@/services/local-storage-keys';

describe('COLLECTION_SCHEMAS (WP 1.2, RES-2/DOM-2)', () => {
  it('deckt genau die für dieses Paket vorentschiedenen fünf Collections ab', () => {
    expect(Object.keys(COLLECTION_SCHEMAS).sort()).toEqual(
      ['accounts', 'budgets', 'debts', 'receivables', 'transactions'].sort(),
    );
  });

  it('jeder Registry-Schlüssel ist ein echter LocalFinanceKey (Kopplung an local-storage-keys)', () => {
    const validKeys = new Set(Object.keys(LOCAL_FINANCE_KEYS));
    for (const key of Object.keys(COLLECTION_SCHEMAS)) {
      expect(validKeys.has(key)).toBe(true);
    }
  });

  it('[Ratsche] die Zahl der abgedeckten Collections darf nur steigen — Startwert dieses Pakets: 5', () => {
    expect(COVERED_COLLECTION_COUNT).toBeGreaterThanOrEqual(5);
  });

  it('jedes Schema akzeptiert ein minimales, nur mit id versehenes Item (nachsichtig, kein .strict())', () => {
    for (const key of Object.keys(COLLECTION_SCHEMAS) as CollectionSchemaKey[]) {
      const schema = COLLECTION_SCHEMAS[key]!;
      const result = schema.safeParse({ id: 'x1' });
      expect(result.success, `Schema für '${key}' sollte { id: 'x1' } akzeptieren`).toBe(true);
    }
  });

  it('jedes Schema weist ein Item ohne id ab', () => {
    for (const key of Object.keys(COLLECTION_SCHEMAS) as CollectionSchemaKey[]) {
      const schema = COLLECTION_SCHEMAS[key]!;
      const result = schema.safeParse({ name: 'ohne id' });
      expect(result.success, `Schema für '${key}' sollte ein Item ohne id ablehnen`).toBe(false);
    }
  });

  it('jedes Schema erhält unbekannte Zusatzfelder (passthrough statt strict)', () => {
    for (const key of Object.keys(COLLECTION_SCHEMAS) as CollectionSchemaKey[]) {
      const schema = COLLECTION_SCHEMAS[key]!;
      const result = schema.safeParse({ id: 'x1', ein_zukuenftiges_feld: 'bleibt erhalten' });
      expect(result.success, `Schema für '${key}' sollte unbekannte Felder nicht ablehnen`).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).ein_zukuenftiges_feld).toBe('bleibt erhalten');
      }
    }
  });
});
