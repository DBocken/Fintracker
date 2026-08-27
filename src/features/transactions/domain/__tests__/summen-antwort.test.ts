/**
 * Was eine Summen-Antwort OHNE genannten Zeitraum aussagen muss.
 *
 * Browser-Fund vom 27.08.: „Wie viel gebe ich für Netflix aus?" nannte — wenn
 * sie überhaupt verstanden wurde — eine nackte Gesamtsumme. Zwei Dinge
 * fehlten, und beide sind keine Zierde:
 *
 * 1. **Der Zeitraum.** Eine Summe ohne Spanne ist eine stille Behauptung:
 *    „248 €" heisst über drei Monate etwas anderes als über drei Jahre. Der
 *    Satz hatte für den Zeitraum sogar einen Platzhalter — der war leer, und
 *    auf dem Bildschirm stand „Bei Netflix, ."
 * 2. **Die monatliche Belastung.** Danach wird gefragt, wenn jemand „gebe
 *    ich" im Präsens sagt: nicht was seit Anbeginn zusammengekommen ist,
 *    sondern was das Monat für Monat kostet.
 *
 * Der Nenner ist dabei der BESTAND, nicht die Spanne der Treffer — sonst
 * bekommt ein Händler, bei dem jemand zweimal war, einen Zwei-Monats-Schnitt
 * und damit eine systematisch zu hohe Zahl (`monatsDurchschnitt`).
 */
import { describe, expect, it } from 'vitest';
import { questions } from '../questions';
import type { QuestionData, QuestionSlots } from '@/lib/question-registry';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { SUPPORTED_LOCALES, translations } from '@/i18n/translations';

let seq = 0;
function tx(date: string, amount: number, payee: string): Transaction {
  seq += 1;
  return {
    id: asTransactionId(`sa-${seq}`),
    date,
    amount,
    payee,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
  } as Transaction;
}

/** Netflix jeden Monat, dazu fremde Buchungen, die den Bestand aufspannen. */
const transactions: Transaction[] = [
  tx('2026-01-05', -12.99, 'Netflix'),
  tx('2026-02-05', -12.99, 'Netflix'),
  tx('2026-03-05', -12.99, 'Netflix'),
  tx('2026-04-05', -12.99, 'Netflix'),
  tx('2026-01-02', -40, 'Rewe'),
  tx('2026-04-28', -40, 'Rewe'),
];

const daten: QuestionData = {
  transactions,
  categories: [],
  accounts: [],
  jetzt: new Date('2026-04-30T12:00:00Z'),
} as unknown as QuestionData;

const haendlerEintrag = questions.find((e) => e.id === 'ausgaben.haendler')!;

function antwortFuer(slots: QuestionSlots) {
  return haendlerEintrag.antwort(slots, daten);
}

function blatt(baum: unknown, pfad: string): unknown {
  return pfad.split('.').reduce<unknown>((k, teil) => (k as Record<string, unknown>)?.[teil], baum);
}

describe('Summen-Antwort ohne genannten Zeitraum', () => {
  it('sollte die Gesamtsumme des Händlers nennen', () => {
    expect(antwortFuer({ haendler: 'Netflix' }).wert).toBeCloseTo(51.96, 2);
  });

  it('sollte den Zeitraum BENENNEN statt eine leere Stelle im Satz zu lassen', () => {
    // `all` ist die Kennung des Gesamtzeitraums; die Präsentation macht
    // daraus Sprache. Ein leerer String liesse „Bei Netflix, ." stehen.
    expect(antwortFuer({ haendler: 'Netflix' }).aussage.params.zeitraum).toBe('all');
  });

  it('sollte die monatliche Belastung über den BESTAND rechnen', () => {
    const begruendung = antwortFuer({ haendler: 'Netflix' }).begruendung ?? [];
    const proMonat = begruendung.find((g) => 'monatlich' in g.params);
    // Bestand Januar–April = 4 Monate, 51,96 € / 4 = 12,99 €.
    expect(proMonat?.params.monatlich).toBeCloseTo(12.99, 2);
  });

  it('sollte die abgedeckte Spanne des Datenbestands benennen', () => {
    const begruendung = antwortFuer({ haendler: 'Netflix' }).begruendung ?? [];
    const spanne = begruendung.find((g) => 'monate' in g.params);
    expect(spanne?.params.monate).toBe(4);
    expect(spanne?.params.vonMonat).toBe('2026-01');
    expect(spanne?.params.bisMonat).toBe('2026-04');
  });

  it('sollte bei GENANNTEM Zeitraum keine Bestands-Begründung anhängen', () => {
    // Wer „im März" fragt, hat den Nenner selbst gesetzt; ein zweiter,
    // anders gerechneter Monatswert daneben wäre Widerspruch, nicht Beleg.
    const mitZeitraum = antwortFuer({
      haendler: 'Netflix',
      zeitraum: { von: '2026-03-01', bis: '2026-03-31', label: 'März' },
    } as unknown as QuestionSlots);
    expect(mitZeitraum.begruendung ?? []).toEqual([]);
    expect(mitZeitraum.aussage.params.zeitraum).toBe('März');
  });

  it('sollte ohne Treffer KEINE monatliche Belastung behaupten', () => {
    // „0 € im Monat" und „dazu liegt mir nichts vor" sind verschiedene
    // Aussagen — dieselbe Trennung wie Leer- gegen Fehlerzustand.
    expect(antwortFuer({ haendler: 'Spotify' }).begruendung ?? []).toEqual([]);
  });

  it('sollte die Begründungs-Schlüssel in ALLEN Sprachen führen', () => {
    const keys = (antwortFuer({ haendler: 'Netflix' }).begruendung ?? []).map((g) => g.key);
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        expect(blatt(translations[locale], key), `${locale}: ${key}`).toBeTypeOf('string');
      }
    }
  });
});
