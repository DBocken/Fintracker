import { describe, it, expect, vi } from 'vitest';
import { redactSensitive } from '../redact';
import { createLogger } from '../logger';

describe('redactSensitive', () => {
  describe('Normal Behavior', () => {
    it('[SECURITY] sollte IBANs ohne Leerzeichen redigieren', () => {
      const out = redactSensitive('Fehler bei DE89370400440532013000 aufgetreten');
      expect(out).not.toContain('DE89370400440532013000');
      expect(out).toContain('[IBAN]');
    });

    it('[SECURITY] sollte IBANs mit Leerzeichen-Gruppen redigieren', () => {
      const out = redactSensitive('Konto DE89 3704 0044 0532 0130 00 nicht gefunden');
      expect(out).not.toMatch(/DE89/);
      expect(out).toContain('[IBAN]');
    });

    it('[SECURITY] sollte Euro-Beträge im deutschen Format redigieren', () => {
      const out = redactSensitive('Buchung über 1.234,56 € fehlgeschlagen');
      expect(out).not.toContain('1.234,56');
      expect(out).toContain('[AMOUNT]');
    });

    it('[SECURITY] sollte Beträge mit vorangestelltem €-Zeichen redigieren', () => {
      const out = redactSensitive('Limit € 500,00 überschritten');
      expect(out).not.toContain('500,00');
      expect(out).toContain('[AMOUNT]');
    });

    it('[SECURITY] sollte EUR-Suffix-Beträge redigieren', () => {
      const out = redactSensitive('Saldo 42,10 EUR ungültig');
      expect(out).not.toContain('42,10');
      expect(out).toContain('[AMOUNT]');
    });

    it('[SECURITY] sollte E-Mail-Adressen redigieren', () => {
      const out = redactSensitive('Login für max.mustermann@example.com fehlgeschlagen');
      expect(out).not.toContain('max.mustermann@example.com');
      expect(out).toContain('[EMAIL]');
    });
  });

  describe('Edge Cases', () => {
    it('sollte harmlose technische Meldungen unverändert lassen', () => {
      const msg = "Cannot read properties of undefined (reading 'map') at TransactionDayList.tsx:42:13";
      expect(redactSensitive(msg)).toBe(msg);
    });

    it('sollte leere Strings durchreichen', () => {
      expect(redactSensitive('')).toBe('');
    });

    it('sollte Versions-/Zeilennummern nicht als Betrag fehlinterpretieren', () => {
      const msg = 'chunk-4ec0e8.js:1:23 failed after 2,5s';
      expect(redactSensitive(msg)).toContain('chunk-4ec0e8.js:1:23');
    });
  });
});

describe('createLogger', () => {
  describe('Level-Routing', () => {
    it('sollte error und warn persistieren, debug und info nicht', () => {
      const persist = vi.fn();
      const log = createLogger({ dev: false, persist });
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      expect(persist).toHaveBeenCalledTimes(2);
      expect(persist.mock.calls[0][0]).toMatchObject({ level: 'warn', message: 'w' });
      expect(persist.mock.calls[1][0]).toMatchObject({ level: 'error', message: 'e' });
    });

    it('sollte im Dev-Modus zusätzlich auf die Konsole schreiben', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger({ dev: true, persist: vi.fn() });
      log.error('dev-sichtbar');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('sollte im Prod-Modus debug nicht auf die Konsole schreiben', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const log = createLogger({ dev: false, persist: vi.fn() });
      log.debug('leise');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Redaktion & Kontext-Whitelist', () => {
    it('[SECURITY] sollte die Message vor der Persistenz redigieren', () => {
      const persist = vi.fn();
      const log = createLogger({ dev: false, persist });
      log.error('Fehler bei DE89370400440532013000');
      expect(persist.mock.calls[0][0].message).not.toContain('DE89370400440532013000');
    });

    it('[SECURITY] sollte nur Whitelist-Keys aus dem Kontext übernehmen', () => {
      const persist = vi.fn();
      const log = createLogger({ dev: false, persist });
      log.error('kaputt', { source: 'sync', code: 'E42', payee: 'REWE Markt', count: 3 });
      const ctx = persist.mock.calls[0][0].context;
      expect(ctx).toMatchObject({ source: 'sync', code: 'E42', count: 3 });
      expect(ctx).not.toHaveProperty('payee');
    });

    it('sollte Fehler in der Persistenz schlucken (Logging darf nie crashen)', () => {
      const log = createLogger({
        dev: false,
        persist: () => {
          throw new Error('idb kaputt');
        },
      });
      expect(() => log.error('x')).not.toThrow();
    });
  });
});
