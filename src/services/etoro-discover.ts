import type {
  EtoroCandlesResponse,
  EtoroInstrumentSearchResponse,
  EtoroCuratedListsResponse,
  EtoroPublicUserInfoResponse,
} from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Backlog-Extras (Instrument-Suche, kuratierte Listen, Candles-Chart,
// öffentliche Trader-Profile) — reine Selektor-Funktionen über die Antworten
// aus etoro-api-schemas.ts. Keine Netzwerk-/Persistenz-Logik hier, nur
// Ableitung fürs UI (EtoroDiscoverTab), analog etoro-mirrors.ts.
// -----------------------------------------------------------------------------

export interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** true = Schlusskurs ≥ Eröffnungskurs (grüne Kerze). */
  isUp: boolean;
}

/**
 * Bildet die (verschachtelte) Candles-Antwort auf Chart-Datenpunkte ab,
 * chronologisch aufsteigend sortiert — unabhängig von der angefragten
 * `direction` (Charts lesen sich links=alt, rechts=neu).
 */
export function selectCandlePoints(response: EtoroCandlesResponse | undefined): CandlePoint[] {
  const candles = response?.candles?.[0]?.candles ?? [];

  return [...candles]
    .map((c) => ({
      date: c.fromDate,
      open: c.open ?? 0,
      high: c.high ?? 0,
      low: c.low ?? 0,
      close: c.close ?? 0,
      isUp: (c.close ?? 0) >= (c.open ?? 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface InstrumentSearchResultView {
  instrumentId: number;
  name: string;
  symbol: string | undefined;
  rate: number | undefined;
}

/** Bildet die Suchtreffer auf ein UI-taugliches Shape ab. */
export function selectInstrumentSearchResults(
  response: EtoroInstrumentSearchResponse | undefined,
): InstrumentSearchResultView[] {
  const items = response?.items ?? [];

  return items.map((item) => ({
    instrumentId: item.instrumentId,
    name: item.displayname || item.internalSymbolFull || `#${item.instrumentId}`,
    symbol: item.internalSymbolFull,
    rate: item.currentRate,
  }));
}

export interface CuratedListView {
  uuid: string;
  name: string;
  description: string | undefined;
  instrumentIds: number[];
}

/** Bildet die kuratierten Listen auf ein UI-taugliches Shape ab. */
export function selectCuratedLists(response: EtoroCuratedListsResponse | undefined): CuratedListView[] {
  const lists = response?.curatedLists ?? [];

  return lists.map((list) => ({
    uuid: list.uuid,
    name: list.name || list.uuid,
    description: list.description,
    instrumentIds: (list.items ?? []).map((item) => item.instrumentId),
  }));
}

export interface PublicUserProfileView {
  username: string;
  isVerified: boolean;
  aboutMe: string | undefined;
  avatarUrl: string | undefined;
}

/**
 * Bildet das erste (einzige, da je Suche ein Username angefragt wird)
 * Nutzerprofil ab. Wählt das größte verfügbare Avatar-Bild.
 */
export function selectPublicUserProfile(response: EtoroPublicUserInfoResponse | undefined): PublicUserProfileView | undefined {
  const user = response?.users?.[0];
  if (!user) return undefined;

  const largestAvatar = [...(user.avatars ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return {
    username: user.username,
    isVerified: user.isVerified ?? false,
    aboutMe: user.userBio?.aboutMe || user.userBio?.aboutMeShort || undefined,
    avatarUrl: largestAvatar?.url,
  };
}
