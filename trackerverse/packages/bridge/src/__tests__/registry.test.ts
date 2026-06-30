import { describe, expect, it } from 'vitest';
import { AppRegistry } from '../registry';

const FIN = { appId: 'fintrack', origin: 'https://fin.trackerverse.de' };
const SHOP = { appId: 'shoptrack', origin: 'https://shop.trackerverse.de' };

describe('AppRegistry (Origin-Bindung)', () => {
  describe('Normal Behavior', () => {
    it('sollte Origin und App gegenseitig auflösen', () => {
      const registry = new AppRegistry([FIN, SHOP]);
      expect(registry.originFor('fintrack')).toBe('https://fin.trackerverse.de');
      expect(registry.appForOrigin('https://shop.trackerverse.de')).toBe('shoptrack');
    });

    it('sollte einen trailing slash normalisieren', () => {
      const registry = new AppRegistry([{ appId: 'meal', origin: 'https://meal.trackerverse.de/' }]);
      expect(registry.verify('meal', 'https://meal.trackerverse.de')).toBe(true);
    });

    it('sollte verify=true liefern wenn App exakt am gebundenen Origin hängt', () => {
      const registry = new AppRegistry([FIN]);
      expect(registry.verify('fintrack', 'https://fin.trackerverse.de')).toBe(true);
    });
  });

  describe('Security', () => {
    it('[SECURITY] sollte verify ablehnen wenn App von fremdem Origin kommt', () => {
      const registry = new AppRegistry([FIN, SHOP]);
      // shoptrack-Identität, aber von fintracks Origin gesendet
      expect(registry.verify('shoptrack', 'https://fin.trackerverse.de')).toBe(false);
    });

    it('[SECURITY] sollte verify für unbekannte Apps ablehnen', () => {
      const registry = new AppRegistry([FIN]);
      expect(registry.verify('evil', 'https://evil.example.com')).toBe(false);
    });

    it('[SECURITY] sollte einen Look-alike-Origin ablehnen', () => {
      const registry = new AppRegistry([FIN]);
      expect(registry.verify('fintrack', 'https://fin.trackerverse.de.evil.com')).toBe(false);
    });
  });
});
