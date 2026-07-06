import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translations } from '@/i18n/translations';
import { EtoroDiscussionsResponseSchema } from '@/services/etoro-api-schemas';
import EtoroNewsTab from '../EtoroNewsTab';

function renderWithI18n(ui: React.ReactElement, locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const newsFeed = EtoroDiscussionsResponseSchema.parse({
  discussions: [
    {
      id: '1',
      post: {
        id: '1',
        owner: { username: 'johndoe' },
        message: { text: 'Excited about $TSLA earnings next week!' },
        created: '2026-01-15T10:30:00Z',
      },
    },
  ],
});

function noopNewsFeed(data: typeof newsFeed | undefined = newsFeed) {
  return { data, isLoading: false, error: null };
}

function noopPositionsFeed(responses: Array<typeof newsFeed | undefined> = []) {
  return { responses, isLoading: false, error: null };
}

describe('EtoroNewsTab', () => {
  describe('Normal Behavior', () => {
    it('sollte News-Beiträge mit Autor und Zeitstempel anzeigen', () => {
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed()}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      expect(screen.getByText('johndoe')).toBeInTheDocument();
      expect(screen.getByText('Excited about $TSLA earnings next week!')).toBeInTheDocument();
    });

    it('[REGRESSION][SECURITY] sollte HTML im Post-Text als reinen Text rendern, nicht als Markup ausführen', () => {
      const maliciousFeed = EtoroDiscussionsResponseSchema.parse({
        discussions: [{ id: '1', post: { id: '1', message: { text: '<img src=x onerror=alert(1)>' } } }],
      });
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed(maliciousFeed)}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      // Text erscheint literal im DOM — kein <img>-Element wurde erzeugt.
      expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
      expect(document.querySelector('img')).not.toBeInTheDocument();
    });

    it('sollte beim Wechsel auf "Meine Positionen" den gemergten Markt-Feed statt des News-Feeds zeigen', () => {
      const positionsResponse = EtoroDiscussionsResponseSchema.parse({
        discussions: [{ id: '2', post: { id: '2', owner: { username: 'janedoe' }, message: { text: 'AAPL looking strong' } } }],
      });
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="my-positions"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed()}
          positionsFeed={noopPositionsFeed([positionsResponse])}
        />,
        'de',
      );
      expect(screen.getByText('AAPL looking strong')).toBeInTheDocument();
      expect(screen.queryByText('Excited about $TSLA earnings next week!')).not.toBeInTheDocument();
    });

    it('sollte onFilterChange beim Klick auf "Meine Positionen" aufrufen', () => {
      let selected: string | undefined;
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={(f) => (selected = f)}
          newsFeed={noopNewsFeed()}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      fireEvent.click(screen.getByText('Meine Positionen'));
      expect(selected).toBe('my-positions');
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed()}
          positionsFeed={noopPositionsFeed()}
        />,
        'en',
      );
      expect(screen.getByText('My positions')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Empty-State zeigen, wenn keine Beiträge vorhanden sind', () => {
      const empty = EtoroDiscussionsResponseSchema.parse({ discussions: [] });
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed(empty)}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      expect(screen.getByText('Keine Beiträge')).toBeInTheDocument();
    });

    it('sollte einen Fallback-Autornamen zeigen, wenn owner fehlt', () => {
      const anonFeed = EtoroDiscussionsResponseSchema.parse({
        discussions: [{ id: '1', post: { id: '1', message: { text: 'anonymous post' } } }],
      });
      renderWithI18n(
        <EtoroNewsTab
          isLocked={false}
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed(anonFeed)}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      expect(screen.getByText('Unbekannt')).toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroNewsTab
          isLocked
          filter="all"
          onFilterChange={() => {}}
          newsFeed={noopNewsFeed(undefined)}
          positionsFeed={noopPositionsFeed()}
        />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro News)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.news-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.news',
        'trading.etoro.news.title',
        'trading.etoro.news.filterLabel',
        'trading.etoro.news.filterAll',
        'trading.etoro.news.filterMyPositions',
        'trading.etoro.news.emptyTitle',
        'trading.etoro.news.emptyAllDesc',
        'trading.etoro.news.emptyMyPositionsDesc',
        'trading.etoro.news.unknownAuthor',
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
