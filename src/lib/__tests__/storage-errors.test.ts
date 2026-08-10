/**
 * RES-6 (WP 1.6): `ERROR_CODES.STORAGE_QUOTA_EXCEEDED` war toter Code, ein
 * voller Speicher warf eine rohe `DOMException` bis zur Oberfläche durch.
 *
 * Bilingualer Nachweis (de + en): `storage-errors.ts` liegt in `src/lib/` und
 * nutzt `serviceT` (kein React-Kontext) — die Sprache wird deshalb wie in den
 * übrigen `lib/__tests__`-Dateien direkt über den localStorage-Schlüssel
 * gepinnt, den `serviceT` liest (`account-limits.test.ts` u. a. folgen
 * demselben Muster). Die UI-seitige Bilingual-Prüfung über
 * `@/test-utils/render` steht in
 * `src/components/__tests__/BackupManager.persistence-hint.test.tsx`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isQuotaExceededError, StorageQuotaExceededError } from '../storage-errors';
import { ERROR_CODES } from '../constants';

describe('isQuotaExceededError', () => {
  it('erkennt den modernen Namen QuotaExceededError', () => {
    expect(isQuotaExceededError(new DOMException('voll', 'QuotaExceededError'))).toBe(true);
  });

  it('[REGRESSION] erkennt den Legacy-Code 22 auch ohne passenden Namen (Safari & Co.)', () => {
    const legacy = { name: 'UnknownError', code: 22 };
    expect(isQuotaExceededError(legacy)).toBe(true);
  });

  it('lehnt andere Fehler ab', () => {
    expect(isQuotaExceededError(new DOMException('kaputt', 'InvalidStateError'))).toBe(false);
    expect(isQuotaExceededError(new Error('irgendwas'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});

describe('StorageQuotaExceededError', () => {
  it('trägt ERROR_CODES.STORAGE_QUOTA_EXCEEDED statt eine rohe DOMException zu sein', () => {
    const error = new StorageQuotaExceededError();
    expect(error.code).toBe(ERROR_CODES.STORAGE_QUOTA_EXCEEDED);
    expect(error).not.toBeInstanceOf(DOMException);
  });

  it('haengt die Ursache als `cause` an, wenn eine uebergeben wird', () => {
    const cause = new DOMException('voll', 'QuotaExceededError');
    const error = new StorageQuotaExceededError(cause);
    expect((error as Error & { cause?: unknown }).cause).toBe(cause);
  });

  describe('Meldung mit Handlungsoption (bilingual)', () => {
    beforeEach(() => {
      window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    });
    afterEach(() => {
      window.localStorage.removeItem('ausgabentracker_locale_v1');
    });

    it('[REGRESSION] sollte auf Deutsch eine Meldung mit Handlungsoption zeigen, keinen rohen Key', () => {
      window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
      const error = new StorageQuotaExceededError();
      expect(error.message).toMatch(/backup|aufräumen/i);
      expect(error.message).not.toBe('storage.quotaExceeded');
    });

    it('[REGRESSION] sollte auf Englisch eine Meldung mit Handlungsoption zeigen, keinen rohen Key', () => {
      window.localStorage.setItem('ausgabentracker_locale_v1', 'en');
      const error = new StorageQuotaExceededError();
      expect(error.message).toMatch(/backup|clean up/i);
      expect(error.message).not.toBe('storage.quotaExceeded');
    });
  });
});
