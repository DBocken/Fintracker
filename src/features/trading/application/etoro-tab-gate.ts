/**
 * Das gemeinsame Gatter der eToro-Abfragen.
 *
 * Jede der zwanzig Abfragen darf nur laufen, wenn alle vier Bedingungen
 * zutreffen. Das ist keine Vorsichtsmaßnahme, sondern eine Anforderung: eToro
 * begrenzt Aufrufe pro Zeitfenster und Endpunkt-Gruppe, und ein Tab, den
 * gerade niemand ansieht, darf dieses Budget nicht verbrauchen.
 *
 * Die Bedingung stand zuvor zwanzigmal wörtlich in `TradingDashboard.tsx`.
 * Zwanzig Kopien einer Regel sind zwanzig Gelegenheiten, eine davon zu
 * vergessen — und vergessen hieße hier: stiller Rate-Limit-Fehler auf einem
 * Tab, den niemand geöffnet hat.
 */
import type { Portfolio } from '@/types';

/** Die Tabs, auf denen eToro-Daten überhaupt gebraucht werden. */
export type EtoroTab =
  | 'overview'
  | 'mirrors'
  | 'history'
  | 'performance'
  | 'analysis'
  | 'watchlists'
  | 'news'
  | 'discover';

export interface EtoroGateInput {
  portfolio: Portfolio | null;
  isEtoro: boolean;
  unlocked: boolean;
  effectiveTab: string;
}

/**
 * Läuft eine Abfrage für `tabs`?
 *
 * `tabs` ist eine Liste, weil einzelne Abfragen von mehreren Tabs gebraucht
 * werden — der Konto-Snapshot etwa von Übersicht, Smart Portfolios und
 * Analyse.
 */
export function etoroTabEnabled(
  { portfolio, isEtoro, unlocked, effectiveTab }: EtoroGateInput,
  tabs: EtoroTab | readonly EtoroTab[],
): boolean {
  const wanted = Array.isArray(tabs) ? tabs : [tabs as EtoroTab];
  return !!portfolio?.id && isEtoro && unlocked && wanted.includes(effectiveTab as EtoroTab);
}

/**
 * Gemeinsame Abfrage-Optionen der eToro-Endpunkte.
 *
 * `retry: false` und `refetchOnWindowFocus: false` sind hier keine Bequemlichkeit:
 * ein automatischer Wiederholungsversuch gegen ein Rate-Limit macht die Lage
 * schlechter, nicht besser, und ein Fokuswechsel ist kein Grund, das Budget
 * erneut anzufassen.
 */
export const ETORO_QUERY_DEFAULTS = {
  refetchOnWindowFocus: false,
  retry: false,
} as const;

/** Kurzlebig: Kontostände und Kurse (teilen sich die Portfolio-Gruppe, 60 req/60 s). */
export const ETORO_STALE_LIVE = 60_000;

/** Langlebig: Instrument- und Branchen-Metadaten ändern sich praktisch nie. */
export const ETORO_STALE_META = 5 * 60_000;
