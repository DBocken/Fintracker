import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { ErrorBoundary } from '../ErrorBoundary';
import { getErrorLog, clearErrorLog } from '@/services/error-log-service';

function Bomb(): never {
  throw new Error('Kaboom aus dem Render');
}

async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(async () => {
  window.localStorage.clear();
  await clearErrorLog();
  // React loggt gefangene Render-Fehler laut auf console.error — im Test stumm.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  describe('Normal Behavior', () => {
    it('sollte bei einem Render-Fehler die Fallback-UI zeigen', () => {
      renderWithI18n(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
        'de',
      );
      expect(screen.getByText(/errorBoundary\.title|Fehler/i)).toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte gefangene Fehler ins zentrale Fehlerprotokoll schreiben (nicht mehr localStorage error_log)', async () => {
      renderWithI18n(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
        'de',
      );
      await flushAsync();
      const log = await getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ source: 'boundary', level: 'error' });
      expect(log[0].message).toContain('Kaboom');
      // Der alte Stub schrieb nach localStorage['error_log'] — darf nicht zurückkommen.
      expect(window.localStorage.getItem('error_log')).toBeNull();
    });
  });
});
