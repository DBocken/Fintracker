/**
 * Banksuche der GoCardless-Anbindung (WP 6.5a).
 *
 * Filter und Rangfolge lagen als 45-zeiliger `useEffect` in
 * `GoCardlessConnect` — ohne einen einzigen Test, obwohl daran haengt, ob der
 * Nutzer seine Bank ueberhaupt findet. Die Regeln sind rein (Liste rein, Liste
 * raus) und stehen jetzt einzeln pruefbar hier.
 */

import { describe, it, expect } from 'vitest';
import {
  INSTITUTION_RESULT_LIMIT,
  rankInstitutions,
  type Institution,
} from '../institution-search';

function bank(id: string, name: string, bic = ''): Institution {
  return { id, name, bic, logo: '', countries: ['DE'] };
}

const BANKEN: Institution[] = [
  bank('SPK', 'Sparkasse Köln', 'COLSDE33'),
  bank('SPKB', 'Sparkasse Bonn', 'BONSDE33'),
  bank('COMM', 'Commerzbank', 'COBADEFF'),
  bank('SANDBOX_X', 'Sandbox Finance', 'SFRXDE20'),
];

describe('rankInstitutions', () => {
  it('sollte ohne Suchbegriff nichts vorschlagen', () => {
    expect(rankInstitutions(BANKEN, '')).toEqual([]);
    expect(rankInstitutions(BANKEN, '   ')).toEqual([]);
  });

  it('sollte nach Name und BIC filtern', () => {
    expect(rankInstitutions(BANKEN, 'sparkasse').map((b) => b.id)).toEqual(['SPKB', 'SPK']);
    expect(rankInstitutions(BANKEN, 'cobadeff').map((b) => b.id)).toEqual(['COMM']);
  });

  it('sollte mehrere Wortteile alle verlangen', () => {
    expect(rankInstitutions(BANKEN, 'sparkasse köln').map((b) => b.id)).toEqual(['SPK']);
    expect(rankInstitutions(BANKEN, 'sparkasse hamburg')).toEqual([]);
  });

  it('sollte den exakten Treffer vor den Praefix-Treffer setzen', () => {
    const liste = [bank('B', 'Commerzbank Filiale'), bank('A', 'Commerzbank')];

    expect(rankInstitutions(liste, 'commerzbank').map((b) => b.id)).toEqual(['A', 'B']);
  });

  it('sollte den Praefix-Treffer vor den Treffer in der Wortmitte setzen', () => {
    const liste = [bank('MITTE', 'Volksbank Nord'), bank('VORN', 'Nord LB')];

    expect(rankInstitutions(liste, 'nord').map((b) => b.id)).toEqual(['VORN', 'MITTE']);
  });

  it('sollte Sandbox-Banken nur in der Entwicklung nach vorne ziehen', () => {
    const liste = [bank('ECHT', 'Sandkasten Bank'), bank('SANDBOX_S', 'Sandkasten Sandbox')];

    expect(rankInstitutions(liste, 'sandkasten').map((b) => b.id)).toEqual(['ECHT', 'SANDBOX_S']);
    expect(rankInstitutions(liste, 'sandkasten', { preferSandbox: true }).map((b) => b.id)).toEqual([
      'SANDBOX_S',
      'ECHT',
    ]);
  });

  it('sollte hoechstens die Ergebnisgrenze liefern — sonst scrollt der Nutzer statt zu tippen', () => {
    const viele = Array.from({ length: 40 }, (_, i) => bank(`I${i}`, `Testbank ${i}`));

    expect(rankInstitutions(viele, 'testbank')).toHaveLength(INSTITUTION_RESULT_LIMIT);
  });

  it('sollte die Eingabeliste nicht veraendern', () => {
    const liste = [bank('B', 'Bank B'), bank('A', 'Bank A')];

    rankInstitutions(liste, 'bank');

    expect(liste.map((b) => b.id)).toEqual(['B', 'A']);
  });
});
