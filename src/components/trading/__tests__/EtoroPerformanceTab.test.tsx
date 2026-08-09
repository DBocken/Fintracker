import { describe, it, expect, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroAccountError } from '@/services/etoro-account-service';
import type { PerformancePoint } from '@/services/etoro-performance';
import EtoroPerformanceTab from '../EtoroPerformanceTab';

// Recharts' ResponsiveContainer braucht ResizeObserver, den jsdom nicht kennt.
// Ein No-op-Shim genügt fürs Rendern im Test.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const series: PerformancePoint[] = [
  { date: '2026-06-01', value: 5000 },
  { date: '2026-06-15', value: 5200 },
  { date: '2026-07-01', value: 5400 },
];

describe('EtoroPerformanceTab', () => {
  describe('Normal Behavior', () => {
    it('sollte den Chart-Titel und Disclaimer rendern, wenn Daten vorhanden sind', () => {
      renderWithI18n(<EtoroPerformanceTab isLocked={false} isLoading={false} error={null} series={series} />, 'de');
      expect(screen.getByText('Kontostand-Verlauf')).toBeInTheDocument();
      expect(screen.getByText(/eToro-Kontostand-Snapshots/)).toBeInTheDocument();
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(<EtoroPerformanceTab isLocked={false} isLoading={false} error={null} series={series} />, 'en');
      expect(screen.getByText('Account balance history')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Empty-State zeigen, wenn die Serie leer ist', () => {
      renderWithI18n(<EtoroPerformanceTab isLocked={false} isLoading={false} error={null} series={[]} />, 'de');
      expect(screen.getByText('Keine Verlaufsdaten')).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(<EtoroPerformanceTab isLocked isLoading={false} error={null} series={[]} />, 'de');
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) einen Berechtigungshinweis statt Crash zeigen', () => {
      renderWithI18n(
        <EtoroPerformanceTab isLocked={false} isLoading={false} error={new EtoroAccountError('unauthorized', true)} series={[]} />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
    });
  });

  describe('PERF-4: chartData-Memoisierung', () => {
    it('[REGRESSION] sollte bei neuen series-Werten (gleiche Länge) die aktualisierten Zahlen in der zugänglichen Tabelle zeigen', () => {
      const { rerender } = renderWithI18n(
        <EtoroPerformanceTab isLocked={false} isLoading={false} error={null} series={series} />,
        'de',
      );

      fireEvent.click(screen.getByRole('button', { name: /Werte als Tabelle/i }));
      expect(screen.getByText(/5\.400,00\s\$/)).toBeInTheDocument();

      const updatedSeries: PerformancePoint[] = [series[0], series[1], { date: '2026-07-01', value: 9999 }];
      // Muss dieselbe I18nProvider-Instanz wie beim ersten Render behalten —
      // sonst rerendert RTL die ganze Baumwurzel und der Provider-Kontext
      // fehlt.
      rerender(
        <I18nProvider initialLocale="de">
          <EtoroPerformanceTab isLocked={false} isLoading={false} error={null} series={updatedSeries} />
        </I18nProvider>,
      );

      expect(screen.getByText(/9\.999,00\s\$/)).toBeInTheDocument();
      expect(screen.queryByText(/5\.400,00\s\$/)).not.toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Performance)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.performance-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.performance.title',
        'trading.etoro.performance.valueLabel',
        'trading.etoro.performance.disclaimer',
        'trading.etoro.performance.emptyTitle',
        'trading.etoro.performance.emptyDesc',
      ];
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
