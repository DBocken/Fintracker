import { describe, it, expect } from 'vitest';
import {
  collectBankFields,
  describeBankTransaction,
  describeMerchantCategory,
  describeTransactionCode,
  pickCounterparty,
  type BankTransactionSource,
} from '../bank-transaction-fields';

function makeSource(overrides: Partial<BankTransactionSource> = {}): BankTransactionSource {
  return {
    bookingDate: '2026-08-19',
    transactionAmount: { amount: '-2.30', currency: 'EUR' },
    ...overrides,
  };
}

describe('pickCounterparty', () => {
  describe('Happy Path', () => {
    it('sollte bei einer Ausgabe den Creditor als Gegenüber nehmen', () => {
      const source = makeSource({ creditorName: 'Parken - Rathaus', debtorName: 'Max Mustermann' });
      expect(pickCounterparty(source, -2.3).name).toBe('Parken - Rathaus');
    });

    it('sollte bei einer Einnahme den Debtor als Gegenüber nehmen', () => {
      const source = makeSource({ creditorName: 'Max Mustermann', debtorName: 'Arbeitgeber GmbH' });
      expect(pickCounterparty(source, 2400).name).toBe('Arbeitgeber GmbH');
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte bei einer Kartenzahlung nicht die abwickelnde Stelle als Empfänger ausweisen', () => {
      // Der gemeldete Fall: Die Bank-App nennt den Händler, Fintracker nannte
      // die abwickelnde Landesbank. Ursache war `debtorName || creditorName` —
      // dieselbe Reihenfolge für BEIDE Richtungen.
      const source = makeSource({
        debtorName: 'Landesbank Hessen-Thüringen',
        creditorName: 'Parken - Rathaus//Wolfsburg/DE',
      });
      expect(pickCounterparty(source, -2.3).name).toBe('Parken - Rathaus//Wolfsburg/DE');
    });

    it('[REGRESSION] sollte die Gegenkonto-IBAN nach dem Vorzeichen wählen', () => {
      // Diese IBAN speist die Erkennung interner Überträge. Aus der falschen
      // Richtung verknüpft sie Buchungen, die nichts miteinander zu tun haben.
      const source = makeSource({
        debtorAccount: { iban: 'DE00EIGENES00000000000' },
        creditorAccount: { iban: 'DE99FREMDES99999999999' },
      });
      expect(pickCounterparty(source, -50).iban).toBe('DE99FREMDES99999999999');
      expect(pickCounterparty(source, 50).iban).toBe('DE00EIGENES00000000000');
    });
  });

  describe('Edge Cases', () => {
    it('sollte auf die andere Richtung zurückfallen, wenn die passende Seite fehlt', () => {
      const source = makeSource({ debtorName: 'Nur Debtor' });
      expect(pickCounterparty(source, -10).name).toBe('Nur Debtor');
    });

    it('sollte den Ultimate-Namen vor der Gegenrichtung bevorzugen', () => {
      const source = makeSource({ ultimateCreditor: 'Eigentlicher Händler', debtorName: 'Abwickler' });
      expect(pickCounterparty(source, -10).name).toBe('Eigentlicher Händler');
    });

    it('sollte ohne jeden Namen null liefern statt eines leeren Strings', () => {
      expect(pickCounterparty(makeSource(), -10)).toEqual({ name: null, iban: null });
    });

    it('sollte den Betrag 0 wie eine Einnahme behandeln (Debtor zuerst)', () => {
      const source = makeSource({ debtorName: 'Debtor', creditorName: 'Creditor' });
      expect(pickCounterparty(source, 0).name).toBe('Debtor');
    });
  });
});

describe('describeMerchantCategory', () => {
  it('sollte 7523 als Parken übersetzen', () => {
    expect(describeMerchantCategory('7523')).toBe('Parken');
  });

  it('sollte Leerzeichen um den Schlüssel tolerieren', () => {
    expect(describeMerchantCategory(' 5411 ')).toBe('Lebensmittel');
  });

  it('sollte für einen unbekannten Schlüssel undefined liefern statt zu raten', () => {
    expect(describeMerchantCategory('9999')).toBeUndefined();
  });

  it('sollte ohne Schlüssel undefined liefern', () => {
    expect(describeMerchantCategory(undefined)).toBeUndefined();
    expect(describeMerchantCategory(null)).toBeUndefined();
    expect(describeMerchantCategory('')).toBeUndefined();
  });
});

describe('describeTransactionCode', () => {
  it('sollte PMNT-CCRD-POSD als Kartenzahlung übersetzen', () => {
    expect(describeTransactionCode('PMNT-CCRD-POSD')).toBe('Kartenzahlung');
  });

  it('sollte Kleinschreibung normalisieren', () => {
    expect(describeTransactionCode('pmnt-ccrd-cwdl')).toBe('Bargeldabhebung');
  });

  it('sollte für einen unbekannten Schlüssel undefined liefern', () => {
    expect(describeTransactionCode('XXXX-YYYY-ZZZZ')).toBeUndefined();
  });
});

describe('describeBankTransaction', () => {
  it('sollte den Branchenschlüssel dem Buchungsschlüssel vorziehen', () => {
    const source = makeSource({ merchantCategoryCode: '7523', bankTransactionCode: 'PMNT-CCRD-POSD' });
    expect(describeBankTransaction(source)).toBe('Parken');
  });

  it('sollte ohne Branchenschlüssel den Buchungsschlüssel nehmen', () => {
    expect(describeBankTransaction(makeSource({ bankTransactionCode: 'PMNT-CCRD-POSD' }))).toBe('Kartenzahlung');
  });

  it('sollte den proprietären Schlüssel vor dem generischen nehmen', () => {
    const source = makeSource({
      proprietaryBankTransactionCode: 'PMNT-CCRD-CWDL',
      bankTransactionCode: 'PMNT-CCRD-POSD',
    });
    expect(describeBankTransaction(source)).toBe('Bargeldabhebung');
  });

  it('sollte ohne jeden Schlüssel undefined liefern', () => {
    expect(describeBankTransaction(makeSource())).toBeUndefined();
  });
});

describe('collectBankFields', () => {
  describe('Regression Protection', () => {
    it('[REGRESSION] sollte jedes gelieferte Feld behalten, das keine eigene Spalte hat', () => {
      // Der Kern: Diese Felder waren im Typ deklariert und wurden beim Import
      // stillschweigend verworfen. Was nicht ankommt, kann später niemand mehr
      // auswerten — und niemand sieht, dass es je da war.
      const source = makeSource({
        transactionId: 'gc-1',
        valueDate: '2026-08-19',
        debtorName: 'Debtor',
        creditorName: 'Creditor',
        debtorAccount: { iban: 'DE11' },
        creditorAccount: { iban: 'DE22' },
        additionalInformation: 'Zusatz',
        purposeCode: 'CDPT',
        bankTransactionCode: 'PMNT-CCRD-POSD',
        proprietaryBankTransactionCode: 'KARTENZAHLUNG',
        merchantCategoryCode: '7523',
        mandateId: 'MND-1',
        endToEndId: 'E2E-1',
      });

      expect(collectBankFields(source)).toEqual({
        transactionId: 'gc-1',
        valueDate: '2026-08-19',
        debtorName: 'Debtor',
        creditorName: 'Creditor',
        debtorIban: 'DE11',
        creditorIban: 'DE22',
        additionalInformation: 'Zusatz',
        purposeCode: 'CDPT',
        bankTransactionCode: 'PMNT-CCRD-POSD',
        proprietaryBankTransactionCode: 'KARTENZAHLUNG',
        merchantCategoryCode: '7523',
        mandateId: 'MND-1',
        endToEndId: 'E2E-1',
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne Zusatzfelder null liefern statt eines leeren Objekts', () => {
      expect(collectBankFields(makeSource())).toBeNull();
    });

    it('sollte leere und nur aus Leerzeichen bestehende Werte weglassen', () => {
      const source = makeSource({ purposeCode: '   ', creditorName: 'Da' });
      expect(collectBankFields(source)).toEqual({ creditorName: 'Da' });
    });
  });
});
