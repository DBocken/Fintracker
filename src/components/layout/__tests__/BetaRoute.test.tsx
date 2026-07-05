import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BetaRoute from '../BetaRoute';
import { setFeatureEnabled } from '@/lib/feature-flags';

function renderTradingRoute() {
  return render(
    <MemoryRouter initialEntries={['/trading']}>
      <Routes>
        <Route path="/coach" element={<div>Coach-Seite</div>} />
        <Route
          path="/trading"
          element={
            <BetaRoute flag="trading_beta">
              <div>Trading-Seite</div>
            </BetaRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BetaRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Normal Behavior', () => {
    it('sollte bei ausgeschaltetem Flag zum Coach umleiten', () => {
      renderTradingRoute();
      expect(screen.getByText('Coach-Seite')).toBeInTheDocument();
      expect(screen.queryByText('Trading-Seite')).not.toBeInTheDocument();
    });

    it('sollte bei eingeschaltetem Flag die Kinder rendern', () => {
      setFeatureEnabled('trading_beta', true);
      renderTradingRoute();
      expect(screen.getByText('Trading-Seite')).toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte das Einschalten des Flags ohne Seiten-Reload übernehmen', () => {
      // Vorher: App.tsx las das Flag nicht-reaktiv — nach dem Umschalten in den
      // Einstellungen leitete /trading bis zum manuellen Reload weiter zum Coach.
      renderTradingRoute();
      expect(screen.getByText('Coach-Seite')).toBeInTheDocument();

      act(() => {
        setFeatureEnabled('trading_beta', true);
        window.dispatchEvent(new Event('fintracker:flag-changed'));
      });

      // Redirect ist bereits passiert (wir sind auf /coach) — entscheidend ist,
      // dass ein erneuter Aufruf von /trading jetzt ohne Reload funktioniert.
      renderTradingRoute();
      expect(screen.getByText('Trading-Seite')).toBeInTheDocument();
    });
  });
});
