import { describe, expect, it } from 'vitest';
import { parseScope, scopeKey } from '../scope';

describe('Scope-Parsing', () => {
  describe('Normal Behavior', () => {
    it('sollte einen gültigen Scope in seine Teile zerlegen', () => {
      expect(parseScope('shoptrack:receipts:read')).toEqual({
        providerApp: 'shoptrack',
        resource: 'receipts',
        action: 'read',
      });
    });

    it('sollte Bindestriche in App und Ressource erlauben', () => {
      expect(parseScope('car-track:fuel-logs:read')).toEqual({
        providerApp: 'car-track',
        resource: 'fuel-logs',
        action: 'read',
      });
    });

    it('sollte aus einem geparsten Scope wieder den Schlüssel bilden', () => {
      const parsed = parseScope('fintrack:transactions:read')!;
      expect(scopeKey(parsed)).toBe('fintrack:transactions:read');
    });
  });

  describe('Edge Cases', () => {
    it('sollte null für nicht-strings liefern', () => {
      expect(parseScope(undefined)).toBeNull();
      expect(parseScope(null)).toBeNull();
      expect(parseScope(42)).toBeNull();
    });

    it('sollte null bei falscher Segmentanzahl liefern', () => {
      expect(parseScope('shoptrack:receipts')).toBeNull();
      expect(parseScope('a:b:c:d')).toBeNull();
      expect(parseScope('')).toBeNull();
    });

    it('sollte leere Segmente ablehnen', () => {
      expect(parseScope('shoptrack::read')).toBeNull();
      expect(parseScope(':receipts:read')).toBeNull();
    });

    it('sollte Großbuchstaben und Whitespace ablehnen', () => {
      expect(parseScope('ShopTrack:receipts:read')).toBeNull();
      expect(parseScope('shoptrack: receipts:read')).toBeNull();
    });
  });

  describe('Security', () => {
    it('[SECURITY] sollte keine Wildcards in der Ressource erlauben', () => {
      expect(parseScope('shoptrack:*:read')).toBeNull();
    });

    it('[SECURITY] sollte keine Wildcards in der App erlauben', () => {
      expect(parseScope('*:receipts:read')).toBeNull();
    });

    it('[SECURITY] sollte nur die Aktion "read" erlauben (kein write in v1)', () => {
      expect(parseScope('shoptrack:receipts:write')).toBeNull();
      expect(parseScope('shoptrack:receipts:*')).toBeNull();
      expect(parseScope('shoptrack:receipts:delete')).toBeNull();
    });
  });
});
