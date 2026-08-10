/**
 * Deterministische JSON-Serialisierung (WP 1.5, RES-5).
 *
 * `JSON.stringify` garantiert KEINE Schlüsselreihenfolge — es serialisiert
 * Objekte schlicht in Einfügereihenfolge. Zwei strukturell identische
 * Backup-Nutzlasten können trotzdem unterschiedliche Einfügereihenfolgen
 * haben (z. B. ein Item, das einen Lese-Schreib-Zyklus über IndexedDB
 * durchlaufen hat, gegenüber einem frisch aus einem Objekt-Literal gebauten).
 * Eine Prüfsumme über den rohen `JSON.stringify`-Text wäre gegen so eine
 * harmlose Neuordnung genauso empfindlich wie gegen echte Manipulation und
 * damit als Integritätssignal nutzlos — sie würde bei jedem harmlosen
 * Re-Export unnötig "verändert" melden.
 *
 * Diese Funktion sortiert Objekt-Schlüssel rekursiv, bevor sie stringifiziert
 * wird. Array-Reihenfolge bleibt unverändert (sie ist fachlich bedeutsam,
 * z. B. Reihenfolge von Transaktionen). Reine Funktion, kein I/O — siehe
 * AGENTS.md §3 „Wohin ein Typ gehört": Berechnungslogik ohne Seiteneffekt
 * gehört nach `src/lib/`, auch wenn heute nur `backup-service.ts` sie ruft.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }
  if (value !== null && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => [key, sortForCanonicalJson(entry)] as const);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}
