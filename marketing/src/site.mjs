/*
 * Einzige Stelle, an der die oeffentliche Adresse der Marketing-Site steht.
 *
 * ACHTUNG — vor dem Launch ersetzen. `fintracker.example` ist nach RFC 2606
 * eine reservierte Domain: sie kann niemandem gehoeren und faellt sofort auf,
 * statt so auszusehen, als waere sie schon richtig. Sie speist canonical-URL,
 * Open Graph, sitemap.xml, robots.txt und llms.txt — eine falsche Domain
 * bleibt sonst an sechs Stellen stehen.
 */
export const SITE_URL = 'https://fintracker.example';

export const SITE_NAME = 'Fintracker';

/*
 * Ziel aller „Kostenlos starten"-Schaltflaechen — die eigentliche Web-App.
 * Ebenfalls vor dem Launch setzen. Steht hier und nicht verstreut in den
 * Seiten, damit ein Wechsel der App-Adresse eine Zeile ist und nicht eine
 * Suche ueber alle Vorlagen.
 */
export const APP_URL = '/app';
