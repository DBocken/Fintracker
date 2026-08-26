import { describe, expect, it } from 'vitest';
import { metricQuestions } from '../metric-questions';
import type { QuestionData, QuestionEntry, QuestionSlots } from '@/lib/question-registry';
import type { Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Diese Tests prüfen, was die Registry-Invarianten NICHT prüfen können: dass
 * die gerechneten Werte stimmen. Der Katalog-Test füllt jeden Eintrag mit
 * einem Standard-Slotsatz und schaut auf Form und Deep-Link — dass eine
 * Vergleichs-Antwort ihre REFERENZ auf den zweiten Partner filtert, sieht er
 * nicht.
 *
 * [REGRESSION] Genau das war im Browser der Fund: „Gebe ich mehr bei Rewe
 * oder bei Aldi aus?" zeigte zweimal Rewe mit identischem Betrag, weil der
 * Eintrag ohne Vergleichspartner über die Wortebene hereinkam und seine
 * Referenzmenge die Hauptmenge war.
 */

let seq = 0;
function tx(date: string, amount: number, payee: string, category_id?: string): Transaction {
  seq += 1;
  return {
    id: asTransactionId(`mq-${seq}`),
    date,
    amount,
    payee,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    category_id,
  } as Transaction;
}

const categories: Category[] = [
  { id: 'c-lebensmittel', name: 'Lebensmittel', filters: [] },
  { id: 'c-freizeit', name: 'Freizeit', filters: [] },
] as unknown as Category[];

const daten: QuestionData = {
  transactions: [
    tx('2026-06-05', -100, 'REWE', 'c-lebensmittel'),
    tx('2026-07-05', -200, 'REWE', 'c-lebensmittel'),
    tx('2026-07-12', -60, 'EDEKA', 'c-lebensmittel'),
    tx('2026-08-01', -40, 'Kino', 'c-freizeit'),
  ],
  categories,
  accounts: [],
  jetzt: new Date('2026-08-24T12:00:00Z'),
};

function eintrag(id: string): QuestionEntry {
  const e = metricQuestions.find((x) => x.id === id);
  if (!e) throw new Error(`Kein Eintrag ${id}`);
  return e;
}

describe('Kennzahl-Einträge', () => {
  it('sollte den Monatsdurchschnitt über die KALENDERMONATE verteilen', () => {
    // 300 € bei REWE über Juni–August = drei Monate, obwohl nur zwei
    // Buchungen existieren.
    const antwort = eintrag('ausgaben.durchschnitt').antwort({ haendler: 'rewe' }, daten);
    expect(antwort.art).toBe('geld');
    expect(antwort.wert).toBeCloseTo(100);
  });

  it('sollte den Anteil an den Gesamtausgaben rechnen, nicht an sich selbst', () => {
    const antwort = eintrag('ausgaben.anteil').antwort({ kategorieIds: ['c-freizeit'] }, daten);
    expect(antwort.art).toBe('quote');
    // 40 € von 400 € Gesamtausgaben.
    expect(antwort.wert).toBeCloseTo(0.1);
  });

  it('sollte den Durchschnitt je Vorgang aus Summe und ANZAHL bilden', () => {
    const antwort = eintrag('ausgaben.jeVorgang').antwort({ haendler: 'rewe' }, daten);
    expect(antwort.wert).toBeCloseTo(150);
  });

  it('sollte den teuersten Monat mit seinem Monat nennen', () => {
    const antwort = eintrag('ausgaben.extremwert').antwort({ haendler: 'rewe' }, daten);
    expect(antwort.wert).toBeCloseTo(200);
    expect(antwort.aussage.params.monat).toBe('2026-07');
  });
});

describe('Vergleichs-Einträge', () => {
  it('[REGRESSION] sollte die Referenzmenge auf den PARTNER filtern', () => {
    // Der Browser-Fund: Ohne diese Filterung stand dieselbe Größe zweimal
    // da, und die Differenz war immer null.
    const slots: QuestionSlots = {
      haendler: 'rewe',
      vergleich: { art: 'haendler', haendler: 'edeka' },
    };
    const antwort = eintrag('vergleich.haendler').antwort(slots, daten);

    expect(antwort.art).toBe('vergleich');
    expect(antwort.wert).toBeCloseTo(300);
    expect(antwort.vergleich?.referenz).toBeCloseTo(60);
    expect(antwort.vergleich?.differenz).toBeCloseTo(240);
    expect(antwort.vergleich?.labelWert).toBe('rewe');
    expect(antwort.vergleich?.labelReferenz).toBe('edeka');
  });

  it('sollte zwei Kategorien gegeneinander stellen', () => {
    const antwort = eintrag('vergleich.kategorie').antwort(
      {
        kategorieIds: ['c-lebensmittel'],
        vergleich: { art: 'kategorie', kategorieIds: ['c-freizeit'] },
      },
      daten,
    );
    expect(antwort.wert).toBeCloseTo(360);
    expect(antwort.vergleich?.referenz).toBeCloseTo(40);
    expect(antwort.vergleich?.labelReferenz).toBe('Freizeit');
  });

  it('sollte zwei Zeiträume gegeneinander stellen', () => {
    const juli = { von: '2026-07-01', bis: '2026-07-31', rangeToken: '2026-07', label: 'Juli 2026' };
    const juni = { von: '2026-06-01', bis: '2026-06-30', rangeToken: '2026-06', label: 'Juni 2026' };
    const antwort = eintrag('vergleich.zeitraum').antwort(
      { zeitraum: juli, vergleich: { art: 'zeitraum', zeitraum: juni } },
      daten,
    );
    // Juli: 200 + 60 = 260, Juni: 100.
    expect(antwort.wert).toBeCloseTo(260);
    expect(antwort.vergleich?.referenz).toBeCloseTo(100);
    expect(antwort.vergleich?.quote).toBeCloseTo(1.6);
    expect(antwort.vergleich?.labelWert).toBe('Juli 2026');
    expect(antwort.vergleich?.labelReferenz).toBe('Juni 2026');
  });

  it('sollte ohne Referenzausgaben keine Prozentzahl behaupten', () => {
    const leer = { von: '2020-01-01', bis: '2020-12-31', rangeToken: '2020', label: '2020' };
    const jahr = { von: '2026-01-01', bis: '2026-12-31', rangeToken: '2026', label: '2026' };
    const antwort = eintrag('vergleich.zeitraum').antwort(
      { zeitraum: jahr, vergleich: { art: 'zeitraum', zeitraum: leer } },
      daten,
    );
    expect(antwort.vergleich?.referenz).toBe(0);
    expect(antwort.vergleich?.quote).toBeNull();
  });
});
