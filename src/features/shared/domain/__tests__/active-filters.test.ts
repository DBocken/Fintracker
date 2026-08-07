import { describe, it, expect } from 'vitest';
import type { DashboardFilterState } from '@/features/shared/domain/dashboard-filters';
import { countActiveFilters } from '@/features/transactions/domain/transactions-scope';
import { describeActiveFilters } from '../active-filters';

/**
 * WP-9.4 — „gefiltert-leer" ist nicht „leer".
 *
 * Heute sagt die Buchungsseite bei null Treffern „Passe Filter oder
 * Suchbegriff an" — richtig, aber unbrauchbar: Der Nutzer hat womöglich
 * sieben Dimensionen gesetzt und weiß nicht, welche davon zu eng ist.
 *
 * Diese Funktion beantwortet die Vorfrage: WELCHE Filter greifen gerade?
 * Die Reihenfolge ist Teil der Aussage und deshalb hier mitgeprüft.
 */

const NONE: DashboardFilterState = {
  category: 'all',
  account: 'all',
  contract: 'all',
  essential: 'all',
  ausgabenklasse: 'all',
  search: '',
  range: 'Gesamt',
  customDays: 30,
};

function withFilters(patch: Partial<DashboardFilterState>): DashboardFilterState {
  return { ...NONE, ...patch };
}

describe('describeActiveFilters (WP-9.4)', () => {
  it('sollte ohne gesetzte Filter nichts liefern', () => {
    expect(describeActiveFilters(NONE)).toEqual([]);
  });

  it('sollte einen Suchbegriff melden', () => {
    expect(describeActiveFilters(withFilters({ search: 'Miete' }))).toEqual([
      { dimension: 'search', value: 'Miete' },
    ]);
  });

  it('sollte einen Suchbegriff ohne Inhalt ignorieren', () => {
    // Sonst behauptet die Meldung einen Filter, den der Nutzer nicht sieht.
    expect(describeActiveFilters(withFilters({ search: '   ' }))).toEqual([]);
  });

  it('sollte den Suchbegriff getrimmt zurueckgeben', () => {
    expect(describeActiveFilters(withFilters({ search: '  Miete ' }))).toEqual([
      { dimension: 'search', value: 'Miete' },
    ]);
  });

  it('sollte die Suche VOR allen anderen Dimensionen nennen', () => {
    // Der Suchbegriff ist das, was der Nutzer zuletzt selbst getippt hat —
    // er ist der wahrscheinlichste Grund fuer null Treffer und die Sache,
    // die er am schnellsten wiedererkennt.
    const result = describeActiveFilters(
      withFilters({ search: 'Miete', category: 'cat-1', range: 'Monat' }),
    );
    expect(result[0]).toEqual({ dimension: 'search', value: 'Miete' });
  });

  it('sollte alle sieben Dimensionen abdecken', () => {
    // Gegenprobe zu `countActiveFilters`: Wenn dort sieben gezaehlt werden,
    // duerfen hier nicht sechs beschrieben werden — sonst nennt die Meldung
    // einen Filter nicht, der aber wirkt.
    const all = withFilters({
      search: 'x',
      category: 'c',
      account: 'a',
      contract: 'vertrag',
      essential: 'ess',
      ausgabenklasse: 'essenziell',
      range: 'Monat',
    });
    expect(describeActiveFilters(all)).toHaveLength(7);
  });

  it('sollte fuer JEDE Kombination genauso viele Dimensionen melden wie gezaehlt werden', () => {
    // Der eigentliche Fallstrick dieses Paares: Jemand ergaenzt eine
    // Filter-Dimension und zieht nur EINE der beiden Funktionen nach. Dann
    // zaehlt der Knopf "3 Filter aktiv", die Meldung nennt aber nur zwei —
    // und der dritte bleibt unsichtbar wirksam.
    //
    // Deshalb hier nicht ein Beispiel, sondern alle 128 Kombinationen der
    // sieben Dimensionen.
    const on: Partial<DashboardFilterState>[] = [
      { search: 'x' },
      { category: 'c' },
      { account: 'a' },
      { contract: 'vertrag' },
      { essential: 'ess' },
      { ausgabenklasse: 'essenziell' },
      { range: 'Monat' },
    ];

    for (let mask = 0; mask < 1 << on.length; mask += 1) {
      let filters = NONE;
      for (let bit = 0; bit < on.length; bit += 1) {
        if (mask & (1 << bit)) filters = { ...filters, ...on[bit] };
      }
      expect(describeActiveFilters(filters), `Maske ${mask}`).toHaveLength(
        countActiveFilters(filters),
      );
    }
  });

  it('sollte Kategorie und Konto als IDs durchreichen', () => {
    // Aufloesung in Namen ist Sache der Oberflaeche: Die Domaene kennt keine
    // Anzeigenamen, und ein Matching ueber den Namen bricht bei Umbenennung
    // und in jeder anderen Sprache (AGENTS.md Paragraf 6).
    const result = describeActiveFilters(withFilters({ category: 'cat-42', account: 'acc-7' }));
    expect(result).toContainEqual({ dimension: 'category', value: 'cat-42' });
    expect(result).toContainEqual({ dimension: 'account', value: 'acc-7' });
  });
});
