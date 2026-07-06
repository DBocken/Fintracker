import { describe, it, expect } from 'vitest';
import {
  EtoroCandlesResponseSchema,
  EtoroInstrumentSearchResponseSchema,
  EtoroCuratedListsResponseSchema,
  EtoroPublicUserInfoResponseSchema,
} from '../etoro-api-schemas';
import {
  selectCandlePoints,
  selectInstrumentSearchResults,
  selectCuratedLists,
  selectPublicUserProfile,
} from '../etoro-discover';

describe('selectCandlePoints', () => {
  describe('Normal Behavior', () => {
    it('sollte Candles chronologisch aufsteigend sortiert abbilden', () => {
      const response = EtoroCandlesResponseSchema.parse({
        interval: 'OneDay',
        candles: [
          {
            instrumentId: 1001,
            candles: [
              { fromDate: '2026-01-03T00:00:00Z', open: 105, high: 110, low: 104, close: 108 },
              { fromDate: '2026-01-01T00:00:00Z', open: 100, high: 102, low: 98, close: 101 },
              { fromDate: '2026-01-02T00:00:00Z', open: 101, high: 106, low: 100, close: 99 },
            ],
          },
        ],
      });

      expect(selectCandlePoints(response)).toEqual([
        { date: '2026-01-01T00:00:00Z', open: 100, high: 102, low: 98, close: 101, isUp: true },
        { date: '2026-01-02T00:00:00Z', open: 101, high: 106, low: 100, close: 99, isUp: false },
        { date: '2026-01-03T00:00:00Z', open: 105, high: 110, low: 104, close: 108, isUp: true },
      ]);
    });

    it('sollte isUp bei gleichem open/close als true werten (>=）', () => {
      const response = EtoroCandlesResponseSchema.parse({
        candles: [{ candles: [{ fromDate: '2026-01-01T00:00:00Z', open: 100, close: 100 }] }],
      });
      expect(selectCandlePoints(response)[0].isUp).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectCandlePoints(undefined)).toEqual([]);
    });

    it('sollte [] liefern, wenn candles-Array fehlt', () => {
      const response = EtoroCandlesResponseSchema.parse({ interval: 'OneDay' });
      expect(selectCandlePoints(response)).toEqual([]);
    });

    it('sollte fehlende OHLC-Werte als 0 behandeln', () => {
      const response = EtoroCandlesResponseSchema.parse({
        candles: [{ candles: [{ fromDate: '2026-01-01T00:00:00Z' }] }],
      });
      expect(selectCandlePoints(response)).toEqual([
        { date: '2026-01-01T00:00:00Z', open: 0, high: 0, low: 0, close: 0, isUp: true },
      ]);
    });
  });
});

describe('selectInstrumentSearchResults', () => {
  describe('Normal Behavior', () => {
    it('sollte Suchtreffer auf name/symbol/rate abbilden', () => {
      const response = EtoroInstrumentSearchResponseSchema.parse({
        items: [
          { instrumentId: 1, displayname: 'Apple Inc.', internalSymbolFull: 'AAPL', currentRate: 190.5 },
          { instrumentId: 2, internalSymbolFull: 'TSLA' },
        ],
      });

      expect(selectInstrumentSearchResults(response)).toEqual([
        { instrumentId: 1, name: 'Apple Inc.', symbol: 'AAPL', rate: 190.5 },
        { instrumentId: 2, name: 'TSLA', symbol: 'TSLA', rate: undefined },
      ]);
    });

    it('sollte auf #instrumentId zurückfallen, wenn weder displayname noch symbol vorhanden ist', () => {
      const response = EtoroInstrumentSearchResponseSchema.parse({ items: [{ instrumentId: 42 }] });
      expect(selectInstrumentSearchResults(response)[0].name).toBe('#42');
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectInstrumentSearchResults(undefined)).toEqual([]);
    });

    it('sollte [] liefern, wenn items-Array fehlt', () => {
      const response = EtoroInstrumentSearchResponseSchema.parse({});
      expect(selectInstrumentSearchResults(response)).toEqual([]);
    });
  });
});

describe('selectCuratedLists', () => {
  describe('Normal Behavior', () => {
    it('sollte kuratierte Listen auf uuid/name/description/instrumentIds abbilden', () => {
      const response = EtoroCuratedListsResponseSchema.parse({
        curatedLists: [
          {
            uuid: 'list-1',
            name: 'Tech Giants',
            description: 'Große Tech-Werte',
            items: [{ instrumentId: 1 }, { instrumentId: 2 }],
          },
        ],
      });

      expect(selectCuratedLists(response)).toEqual([
        { uuid: 'list-1', name: 'Tech Giants', description: 'Große Tech-Werte', instrumentIds: [1, 2] },
      ]);
    });

    it('sollte auf uuid zurückfallen, wenn kein name vorhanden ist', () => {
      const response = EtoroCuratedListsResponseSchema.parse({ curatedLists: [{ uuid: 'list-2' }] });
      expect(selectCuratedLists(response)[0].name).toBe('list-2');
      expect(selectCuratedLists(response)[0].instrumentIds).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectCuratedLists(undefined)).toEqual([]);
    });

    it('sollte [] liefern, wenn curatedLists-Array fehlt', () => {
      const response = EtoroCuratedListsResponseSchema.parse({});
      expect(selectCuratedLists(response)).toEqual([]);
    });
  });
});

describe('selectPublicUserProfile', () => {
  describe('Normal Behavior', () => {
    it('sollte das erste Nutzerprofil abbilden und den größten Avatar wählen', () => {
      const response = EtoroPublicUserInfoResponseSchema.parse({
        users: [
          {
            username: 'johndoe',
            isVerified: true,
            userBio: { aboutMe: 'Long-term investor' },
            avatars: [
              { url: 'small.png', width: 50 },
              { url: 'large.png', width: 200 },
              { url: 'medium.png', width: 100 },
            ],
          },
        ],
      });

      expect(selectPublicUserProfile(response)).toEqual({
        username: 'johndoe',
        isVerified: true,
        aboutMe: 'Long-term investor',
        avatarUrl: 'large.png',
      });
    });

    it('sollte auf aboutMeShort zurückfallen, wenn aboutMe fehlt', () => {
      const response = EtoroPublicUserInfoResponseSchema.parse({
        users: [{ username: 'janedoe', userBio: { aboutMeShort: 'Short bio' } }],
      });
      expect(selectPublicUserProfile(response)?.aboutMe).toBe('Short bio');
    });

    it('sollte isVerified als false werten, wenn nicht angegeben', () => {
      const response = EtoroPublicUserInfoResponseSchema.parse({ users: [{ username: 'janedoe' }] });
      expect(selectPublicUserProfile(response)?.isVerified).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('sollte undefined liefern, wenn response undefined ist', () => {
      expect(selectPublicUserProfile(undefined)).toBeUndefined();
    });

    it('sollte undefined liefern, wenn users-Array leer ist', () => {
      const response = EtoroPublicUserInfoResponseSchema.parse({ users: [] });
      expect(selectPublicUserProfile(response)).toBeUndefined();
    });

    it('sollte undefined liefern, wenn keine Avatare vorhanden sind', () => {
      const response = EtoroPublicUserInfoResponseSchema.parse({ users: [{ username: 'janedoe' }] });
      expect(selectPublicUserProfile(response)?.avatarUrl).toBeUndefined();
    });
  });
});
