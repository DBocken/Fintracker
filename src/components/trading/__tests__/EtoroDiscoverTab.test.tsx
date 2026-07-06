import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import type { CandlePoint, InstrumentSearchResultView, CuratedListView, PublicUserProfileView } from '@/services/etoro-discover';
import EtoroDiscoverTab from '../EtoroDiscoverTab';

// Recharts' ResponsiveContainer braucht ResizeObserver, den jsdom nicht kennt.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

function noopState<T extends object = object>(extra?: T) {
  return { isLoading: false, error: null, ...extra } as { isLoading: boolean; error: Error | null } & T;
}

const searchResults: InstrumentSearchResultView[] = [
  { instrumentId: 1, name: 'Apple Inc.', symbol: 'AAPL', rate: 190.5 },
];

const curatedLists: CuratedListView[] = [
  { uuid: 'list-1', name: 'Tech Giants', description: 'Große Tech-Werte', instrumentIds: [1, 2] },
];

const candles: CandlePoint[] = [
  { date: '2026-01-01T00:00:00Z', open: 100, high: 105, low: 98, close: 102, isUp: true },
];

const userProfile: PublicUserProfileView = {
  username: 'johndoe',
  isVerified: true,
  aboutMe: 'Long-term investor',
  avatarUrl: undefined,
};

function baseProps(overrides: Partial<React.ComponentProps<typeof EtoroDiscoverTab>> = {}) {
  return {
    isLocked: false,
    searchQuery: '',
    onSearchQueryChange: () => {},
    onSearchSubmit: () => {},
    searchResults: [],
    searchState: noopState({ hasSearched: false }),
    curatedLists: [],
    curatedListsState: noopState(),
    selectedInstrument: undefined,
    onSelectInstrument: () => {},
    candles: [],
    candlesState: noopState(),
    usernameQuery: '',
    onUsernameQueryChange: () => {},
    onUsernameSubmit: () => {},
    userProfile: undefined,
    userProfileState: noopState({ hasSearched: false }),
    ...overrides,
  };
}

describe('EtoroDiscoverTab', () => {
  describe('Normal Behavior', () => {
    it('sollte Instrument-Suchtreffer anzeigen und onSelectInstrument beim Klick aufrufen', () => {
      let selected: { instrumentId: number; name: string } | undefined;
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({
            searchQuery: 'Apple',
            searchResults,
            searchState: noopState({ hasSearched: true }),
            onSelectInstrument: (option) => (selected = option),
          })}
        />,
      );
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText(/190,50\s*\$/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Apple Inc.'));
      expect(selected).toEqual({ instrumentId: 1, name: 'Apple Inc.' });
    });

    it('sollte kuratierte Listen mit klickbaren Instrument-Buttons anzeigen', () => {
      let selected: { instrumentId: number; name: string } | undefined;
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({
            curatedLists,
            curatedListsState: noopState(),
            onSelectInstrument: (option) => (selected = option),
          })}
        />,
      );
      expect(screen.getByText('Tech Giants')).toBeInTheDocument();
      expect(screen.getByText('Große Tech-Werte')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Instrument #1'));
      expect(selected).toEqual({ instrumentId: 1, name: 'Instrument #1' });
    });

    it('sollte den Candlestick-Chart für das ausgewählte Instrument rendern', () => {
      const { container } = renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({
            selectedInstrument: { instrumentId: 1, name: 'Apple Inc.' },
            candles,
          })}
        />,
      );
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
    });

    it('sollte ein gefundenes Trader-Profil mit Verifiziert-Badge anzeigen', () => {
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({
            usernameQuery: 'johndoe',
            userProfile,
            userProfileState: noopState({ hasSearched: true }),
          })}
        />,
      );
      expect(screen.getByText('johndoe')).toBeInTheDocument();
      expect(screen.getByText('Verifiziert')).toBeInTheDocument();
      expect(screen.getByText('Long-term investor')).toBeInTheDocument();
    });

    it('sollte onSearchSubmit beim Absenden des Suchformulars aufrufen', () => {
      let submitted = false;
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({
            searchQuery: 'Apple',
            onSearchSubmit: () => (submitted = true),
          })}
        />,
      );
      fireEvent.click(screen.getAllByRole('button', { name: 'Suchen' })[0]);
      expect(submitted).toBe(true);
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(<EtoroDiscoverTab {...baseProps()} />, 'en');
      expect(screen.getByText('Discover')).toBeInTheDocument();
      expect(screen.getByText('Instrument search')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Idle-Hinweis zeigen, solange noch nicht gesucht wurde', () => {
      renderWithI18n(<EtoroDiscoverTab {...baseProps()} />);
      expect(screen.getByText('Instrument suchen')).toBeInTheDocument();
      expect(screen.getByText('Trader suchen')).toBeInTheDocument();
    });

    it('sollte einen Keine-Treffer-Hinweis zeigen, wenn die Suche leer zurückkam', () => {
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({ searchQuery: 'Zzz', searchState: noopState({ hasSearched: true }) })}
        />,
      );
      expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    });

    it('sollte einen Profil-nicht-gefunden-Hinweis zeigen, wenn die Trader-Suche leer zurückkam', () => {
      renderWithI18n(
        <EtoroDiscoverTab
          {...baseProps({ usernameQuery: 'unknown', userProfileState: noopState({ hasSearched: true }) })}
        />,
      );
      expect(screen.getByText('Profil nicht gefunden')).toBeInTheDocument();
    });

    it('sollte einen Empty-State zeigen, wenn keine kuratierten Listen vorhanden sind', () => {
      renderWithI18n(<EtoroDiscoverTab {...baseProps()} />);
      expect(screen.getByText('Keine kuratierten Listen')).toBeInTheDocument();
    });

    it('sollte einen Empty-State zeigen, wenn kein Instrument für den Chart ausgewählt ist', () => {
      renderWithI18n(<EtoroDiscoverTab {...baseProps()} />);
      expect(screen.getByText('Kein Instrument ausgewählt')).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(<EtoroDiscoverTab {...baseProps({ isLocked: true })} />);
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Discover)', () => {
    it('[REGRESSION] sollte alle trading.etoro.discover-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.discover',
        'trading.etoro.discover.title',
        'trading.etoro.discover.searchTitle',
        'trading.etoro.discover.searchPlaceholder',
        'trading.etoro.discover.searchButton',
        'trading.etoro.discover.searchIdleTitle',
        'trading.etoro.discover.searchIdleDesc',
        'trading.etoro.discover.searchEmptyTitle',
        'trading.etoro.discover.searchEmptyDesc',
        'trading.etoro.discover.instrumentFallback',
        'trading.etoro.discover.curatedTitle',
        'trading.etoro.discover.curatedEmptyTitle',
        'trading.etoro.discover.curatedEmptyDesc',
        'trading.etoro.discover.chartTitle',
        'trading.etoro.discover.chartEmptyTitle',
        'trading.etoro.discover.chartEmptyDesc',
        'trading.etoro.discover.candlesTooltipLabel',
        'trading.etoro.discover.traderTitle',
        'trading.etoro.discover.traderPlaceholder',
        'trading.etoro.discover.traderButton',
        'trading.etoro.discover.traderIdleTitle',
        'trading.etoro.discover.traderIdleDesc',
        'trading.etoro.discover.traderEmptyTitle',
        'trading.etoro.discover.traderEmptyDesc',
        'trading.etoro.discover.traderVerifiedBadge',
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
