import { describe, expect, it } from 'vitest';
import { createCategorizer } from '@/lib/categorization';
import { asTransactionId } from '@/lib/ids';
import type { Category, Transaction } from '@/types';

/**
 * Laufzeit-Gegenprobe zum Wächter in `categorizer.test.ts`. Die STRUKTURELLE
 * Aussage („der Index wird einmal gebaut, nicht je Buchung") steht dort und
 * ist ohne Uhr formuliert; hier steht nur noch die Frage, ob der Vollimport in
 * vertretbarer Zeit durchläuft.
 *
 * Bewusst KEIN Vergleich gegen `explainCategorization` mehr: die Einzelfall-
 * Form ruft seit WP „Kategorisierung vorbereiten" denselben Kern auf und
 * profitiert von jeder Verbesserung mit — ein Verhältnis zwischen beiden misst
 * darum nur noch den Index-Aufbau und nicht mehr die Sache selbst.
 *
 * Das Budget ist absichtlich großzügig (gemessen ~270 ms, Schwelle 1500 ms):
 * fremde CI-Hardware ist langsamer, und ein Perf-Test, der bei Rauschen rot
 * wird, wird abgeschaltet statt beachtet. Er fängt die Größenordnung, nicht
 * die Nachkommastelle — die tatsächlich gemessene Zahl steht in der Ausgabe.
 */

const CATEGORIES = 200;
const TRANSACTIONS = 3000;
/** Obergrenze für den ganzen Durchlauf, siehe Kopfkommentar. */
const BUDGET_MS = 1500;

function buildCategories(count: number): Category[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cat-${i}`,
    name: `Kategorie ${i}`,
    // Jede fünfte Kategorie hängt unter einer Einkommens-Hauptkategorie: der
    // Richtungs-Guard muss dafür die Elternkette hochlaufen.
    parent_id: i % 5 === 0 && i > 0 ? 'cat-0' : null,
    filters: [`haendler${i}`, `marke-${i}-gmbh`, `filiale ${i}`],
    attributes: i === 0 ? { ausgabenklasse: 'einkommen' as const } : undefined,
  }));
}

function buildTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: asTransactionId(`tx-${i}`),
    date: '2026-01-15',
    amount: i % 9 === 0 ? 240.5 : -((i % 120) + 1),
    payee: `Haendler${i % 150} Filiale ${i % 40}`,
    description: `Kartenzahlung marke-${i % 180}-gmbh`,
    original_text: `SEPA LASTSCHRIFT HAENDLER${i % 150} // EREF ${i}`,
    auto_mapped: false,
    confirmed: false,
  }));
}

describe('[Performance] Kategorisierung von 3000 Buchungen bei 200 Kategorien', () => {
  it('sollte den Bestand mit einem vorbereiteten Kategorisierer im Budget durchlaufen', () => {
    const categories = buildCategories(CATEGORIES);
    const transactions = buildTransactions(TRANSACTIONS);

    // Aufwärmen, damit nicht die erste JIT-Runde gemessen wird.
    const warmup = createCategorizer(categories);
    for (const transaction of transactions.slice(0, 50)) warmup.explain(transaction);

    const start = performance.now();
    const categorizer = createCategorizer(categories);
    let zugeordnet = 0;
    for (const transaction of transactions) {
      if (categorizer.categorize(transaction)) zugeordnet += 1;
    }
    const durationMs = performance.now() - start;

    // Die gemessene Zahl gehört in die CI-Ausgabe, nicht nur in einen Bericht.
    console.log(
      `[Performance] Kategorisierung: ${TRANSACTIONS} Buchungen x ${CATEGORIES} Kategorien ` +
        `in ${durationMs.toFixed(1)} ms (${zugeordnet} zugeordnet)`,
    );

    // Der Lauf muss auch wirklich gearbeitet haben — ein Kategorisierer, der
    // nichts zuordnet, wäre schnell und wertlos.
    expect(zugeordnet).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(BUDGET_MS);
  });
});
