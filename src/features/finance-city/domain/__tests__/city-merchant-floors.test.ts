import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildMerchantFloorsByBuilding } from '../city-merchant-floors';
import type { Category, Transaction, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';

// Das "Sonstige"-Label kommt aus serviceT (`@/i18n/serviceT`), das die Sprache
// aus localStorage liest — in jsdom sonst abhängig von `navigator.language`
// (Präzedenzfall: `src/lib/__tests__/analysis-data.test.ts`).
beforeEach(() => {
  window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
});
afterEach(() => {
  window.localStorage.removeItem('ausgabentracker_locale_v1');
});

let txCounter = 0;
function tx(opts: {
  payee: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  isTransfer?: boolean;
  date?: string;
}): Transaction {
  txCounter += 1;
  return {
    id: asTransactionId(`tx-${txCounter}`),
    date: opts.date ?? '2026-06-01',
    amount: opts.amount,
    payee: opts.payee,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: opts.categoryId ?? null,
    subcategory_id: opts.subcategoryId ?? null,
    is_transfer: opts.isTransfer,
  };
}

function category(id: string, name: string, parentId?: string): Category {
  return { id, name, filters: [], parent_id: parentId ?? null };
}

function allocation(opts: {
  id: string;
  txId: string;
  amountMinor: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
}): TransactionAllocation {
  return {
    id: opts.id,
    transaction_id: opts.txId,
    amount_minor: opts.amountMinor,
    category_id: opts.categoryId ?? null,
    subcategory_id: opts.subcategoryId ?? null,
    source: 'manual',
  } as TransactionAllocation;
}

describe('buildMerchantFloorsByBuilding – Aufteilungen', () => {
  const CAT_FOOD = 'food';
  const CAT_CLOTHES = 'clothes';
  const categoriesById = new Map<string, Category>([
    [CAT_FOOD, category(CAT_FOOD, 'Lebensmittel')],
    [CAT_CLOTHES, category(CAT_CLOTHES, 'Kleidung')],
  ]);

  it('sollte den Kleidungs-Anteil einer Aldi-Buchung im Kleidungs-Gebäude als Etage führen', () => {
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const floors = buildMerchantFloorsByBuilding(
      [aldi],
      categoriesById,
      new Map([[aldi.id!, [
        allocation({ id: 'a-food', txId: aldi.id!, amountMinor: -3700, categoryId: CAT_FOOD }),
        allocation({ id: 'a-clothes', txId: aldi.id!, amountMinor: -1300, categoryId: CAT_CLOTHES }),
      ]]]),
    );

    expect(floors.get(CAT_FOOD)?.map((f) => [f.label, f.amount])).toEqual([['Aldi', 37]]);
    // Der Anteil zählt im KLEIDUNGS-Gebäude, nicht bei Lebensmitteln.
    expect(floors.get(CAT_CLOTHES)?.map((f) => [f.label, f.amount])).toEqual([['Aldi', 13]]);
  });

  it('sollte den Anteil je Etage mit anderen Händlern derselben Kategorie zusammenführen', () => {
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const cua = tx({ payee: 'C&A', amount: -30, categoryId: CAT_CLOTHES });
    const floors = buildMerchantFloorsByBuilding(
      [aldi, cua],
      categoriesById,
      new Map([[aldi.id!, [
        allocation({ id: 'a-food', txId: aldi.id!, amountMinor: -3700, categoryId: CAT_FOOD }),
        allocation({ id: 'a-clothes', txId: aldi.id!, amountMinor: -1300, categoryId: CAT_CLOTHES }),
      ]]]),
    );

    // Absteigend nach Betrag: C&A (30) vor dem Aldi-Anteil (13).
    expect(floors.get(CAT_CLOTHES)?.map((f) => [f.label, f.amount])).toEqual([['C&A', 30], ['Aldi', 13]]);
  });

  it('sollte einen Anteil in einer Unterkategorie im Unterkategorie-Gebäude führen', () => {
    const withSub = new Map<string, Category>([
      ...categoriesById,
      ['shoes', category('shoes', 'Schuhe', CAT_CLOTHES)],
    ]);
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const floors = buildMerchantFloorsByBuilding(
      [aldi],
      withSub,
      new Map([[aldi.id!, [
        allocation({ id: 'a-food', txId: aldi.id!, amountMinor: -3000, categoryId: CAT_FOOD }),
        allocation({ id: 'a-shoes', txId: aldi.id!, amountMinor: -2000, categoryId: CAT_CLOTHES, subcategoryId: 'shoes' }),
      ]]]),
    );

    expect(floors.get('shoes')?.map((f) => f.amount)).toEqual([20]);
    expect(floors.get(CAT_CLOTHES)).toBeUndefined();
  });

  it('sollte eine Aufteilung ohne auflösbare Kategorie überspringen statt zu crashen', () => {
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const floors = buildMerchantFloorsByBuilding(
      [aldi],
      categoriesById,
      new Map([[aldi.id!, [
        allocation({ id: 'a-ghost', txId: aldi.id!, amountMinor: -2000, categoryId: 'geloescht' }),
        allocation({ id: 'a-food', txId: aldi.id!, amountMinor: -3000, categoryId: CAT_FOOD }),
      ]]]),
    );

    expect(floors.get(CAT_FOOD)?.map((f) => f.amount)).toEqual([30]);
  });

  it('sollte ohne Aufteilungs-Map unverändert die volle Buchung führen', () => {
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const floors = buildMerchantFloorsByBuilding([aldi], categoriesById);

    expect(floors.get(CAT_FOOD)?.map((f) => f.amount)).toEqual([50]);
    expect(floors.get(CAT_CLOTHES)).toBeUndefined();
  });

  it('sollte die Buchungsliste der Etage auf den Anteilsbetrag setzen (Sheet zeigt den Anteil)', () => {
    const aldi = tx({ payee: 'Aldi', amount: -50, categoryId: CAT_FOOD });
    const floors = buildMerchantFloorsByBuilding(
      [aldi],
      categoriesById,
      new Map([[aldi.id!, [
        allocation({ id: 'a-clothes', txId: aldi.id!, amountMinor: -1300, categoryId: CAT_CLOTHES }),
        allocation({ id: 'a-food', txId: aldi.id!, amountMinor: -3700, categoryId: CAT_FOOD }),
      ]]]),
    );

    expect(floors.get(CAT_CLOTHES)?.[0].bookings).toEqual([
      { txId: aldi.id, date: aldi.date, amount: 13, payee: 'Aldi' },
    ]);
  });
});

describe('buildMerchantFloorsByBuilding', () => {
  const CAT_LEISURE = 'leisure';
  const CAT_STREAMING = 'streaming';
  const CAT_FUEL = 'fuel';

  const categoriesById = new Map<string, Category>([
    [CAT_LEISURE, category(CAT_LEISURE, 'Freizeit')],
    [CAT_STREAMING, category(CAT_STREAMING, 'Streaming', CAT_LEISURE)],
    [CAT_FUEL, category(CAT_FUEL, 'Tanken')],
  ]);

  it('sollte Buchungen nach Gebäude (Unterkategorie) und Händler gruppieren', () => {
    const netflix = tx({ payee: 'Netflix', amount: -17.99, categoryId: CAT_STREAMING });
    const shell = tx({ payee: 'Shell', amount: -60, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([netflix, shell], categoriesById);

    // toMatchObject: seit WP-D4 tragen Etagen zusätzlich ihre `bookings` (eigene Tests unten).
    expect(floors.get(CAT_STREAMING)).toMatchObject([{ id: expect.any(String), label: 'Netflix', amount: 17.99 }]);
    expect(floors.get(CAT_FUEL)).toMatchObject([{ id: expect.any(String), label: 'Shell', amount: 60 }]);
  });

  it('sollte eine Buchung ohne Unterkategorie im Direkt-Gebäude (Hauptkategorie selbst) einordnen', () => {
    const shell = tx({ payee: 'Shell', amount: -60, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([shell], categoriesById);

    expect([...floors.keys()]).toEqual([CAT_FUEL]);
  });

  it('sollte mehrere Buchungen desselben Händlers zu EINER Etage mit summiertem Betrag zusammenfassen', () => {
    const a1 = tx({ payee: 'Aldi', amount: -23.45, categoryId: CAT_FUEL });
    const a2 = tx({ payee: 'Aldi', amount: -12.5, categoryId: CAT_FUEL });
    const a3 = tx({ payee: 'Aldi', amount: -9.05, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([a1, a2, a3], categoriesById);

    const building = floors.get(CAT_FUEL)!;
    expect(building).toHaveLength(1);
    expect(building[0].label).toBe('Aldi');
    expect(building[0].amount).toBeCloseTo(45, 10);
  });

  it('[REGRESSION] sollte eine einmalige, NICHT wiederkehrende Buchung (z. B. Aldi, 1x) als eigene, beschriftete Etage aufnehmen', () => {
    // Nutzer-Befund: computeContracts überspringt Händler mit weniger als
    // minCount Buchungen (3 bei Merchant-Name, 2 bei IBAN) — eine einzelne
    // Aldi-Buchung wurde dadurch bisher gar keine Etage. Die neue Etagen-
    // Regel (Etage = Händler, unabhängig von Wiederkehr) muss sie trotzdem
    // aufnehmen.
    const aldi = tx({ payee: 'Aldi', amount: -8.5, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([aldi], categoriesById);

    const building = floors.get(CAT_FUEL)!;
    expect(building).toMatchObject([{ id: expect.any(String), label: 'Aldi', amount: 8.5 }]);
  });

  it('sollte bei mehr als 6 Händlern die Top 5 (nach Betrag absteigend) als eigene Etagen behalten und den Rest zu EINER "Sonstige"-Etage zusammenfassen', () => {
    // 7 unterschiedliche Händler -> Deckelung auf maximal 6 Etagen (Top 5 + Sonstige).
    const bookings = [
      tx({ payee: 'Händler A', amount: -100, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler B', amount: -90, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler C', amount: -80, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler D', amount: -70, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler E', amount: -60, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler F', amount: -10, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler G', amount: -5, categoryId: CAT_FUEL }),
    ];

    const floors = buildMerchantFloorsByBuilding(bookings, categoriesById);
    const building = floors.get(CAT_FUEL)!;

    expect(building).toHaveLength(6);
    expect(building.slice(0, 5).map((f) => f.label)).toEqual([
      'Händler A',
      'Händler B',
      'Händler C',
      'Händler D',
      'Händler E',
    ]);
    // Die letzte Etage ist die zusammengefasste "Sonstige"-Etage (F + G = 15).
    expect(building[5].label).toBe('Sonstige');
    expect(building[5].amount).toBeCloseTo(15, 10);
  });

  it('sollte bei GENAU 6 Händlern alle namentlich als eigene Etagen behalten (keine Deckelung)', () => {
    const bookings = [
      tx({ payee: 'Händler A', amount: -60, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler B', amount: -50, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler C', amount: -40, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler D', amount: -30, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler E', amount: -20, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler F', amount: -10, categoryId: CAT_FUEL }),
    ];

    const floors = buildMerchantFloorsByBuilding(bookings, categoriesById);
    const building = floors.get(CAT_FUEL)!;

    expect(building).toHaveLength(6);
    expect(building.map((f) => f.label)).not.toContain('Sonstige');
  });

  it('sollte je Etage die Einzelbuchungen (txId/Datum/Betrag/Payee) nach Datum absteigend mitliefern (WP-D4, Sheet-Buchungsliste)', () => {
    const older = tx({ payee: 'Netflix', amount: -15.99, categoryId: CAT_FUEL, date: '2026-04-12' });
    const newest = tx({ payee: 'Netflix', amount: -17.99, categoryId: CAT_FUEL, date: '2026-06-12' });
    const middle = tx({ payee: 'Netflix', amount: -15.99, categoryId: CAT_FUEL, date: '2026-05-12' });

    const floors = buildMerchantFloorsByBuilding([older, newest, middle], categoriesById);
    const netflixFloor = floors.get(CAT_FUEL)![0];

    expect(netflixFloor.bookings).toHaveLength(3);
    expect(netflixFloor.bookings!.map((b) => b.txId)).toEqual([newest.id, middle.id, older.id]);
    expect(netflixFloor.bookings![0]).toEqual({
      txId: newest.id,
      date: '2026-06-12',
      amount: 17.99, // absoluter Anzeige-Betrag (Ausgaben im Modell positiv).
      payee: 'Netflix',
    });
  });

  it('sollte der "Sonstige"-Etage die Buchungen ALLER zusammengefassten Händler mitgeben (nach Datum absteigend)', () => {
    const bookings = [
      tx({ payee: 'Händler A', amount: -100, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler B', amount: -90, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler C', amount: -80, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler D', amount: -70, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler E', amount: -60, categoryId: CAT_FUEL }),
      tx({ payee: 'Händler F', amount: -10, categoryId: CAT_FUEL, date: '2026-06-20' }),
      tx({ payee: 'Händler G', amount: -5, categoryId: CAT_FUEL, date: '2026-06-25' }),
    ];

    const floors = buildMerchantFloorsByBuilding(bookings, categoriesById);
    const otherFloor = floors.get(CAT_FUEL)![5];

    expect(otherFloor.label).toBe('Sonstige');
    expect(otherFloor.bookings).toHaveLength(2);
    // Neueste zuerst: G (25.06.) vor F (20.06.) — Payee je Zeile erhalten.
    expect(otherFloor.bookings!.map((b) => b.payee)).toEqual(['Händler G', 'Händler F']);
  });

  it('[REGRESSION] sollte eine per subcategory_id zugewiesene Buchung unter dem UNTERKATEGORIE-Gebäude einordnen (App-Konvention subcategory_id ?? category_id)', () => {
    // Nutzer-Befund: Buchungen mit gesetzter `subcategory_id` (und
    // `category_id` = Hauptkategorie) landeten unter dem HAUPTKATEGORIE-Key —
    // das aus dem Sunburst (getCategoryContributions: subcategory_id ??
    // category_id) gebaute Unterkategorie-Gebäude fand dadurch keine Etagen
    // und blieb beim Eintauchen leer.
    const netflix = tx({
      payee: 'Netflix',
      amount: -17.99,
      categoryId: CAT_LEISURE, // Hauptkategorie …
      subcategoryId: CAT_STREAMING, // … Zuweisung über die Unterkategorie.
    });

    const floors = buildMerchantFloorsByBuilding([netflix], categoriesById);

    expect(floors.get(CAT_STREAMING)).toMatchObject([{ label: 'Netflix', amount: 17.99 }]);
    expect(floors.has(CAT_LEISURE)).toBe(false);
  });

  it('[REGRESSION] sollte eine Buchung mit NUR subcategory_id (ohne category_id) nicht verlieren', () => {
    const netflix = tx({ payee: 'Netflix', amount: -17.99, subcategoryId: CAT_STREAMING });

    const floors = buildMerchantFloorsByBuilding([netflix], categoriesById);

    expect(floors.get(CAT_STREAMING)).toMatchObject([{ label: 'Netflix', amount: 17.99 }]);
  });

  it('sollte Transfers, Einnahmen und unkategorisierte Buchungen ignorieren', () => {
    const transfer = tx({ payee: 'Eigenes Konto', amount: -500, categoryId: CAT_FUEL, isTransfer: true });
    const income = tx({ payee: 'Arbeitgeber', amount: 3000, categoryId: CAT_FUEL });
    const uncategorized = tx({ payee: 'Unbekannt', amount: -20, categoryId: null });

    const floors = buildMerchantFloorsByBuilding([transfer, income, uncategorized], categoriesById);

    expect(floors.size).toBe(0);
  });

  it('sollte eine Buchung mit nicht auflösbarer Kategorie überspringen statt abzustürzen', () => {
    const orphan = tx({ payee: 'Unbekannter Laden', amount: -20, categoryId: 'not-in-map' });

    expect(() => buildMerchantFloorsByBuilding([orphan], categoriesById)).not.toThrow();
    const floors = buildMerchantFloorsByBuilding([orphan], categoriesById);
    expect(floors.size).toBe(0);
  });

  it('sollte bei leeren Transaktionen eine leere Map liefern', () => {
    const floors = buildMerchantFloorsByBuilding([], categoriesById);
    expect(floors.size).toBe(0);
  });

  it('sollte Cent-genau (Integer-Cent) summieren statt mit Float-Drift (z. B. 0,10 € + 0,20 €)', () => {
    const b1 = tx({ payee: 'Kiosk', amount: -0.1, categoryId: CAT_FUEL });
    const b2 = tx({ payee: 'Kiosk', amount: -0.2, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([b1, b2], categoriesById);
    const building = floors.get(CAT_FUEL)!;

    expect(building).toHaveLength(1);
    // Roh-Float 0.1 + 0.2 === 0.30000000000000004 — über Integer-Cent muss exakt 0.3 herauskommen.
    expect(building[0].amount).toBe(0.3);
  });

  it('sollte den Payee der betragshöchsten Einzelbuchung als Etagen-Label verwenden', () => {
    // Gleicher Händler-Fingerprint (Normalisierung ignoriert Groß-/Kleinschreibung),
    // aber unterschiedliche Payee-Schreibweise über die Zeit — das Label soll
    // den Payee der größten Einzelbuchung nehmen.
    const small = tx({ payee: 'Aldi', amount: -5, categoryId: CAT_FUEL });
    const big = tx({ payee: 'ALDI', amount: -50, categoryId: CAT_FUEL });

    const floors = buildMerchantFloorsByBuilding([small, big], categoriesById);
    const building = floors.get(CAT_FUEL)!;

    expect(building).toHaveLength(1);
    expect(building[0].label).toBe('ALDI');
    expect(building[0].amount).toBeCloseTo(55, 10);
  });
});
