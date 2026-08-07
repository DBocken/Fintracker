import { gzipSync } from 'node:zlib';

/**
 * Kern der Bundle-Budget-Prüfung (WP-10.6) — reine Logik, damit sie testbar
 * ist, ohne dass ein Build danebenliegen muss.
 *
 * **Gemessen wird gzip, nicht die rohe Dateigrösse.** Ausgeliefert wird
 * komprimiert; die rohe Zahl beschreibt niemandes Wartezeit.
 *
 * **Der Name ohne Hash ist der Schlüssel.** `money-taEjb3vW.js` heisst beim
 * nächsten Build anders, ist aber dasselbe Bündel. Ein Budget auf den
 * Dateinamen mit Hash wäre nach einem Zeichen Änderung wertlos.
 */

/** `CityPage-sUZgBeGW.js` → `CityPage`. */
export function chunkName(fileName) {
  return fileName.replace(/\.js$/, '').replace(/-[A-Za-z0-9_-]{8,}$/, '');
}

export function gzipSizeOf(content) {
  return gzipSync(content, { level: 9 }).length;
}

/**
 * Vergleicht gemessene Grössen gegen das Budget.
 *
 * Zwei Richtungen, beide wichtig:
 * - **über Budget** ist ein Fehlschlag. Etwas ist gewachsen.
 * - **weit unter Budget** ist ein Hinweis. Ein Budget, das um ein Vielfaches
 *   überschritten werden könnte, bevor es anschlägt, misst nichts mehr.
 */
export function compareToBudget(measured, budget, { slackRatio = 0.5 } = {}) {
  const over = [];
  const stale = [];
  const unbudgeted = [];

  for (const [name, bytes] of Object.entries(measured)) {
    const limit = budget.chunks?.[name];
    if (limit === undefined) {
      unbudgeted.push({ name, bytes });
      continue;
    }
    if (bytes > limit) over.push({ name, bytes, limit });
    else if (bytes < limit * slackRatio) stale.push({ name, bytes, limit });
  }

  const total = Object.values(measured).reduce((sum, bytes) => sum + bytes, 0);
  const totalOver = budget.totalGzipBytes !== undefined && total > budget.totalGzipBytes;

  return { over, stale, unbudgeted, total, totalOver, totalLimit: budget.totalGzipBytes };
}

export function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
