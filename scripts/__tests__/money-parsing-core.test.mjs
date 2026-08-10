import { describe, it, expect } from 'vitest';
import { findMoneyParsingViolations } from '../money-parsing-core.mjs';

/**
 * Wächter-Test für den Geld-Parsing-Wächter (GOV-1 / WP 2.2).
 *
 * Zwei Verbote, zwei Erkennungsmuster. Wie beim Dezimal-Eingabe-Wächter ist
 * der „Kein Fehlalarm"-Block gleichgewichtig zum Verstoß-Block — ein Wächter
 * mit Fehlalarmen wird abgeschaltet statt befolgt.
 */
describe('findMoneyParsingViolations', () => {
  describe('Verstöße', () => {
    it('[REGRESSION] sollte Number.parseFloat mit Komma-Ersetzung finden (AskYourMoney.tsx:52)', () => {
      // Genau diese Zeile stand in AskYourMoney.tsx: getipptes „1.200" wurde
      // als 1,2 gelesen (deutscher Tausenderpunkt).
      const src = `  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));`;
      const funde = findMoneyParsingViolations('src/components/dashboard/finrisk/AskYourMoney.tsx', src);
      expect(funde).toHaveLength(1);
      expect(funde[0]).toMatchObject({ line: 1, hint: 'parseFloat-Komma-Ersetzung' });
    });

    it('sollte rohes parseFloat (ohne `Number.`) mit Komma-Ersetzung finden', () => {
      const src = `const x = parseFloat(input.replace(',', '.'));`;
      expect(findMoneyParsingViolations('a.ts', src)).toHaveLength(1);
    });

    it('sollte Komma-Ersetzung als Regex-Literal erkennen', () => {
      const src = `const x = parseFloat(input.replace(/,/, '.'));`;
      expect(findMoneyParsingViolations('a.ts', src)[0].hint).toBe('parseFloat-Komma-Ersetzung');
    });

    it('sollte einen mehrzeilig umgebrochenen Aufruf finden', () => {
      const src = ['const x = parseFloat(', '  input.replace(",", "."),', ');'].join('\n');
      expect(findMoneyParsingViolations('a.ts', src)).toHaveLength(1);
    });

    it('[REGRESSION] sollte `as unknown as` finden (BankCallbackPage.tsx:119)', () => {
      // Genau diese Zeile stand in BankCallbackPage.tsx: fremde
      // GoCardless-Bankdaten flossen ungeprüft in den React-State.
      const src = `gotAccounts = (result.accounts || []) as unknown as GoCardlessAccount[];`;
      const funde = findMoneyParsingViolations('src/pages/BankCallbackPage.tsx', src);
      expect(funde).toHaveLength(1);
      expect(funde[0]).toMatchObject({ line: 1, hint: 'as unknown as' });
    });

    it('sollte die Zeilennummer melden', () => {
      const src = `zeile1\nzeile2\nconst x = foo as unknown as Bar;`;
      expect(findMoneyParsingViolations('a.ts', src)[0].line).toBe(3);
    });

    it('sollte mehrere Verstöße in derselben Datei zählen', () => {
      const src = [`const a = parseFloat(x.replace(',', '.'));`, `const b = y as unknown as Z;`].join('\n');
      expect(findMoneyParsingViolations('a.ts', src)).toHaveLength(2);
    });
  });

  describe('Kein Fehlalarm', () => {
    it('sollte parseFloat OHNE Komma-Ersetzung in Ruhe lassen', () => {
      // BankCallbackPage.tsx (formatBalance): parst eine bereits
      // Punkt-formatierte API-Zahl, kein getippter deutscher Betrag.
      const src = `const x = parseFloat(preferred.balanceAmount.amount);`;
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });

    it('sollte `parseGermanNumber(x.replace(...))` in Ruhe lassen', () => {
      // parseGermanNumber ist der korrekte, deutschsprachige Parser selbst —
      // kein rohes parseFloat beteiligt.
      const src = `const x = parseGermanNumber(input.replace(/\\s/g, ''));`;
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });

    it('sollte `as const` in Ruhe lassen', () => {
      const src = `const STATUSES = ['a', 'b'] as const;`;
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });

    it('sollte einen einfachen `as SomeType`-Cast in Ruhe lassen', () => {
      const src = `const err = e as Error;`;
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });

    it('sollte beide Muster in einer Kommentarzeile nicht melden', () => {
      const src = [
        '// Frueher stand hier: parseFloat(amount.replace(",", "."))',
        '// und: foo as unknown as Bar',
        '* as unknown as war auch hier nur ein Kommentar',
      ].join('\n');
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });

    it('sollte `as unknown as` in einer Testdatei in Ruhe lassen', () => {
      const src = `const fake = {} as unknown as SomeType;`;
      expect(findMoneyParsingViolations('src/services/__tests__/foo.test.ts', src)).toEqual([]);
    });

    it('sollte parseFloat mit anderer .replace()-Ersetzung (kein Komma->Punkt) in Ruhe lassen', () => {
      // Tausenderpunkte entfernen ist etwas anderes als Komma->Punkt.
      const src = `const x = parseFloat(input.replace(/\\./g, ''));`;
      expect(findMoneyParsingViolations('a.ts', src)).toEqual([]);
    });
  });
});
