/**
 * Rücklage für Rechnungen, die NICHT monatlich kommen (Welle 4).
 *
 * Der Auftrag (#333, Punkt 4) verlangte dafür ein neues Datenmodell — „echte
 * Sparziele" statt der fest verdrahteten Meilensteine. Nachgemessen braucht
 * die FRAGE das nicht: „Wie viel muss ich monatlich zurücklegen, damit die
 * Jahresrechnungen mich nicht überraschen?" ist aus dem Bestand rechenbar.
 * Die Vertragsableitung erkennt Zyklen längst (`Vierteljährlich`,
 * `Halbjährlich`, `Jährlich`), und `yearlyEquivalent` rechnet sie um.
 *
 * Das ist Ebene 1 der Regel „Rechnen, schließen, prüfen" (AGENTS.md §3): Eine
 * Aufgabe wandert nur dann eine Ebene höher — und erst recht nur dann in ein
 * neues Datenmodell —, wenn die darunter sie nachweislich nicht löst. Ein
 * eigenes Sparziel bleibt sinnvoll für Vorhaben, die in KEINER Buchung
 * stehen (ein geplanter Umzug); dafür gibt es `SinkingFund` bereits samt
 * Schreibpfad.
 *
 * Rein und ohne I/O — die Vertragszeilen kommen von aussen herein.
 */

import type { ContractRow } from '@/lib/contract-types';
import { isActiveForTotals, yearlyEquivalent } from '@/lib/contract-derivation';

/** Eine Rechnung, die seltener als monatlich kommt. */
export interface UnregelmaessigePosten {
  /** Anzeigename — Nutzerdatum. */
  name: string;
  /** Typischer Betrag JE FÄLLIGKEIT, nicht pro Monat. */
  betrag: number;
  /** Wie oft im Jahr die Rechnung kommt (1 = jährlich, 4 = vierteljährlich). */
  proJahr: number;
  /** Nächste Fälligkeit, falls die Ableitung sie kennt. */
  naechsteISO: string | null;
  /** Anteil dieser Rechnung an der monatlichen Rücklage. */
  monatlich: number;
}

export interface JahresRuecklage {
  /** Was monatlich zurückzulegen ist, damit alle Posten gedeckt sind. */
  monatlich: number;
  /** Summe aller Posten über ein Jahr. */
  proJahr: number;
  /** Die Posten, absteigend nach Jahreslast. */
  posten: UnregelmaessigePosten[];
}

/**
 * Wie oft im Jahr ein Zyklus fällig wird. Monatlich und Wöchentlich zählen
 * NICHT: Sie sind Teil der laufenden Kosten, und wer sie in die Rücklage
 * zöge, würde dieselbe Zahl zweimal zurücklegen.
 */
function faelligkeitenProJahr(row: ContractRow): number {
  switch (row.cycle) {
    case 'Vierteljährlich':
      return 4;
    case 'Halbjährlich':
      return 2;
    case 'Jährlich':
      return 1;
    default:
      return 0;
  }
}

/**
 * Die monatliche Rücklage aus den erkannten Vertragsserien.
 *
 * Gezählt werden nur AUSGABEN aktiver Serien mit bekanntem Zyklus — dieselbe
 * Schranke wie bei den Fixkosten (`isActiveForTotals`). Eine beendete
 * Versicherung darf keine Rücklage mehr fordern.
 */
export function jahresRuecklage(rows: readonly ContractRow[]): JahresRuecklage {
  const posten: UnregelmaessigePosten[] = [];

  for (const row of rows) {
    if (row.type !== 'Ausgabe' || !isActiveForTotals(row)) continue;
    const proJahr = faelligkeitenProJahr(row);
    if (proJahr === 0) continue;

    const betrag = Math.abs(row.amountRecentTypical ?? row.amountTypical);
    if (betrag <= 0) continue;

    posten.push({
      name: row.payee,
      betrag,
      proJahr,
      naechsteISO: row.nextDateISO,
      // Über `yearlyEquivalent` statt `betrag * proJahr`, damit die Umrechnung
      // an EINER Stelle steht: Wer dort einen Zyklus ergänzt, ändert beide
      // Rechnungen zugleich.
      monatlich: yearlyEquivalent(betrag, row.cycle) / 12,
    });
  }

  posten.sort((a, b) => b.monatlich - a.monatlich);

  const monatlich = posten.reduce((summe, p) => summe + p.monatlich, 0);
  return { monatlich, proJahr: monatlich * 12, posten };
}
