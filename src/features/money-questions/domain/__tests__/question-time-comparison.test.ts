import { describe, expect, it } from 'vitest';
import {
  erkenneVergleichsBezug,
  parseZeitraum,
  referenzZeitraum,
} from '@/features/money-questions/domain/question-time-expressions';

const JETZT = new Date('2026-08-24T12:00:00Z');

function zeitraum(text: string) {
  const treffer = parseZeitraum(text, 'de', JETZT);
  if (!treffer) throw new Error(`Kein Zeitraum in „${text}"`);
  return treffer.slot;
}

describe('erkenneVergleichsBezug', () => {
  it('sollte den Vorjahresbezug erkennen', () => {
    expect(erkenneVergleichsBezug('Sind meine Ausgaben höher als im Vorjahr?', 'de')).toBe('vorjahr');
    expect(erkenneVergleichsBezug('mehr als letztes Jahr', 'de')).toBe('vorjahr');
    expect(erkenneVergleichsBezug('Ist Tanken teurer geworden?', 'de')).toBe('vorjahr');
    expect(erkenneVergleichsBezug('higher than last year', 'en')).toBe('vorjahr');
    expect(erkenneVergleichsBezug('больше, чем в прошлым годом', 'ru')).toBe('vorjahr');
  });

  it('sollte den Vormonatsbezug erkennen', () => {
    expect(erkenneVergleichsBezug('teurer als im Vormonat', 'de')).toBe('vorperiode');
    expect(erkenneVergleichsBezug('compared to the previous month', 'en')).toBe('vorperiode');
  });

  it('sollte ohne Vergleichswort null liefern', () => {
    expect(erkenneVergleichsBezug('Wie viel habe ich im Juli ausgegeben?', 'de')).toBeNull();
  });

  it('[REGRESSION] sollte einen blossen Zeitraum NICHT für einen Vergleich halten', () => {
    // Gemessen an der Router-Ratsche: „letzten Monat" nennt den Zeitraum,
    // nicht eine Referenz. Ohne diese Enge wurde „Wie viel habe ich letzten
    // Monat insgesamt ausgegeben?" zur Gegenüberstellung — und die
    // Gesamtsummen-Frage blieb unbeantwortet.
    expect(erkenneVergleichsBezug('Wie viel habe ich letzten Monat ausgegeben?', 'de')).toBeNull();
    expect(erkenneVergleichsBezug('Wofür habe ich letztes Jahr am meisten gezahlt?', 'de')).toBeNull();
    expect(erkenneVergleichsBezug('meine Ausgaben im Vormonat', 'de')).toBeNull();
    expect(erkenneVergleichsBezug('how much did i spend last year', 'en')).toBeNull();
  });
});

describe('referenzZeitraum', () => {
  it('sollte beim Monat den GLEICHEN Monat im Vorjahr liefern', () => {
    // Der Kern der Unterscheidung: Juli gegen Juli, nicht Juli gegen Juni.
    const juli = zeitraum('im Juli 2026');
    const referenz = referenzZeitraum(juli, 'vorjahr', 'de');
    expect(referenz).toMatchObject({ rangeToken: '2025-07', von: '2025-07-01', bis: '2025-07-31' });
  });

  it('sollte beim Monat für die Vorperiode den Vormonat liefern', () => {
    const juli = zeitraum('im Juli 2026');
    expect(referenzZeitraum(juli, 'vorperiode', 'de')).toMatchObject({ rangeToken: '2026-06' });
  });

  it('sollte über den Jahreswechsel zurückzählen', () => {
    const januar = zeitraum('im Januar 2026');
    expect(referenzZeitraum(januar, 'vorperiode', 'de')).toMatchObject({ rangeToken: '2025-12' });
  });

  it('sollte beim Jahr das Vorjahr liefern — für beide Bezüge dasselbe', () => {
    const jahr = zeitraum('2026');
    expect(referenzZeitraum(jahr, 'vorjahr', 'de')).toMatchObject({ rangeToken: '2025' });
    expect(referenzZeitraum(jahr, 'vorperiode', 'de')).toMatchObject({ rangeToken: '2025' });
  });

  it('sollte beim Quartal richtig zurückspringen', () => {
    const q3 = zeitraum('q3 2026');
    expect(referenzZeitraum(q3, 'vorperiode', 'de')).toMatchObject({ rangeToken: '2026-Q2' });
    expect(referenzZeitraum(q3, 'vorjahr', 'de')).toMatchObject({ rangeToken: '2025-Q3' });
    const q1 = zeitraum('q1 2026');
    expect(referenzZeitraum(q1, 'vorperiode', 'de')).toMatchObject({ rangeToken: '2025-Q4' });
  });

  it('sollte für gleitende Tages-Zeiträume KEINE Vorperiode erfinden', () => {
    // Zu „den letzten 30 Tagen" gibt es keine Vorperiode, die ein Nutzer
    // meint — eine erfundene wäre eine falsche Bezugsgröße.
    const tage = zeitraum('letzten 30 tage');
    expect(referenzZeitraum(tage, 'vorperiode', 'de')).toBeNull();
  });

  it('sollte für „gesamt" keine Vorperiode liefern', () => {
    const gesamt = zeitraum('insgesamt');
    expect(referenzZeitraum(gesamt, 'vorjahr', 'de')).toBeNull();
  });
});
