import { describe, it, expect } from 'vitest';
import { questionCatalog } from '../question-catalog';
import { fehlendeSlots } from '@/lib/question-registry';
import type { QuestionData, QuestionSlots } from '@/lib/question-registry';
import { decodeDashboardFilters, filterTransactions } from '@/features/shared/domain/dashboard-filtering';
import { sumExpenses, sumIncome } from '@/lib/analysis-data';
import { SUPPORTED_LOCALES, translations } from '@/i18n/translations';
import type { Account, Category, Transaction } from '@/types';
import type { Debt } from '@/lib/debt-types';
import { asTransactionId } from '@/lib/ids';

const JETZT = new Date('2026-07-20T12:00:00Z');

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-07-05',
    amount: -30,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    id: asTransactionId(overrides.id ?? `qc-${seq}`),
  };
}

const categories: Category[] = [
  { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] } as unknown as Category,
];
const accounts: Account[] = [];

const transactions: Transaction[] = [
  tx({ id: 't1', payee: 'LIDL SAGT DANKE 1234', amount: -30, date: '2026-07-05' }),
  tx({ id: 't2', payee: 'LIDL SAGT DANKE 5678', amount: -20, date: '2026-07-12' }),
  tx({ id: 't3', payee: 'LIDL SAGT DANKE 9012', amount: -25, date: '2026-06-11' }),
  tx({ id: 't4', payee: 'REWE SAGT DANKE 4711', amount: -15, date: '2026-07-08' }),
  tx({ id: 't5', payee: 'Arbeitgeber', amount: 2400, date: '2026-07-01' }),
  // Notiz nennt Lidl — darf beim Händlerfilter NICHT mitzählen.
  tx({ id: 't6', payee: 'Parkhaus', amount: -4, date: '2026-07-09', tax_note: 'bei Lidl geparkt' }),
];

const debts: Debt[] = [
  {
    id: 'd1',
    user_id: 'local',
    name: 'Autokredit',
    type: 'car_loan',
    balance: 4800,
    interest_rate: 3.9,
    min_payment: 180,
    is_bnpl: false,
    is_paid_off: false,
  } as Debt,
];

const daten: QuestionData = {
  transactions,
  categories,
  accounts,
  debts,
  budgets: [],
  contractDecisions: new Map(),
  jetzt: JETZT,
};

/** Slots, die jeden Pflicht-Slot des Katalogs plausibel belegen. */
const alleSlots: QuestionSlots = {
  haendler: 'lidl sagt danke',
  kategorieId: 'local-cat-lebensmittel',
  betrag: 12000,
  zeitraum: { von: '2026-07-01', bis: '2026-07-31', rangeToken: '2026-07', label: '2026-07' },
};

function leaf(baum: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, teil) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[teil] : undefined),
    baum,
  );
}

describe('Abfrage-Register: Katalog', () => {
  it('sollte Einträge aus mehreren Slices einsammeln', () => {
    // Belegt, dass der Glob wirklich greift — eine leere Liste wäre der
    // stumme Ausfall, gegen den die Kompositionswurzel gebaut ist.
    expect(questionCatalog.entries.length).toBeGreaterThanOrEqual(5);
    const ids = questionCatalog.entries.map((e) => e.id);
    expect(ids).toContain('ausgaben.haendler');
    expect(ids).toContain('vertrag.jahreskosten');
    expect(ids).toContain('schulden.restschuld');
    expect(ids).toContain('budget.status');
    expect(ids).toContain('leistbarkeit.anschaffung');
  });

  it('sollte eindeutige IDs haben', () => {
    const ids = questionCatalog.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sollte für jeden Eintrag Auslöser und Aussage in ALLEN Sprachen kennen', () => {
    // Ein Eintrag ohne Übersetzung ist in dieser Sprache stumm — und das
    // fällt sonst niemandem auf, weil `t()` den rohen Punkt-String rendert.
    const fehlend: string[] = [];

    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      const keys = [
        ...entry.ausloeser,
        antwort.aussage.key,
        ...(antwort.begruendung ?? []).map((b) => b.key),
      ];
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of keys) {
          if (typeof leaf(translations[locale], key) !== 'string') {
            fehlend.push(`${locale}: ${key}`);
          }
        }
      }
    }

    expect(fehlend).toEqual([]);
  });

  it('sollte niemals einen fertig formatierten Betrag zurückgeben', () => {
    // Die Festlegung, an der der Sanfte Modus hängt: Formatiert wird in der
    // Präsentation (über `money.mask`), nie im Register — `src/lib/` hat
    // keinen React-Kontext, und `check:money-format` sieht dort nichts.
    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      expect(typeof antwort.wert === 'number' || antwort.wert === null).toBe(true);
      for (const wert of Object.values(antwort.aussage.params)) {
        expect(String(wert)).not.toMatch(/[€$]|\bEUR\b/);
      }
    }
  });

  it('sollte für jeden Eintrag einen Deep-Link liefern', () => {
    for (const entry of questionCatalog.entries) {
      const antwort = entry.antwort(alleSlots, daten);
      expect(antwort.deepLink.startsWith('/')).toBe(true);
    }
  });

  it('sollte teure Einträge verweisen lassen statt rechnen', () => {
    for (const entry of questionCatalog.entries.filter((e) => e.aufwand === 'teuer')) {
      expect(entry.antwort(alleSlots, daten).art).toBe('verweis');
      // Ein teurer Eintrag darf keine Daten anfordern — sonst würde die
      // Fläche für eine Antwort laden, die sie gar nicht berechnet.
      expect(entry.needs).toEqual([]);
    }
  });

  it('sollte fehlende Pflicht-Slots benennen, statt zu raten', () => {
    const eintrag = questionCatalog.byId('ausgaben.haendler');
    expect(eintrag).toBeDefined();
    expect(fehlendeSlots(eintrag!, {})).toEqual(['haendler']);
    expect(fehlendeSlots(eintrag!, { haendler: 'lidl' })).toEqual([]);
  });

  it('sollte nur die Bedürfnisse der gefragten Einträge nennen', () => {
    expect(questionCatalog.needsFor(['schulden.restschuld'])).toEqual(['debts']);
    expect(questionCatalog.needsFor(['leistbarkeit.anschaffung'])).toEqual([]);
  });
});

/**
 * DIE tragende Invariante des Registers.
 *
 * Ohne sie driften genannte Zahl und verlinkte Liste auseinander, und der Chat
 * wird zur Quelle falscher Auskunft mit belastbar wirkendem Beleg — das
 * schlimmste denkbare Ergebnis dieses Pakets.
 */
describe('Abfrage-Register: Zahl und Deep-Link zeigen dieselbe Menge', () => {
  // Die harte Zusicherung gilt für Einträge, die ihren Link als QUELLE
  // ausweisen. `kontext` ist kein Schlupfloch, sondern eine echte
  // Unterscheidung — siehe `deepLinkArt` in `question-registry.ts`.
  const mitQuellLink = () =>
    questionCatalog.entries.filter((entry) => entry.antwort(alleSlots, daten).deepLinkArt === 'quelle');

  it('sollte mindestens einen Eintrag mit Quell-Deep-Link haben', () => {
    expect(mitQuellLink().length).toBeGreaterThan(0);
  });

  it('sollte die Zusicherung an einer NICHT-leeren Menge prüfen', () => {
    // Ohne diesen Test könnte die Invariante trivial durchgehen: Liefert ein
    // Eintrag 0 Buchungen und der Link ebenfalls 0, stimmen beide Seiten
    // überein, ohne dass irgendetwas geprüft wurde. Genau das ist hier
    // einmal passiert, als `filterAusSlots` noch Slots anwandte, die der
    // Eintrag gar nicht deklariert hatte.
    const nichtLeer = mitQuellLink().filter((e) => e.antwort(alleSlots, daten).anzahl > 0);
    expect(nichtLeer.length).toBeGreaterThan(0);
  });

  it('sollte jeden Quell-Link auf die gefilterte Buchungsliste zeigen lassen', () => {
    // Ein Quell-Link, der keinen Filterzustand trägt, könnte die Zusicherung
    // gar nicht einlösen — er zeigte immer die ganze Liste.
    for (const entry of mitQuellLink()) {
      expect(entry.antwort(alleSlots, daten).deepLink, entry.id).toMatch(/^\/transactions\?/);
    }
  });

  it('sollte für jeden Quell-Deep-Link dieselbe Anzahl und Summe ergeben wie die Antwort', () => {
    for (const entry of mitQuellLink()) {
      const antwort = entry.antwort(alleSlots, daten);
      const params = new URLSearchParams(antwort.deepLink.split('?')[1]);
      const ausLink = filterTransactions(
        transactions,
        categories,
        accounts,
        decodeDashboardFilters(params),
        JETZT,
      );

      expect(ausLink.length, `${entry.id}: Anzahl`).toBe(antwort.anzahl);

      if (antwort.art === 'geld' && antwort.wert !== null) {
        const summe = antwort.wert >= 0 && sumIncome(ausLink) === antwort.wert
          ? sumIncome(ausLink)
          : sumExpenses(ausLink);
        expect(summe, `${entry.id}: Summe`).toBeCloseTo(antwort.wert, 2);
      }
    }
  });

  it('sollte auch für rollende Spannen dieselbe Menge liefern', () => {
    // „letzte 30 Tage" darf im Deep-Link nicht still auf „Gesamt" zurückfallen
    // — die Antwort nennte sonst eine Summe über den ganzen Bestand.
    const slots: QuestionSlots = {
      ...alleSlots,
      zeitraum: { von: '2026-06-20', bis: '2026-07-20', rangeToken: '30d', label: '30' },
    };
    const antwort = questionCatalog.byId('ausgaben.haendler')!.antwort(slots, daten);
    const params = new URLSearchParams(antwort.deepLink.split('?')[1]);

    expect(params.get('range')).toBe('30d');
    const ausLink = filterTransactions(transactions, categories, accounts, decodeDashboardFilters(params), JETZT);
    expect(ausLink.length).toBe(antwort.anzahl);
    // Nur die Juli-Lidl-Buchungen, nicht die vom 11. Juni.
    expect(ausLink.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('[REGRESSION] sollte den Notiz-Treffer weder zählen noch verlinken', () => {
    // `t6` nennt „Lidl" in der Notiz. Die Antwort zählt ihn nicht — und der
    // Deep-Link darf ihn ebenfalls nicht zeigen, sonst stimmt die Summe der
    // verlinkten Liste nicht mit der genannten Zahl überein.
    const antwort = questionCatalog.byId('ausgaben.haendler')!.antwort(alleSlots, daten);
    const params = new URLSearchParams(antwort.deepLink.split('?')[1]);
    const ausLink = filterTransactions(transactions, categories, accounts, decodeDashboardFilters(params), JETZT);

    expect(ausLink.map((t) => t.id)).not.toContain('t6');
    expect(antwort.anzahl).toBe(ausLink.length);
  });
});
