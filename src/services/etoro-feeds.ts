import type { EtoroDiscussionsResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// News & Markt-Feeds — reine Selektor-Funktionen über die Antworten aus
// etoro-api-schemas.ts. Keine Netzwerk-/Persistenz-Logik hier, nur Ableitung
// fürs UI (EtoroNewsTab), analog etoro-mirrors.ts.
//
// SICHERHEIT: `text` MUSS von der Komponente ausschließlich als reiner Text
// gerendert werden (kein dangerouslySetInnerHTML) — nutzergenerierter Inhalt.
// -----------------------------------------------------------------------------

export interface FeedPostView {
  id: string;
  username: string | undefined;
  text: string | undefined;
  createdAt: string | undefined;
  /** internalId der in tags[].market verlinkten Instrumente. */
  instrumentIds: number[];
}

/**
 * Bildet die Discussions einer Feed-Antwort auf ein UI-taugliches Shape ab.
 * Reihenfolge bleibt wie von eToro geliefert (Ranking-Algorithmus der API,
 * nicht durch einen eigenen Sortier-Selektor ersetzen).
 */
export function selectFeedPosts(response: EtoroDiscussionsResponse | undefined): FeedPostView[] {
  const discussions = response?.discussions ?? [];

  return discussions
    .filter((d) => !!d.post)
    .map((d) => {
      const post = d.post!;
      return {
        id: post.id,
        username: post.owner?.username,
        text: post.message?.text,
        createdAt: post.created,
        instrumentIds: (post.tags ?? [])
          .map((tag) => tag.market?.internalId)
          .filter((id): id is number => id != null),
      };
    });
}

/**
 * Mergt mehrere Markt-Feed-Antworten (ein Aufruf je gehaltenem Instrument,
 * siehe fetchEtoroMarketFeed) zu einer deduplizierten, nach createdAt
 * absteigend sortierten Liste — anders als ein einzelner Feed-Aufruf, wo die
 * eToro-eigene Reihenfolge erhalten bleibt (hier gibt es kein einzelnes
 * Ranking mehr, das die Zusammenführung mehrerer Listen sinnvoll ordnen würde).
 */
export function selectMergedMarketFeed(responses: Array<EtoroDiscussionsResponse | undefined>): FeedPostView[] {
  const seen = new Map<string, FeedPostView>();

  for (const response of responses) {
    for (const post of selectFeedPosts(response)) {
      if (!seen.has(post.id)) seen.set(post.id, post);
    }
  }

  return [...seen.values()].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : undefined;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : undefined;
    if (timeA == null && timeB == null) return 0;
    if (timeA == null) return 1;
    if (timeB == null) return -1;
    return timeB - timeA;
  });
}
