import { describe, it, expect } from 'vitest';
import {
  isSafeExternalAuthUrl,
  assertSafeRedirectUrl,
  GOCARDLESS_AUTH_HOST_SUFFIXES,
} from '@/lib/safe-url';

describe('[SECURITY] safe-url — Validierung externer Redirect-URLs', () => {
  describe('Normal Behavior', () => {
    it('sollte GoCardless-Auth-URLs akzeptieren', () => {
      expect(isSafeExternalAuthUrl('https://ob.gocardless.com/psd2/start/abc/xyz')).toBe(true);
      expect(isSafeExternalAuthUrl('https://bankaccountdata.gocardless.com/psd2/start/abc')).toBe(true);
      expect(isSafeExternalAuthUrl('https://gocardless.com/whatever')).toBe(true);
    });

    it('sollte Hosts case-insensitiv und mit Port akzeptieren', () => {
      expect(isSafeExternalAuthUrl('https://OB.GoCardless.com/start')).toBe(true);
      expect(isSafeExternalAuthUrl('https://ob.gocardless.com:443/start')).toBe(true);
    });

    it('sollte erlaubte eigene Origins akzeptieren (requisition.redirect-Fallback)', () => {
      const opts = { allowedOrigins: ['https://fintracker-phi.vercel.app'] };
      expect(isSafeExternalAuthUrl('https://fintracker-phi.vercel.app/accounts', opts)).toBe(true);
    });

    it('sollte eigene Host-Suffixe per Option erlauben', () => {
      const opts = { allowedHostSuffixes: ['example.com'] };
      expect(isSafeExternalAuthUrl('https://auth.example.com/start', opts)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leere, null- und undefined-Werte ablehnen', () => {
      expect(isSafeExternalAuthUrl('')).toBe(false);
      expect(isSafeExternalAuthUrl(null)).toBe(false);
      expect(isSafeExternalAuthUrl(undefined)).toBe(false);
    });

    it('sollte relative und kaputte URLs ablehnen', () => {
      expect(isSafeExternalAuthUrl('/accounts')).toBe(false);
      expect(isSafeExternalAuthUrl('ob.gocardless.com/start')).toBe(false);
      expect(isSafeExternalAuthUrl('https://')).toBe(false);
    });

    it('sollte Lookalike-Hosts ablehnen (Suffix-Verwechslung)', () => {
      expect(isSafeExternalAuthUrl('https://evilgocardless.com/start')).toBe(false);
      expect(isSafeExternalAuthUrl('https://gocardless.com.evil.tld/start')).toBe(false);
    });

    it('sollte URLs mit eingebetteten Credentials ablehnen', () => {
      expect(isSafeExternalAuthUrl('https://user:pw@ob.gocardless.com/start')).toBe(false);
      expect(isSafeExternalAuthUrl('https://evil@ob.gocardless.com/start')).toBe(false);
    });

    it('sollte fremde Origins trotz allowedOrigins ablehnen', () => {
      const opts = { allowedOrigins: ['https://fintracker-phi.vercel.app'] };
      expect(isSafeExternalAuthUrl('https://evil.example/accounts', opts)).toBe(false);
    });
  });

  describe('Error Cases', () => {
    it('[REGRESSION] sollte javascript:- und data:-URLs blockieren (XSS)', () => {
      expect(isSafeExternalAuthUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeExternalAuthUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('sollte http:// (Klartext) blockieren', () => {
      expect(isSafeExternalAuthUrl('http://ob.gocardless.com/start')).toBe(false);
    });

    it('assertSafeRedirectUrl sollte bei unsicherer URL werfen und sichere durchreichen', () => {
      expect(() => assertSafeRedirectUrl('javascript:alert(1)')).toThrow();
      const safe = 'https://ob.gocardless.com/psd2/start/abc';
      expect(assertSafeRedirectUrl(safe)).toBe(safe);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] Default-Allowlist sollte gocardless.com enthalten', () => {
      expect(GOCARDLESS_AUTH_HOST_SUFFIXES).toContain('gocardless.com');
    });
  });
});
