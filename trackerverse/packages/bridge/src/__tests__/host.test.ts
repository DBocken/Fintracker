import { describe, expect, it, vi } from 'vitest';
import { CapabilityBroker } from '../broker';
import { CapabilityStore } from '../capabilities';
import { handleBrokerMessageEvent, type BrokerMessageEventLike } from '../host';
import { AppRegistry } from '../registry';
import { BRIDGE_PROTOCOL_VERSION } from '../types';

const FIN_ORIGIN = 'https://fin.trackerverse.de';

function makeBroker() {
  const broker = new CapabilityBroker({
    registry: new AppRegistry([{ appId: 'fintrack', origin: FIN_ORIGIN }]),
    capabilities: new CapabilityStore({
      initial: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
    }),
    requestConsent: () => true,
  });
  broker.registerProvider('shoptrack', 'receipts', () => [{ id: 'r1' }]);
  return broker;
}

function requestEvent(origin: string, postMessage = vi.fn()): BrokerMessageEventLike {
  return {
    origin,
    source: { postMessage },
    data: {
      __trackerverse: true,
      protocol: BRIDGE_PROTOCOL_VERSION,
      kind: 'request',
      id: 'req-1',
      appId: 'fintrack',
      scope: 'shoptrack:receipts:read',
    },
  };
}

describe('Broker-Host (postMessage)', () => {
  describe('Normal Behavior', () => {
    it('sollte die Antwort an die Quelle zurückposten', async () => {
      const postMessage = vi.fn();
      await handleBrokerMessageEvent(makeBroker(), requestEvent(FIN_ORIGIN, postMessage));
      expect(postMessage).toHaveBeenCalledTimes(1);
      const [response] = postMessage.mock.calls[0];
      expect(response).toMatchObject({ kind: 'response', id: 'req-1', ok: true });
    });
  });

  describe('Security', () => {
    it('[SECURITY] sollte die Antwort an exakt den anfragenden Origin posten, niemals an "*"', async () => {
      const postMessage = vi.fn();
      await handleBrokerMessageEvent(makeBroker(), requestEvent(FIN_ORIGIN, postMessage));
      const [, targetOrigin] = postMessage.mock.calls[0];
      expect(targetOrigin).toBe(FIN_ORIGIN);
      expect(targetOrigin).not.toBe('*');
    });

    it('[SECURITY] sollte fremde Nachrichten ohne unseren Envelope ignorieren', async () => {
      const postMessage = vi.fn();
      await handleBrokerMessageEvent(makeBroker(), {
        origin: FIN_ORIGIN,
        source: { postMessage },
        data: { type: 'analytics', payload: 1 },
      });
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('[SECURITY] sollte einem fremden Origin eine origin_mismatch-Fehlerantwort an dessen Origin schicken', async () => {
      const postMessage = vi.fn();
      await handleBrokerMessageEvent(makeBroker(), requestEvent('https://evil.example.com', postMessage));
      const [response, targetOrigin] = postMessage.mock.calls[0];
      expect(response).toMatchObject({ ok: false, error: { code: 'origin_mismatch' } });
      expect(targetOrigin).toBe('https://evil.example.com');
    });

    it('sollte nicht abstürzen wenn source null ist', async () => {
      await expect(
        handleBrokerMessageEvent(makeBroker(), { ...requestEvent(FIN_ORIGIN), source: null }),
      ).resolves.toBeUndefined();
    });
  });
});
