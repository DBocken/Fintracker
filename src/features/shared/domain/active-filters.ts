import type { DashboardFilterState } from '@/components/dashboard/filter-utils';

/**
 * Eine gerade wirkende Filter-Dimension (WP-9.4).
 *
 * `value` ist bewusst der ROHWERT: bei `category`/`account` die stabile ID,
 * nicht der Anzeigename. Die Domäne kennt keine Anzeigenamen, und ein
 * Matching über den Namen bricht bei jeder Umbenennung und in jeder anderen
 * Sprache (AGENTS.md §6, Falle „Matching über den Anzeigenamen").
 */
export type ActiveFilterDescriptor = {
  dimension: 'search' | 'category' | 'account' | 'contract' | 'essential' | 'ausgabenklasse' | 'range';
  value: string;
};

/**
 * Welche Filter greifen gerade — in der Reihenfolge, in der man sie nennen
 * sollte (WP-9.4).
 *
 * Die Vorfrage zu jeder brauchbaren „kein Treffer"-Meldung. Bisher stand dort
 * „Passe Filter oder Suchbegriff an" — richtig, aber unbrauchbar: Der Nutzer
 * kann sieben Dimensionen gesetzt haben und weiß nicht, welche zu eng ist.
 *
 * **Die Reihenfolge ist Teil der Aussage.** Der Suchbegriff steht vorn, weil
 * er das ist, was der Nutzer zuletzt selbst getippt hat — der wahrscheinlichste
 * Grund für null Treffer und die Sache, die er am schnellsten wiedererkennt.
 * Dann die inhaltlichen Dimensionen, zuletzt der Zeitraum: Er ist oft
 * voreingestellt und selten die Überraschung.
 *
 * Zählt dieselben sieben Dimensionen wie `countActiveFilters()` — ein Test
 * sichert das ab. Beschriebe diese Funktion weniger, als jene zählt, nennte
 * die Meldung einen Filter nicht, der aber wirkt.
 */
export function describeActiveFilters(filters: DashboardFilterState): ActiveFilterDescriptor[] {
  const active: ActiveFilterDescriptor[] = [];

  const search = filters.search.trim();
  if (search !== '') active.push({ dimension: 'search', value: search });

  if (filters.category !== 'all') active.push({ dimension: 'category', value: filters.category });
  if (filters.account !== 'all') active.push({ dimension: 'account', value: filters.account });
  if (filters.contract !== 'all') active.push({ dimension: 'contract', value: filters.contract });
  if (filters.essential !== 'all') active.push({ dimension: 'essential', value: filters.essential });
  if (filters.ausgabenklasse !== 'all') {
    active.push({ dimension: 'ausgabenklasse', value: filters.ausgabenklasse });
  }

  if (filters.range !== 'Gesamt') active.push({ dimension: 'range', value: filters.range });

  return active;
}
