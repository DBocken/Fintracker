import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendErrorLogEntry,
  getErrorLog,
  clearErrorLog,
  exportErrorLogAsJson,
  migrateLegacyErrorLog,
  ERROR_LOG_KEY,
  MAX_ERROR_LOG_ENTRIES,
} from '../error-log-service';
import { idbGet } from '../idb-kv';

beforeEach(async () => {
  window.localStorage.clear();
  await clearErrorLog();
});

describe('error-log-service', () => {
  describe('Normal Behavior', () => {
    it('sollte Einträge anhängen und wieder auslesen', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'kaputt' });
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ level: 'error', source: 'manual', message: 'kaputt' });
      expect(log[0].timestamp).toBeTruthy();
      expect(log[0].id).toBeTruthy();
    });

    it('sollte das Protokoll vollständig leeren können', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'x' });
      await clearErrorLog();
      expect(await getErrorLog()).toHaveLength(0);
    });

    it('sollte einen JSON-Export mit allen Einträgen liefern', async () => {
      await appendErrorLogEntry({ level: 'warn', source: 'window', message: 'a' });
      const json = await exportErrorLogAsJson();
      const parsed = JSON.parse(json);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].message).toBe('a');
    });
  });

  describe('Ring-Buffer & De-Dupe', () => {
    it(`sollte auf ${MAX_ERROR_LOG_ENTRIES} Einträge begrenzen (älteste fallen raus)`, async () => {
      for (let i = 0; i < MAX_ERROR_LOG_ENTRIES + 5; i++) {
        await appendErrorLogEntry({ level: 'error', source: 'manual', message: `fehler-${i}` });
      }
      const log = await getErrorLog();
      expect(log).toHaveLength(MAX_ERROR_LOG_ENTRIES);
      expect(log[0].message).toBe('fehler-5');
      expect(log[log.length - 1].message).toBe(`fehler-${MAX_ERROR_LOG_ENTRIES + 4}`);
    });

    it('sollte identische message+stack kurz hintereinander zu count kollabieren', async () => {
      const entry = { level: 'error' as const, source: 'window' as const, message: 'loop', stack: 's' };
      await appendErrorLogEntry(entry);
      await appendErrorLogEntry(entry);
      await appendErrorLogEntry(entry);
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].count).toBe(3);
    });

    it('sollte unterschiedliche Meldungen NICHT kollabieren', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'a' });
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'b' });
      expect(await getErrorLog()).toHaveLength(2);
    });
  });

  describe('Redaktion beim Schreiben', () => {
    it('[PRIVACY] sollte IBANs/Beträge/E-Mails in message und stack redigieren', async () => {
      await appendErrorLogEntry({
        level: 'error',
        source: 'boundary',
        message: 'Upload für max@example.com über 1.234,56 € fehlgeschlagen',
        stack: 'at pay (DE89370400440532013000)',
      });
      const [entry] = await getErrorLog();
      expect(entry.message).not.toContain('max@example.com');
      expect(entry.message).not.toContain('1.234,56');
      expect(entry.stack).not.toContain('DE89370400440532013000');
    });

    it('[PRIVACY] sollte auch der persistierte Roh-String im Store redigiert sein', async () => {
      await appendErrorLogEntry({
        level: 'error',
        source: 'manual',
        message: 'IBAN DE89370400440532013000 ungültig',
      });
      const raw = await idbGet(ERROR_LOG_KEY);
      expect(raw).toBeTruthy();
      expect(raw).not.toContain('DE89370400440532013000');
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte das Legacy-localStorage-Protokoll (error_log) importieren und löschen', async () => {
      window.localStorage.setItem(
        'error_log',
        JSON.stringify([{ message: 'alt', stack: 's', timestamp: '2026-01-01T00:00:00.000Z' }]),
      );
      const migrated = await migrateLegacyErrorLog();
      expect(migrated).toBe(1);
      expect(window.localStorage.getItem('error_log')).toBeNull();
      const log = await getErrorLog();
      expect(log.some((e) => e.message === 'alt')).toBe(true);
    });

    it('[REGRESSION] sollte die Legacy-Migration idempotent sein', async () => {
      window.localStorage.setItem('error_log', JSON.stringify([{ message: 'alt' }]));
      await migrateLegacyErrorLog();
      const second = await migrateLegacyErrorLog();
      expect(second).toBe(0);
      expect(await getErrorLog()).toHaveLength(1);
    });

    it('[REGRESSION] sollte kaputtes Legacy-JSON still verwerfen', async () => {
      window.localStorage.setItem('error_log', '{nicht-json');
      await expect(migrateLegacyErrorLog()).resolves.toBe(0);
      expect(window.localStorage.getItem('error_log')).toBeNull();
    });

    it('[REGRESSION] sollte vom Danger-Zone-Wipe (clearLocalKvStore) mit geleert werden', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'x' });
      const { clearLocalKvStore } = await import('../idb-kv');
      await clearLocalKvStore();
      expect(await getErrorLog()).toHaveLength(0);
    });
  });
});
