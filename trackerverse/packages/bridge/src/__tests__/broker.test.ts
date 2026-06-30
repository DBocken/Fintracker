import { describe, expect, it, vi } from 'vitest';
import { CapabilityBroker, type ConsentCallback } from '../broker';
import { CapabilityStore, type GrantRecord } from '../capabilities';
import { AppRegistry } from '../registry';
import { BRIDGE_PROTOCOL_VERSION, type BridgeRequestMessage } from '../types';

const FIN_ORIGIN = 'https://fin.trackerverse.de';
const SHOP_ORIGIN = 'https://shop.trackerverse.de';

function makeBroker(opts: {
  consent?: ConsentCallback;
  initialGrants?: GrantRecord[];
  receiptsProvider?: (params: unknown) => unknown;
} = {}) {
  const registry = new AppRegistry([
    { appId: 'fintrack', origin: FIN_ORIGIN },
    { appId: 'shoptrack', origin: SHOP_ORIGIN },
  ]);
  const capabilities = new CapabilityStore({ initial: opts.initialGrants });
  const audit = vi.fn();
  const broker = new CapabilityBroker({
    registry,
    capabilities,
    requestConsent: opts.consent ?? (() => true),
    onAudit: audit,
    now: () => '2026-06-30T00:00:00.000Z',
  });
  const provider = vi.fn((ctx: { params: unknown }) =>
    opts.receiptsProvider ? opts.receiptsProvider(ctx.params) : [{ id: 'r1', total: 42 }],
  );
  // shoptrack stellt seine Belege bereit; fintrack ist der Consumer.
  broker.registerProvider('shoptrack', 'receipts', provider);
  return { broker, capabilities, audit, provider };
}

function request(over: Partial<BridgeRequestMessage> = {}): BridgeRequestMessage {
  return {
    __trackerverse: true,
    protocol: BRIDGE_PROTOCOL_VERSION,
    kind: 'request',
    id: 'req-1',
    appId: 'fintrack',
    scope: 'shoptrack:receipts:read',
    ...over,
  };
}

describe('CapabilityBroker', () => {
  describe('Normal Behavior', () => {
    it('sollte bei vorhandenem Grant die Provider-Daten liefern', async () => {
      const { broker } = makeBroker({
        initialGrants: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
      });
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(res.ok).toBe(true);
      expect(res.data).toEqual([{ id: 'r1', total: 42 }]);
    });

    it('sollte params an den Provider durchreichen', async () => {
      const { broker, provider } = makeBroker({
        initialGrants: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
      });
      await broker.handle(request({ params: { month: '2026-06' } }), FIN_ORIGIN);
      expect(provider).toHaveBeenCalledWith(
        expect.objectContaining({ consumerApp: 'fintrack', resource: 'receipts', params: { month: '2026-06' } }),
      );
    });
  });

  describe('Consent-Flow', () => {
    it('sollte bei fehlendem Grant Consent erfragen, dann liefern und persistieren', async () => {
      const consent = vi.fn(() => true);
      const { broker, capabilities } = makeBroker({ consent });
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(consent).toHaveBeenCalledTimes(1);
      expect(res.ok).toBe(true);
      expect(capabilities.isGranted('fintrack', 'shoptrack:receipts:read')).toBe(true);
    });

    it('sollte nach erteiltem Consent beim zweiten Mal nicht erneut fragen', async () => {
      const consent = vi.fn(() => true);
      const { broker } = makeBroker({ consent });
      await broker.handle(request({ id: 'a' }), FIN_ORIGIN);
      await broker.handle(request({ id: 'b' }), FIN_ORIGIN);
      expect(consent).toHaveBeenCalledTimes(1);
    });

    it('sollte ein { granted: true }-Objekt als Consent akzeptieren', async () => {
      const { broker } = makeBroker({ consent: () => ({ granted: true }) });
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(res.ok).toBe(true);
    });
  });

  describe('Default-deny', () => {
    it('sollte bei abgelehntem Consent verweigern und den Provider nicht aufrufen', async () => {
      const { broker, provider } = makeBroker({ consent: () => false });
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('consent_denied');
      expect(provider).not.toHaveBeenCalled();
    });

    it('sollte einen unbekannten Scope ablehnen', async () => {
      const { broker } = makeBroker();
      const res = await broker.handle(request({ scope: 'shoptrack:*:read' }), FIN_ORIGIN);
      expect(res.error?.code).toBe('invalid_scope');
    });

    it('sollte ablehnen wenn kein Provider registriert ist', async () => {
      const { broker } = makeBroker();
      const res = await broker.handle(request({ scope: 'shoptrack:secrets:read' }), FIN_ORIGIN);
      expect(res.error?.code).toBe('no_provider');
    });

    it('sollte eine falsche Protokollversion ablehnen', async () => {
      const { broker } = makeBroker();
      const res = await broker.handle(request({ protocol: 999 }), FIN_ORIGIN);
      expect(res.error?.code).toBe('protocol_mismatch');
    });

    it('sollte eine malformte Nachricht ablehnen', async () => {
      const { broker } = makeBroker();
      expect((await broker.handle(null, FIN_ORIGIN)).error?.code).toBe('malformed');
      expect((await broker.handle({ foo: 'bar' }, FIN_ORIGIN)).error?.code).toBe('malformed');
    });

    it('sollte einen Provider-Fehler als provider_error abfangen statt zu werfen', async () => {
      const { broker } = makeBroker({
        initialGrants: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
        receiptsProvider: () => {
          throw new Error('boom');
        },
      });
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('provider_error');
    });
  });

  describe('Security', () => {
    it('[SECURITY] sollte verweigern wenn appId nicht zum sendenden Origin gehört', async () => {
      const { broker, provider } = makeBroker({
        // Selbst MIT Grant darf ein fremder Origin die Identität nicht missbrauchen.
        initialGrants: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
      });
      const res = await broker.handle(request({ appId: 'fintrack' }), SHOP_ORIGIN);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('origin_mismatch');
      expect(provider).not.toHaveBeenCalled();
    });

    it('[SECURITY] sollte einen komplett unbekannten Origin ablehnen', async () => {
      const { broker } = makeBroker();
      const res = await broker.handle(request(), 'https://evil.example.com');
      expect(res.error?.code).toBe('origin_mismatch');
    });

    it('[SECURITY] sollte Origin VOR dem Scope prüfen (kein Informationsleck über Provider-Existenz)', async () => {
      const { broker } = makeBroker();
      // Unbekannter Scope UND falscher Origin -> Origin-Fehler hat Vorrang.
      const res = await broker.handle(
        request({ scope: 'shoptrack:secrets:read' }),
        'https://evil.example.com',
      );
      expect(res.error?.code).toBe('origin_mismatch');
    });

    it('[SECURITY] sollte nach Revoke wieder verweigern (Grant ist widerrufbar)', async () => {
      const { broker, capabilities } = makeBroker({ consent: () => false });
      capabilities.grant('fintrack', 'shoptrack:receipts:read', 'x');
      expect((await broker.handle(request(), FIN_ORIGIN)).ok).toBe(true);
      capabilities.revoke('fintrack', 'shoptrack:receipts:read');
      const res = await broker.handle(request(), FIN_ORIGIN);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('consent_denied');
    });
  });

  describe('Audit', () => {
    it('sollte ein allow-Audit-Event mit Scope emittieren', async () => {
      const { broker, audit } = makeBroker({
        initialGrants: [{ consumerApp: 'fintrack', scope: 'shoptrack:receipts:read', grantedAt: 'x' }],
      });
      await broker.handle(request(), FIN_ORIGIN);
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'allow', appId: 'fintrack', scope: 'shoptrack:receipts:read' }),
      );
    });

    it('sollte ein deny-Audit-Event bei Origin-Mismatch emittieren', async () => {
      const { broker, audit } = makeBroker();
      await broker.handle(request(), SHOP_ORIGIN);
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'deny', reason: 'origin_mismatch' }));
    });
  });
});
