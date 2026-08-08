import { describe, it, expect } from 'vitest';
import { findNumberInputs } from '../decimal-input-core.mjs';

/**
 * Wächter-Test für den Dezimal-Eingabe-Wächter.
 *
 * Er muss zwei Dinge können, und das zweite ist das schwerere: den echten
 * Verstoß finden UND die legitimen ganzzahligen Felder in Ruhe lassen. Ein
 * Wächter mit Fehlalarmen wird abgeschaltet statt befolgt.
 */
describe('findNumberInputs', () => {
  describe('Verstöße', () => {
    it('[REGRESSION] sollte ein Betragsfeld mit type="number" finden', () => {
      // Genau diese Form stand in DebtFormDialog: „12,50" wurde zu 1.250 €.
      const src = `
        <Input
          id="debt-balance"
          type="number"
          inputMode="decimal"
          value={form.balance}
        />`;
      const funde = findNumberInputs('a.tsx', src);
      expect(funde).toHaveLength(1);
      expect(funde[0].hint).toBe('balance');
    });

    it('[REGRESSION] sollte ein Zinssatz-Feld finden', () => {
      // „5,5" wurde dort zu 55 % — gemessen in Chromium (de-DE).
      const src = `<Input id="debt-rate" type="number" value={form.interest_rate} />`;
      expect(findNumberInputs('a.tsx', src)[0].hint).toBe('rate');
    });

    it('sollte auch finden, wenn nur das aria-label es verrät', () => {
      const src = `<Input type="number" aria-label="Betrag in Euro" />`;
      expect(findNumberInputs('a.tsx', src)).toHaveLength(1);
    });

    it('sollte finden, wenn `type` VOR dem sprechenden Attribut steht', () => {
      const src = `
        <Input
          type="number"
          id="wd-amount"
        />`;
      expect(findNumberInputs('a.tsx', src)).toHaveLength(1);
    });

    it('[REGRESSION] sollte ein Zielbetrag-Feld finden', () => {
      // Aufgefallen beim Aufraeumen des Backlogs: `FundForm` hatte ein
      // `type="number"`-Feld fuer den Zielbetrag einer Ruecklage, und der
      // Waechter schwieg — „target" fehlte schlicht im Wortschatz. Ein
      // Waechter, der einen ganzen Feldtyp nicht kennt, meldet „alles sauber"
      // ueber etwas, das er nie angesehen hat.
      const src = `<Input type="number" placeholder={t('forecast.targetAmount')} value={target} />`;
      expect(findNumberInputs('a.tsx', src)).toHaveLength(1);
    });

    it('sollte die Zeilennummer melden', () => {
      const src = `zeile1\nzeile2\n<Input type="number" id="amount" />`;
      expect(findNumberInputs('a.tsx', src)[0].line).toBe(3);
    });
  });

  describe('Kein Fehlalarm', () => {
    it('sollte ein Tages-Feld in Ruhe lassen', () => {
      // Der Tag im Monat ist ganzzahlig — dort ist type="number" richtig.
      const src = `<Input id="debt-due" type="number" inputMode="numeric" value={form.due_day} />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });

    it('sollte eine Anzahl in Ruhe lassen', () => {
      const src = `<Input id="trials" type="number" value={trials} />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });

    it('sollte ein Jahr in Ruhe lassen', () => {
      const src = `<Input id="tax-year" type="number" value={year} />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });

    it('sollte den DecimalInput selbst nicht melden', () => {
      const src = `<DecimalInput id="debt-balance" value={form.balance} />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });

    it('sollte eine auskommentierte Zeile nicht melden', () => {
      const src = `// <Input type="number" id="amount" />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });

    it('sollte ein Feld ohne jeden Hinweis nicht melden', () => {
      // Ohne sprechendes Attribut kann der Waechter nichts wissen — dann
      // schweigt er, statt zu raten.
      const src = `<Input type="number" />`;
      expect(findNumberInputs('a.tsx', src)).toEqual([]);
    });
  });
});
