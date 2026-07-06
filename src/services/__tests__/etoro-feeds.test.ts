import { describe, it, expect } from 'vitest';
import { EtoroDiscussionsResponseSchema } from '../etoro-api-schemas';
import { selectFeedPosts, selectMergedMarketFeed } from '../etoro-feeds';

describe('selectFeedPosts', () => {
  describe('Normal Behavior', () => {
    it('sollte id/username/text/createdAt/instrumentIds abbilden, Reihenfolge unverändert', () => {
      const response = EtoroDiscussionsResponseSchema.parse({
        discussions: [
          {
            id: '1',
            post: {
              id: '1',
              owner: { username: 'johndoe' },
              message: { text: 'Excited about $TSLA earnings!' },
              created: '2026-01-15T10:30:00Z',
              tags: [{ market: { symbolName: 'TSLA', internalId: 59114 } }],
            },
          },
          {
            id: '2',
            post: {
              id: '2',
              owner: { username: 'janedoe' },
              message: { text: 'AAPL looking strong' },
              created: '2026-01-16T10:30:00Z',
            },
          },
        ],
      });

      const posts = selectFeedPosts(response);
      expect(posts).toEqual([
        { id: '1', username: 'johndoe', text: 'Excited about $TSLA earnings!', createdAt: '2026-01-15T10:30:00Z', instrumentIds: [59114] },
        { id: '2', username: 'janedoe', text: 'AAPL looking strong', createdAt: '2026-01-16T10:30:00Z', instrumentIds: [] },
      ]);
    });

    it('[REGRESSION] sollte den Post-Text unverändert als reinen String liefern (kein HTML-Parsing)', () => {
      const response = EtoroDiscussionsResponseSchema.parse({
        discussions: [{ id: '1', post: { id: '1', message: { text: '<img src=x onerror=alert(1)>' } } }],
      });
      expect(selectFeedPosts(response)[0].text).toBe('<img src=x onerror=alert(1)>');
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectFeedPosts(undefined)).toEqual([]);
    });

    it('sollte Discussions ohne post ausblenden (z. B. gelöschter Post)', () => {
      const response = EtoroDiscussionsResponseSchema.parse({ discussions: [{ id: '1' }] });
      expect(selectFeedPosts(response)).toEqual([]);
    });
  });
});

describe('selectMergedMarketFeed', () => {
  describe('Normal Behavior', () => {
    it('sollte mehrere Feed-Antworten deduplizieren und nach createdAt absteigend sortieren', () => {
      const responseA = EtoroDiscussionsResponseSchema.parse({
        discussions: [{ id: '1', post: { id: '1', message: { text: 'a' }, created: '2026-01-01T00:00:00Z' } }],
      });
      const responseB = EtoroDiscussionsResponseSchema.parse({
        discussions: [
          { id: '1', post: { id: '1', message: { text: 'a (duplicate)' }, created: '2026-01-01T00:00:00Z' } },
          { id: '2', post: { id: '2', message: { text: 'b' }, created: '2026-01-05T00:00:00Z' } },
        ],
      });

      const merged = selectMergedMarketFeed([responseA, responseB]);
      expect(merged.map((p) => p.id)).toEqual(['2', '1']);
      // Erstes Vorkommen gewinnt bei Duplikaten.
      expect(merged.find((p) => p.id === '1')?.text).toBe('a');
    });

    it('sollte Posts ohne createdAt ans Ende sortieren', () => {
      const response = EtoroDiscussionsResponseSchema.parse({
        discussions: [
          { id: '1', post: { id: '1' } },
          { id: '2', post: { id: '2', created: '2026-01-01T00:00:00Z' } },
        ],
      });
      expect(selectMergedMarketFeed([response]).map((p) => p.id)).toEqual(['2', '1']);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn keine Antworten übergeben werden', () => {
      expect(selectMergedMarketFeed([])).toEqual([]);
    });

    it('sollte undefined-Einträge in der Liste ignorieren', () => {
      expect(selectMergedMarketFeed([undefined, undefined])).toEqual([]);
    });
  });
});
