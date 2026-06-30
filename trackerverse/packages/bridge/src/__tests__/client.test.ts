import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeRequestError, createBridgeClient, type ClientTransport } from '../client';
import { BRIDGE_PROTOCOL_VERSION, type BridgeRequestMessage, type BridgeResponseMessage } from '../types';

const VAULT_ORIGIN = 'https://vault.trackerverse.de';

/** Test-Transport: merkt sich gesendete Nachrichten und erlaubt manuelles Antworten. */
function makeTransport() {
  const sent: { message: BridgeRequestMessage; targetOrigin: string }[] = [];
  let handler: ((data: unknown, origin: string) => void) | null = null;
  const transport: ClientTransport = {
    send(message, targetOrigin) {
      sent.push({ message, targetOrigin });
    },
    subscribe(h) {
      handler = h;
      return () => {
        handler = null;
      };
    },
  };
  const reply = (data: unknown, origin = VAULT_ORIGIN) => handler?.(data, origin);
  const response = (over: Partial<BridgeResponseMessage>): BridgeResponseMessage => ({
    __trackerverse: true,
    protocol: BRIDGE_PROTOCOL_VERSION,
    kind: 'response',
    id: sent[sent.length - 1]?.message.id ?? 'unknown',
    ok: true,
    ...over,
  });
  return { transport, sent, reply, response };
}

describe('Bridge-Client', () => {
  describe('Normal Behavior', () => {
    it('sollte eine Anfrage an den Vault-Origin senden', () => {
      const { transport, sent } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport });
      void client.request('shoptrack:receipts:read', { month: '2026-06' });
      expect(sent).toHaveLength(1);
      expect(sent[0].targetOrigin).toBe(VAULT_ORIGIN);
      expect(sent[0].message).toMatchObject({ appId: 'fintrack', scope: 'shoptrack:receipts:read', params: { month: '2026-06' } });
    });

    it('sollte mit den Daten der passenden Antwort auflösen', async () => {
      const { transport, reply, response } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport });
      const promise = client.request('shoptrack:receipts:read');
      reply(response({ ok: true, data: [{ id: 'r1' }] }));
      await expect(promise).resolves.toEqual([{ id: 'r1' }]);
    });

    it('sollte bei ok:false mit einem BridgeRequestError ablehnen', async () => {
      const { transport, reply, response } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport });
      const promise = client.request('shoptrack:receipts:read');
      reply(response({ ok: false, error: { code: 'consent_denied', message: 'nope' } }));
      await expect(promise).rejects.toBeInstanceOf(BridgeRequestError);
      await expect(promise).rejects.toMatchObject({ code: 'consent_denied' });
    });
  });

  describe('Security', () => {
    it('[SECURITY] sollte Antworten von einem fremden Origin ignorieren', async () => {
      vi.useFakeTimers();
      const { transport, reply, response } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport, timeoutMs: 1000 });
      const promise = client.request('shoptrack:receipts:read');
      const rejection = expect(promise).rejects.toMatchObject({ code: 'timeout' });
      // Antwort vom falschen Origin -> muss ignoriert werden, daher läuft der Timeout.
      reply(response({ ok: true, data: 'leak' }), 'https://evil.example.com');
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
    });

    it('sollte Antworten mit unbekannter Korrelations-ID ignorieren', async () => {
      vi.useFakeTimers();
      const { transport, reply, response } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport, timeoutMs: 1000 });
      const promise = client.request('shoptrack:receipts:read');
      const rejection = expect(promise).rejects.toMatchObject({ code: 'timeout' });
      reply(response({ id: 'fremde-id', ok: true, data: 'x' }));
      await vi.advanceTimersByTimeAsync(1000);
      await rejection;
    });
  });

  describe('Edge Cases', () => {
    it('sollte nach Timeout ablehnen', async () => {
      vi.useFakeTimers();
      const { transport } = makeTransport();
      const client = createBridgeClient({ appId: 'fintrack', vaultOrigin: VAULT_ORIGIN, transport, timeoutMs: 500 });
      const promise = client.request('shoptrack:receipts:read');
      const rejection = expect(promise).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(500);
      await rejection;
    });
  });
});

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});
