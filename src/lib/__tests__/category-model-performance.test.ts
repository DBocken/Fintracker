import { describe, it, expect } from 'vitest';
import { trainCategoryModel, predictCategory, withClassPrecision } from '@/lib/category-model';
import { makeSyntheticTransactions } from '@/test-utils/synthetic-transactions';
import type { Transaction } from '@/types';

/**
 * Zeitbudget des gelernten Modells.
 *
 * Dieser Test ist die Entscheidungsgrundlage für „Worker ja/nein" (WP-B). Das
 * Modell wird bewusst NICHT im Web-Worker trainiert: Ein Worker verwandelt
 * eine synchrone reine Funktion in einen asynchronen Kanal und erzwingt damit
 * eine zweite, asynchrone Kategorisierungs-Rangfolge neben der bestehenden.
 * Gerechtfertigt wäre das nur, wenn das Training teuer wäre.
 *
 * Reißt dieses Budget, ist der Worker die dokumentierte Ausweichroute — und
 * dann steht hier die Messung, die das begründet, statt einer Vermutung.
 */
const TRAINING_BUDGET_MS = 150;

/** 5000 Buchungen ist die Perf-Messgröße des Repos (docs/performance.md). */
const BUCHUNGEN = 5000;

function bestaetigt(transactions: Transaction[]): Transaction[] {
  const kategorien = ['local-cat-lebensmittel', 'local-cat-freizeit', 'local-cat-strom', 'local-cat-tanken'];
  return transactions.map((t, i) => ({
    ...t,
    confirmed: true,
    category_id: kategorien[i % kategorien.length],
  }));
}

describe('Zeitbudget des gelernten Modells', () => {
  it('sollte 5000 bestätigte Buchungen deutlich unter dem Worker-Budget trainieren', () => {
    const buchungen = bestaetigt(makeSyntheticTransactions(BUCHUNGEN));

    const start = performance.now();
    const model = trainCategoryModel(buchungen);
    const dauer = performance.now() - start;

    expect(model.klassen.length).toBeGreaterThan(0);
    expect(dauer).toBeLessThan(TRAINING_BUDGET_MS);
  });

  it('sollte eine Einzelvorhersage im Sub-Millisekunden-Bereich liefern', () => {
    // Die Vorhersage läuft in der Import-Schleife pro Buchung — hier zählt
    // nicht das Budget des Trainings, sondern dass sie nicht selbst zum
    // Flaschenhals wird.
    const buchungen = bestaetigt(makeSyntheticTransactions(BUCHUNGEN));
    const roh = trainCategoryModel(buchungen);
    const model = withClassPrecision(roh, new Map(roh.klassen.map((k) => [k, 0.95])));

    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) predictCategory(model, buchungen[i]);
    const proVorhersage = (performance.now() - start) / 1000;

    expect(proVorhersage).toBeLessThan(1);
  });
});
