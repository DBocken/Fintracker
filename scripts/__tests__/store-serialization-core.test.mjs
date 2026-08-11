import { describe, expect, it } from 'vitest';
import {
  findeUnserialisierteSchreibpfade,
  istSpeicherschicht,
} from '../store-serialization-core.mjs';

/**
 * Wächter gegen unserialisiertes Lesen-Ändern-Schreiben (Issue #311).
 *
 * Die Tests halten beide Richtungen fest: Er muss den echten Fehler sehen —
 * und er muss die legitimen Formen in Ruhe lassen. Ein Wächter, der reines
 * Lesen anmeckert, wird abgeschaltet statt befolgt.
 */

describe('istSpeicherschicht', () => {
  it('sollte Services und Slice-Datenschichten prüfen', () => {
    expect(istSpeicherschicht('src/services/debt-service.ts')).toBe(true);
    expect(istSpeicherschicht('src/features/trading/data/positions.ts')).toBe(true);
  });

  it('sollte Tests und Darstellung nicht prüfen', () => {
    expect(istSpeicherschicht('src/services/__tests__/debt-service.test.ts')).toBe(false);
    expect(istSpeicherschicht('src/components/dashboard/Dashboard.tsx')).toBe(false);
    expect(istSpeicherschicht('src/lib/money.ts')).toBe(false);
  });
});

describe('findeUnserialisierteSchreibpfade', () => {
  it('sollte Lesen und Schreiben im selben Rumpf melden', () => {
    const quelle = `
      export async function addRule(rule) {
        const rules = await readLocalFinanceList('merchantRules');
        rules.push(rule);
        await writeLocalFinanceList('merchantRules', rules);
      }
    `;
    const funde = findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].funktion).toBe('addRule');
    expect(funde[0].familie).toBe('Finanz-Collections');
  });

  it('sollte schweigen, wenn der Ablauf in withKeyLock steht', () => {
    const quelle = `
      export async function addRule(rule) {
        return withKeyLock('merchantRules', async () => {
          const rules = await readLocalFinanceList('merchantRules');
          rules.push(rule);
          await writeLocalFinanceList('merchantRules', rules);
        });
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte schweigen, wenn mutateLocalFinanceList benutzt wird', () => {
    const quelle = `
      export async function addRule(rule) {
        await mutateLocalFinanceList('merchantRules', (rules) => [...rules, rule]);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte reines Lesen nicht melden', () => {
    const quelle = `
      export async function getRules() {
        return readLocalFinanceList('merchantRules');
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte reines Ersetzen der ganzen Liste nicht melden', () => {
    const quelle = `
      export async function replaceRules(rules) {
        return writeLocalFinanceList('merchantRules', rules);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte zwei getrennte Funktionen nicht als Paar werten', () => {
    const quelle = `
      export async function getRules() {
        return readLocalFinanceList('merchantRules');
      }
      export async function replaceRules(rules) {
        return writeLocalFinanceList('merchantRules', rules);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte Lesen der einen und Schreiben der anderen Familie nicht als Paar werten', () => {
    // Verschiedene Speicherschlüssel teilen keinen Zwischenzustand.
    const quelle = `
      export async function mischen() {
        const cats = await readLocalCategoriesRaw();
        await writeLocalFinanceList('merchantRules', cats);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte den Verstoß nur einmal melden, wenn er in einer inneren Funktion steht', () => {
    const quelle = `
      export async function aussen() {
        const helfer = async () => {
          const rules = await readLocalFinanceList('merchantRules');
          await writeLocalFinanceList('merchantRules', rules);
        };
        await helfer();
      }
    `;
    const funde = findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].funktion).toBe('helfer');
  });

  it('sollte die Einstellungs- und Kategorien-Familie ebenfalls kennen', () => {
    const einstellungen = `
      export async function updateLocalUserSettings(settings) {
        const current = await getLocalUserSettings();
        await schreibeLokaleEinstellungen({ ...current, ...settings });
      }
    `;
    expect(findeUnserialisierteSchreibpfade(einstellungen, 'src/services/s.ts')[0].familie).toBe(
      'Nutzereinstellungen',
    );

    const kategorien = `
      export async function saveLocalCategory(category) {
        const categories = await readLocalCategoriesRaw();
        await writeLocalCategories([...categories, category]);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(kategorien, 'src/services/s.ts')[0].familie).toBe(
      'Kategorien',
    );
  });
});
