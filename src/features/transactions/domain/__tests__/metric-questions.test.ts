import { describe, expect, it } from 'vitest';
import { metricQuestions } from '../metric-questions';
import type { QuestionData, QuestionEntry, QuestionSlots } from '@/lib/question-registry';
import { istKategorieAktion } from '@/lib/question-registry';
import type { Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { SUPPORTED_LOCALES, translations } from '@/i18n/translations';
import type { CategorizationSource } from '@/lib/categorization';

/** Punktpfad in einem Sprachbaum auflösen. */
function blatt(baum: unknown, pfad: string): unknown {
  return pfad.split('.').reduce<unknown>((k, teil) => (k as Record<string, unknown>)?.[teil], baum);
}

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

/**
 * Welle 3: letzte Buchung und Einkommensarten.
 */
function mit(transactions: Transaction[]): QuestionData {
  return { ...daten, transactions };
}

describe('abbuchung.letzte', () => {
  const e = eintrag('abbuchung.letzte');

  it('sollte die JÜNGSTE Buchung nennen, nicht irgendeine', () => {
    const antwort = e.antwort(
      { haendler: 'rewe' },
      mit([
        tx('2026-07-02', -30, 'REWE'),
        tx('2026-08-11', -55, 'REWE'),
        tx('2026-06-01', -20, 'REWE'),
      ]),
    );
    expect(antwort.art).toBe('datum');
    expect(antwort.aussage.params.datum).toBe('2026-08-11');
    expect(antwort.wert).toBe(55);
  });

  it('sollte den Link als KONTEXT ausweisen, nicht als Quelle', () => {
    // Der Link zeigt alle Buchungen des Händlers, die Zahl stammt aus genau
    // einer. Diese Entfernung zu benennen ist ehrlicher, als die Zahl passend
    // zu biegen — der Katalog-Test hat das eingefordert (Anzahl 3 gegen 1).
    const antwort = e.antwort({ haendler: 'rewe' }, mit([tx('2026-07-02', -30, 'REWE')]));
    expect(antwort.deepLinkArt).toBe('kontext');
  });

  it('sollte ohne Treffer „keine Buchung" sagen statt ein Datum zu erfinden', () => {
    const antwort = e.antwort({ haendler: 'gibtsnicht' }, mit([tx('2026-07-02', -30, 'REWE')]));
    expect(antwort.art).toBe('keine');
  });
});

describe('einkommen.arten', () => {
  const e = eintrag('einkommen.arten');

  it('sollte Eingänge nach Kategorie aufschlüsseln und Ausgaben auslassen', () => {
    const antwort = e.antwort(
      {},
      mit([
        tx('2026-07-01', 2000, 'Muster GmbH', 'c-lebensmittel'),
        tx('2026-07-05', 300, 'Kunde', 'c-freizeit'),
        tx('2026-07-06', -50, 'REWE', 'c-lebensmittel'),
      ]),
    );
    expect(antwort.art).toBe('liste');
    expect(antwort.wert).toBe(2300);
    expect(antwort.posten?.map((p) => p.betrag)).toEqual([2000, 300]);
  });

  it('[REGRESSION] sollte unkategorisierte Eingänge als eigene Zeile führen, nicht verschlucken', () => {
    // Eine Liste, die sich nicht auf die Gesamtsumme addiert, ist eine
    // Behauptung über das Fehlende.
    const antwort = e.antwort(
      {},
      mit([tx('2026-07-01', 2000, 'Muster GmbH', 'c-lebensmittel'), tx('2026-07-09', 120, 'Unbekannt')]),
    );
    const summe = (antwort.posten ?? []).reduce((s, p) => s + p.betrag, 0);
    expect(summe).toBe(antwort.wert);
    expect(antwort.posten?.some((p) => p.labelKey === 'financeQuestions.ohneKategorie')).toBe(true);
  });
});

describe('kategorie.begruendung', () => {
  const e = eintrag('kategorie.begruendung');

  it('sollte die Kategorie samt QUELLE der Zuordnung nennen', () => {
    const antwort = e.antwort(
      { haendler: 'rewe' },
      { ...mit([tx('2026-07-02', -30, 'REWE', 'c-lebensmittel')]), merchantRules: [] },
    );
    expect(antwort.begruendung?.[0]?.key).toMatch(/^financeQuestions\.quelle\./);
  });

  it('sollte eine SELBST gelernte Regel als solche ausweisen', () => {
    // Der Kern der Erklärbarkeit: Eine ausdrückliche Nutzerentscheidung ist
    // eine andere Auskunft als ein geratenes Stichwort.
    const antwort = e.antwort(
      { haendler: 'rewe' },
      {
        ...mit([tx('2026-07-02', -30, 'REWE')]),
        merchantRules: [
          { id: 'r1', user_id: 'local', merchant_pattern: 'rewe', category_id: 'c-lebensmittel' },
        ],
      },
    );
    expect(antwort.begruendung?.[0]?.key).toBe('financeQuestions.quelle.merchant_rule');
  });

  it('sollte für JEDE Quelle einen Text in ALLEN Sprachen haben', () => {
    // `financeQuestions.quelle.<source>` wird im Eintrag GEBAUT — weder die
    // Aufrufstellen-Prüfung noch der Katalog-Test sehen alle fünf Werte.
    // Dieselbe Ausleuchtung wie bei `labelKey` in Welle 2: Ein fehlender
    // Zweig stünde sonst roh auf dem Bildschirm.
    const quellen: CategorizationSource[] = [
      'merchant_rule',
      'category_filter',
      'learned_model',
      'regex_fallback',
      'none',
    ];
    for (const quelle of quellen) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(
          typeof blatt(translations[locale], `financeQuestions.quelle.${quelle}`),
          `${locale}: ${quelle}`,
        ).toBe('string');
      }
    }
  });

  it('sollte ohne Buchung nichts behaupten', () => {
    const antwort = e.antwort({ haendler: 'gibtsnicht' }, { ...mit([]), merchantRules: [] });
    expect(antwort.art).toBe('keine');
  });
});

describe('kategorie.aktion', () => {
  const e = eintrag('kategorie.aktion');

  const absicht = { art: 'zuordnen' as const, haendlerText: 'rewe', kategorieText: 'lebensmittel' };

  it('sollte die Vorschau samt Rückweg rechnen, ohne zu schreiben', () => {
    const antwort = e.antwort(
      { haendler: 'rewe', kategorieIds: ['c-lebensmittel'], kategorieAktion: absicht },
      mit([tx('2026-07-02', -30, 'REWE'), tx('2026-07-05', -20, 'REWE', 'c-freizeit')]),
    );
    expect(antwort.art).toBe('aktion');
    expect(antwort.aktion?.art).toBe('zuordnen');
    // Der Schnappschuss entsteht in der VORSCHAU, nicht erst beim Schreiben:
    // Sonst gäbe es einen Moment, in dem geschrieben ist und der Rückweg
    // noch nicht feststeht.
    const vorschau = antwort.aktion;
    expect(vorschau && istKategorieAktion(vorschau) ? vorschau.vorher.map((v) => v.kategorieId) : null)
      .toEqual([null, 'c-freizeit']);
  });

  it('[REGRESSION] sollte bereits richtig zugeordnete Buchungen NICHT mitzählen', () => {
    // „8 Buchungen ändern", wenn nur 3 sich ändern, ist eine falsche
    // Ankündigung — und die Ankündigung ist hier das Versprechen, auf das
    // jemand klickt.
    const antwort = e.antwort(
      { haendler: 'rewe', kategorieIds: ['c-lebensmittel'], kategorieAktion: absicht },
      mit([
        tx('2026-07-02', -30, 'REWE', 'c-lebensmittel'),
        tx('2026-07-05', -20, 'REWE', 'c-freizeit'),
      ]),
    );
    expect(antwort.anzahl).toBe(1);
  });

  it('sollte „merken" als andere Aktionsart durchreichen', () => {
    const antwort = e.antwort(
      {
        haendler: 'rewe',
        kategorieIds: ['c-lebensmittel'],
        kategorieAktion: { ...absicht, art: 'merken' },
      },
      mit([tx('2026-07-02', -30, 'REWE')]),
    );
    expect(antwort.aktion?.art).toBe('merken');
  });

  it('sollte ohne erkannte Kategorie NICHTS vorschlagen', () => {
    // Raten wäre hier besonders teuer: Eine falsch zugeordnete Kategorie
    // verfälscht jede spätere Summe.
    const antwort = e.antwort(
      { haendler: 'rewe', kategorieAktion: absicht },
      mit([tx('2026-07-02', -30, 'REWE')]),
    );
    expect(antwort.art).toBe('keine');
  });

  it('sollte interne Überträge nicht umtragen', () => {
    const antwort = e.antwort(
      { haendler: 'rewe', kategorieIds: ['c-lebensmittel'], kategorieAktion: absicht },
      mit([tx('2026-07-02', -900, 'REWE')].map((t) => ({ ...t, is_transfer: true }))),
    );
    expect(antwort.anzahl).toBe(0);
  });
});
