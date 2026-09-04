/**
 * Die Vorschau muss der PLAN der Aktion sein.
 *
 * Sie rechnete bis hierher in vier Punkten anders als der Knopf daneben, und
 * jeder einzelne machte die Anzeige falsch:
 *
 * 1. `categorize` (jede Konfidenz) gegen `categorizeConfident` (Schwelle 0,7).
 * 2. Bestätigte Buchungen blieben in der Liste, der Lauf überspringt sie.
 * 3. Sie zeigte nur Zugänge; der Lauf ENTZIEHT auch Zuordnungen.
 * 4. Sie war bei 50 gedeckelt und sah wie der Bestand aus.
 *
 * Der Nutzer bestätigte damit eine Menge und bekam eine andere — und die
 * Vorschau ist die einzige Stelle, an der er vorher sieht, was passiert.
 *
 * Geprüft wird gegen den ECHTEN Speicher und die ECHTEN Saat-Kategorien: Der
 * Befund hängt an der wirklichen Kategorisierungs-Kaskade, nicht an einem
 * Doppel davon.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Transaction } from '../../types';
import { asTransactionId } from '@/lib/ids';
import { localEncryption } from '../local-crypto';
import { clearLocalKvStore } from '../idb-kv';
import { saveTransactions, getCategoryPreview } from '../transaction-service';
import { getLocalCategories } from '../local-settings-service';

function buchung(over: Partial<Transaction>): Transaction {
  return {
    id: asTransactionId('tx-1'),
    account_id: 'a1',
    date: '2026-01-10',
    amount: -20,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE SAGT DANKE',
    category_id: null,
    auto_mapped: false,
    confirmed: false,
    ...over,
  } as Transaction;
}

async function kategorieMitFiltern() {
  const alle = await getLocalCategories();
  const mit = alle.find((c) => (c.filters?.length ?? 0) > 0);
  if (!mit) throw new Error('Keine Saat-Kategorie mit Filtern gefunden');
  return mit;
}

/**
 * Welche Kategorie ordnet die ECHTE Kaskade dieser Buchung zu?
 *
 * Bewusst erfragt statt angenommen: Welcher Filter, welches Stichwort und
 * welche Konfidenz am Ende gewinnen, ist Sache der Kaskade — ein Test, der das
 * vorwegnimmt, prueft seine eigene Annahme statt des Verhaltens.
 */
async function zielKategorieFuer(): Promise<{ id: string; anzahl: number }> {
  for (const kat of await getLocalCategories()) {
    const plan = await getCategoryPreview(kat.id, 1000);
    if (plan.anzahlHinzu > 0) return { id: kat.id, anzahl: plan.anzahlHinzu };
  }
  throw new Error('Die Kaskade ordnet der Testbuchung keine Kategorie zu');
}

describe('Vorschau als Plan der Übernahme', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it('sollte für eine unbekannte Kategorie einen leeren Plan liefern, nicht werfen', async () => {
    const plan = await getCategoryPreview('gibt-es-nicht');

    expect(plan).toEqual({ beispiele: [], anzahlHinzu: 0, anzahlEntzug: 0, anzahlGesamt: 0 });
  });

  it('[REGRESSION] sollte bestätigte Buchungen ausnehmen — der Lauf fasst sie nie an', async () => {
    const kat = await kategorieMitFiltern();
    const stichwort = kat.filters![0];

    await saveTransactions([
      buchung({ id: asTransactionId('tx-bestaetigt'), payee: stichwort, confirmed: true, category_id: null }),
    ]);

    const plan = await getCategoryPreview(kat.id);

    expect(plan.beispiele.map((t) => t.id)).not.toContain('tx-bestaetigt');
    expect(plan.anzahlGesamt).toBe(0);
  });

  it('[REGRESSION] sollte die Zahlen vollständig zählen, auch über der Beispielgrenze', async () => {
    // Der Befund: Die Fläche schrieb „und {n} weitere" aus der Länge einer bei
    // 50 abgeschnittenen Liste — also höchstens „und 40 weitere", ob nun 41
    // oder 4.100 Buchungen betroffen waren.
    await saveTransactions(
      Array.from({ length: 12 }, (_, i) =>
        buchung({ id: asTransactionId(`tx-${i}`), payee: 'REWE', description: 'Einkauf', original_text: 'REWE SAGT DANKE' }),
      ),
    );

    const ziel = await zielKategorieFuer();
    expect(ziel.anzahl).toBe(12);

    const gekappt = await getCategoryPreview(ziel.id, 5);

    // Gekappt wird, wie viele Zeilen gezeigt werden — NICHT, was gezählt wird.
    expect(gekappt.beispiele).toHaveLength(5);
    expect(gekappt.anzahlHinzu).toBe(12);
    expect(gekappt.anzahlGesamt).toBe(12);
  });

  it('[REGRESSION] sollte den ENTZUG einer Zuordnung ausweisen', async () => {
    // Der gefährlichste Teil des Laufs kam in der Vorschau gar nicht vor: Eine
    // früher automatisch zugeordnete Buchung, die heute keine 0,7 mehr
    // erreicht, VERLIERT ihre Kategorie.
    const kat = await kategorieMitFiltern();

    await saveTransactions([
      buchung({
        id: asTransactionId('tx-entzug'),
        payee: 'Voellig Unbekannter Empfaenger Ohne Muster',
        description: '',
        original_text: '',
        category_id: kat.id,
        auto_mapped: true,
        confirmed: false,
      }),
    ]);

    const plan = await getCategoryPreview(kat.id);

    expect(plan.anzahlEntzug).toBe(1);
    expect(plan.anzahlGesamt).toBe(1);
  });

  it('sollte eine bereits richtig zugeordnete Buchung nicht mitzählen', async () => {
    // Sie ändert sich nicht, also gehört sie nicht in den Plan. Geprüft über
    // zwei gleichartige Buchungen — eine ohne Kategorie, eine bereits richtig
    // zugeordnet: Gezählt werden darf nur die erste.
    await saveTransactions([
      buchung({ id: asTransactionId('tx-offen'), payee: 'REWE', description: 'Einkauf', original_text: 'REWE SAGT DANKE' }),
    ]);
    const ziel = await zielKategorieFuer();
    expect(ziel.anzahl).toBe(1);

    await saveTransactions([
      buchung({
        id: asTransactionId('tx-schon-richtig'),
        payee: 'REWE',
        description: 'Einkauf',
        original_text: 'REWE SAGT DANKE',
        category_id: ziel.id,
        auto_mapped: true,
      }),
    ]);

    const plan = await getCategoryPreview(ziel.id);

    expect(plan.anzahlHinzu).toBe(1);
    expect(plan.beispiele.map((t) => t.id)).toEqual(['tx-offen']);
  });
});
