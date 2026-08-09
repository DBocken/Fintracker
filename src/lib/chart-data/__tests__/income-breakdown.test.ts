import { describe, it, expect } from 'vitest';
import { buildIncomeBreakdown, buildIncomeOverTime } from '../income-breakdown';
import type { Transaction, Category, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Lag bis WP 6.6 in `src/lib/__tests__/analysis-data.test.ts` — mit dem Modul
 * mitgewandert (ARCH-6). Die Zusicherungen sind unverändert.
 */
describe('Income Breakdown & Over Time', () => {
  const incomeCategories: Category[] = [
    { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'verkaeufe', name: 'Verkäufe', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'onlineverkauf', name: 'Online-Verkäufe', filters: [], parent_id: 'verkaeufe', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'versicherungen', name: 'Versicherungen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell' } },
  ];

  function itx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2024-03-15',
      amount: 0,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: false,
      ...overrides,
      id: asTransactionId(overrides.id ?? crypto.randomUUID()),
    };
  }

  describe('buildIncomeBreakdown', () => {
    it('gruppiert Einnahmen nach Haupt- und Unterkategorie, total === Summe', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2300);
      expect(result.groups).toHaveLength(2);
      const anstellung = result.groups.find((g) => g.id === 'anstellung');
      expect(anstellung?.value).toBe(2000);
      expect(anstellung?.children[0]).toMatchObject({ id: 'gehalt', value: 2000, share: 1 });
    });

    it('schließt Transfers und Ausgaben aus', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), amount: 1000, is_transfer: true }),
        itx({ id: asTransactionId('3'), amount: -50, category_id: 'versicherungen' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2000);
    });

    it('positive Buchung in einer Nicht-Einkommens-Kategorie landet unter "Sonstige Zuflüsse"', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 15, category_id: 'versicherungen', description: 'Beitragsrückerstattung' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(15);
      expect(result.groups[0].id).toBe('__nonincome');
    });

    it('teilt eine aufgeteilte Buchung (Splits) korrekt auf zwei Einkommens-Subs auf', () => {
      const allocationsByTx = new Map<string, TransactionAllocation[]>([
        ['1', [
          { id: 'a1', transaction_id: '1', category_id: 'anstellung', subcategory_id: 'gehalt', amount_minor: 150000, source: 'manual' },
          { id: 'a2', transaction_id: '1', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf', amount_minor: 50000, source: 'manual' },
        ]],
      ]);
      const txs: Transaction[] = [itx({ id: asTransactionId('1'), amount: 2000 })];
      const result = buildIncomeBreakdown(txs, incomeCategories, allocationsByTx);
      expect(result.total).toBe(2000);
      expect(result.groups.find((g) => g.id === 'anstellung')?.value).toBe(1500);
      expect(result.groups.find((g) => g.id === 'verkaeufe')?.value).toBe(500);
    });

    it('liefert leere Aufschlüsselung für leere Eingabe', () => {
      const result = buildIncomeBreakdown([], incomeCategories);
      expect(result).toEqual({ total: 0, groups: [] });
    });
  });

  describe('buildIncomeOverTime', () => {
    it('aggregiert Einnahmen je Monat und Hauptkategorie, aufsteigend sortiert', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), date: '2024-02-01', amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), date: '2024-01-01', amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeOverTime(txs, incomeCategories);
      expect(result.map((p) => p.month)).toEqual(['2024-01', '2024-02']);
      expect(result[1].byMain['anstellung']).toBe(2000);
    });

    it('liefert ein leeres Array für leere Eingabe', () => {
      expect(buildIncomeOverTime([], incomeCategories)).toEqual([]);
    });
  });
});

/**
 * Grenzfälle der Einnahmen-Aufbereitung: Was NICHT als Einnahme zählt, und wie
 * Zuflüsse ohne Einkommens-Kategorie einsortiert werden.
 */
describe('Einnahmen — Abgrenzung von Zuflüssen', () => {
  const cats: Category[] = [
    { id: 'anstellung', name: 'Anstellung', filters: [], attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'bonus', name: 'Bonus', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'versicherung', name: 'Versicherung', filters: [], attributes: { ausgabenklasse: 'essenziell' } },
  ];

  function itx(over: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2026-04-15',
      amount: 0,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: false,
      ...over,
      id: asTransactionId(over.id ?? crypto.randomUUID()),
    };
  }

  it('zählt nur die positiven Anteile einer aufgeteilten Buchung als Einnahme', () => {
    // Eine Gehaltsbuchung mit einem negativen Anteil (einbehaltener
    // Vorschuss) darf nur mit ihrem positiven Teil in die Einnahmen gehen —
    // sonst steht in „Woher kommt mein Geld?" mehr, als je eingegangen ist.
    const map = new Map<string, TransactionAllocation[]>([
      ['t1', [
        { id: 'a', transaction_id: 't1', amount_minor: 250000, category_id: 'gehalt', source: 'manual' },
        { id: 'b', transaction_id: 't1', amount_minor: -50000, category_id: 'gehalt', source: 'manual' },
      ]],
    ]);
    const result = buildIncomeBreakdown([itx({ id: 't1', amount: 2000, category_id: 'gehalt' })], cats, map);
    expect(result.total).toBeCloseTo(2500, 2);
  });

  it('sortiert die Unterkategorien einer Einkommensgruppe absteigend nach Betrag', () => {
    const result = buildIncomeBreakdown(
      [
        itx({ id: 'b1', amount: 500, category_id: 'anstellung', subcategory_id: 'bonus' }),
        itx({ id: 'g1', amount: 3000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
      ],
      cats,
    );
    const gruppe = result.groups.find((g) => g.id === 'anstellung');
    expect(gruppe?.children.map((c) => c.id)).toEqual(['gehalt', 'bonus']);
    expect(gruppe?.children[0].share).toBeCloseTo(3000 / 3500, 5);
  });

  it('lässt Überträge, Ausgaben und unparsbare Daten aus dem Einnahmen-Verlauf heraus', () => {
    // Jeder dieser drei Fälle würde den Monatsverlauf verfälschen: der Übertrag
    // erfindet Einkommen, die Ausgabe kehrt das Vorzeichen um, das kaputte
    // Datum landete sonst in einem Monat „Invalid Date".
    const punkte = buildIncomeOverTime(
      [
        itx({ id: 'u1', amount: 900, category_id: 'gehalt', is_transfer: true }),
        itx({ id: 'a1', amount: -900, category_id: 'gehalt' }),
        itx({ id: 'd1', amount: 900, category_id: 'gehalt', date: 'kein-datum' }),
        itx({ id: 'g1', amount: 2000, category_id: 'gehalt', date: '2026-04-15' }),
      ],
      cats,
    );
    expect(punkte).toHaveLength(1);
    expect(punkte[0]).toMatchObject({ month: '2026-04', total: 2000 });
  });

  it('sammelt Zuflüsse in Nicht-Einkommens-Kategorien im Verlauf getrennt vom Einkommen', () => {
    // Eine Versicherungserstattung ist Geld auf dem Konto, aber kein Einkommen.
    // Sie darf die Einkommens-Hauptkategorie nicht aufblähen — sonst sieht der
    // Verlauf nach einer Gehaltserhöhung aus, die es nie gab.
    const punkte = buildIncomeOverTime(
      [
        itx({ id: 'g1', amount: 2000, category_id: 'gehalt', date: '2026-04-01' }),
        itx({ id: 'v1', amount: 150, category_id: 'versicherung', date: '2026-04-20' }),
      ],
      cats,
    );
    expect(punkte).toHaveLength(1);
    expect(punkte[0].total).toBeCloseTo(2150, 2);
    expect(punkte[0].byMain.anstellung).toBeCloseTo(2000, 2);
    expect(Object.keys(punkte[0].byMain)).toHaveLength(2);
    expect(punkte[0].byMain.anstellung + (punkte[0].byMain.__nonincome ?? 0)).toBeCloseTo(2150, 2);
  });

  it('zählt nur den positiven Anteil einer aufgeteilten Buchung in den Verlauf', () => {
    const map = new Map<string, TransactionAllocation[]>([
      ['t2', [
        { id: 'a', transaction_id: 't2', amount_minor: 30000, category_id: 'gehalt', source: 'manual' },
        { id: 'b', transaction_id: 't2', amount_minor: -10000, category_id: 'gehalt', source: 'manual' },
      ]],
    ]);
    const punkte = buildIncomeOverTime([itx({ id: 't2', amount: 200, category_id: 'gehalt', date: '2026-05-02' })], cats, map);
    expect(punkte[0].total).toBeCloseTo(300, 2);
  });
});
