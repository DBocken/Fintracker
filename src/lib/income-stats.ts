/**
 * Einkommens-Statistik aus den eigenen Buchungen — reine Funktionen, kein I/O.
 */
import type { Transaction } from '@/types';

/**
 * Durchschnittliches Monatseinkommen über die letzten `monate` VOLLEN
 * Kalendermonate vor `jetzt`.
 *
 * Der laufende Monat zählt bewusst nicht mit: Er ist unvollständig, und ihn
 * einzurechnen drückte den Schnitt systematisch nach unten — am 3. eines
 * Monats sähe jedes Einkommen „eingebrochen" aus.
 *
 * `null` heisst „keine Einnahmen erfasst" — eine ANDERE Aussage als „0 €
 * Einkommen", und die Aufrufstelle muss beide unterscheiden können.
 */
export function durchschnittlichesMonatsEinkommen(
  transactions: readonly Transaction[],
  jetzt: Date,
  monate = 3,
): number | null {
  const erster = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth() - monate, 1));
  const ende = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), 1));
  const von = erster.toISOString().slice(0, 10);
  const bis = ende.toISOString().slice(0, 10);

  let summe = 0;
  let gefunden = false;
  for (const t of transactions) {
    if (t.is_transfer || t.amount <= 0) continue;
    if (t.date < von || t.date >= bis) continue;
    summe += t.amount;
    gefunden = true;
  }
  return gefunden ? summe / monate : null;
}

/**
 * Einnahmen-Summen je vollem Kalendermonat, ältester zuerst. Monate ohne
 * Einnahme stehen als 0 drin — eine Lücke IST eine Schwankung.
 */
export function monatlicheEinnahmen(
  transactions: readonly Transaction[],
  jetzt: Date,
  monate = 6,
): number[] {
  const summen: number[] = [];
  for (let i = monate; i >= 1; i--) {
    const von = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth() - i, 1));
    const bis = new Date(Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth() - i + 1, 1));
    const vonIso = von.toISOString().slice(0, 10);
    const bisIso = bis.toISOString().slice(0, 10);
    let summe = 0;
    for (const t of transactions) {
      if (t.is_transfer || t.amount <= 0) continue;
      if (t.date < vonIso || t.date >= bisIso) continue;
      summe += t.amount;
    }
    summen.push(summe);
  }
  return summen;
}

export interface EinkommensSchwankung {
  /** Mittelwert der Monatssummen. */
  mittel: number;
  /** Standardabweichung — „± so viel schwankt es". */
  abweichung: number;
  monate: number;
}

/**
 * Wie stark schwankt das Monatseinkommen? `null`, solange es keine zwei
 * vollen Monate mit irgendeiner Einnahme gibt — aus einem Punkt lässt sich
 * keine Streuung behaupten.
 */
export function einkommensSchwankung(
  transactions: readonly Transaction[],
  jetzt: Date,
  monate = 6,
): EinkommensSchwankung | null {
  const summen = monatlicheEinnahmen(transactions, jetzt, monate).filter((s) => s > 0);
  if (summen.length < 2) return null;
  const mittel = summen.reduce((a, b) => a + b, 0) / summen.length;
  const varianz = summen.reduce((a, b) => a + (b - mittel) ** 2, 0) / summen.length;
  return { mittel, abweichung: Math.sqrt(varianz), monate: summen.length };
}
