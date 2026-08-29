/**
 * Router-Stufe 3: `erweitereUmSemantik` — die Grenzen der Stufe, nicht ihre
 * Qualität (die misst `semantic-ratchet.test.ts` über die Fixture).
 */
import { describe, expect, it } from 'vitest';
import { erweitereUmSemantik, type QuestionVocabulary } from '@/features/money-questions/domain/question-matcher';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';

const VOK: QuestionVocabulary = {
  kategorien: [],
  konten: [],
  haendler: [{ wort: 'netflix', wert: 'netflix' }],
  ausloeser: new Map(),
  verstaerker: new Map(),
};
const JETZT = new Date('2026-08-23T12:00:00Z');
const ENTRIES = questionCatalog.entries;

const stufe3 = (
  bisher: Parameters<typeof erweitereUmSemantik>[0],
  text: string,
  vorschlaege: { klasse: string; score: number }[],
) => erweitereUmSemantik(bisher, text, VOK, ENTRIES, 'de', JETZT, vorschlaege);

describe('Router-Stufe 3 (erweitereUmSemantik)', () => {
  it('sollte aus „unverstanden" eine Auswahl mit nurVermutung machen', () => {
    const r = stufe3({ art: 'unverstanden' }, 'wie viel geht für netflix drauf', [
      { klasse: 'ausgaben.haendler', score: 0.9 },
      { klasse: 'ausgaben.gesamt', score: 0.88 },
    ]);
    expect(r.art).toBe('kandidaten');
    if (r.art !== 'kandidaten') return;
    expect(r.nurVermutung).toBe(true);
    expect(r.top.map((k) => k.entryId)).toEqual(['ausgaben.haendler', 'ausgaben.gesamt']);
    // Slot-Extraktion läuft wie überall deterministisch mit:
    expect(r.top[0].slots.haendler).toBe('netflix');
  });

  it('sollte ein getragenes Ergebnis NIE anfassen', () => {
    const getragen = {
      art: 'aufloesen' as const,
      kandidat: { entryId: 'ausgaben.gesamt', score: 5, slots: {}, fehlend: [], erschlossen: [] },
    };
    expect(stufe3(getragen, 'egal', [{ klasse: 'konto.gesamt', score: 0.99 }])).toBe(getragen);

    const auswahl = { art: 'kandidaten' as const, top: [getragen.kandidat] };
    expect(stufe3(auswahl, 'egal', [{ klasse: 'konto.gesamt', score: 0.99 }])).toBe(auswahl);
  });

  it('sollte die Stufe-2-Vermutung vorn behalten und nur ERGÄNZEN', () => {
    const vermutung = {
      art: 'kandidaten' as const,
      top: [{ entryId: 'ausgaben.gesamt', score: 0, slots: {}, fehlend: [], erschlossen: [] }],
      nurVermutung: true,
    };
    const r = stufe3(vermutung, 'irgendwas mit geld', [
      { klasse: 'ausgaben.gesamt', score: 0.95 }, // Dublette — darf nicht doppelt
      { klasse: 'konto.gesamt', score: 0.9 },
    ]);
    expect(r.art).toBe('kandidaten');
    if (r.art !== 'kandidaten') return;
    expect(r.top.map((k) => k.entryId)).toEqual(['ausgaben.gesamt', 'konto.gesamt']);
  });

  it('[SECURITY] sollte Aktions-Einträge verwerfen, selbst wenn sie vorgeschlagen werden', () => {
    const r = stufe3({ art: 'unverstanden' }, 'leg das budget an', [
      { klasse: 'budget.aktion', score: 0.99 },
    ]);
    expect(r.art).toBe('unverstanden');
  });

  it('sollte das Szenario-Gate durchsetzen: hypothetische Frage erreicht nur Szenario-Einträge', () => {
    const r = stufe3({ art: 'unverstanden' }, 'was wäre wenn ich 200 weniger ausgebe', [
      { klasse: 'ausgaben.haendler', score: 0.95 },
    ]);
    // ausgaben.haendler beantwortet keine Szenarien — die Stufe bleibt stumm.
    expect(r.art).toBe('unverstanden');
  });

  it('sollte bei leeren Vorschlägen unverändert zurückgeben', () => {
    const u = { art: 'unverstanden' as const };
    expect(stufe3(u, 'kauderwelsch', [])).toBe(u);
  });
});
