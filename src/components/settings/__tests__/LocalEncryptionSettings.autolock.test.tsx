import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { LocalEncryptionSettings } from '../LocalEncryptionSettings';

/**
 * WP 3.2 (SEC-2): bilingualer Test der neuen Auto-Lock-Texte
 * (`privacy.localEncryption.autoLock*`), gemäß AGENTS.md §6 über
 * `@/test-utils/render` (nicht über eine lokale Provider-Kopie).
 */

const setAutoLockMinutes = vi.fn();
const setLockOnHidden = vi.fn();

vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({
    enabled: true,
    unlocked: true,
    autoLockMinutes: 10,
    setAutoLockMinutes,
    lockOnHidden: false,
    setLockOnHidden,
    lock: vi.fn(),
    unlock: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('LocalEncryptionSettings — Auto-Lock', () => {
  beforeEach(() => {
    setAutoLockMinutes.mockClear();
    setLockOnHidden.mockClear();
  });

  it('sollte die Auto-Lock-Einstellung auf Deutsch beschriften', () => {
    renderWithI18n(<LocalEncryptionSettings />, 'de');
    expect(screen.getByText('Automatische Sperre')).toBeInTheDocument();
    expect(screen.getByLabelText('Automatische Sperre')).toBeInTheDocument();
  });

  it('should label the auto-lock setting in English', () => {
    renderWithI18n(<LocalEncryptionSettings />, 'en');
    expect(screen.getByText('Auto-lock')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-lock')).toBeInTheDocument();
  });

  it('sollte die "Bei Tab-Wechsel sperren"-Einstellung auf Deutsch beschriften', () => {
    renderWithI18n(<LocalEncryptionSettings />, 'de');
    expect(screen.getByText('Bei Tab-Wechsel sperren')).toBeInTheDocument();
    expect(screen.getByLabelText('Bei Tab-Wechsel sperren')).toBeInTheDocument();
  });

  it('should label the "lock on tab switch" setting in English', () => {
    renderWithI18n(<LocalEncryptionSettings />, 'en');
    expect(screen.getByText('Lock when switching tabs')).toBeInTheDocument();
    expect(screen.getByLabelText('Lock when switching tabs')).toBeInTheDocument();
  });
});
