import { describe, it, expect, beforeEach } from 'vitest';
import {
  installGlobalErrorHandlers,
  uninstallGlobalErrorHandlers,
} from '../global-error-handlers';
import { getErrorLog, clearErrorLog } from '../error-log-service';

async function flushAsync() {
  // appendErrorLogEntry läuft fire-and-forget über IndexedDB — kurz warten.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(async () => {
  uninstallGlobalErrorHandlers();
  await clearErrorLog();
});

describe('installGlobalErrorHandlers', () => {
  describe('Normal Behavior', () => {
    it('sollte unbehandelte window-Fehler ins Protokoll schreiben', async () => {
      installGlobalErrorHandlers();
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }));
      await flushAsync();
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ source: 'window', level: 'error' });
      expect(log[0].message).toContain('boom');
    });

    it('sollte unbehandelte Promise-Rejections ins Protokoll schreiben', async () => {
      installGlobalErrorHandlers();
      // jsdom kennt keinen PromiseRejectionEvent-Konstruktor → generisches Event
      // mit reason-Feld, wie es der Handler liest.
      const event = new Event('unhandledrejection') as Event & { reason?: unknown };
      event.reason = new Error('abgelehnt');
      window.dispatchEvent(event);
      await flushAsync();
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ source: 'promise', level: 'error' });
      expect(log[0].message).toContain('abgelehnt');
    });
  });

  describe('Edge Cases', () => {
    it('sollte Doppel-Installation als No-op behandeln (keine doppelten Einträge)', async () => {
      installGlobalErrorHandlers();
      installGlobalErrorHandlers();
      window.dispatchEvent(new ErrorEvent('error', { message: 'einmal' }));
      await flushAsync();
      // De-Dupe würde count erhöhen — doppelte Listener wären count=2.
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].count).toBe(1);
    });

    it('sollte Nicht-Error-Rejection-Gründe (Strings) protokollieren', async () => {
      installGlobalErrorHandlers();
      const event = new Event('unhandledrejection') as Event & { reason?: unknown };
      event.reason = 'nur ein String';
      window.dispatchEvent(event);
      await flushAsync();
      const log = await getErrorLog();
      expect(log[0].message).toContain('nur ein String');
    });
  });
});
