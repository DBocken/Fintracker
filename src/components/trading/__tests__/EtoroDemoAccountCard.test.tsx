import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroPnlResponseSchema } from '@/services/etoro-api-schemas';
import EtoroDemoAccountCard from '../EtoroDemoAccountCard';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const pnl = EtoroPnlResponseSchema.parse({
  clientPortfolio: { credit: 10000, unrealizedPnL: 234.5 },
});

describe('EtoroDemoAccountCard', () => {
  describe('Normal Behavior', () => {
    it('sollte Demo-Guthaben und unrealisierte G/V anzeigen', () => {
      renderWithI18n(<EtoroDemoAccountCard isLoading={false} error={null} pnl={pnl} />);
      expect(screen.getByText('Demo-Konto')).toBeInTheDocument();
      expect(screen.getByText(/10\.000,00\s*\$/)).toBeInTheDocument();
      expect(screen.getByText(/234,50\s*\$/)).toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(<EtoroDemoAccountCard isLoading={false} error={null} pnl={pnl} />, 'en');
      expect(screen.getByText('Demo account')).toBeInTheDocument();
    });
  });

  describe('Edge Cases (stilles Degradieren)', () => {
    it('sollte null rendern, wenn kein Demo-Konto vorhanden ist (leere Antwort)', () => {
      const empty = EtoroPnlResponseSchema.parse({});
      const { container } = renderWithI18n(<EtoroDemoAccountCard isLoading={false} error={null} pnl={empty} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('sollte null rendern, während geladen wird (kein Spinner/Flackern)', () => {
      const { container } = renderWithI18n(<EtoroDemoAccountCard isLoading error={null} pnl={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('[REGRESSION] sollte bei Fehler (z. B. fehlender Scope) still null rendern statt einer Fehlermeldung', () => {
      const { container } = renderWithI18n(<EtoroDemoAccountCard isLoading={false} error={new Error('unauthorized')} pnl={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('i18n-Compliance (eToro Demo-Konto)', () => {
    it('[REGRESSION] sollte alle trading.etoro.demo-Keys in de/en/tlh haben', () => {
      const keys = ['trading.etoro.demo.title', 'trading.etoro.demo.credit', 'trading.etoro.demo.unrealizedPnl'];
      const locales = [translations.de, translations.en, translations.tlh];
      keys.forEach((key) => {
        const path = key.split('.');
        locales.forEach((locale) => {
          let value = locale as Record<string, unknown>;
          path.forEach((p) => {
            expect(value[p], `${key} fehlt`).toBeDefined();
            value = value[p] as Record<string, unknown>;
          });
        });
      });
    });
  });
});
