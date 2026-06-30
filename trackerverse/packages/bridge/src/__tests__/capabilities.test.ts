import { describe, expect, it, vi } from 'vitest';
import { CapabilityStore } from '../capabilities';

const T = '2026-06-30T00:00:00.000Z';

describe('CapabilityStore (Grants)', () => {
  describe('Normal Behavior', () => {
    it('sollte einen Grant setzen und prüfen', () => {
      const store = new CapabilityStore();
      store.grant('shoptrack', 'fintrack:transactions:read', T);
      expect(store.isGranted('shoptrack', 'fintrack:transactions:read')).toBe(true);
    });

    it('sollte einen Grant widerrufen', () => {
      const store = new CapabilityStore();
      store.grant('shoptrack', 'fintrack:transactions:read', T);
      store.revoke('shoptrack', 'fintrack:transactions:read');
      expect(store.isGranted('shoptrack', 'fintrack:transactions:read')).toBe(false);
    });

    it('sollte alle Grants einer App widerrufen', () => {
      const store = new CapabilityStore();
      store.grant('meal', 'shoptrack:receipts:read', T);
      store.grant('meal', 'fintrack:transactions:read', T);
      store.grant('fit', 'meal:meals:read', T);
      store.revokeAll('meal');
      expect(store.list().map((g) => g.consumerApp)).toEqual(['fit']);
    });
  });

  describe('Edge Cases', () => {
    it('sollte standardmäßig nichts erlauben (Default-deny)', () => {
      const store = new CapabilityStore();
      expect(store.isGranted('shoptrack', 'fintrack:transactions:read')).toBe(false);
    });

    it('sollte mit anfänglichen Grants hydratisieren', () => {
      const store = new CapabilityStore({
        initial: [{ consumerApp: 'shoptrack', scope: 'fintrack:transactions:read', grantedAt: T }],
      });
      expect(store.isGranted('shoptrack', 'fintrack:transactions:read')).toBe(true);
    });

    it('sollte denselben Grant idempotent behandeln (Zeitstempel bleibt)', () => {
      const store = new CapabilityStore();
      store.grant('shoptrack', 'fintrack:transactions:read', T);
      store.grant('shoptrack', 'fintrack:transactions:read', '2099-01-01T00:00:00.000Z');
      expect(store.list()).toHaveLength(1);
      expect(store.list()[0].grantedAt).toBe(T);
    });
  });

  describe('Persistence', () => {
    it('sollte onChange bei grant und revoke aufrufen', () => {
      const onChange = vi.fn();
      const store = new CapabilityStore({ onChange });
      store.grant('shoptrack', 'fintrack:transactions:read', T);
      store.revoke('shoptrack', 'fintrack:transactions:read');
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('sollte onChange nicht bei wirkungslosem revoke aufrufen', () => {
      const onChange = vi.fn();
      const store = new CapabilityStore({ onChange });
      store.revoke('shoptrack', 'fintrack:transactions:read');
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
