/**
 * Suche und Rangfolge in der Bankenliste der GoCardless-Anbindung.
 *
 * Herausgeloest aus `GoCardlessConnect` (WP 6.5a), wo dieselben Regeln als
 * `useEffect` ueber zwei Zustandsvariablen standen und deshalb nicht einzeln
 * pruefbar waren — obwohl daran haengt, ob der Nutzer seine Bank findet.
 */

/** Ein Institut, so wie die GoCardless-API es liefert. */
export interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
  transaction_total_days?: string;
}

/**
 * Mehr Treffer helfen niemandem: Wer 200 Sparkassen sieht, scrollt, statt
 * weiterzutippen.
 */
export const INSTITUTION_RESULT_LIMIT = 20;

export interface RankInstitutionsOptions {
  /**
   * Test-Institute nach oben ziehen. In der Entwicklung ist die Sandbox-Bank
   * fast immer die gemeinte; in Produktion waere sie eine Falle.
   */
  preferSandbox?: boolean;
}

function isSandbox(institution: Institution): boolean {
  return institution.id.includes('SANDBOX');
}

/**
 * Filtert die Institute gegen den Suchbegriff und sortiert sie nach
 * Trefferguete: exakter Treffer, dann Praefix, dann alphabetisch.
 *
 * Ein leerer Suchbegriff liefert bewusst NICHTS statt „alles" — die Liste ist
 * vierstellig lang und waere als Vorschlag wertlos.
 */
export function rankInstitutions(
  institutions: Institution[],
  searchQuery: string,
  { preferSandbox = false }: RankInstitutionsOptions = {},
): Institution[] {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return [];

  const queryParts = query.split(/\s+/);

  const matches = institutions.filter((institution) => {
    const name = institution.name.toLowerCase();
    const bic = institution.bic?.toLowerCase() || '';
    return queryParts.every((part) => name.includes(part) || bic.includes(part));
  });

  // `toSorted` waere schoener, ist aber nicht ueberall verfuegbar; `filter`
  // liefert bereits eine neue Liste, die Eingabe bleibt unberuehrt.
  matches.sort((a, b) => {
    if (preferSandbox) {
      if (isSandbox(a) && !isSandbox(b)) return -1;
      if (isSandbox(b) && !isSandbox(a)) return 1;
    }

    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aBic = a.bic?.toLowerCase() || '';
    const bBic = b.bic?.toLowerCase() || '';

    if (aName === query || aBic === query) return -1;
    if (bName === query || bBic === query) return 1;

    const aStartsWith = aName.startsWith(query) || aBic.startsWith(query);
    const bStartsWith = bName.startsWith(query) || bBic.startsWith(query);
    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;

    return a.name.localeCompare(b.name);
  });

  return matches.slice(0, INSTITUTION_RESULT_LIMIT);
}

/** Die Vollliste, wie die Flaeche sie vorhaelt: alphabetisch, unveraendert. */
export function sortInstitutionsByName(institutions: Institution[]): Institution[] {
  return [...institutions].sort((a, b) => a.name.localeCompare(b.name));
}
