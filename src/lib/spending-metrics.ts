/**
 * Rechenarten über einer bereits gefilterten Buchungsmenge (Welle 1).
 *
 * Der Befund, der diese Datei nötig macht: Quer durch die Themen des
 * Auftrags — Lebensmittel, Mobilität, Wohnen, Händler, Kategorien —
 * wiederholen sich dieselben Fragen in anderer Kleidung. „Was kostet mich
 * X im Monat?", „Welchen Anteil macht X aus?", „Was war mein teuerster
 * Monat?" sind KEINE fachlich verschiedenen Auswertungen, sondern
 * verschiedene RECHENARTEN auf derselben Menge.
 *
 * Deshalb liegen sie hier als reine Funktionen über `Transaction[]` und
 * nicht je Thema neu: Die Filterung (welche Buchungen überhaupt) macht
 * `filterTransactions` (`features/shared/domain/dashboard-filtering.ts`),
 * die Summenbildung `sumExpenses` (`lib/analysis-data.ts`). Was hier
 * dazukommt, ist ausschliesslich die Kennzahl darüber.
 *
 * **Alle Beträge positiv** (Ausgabenhöhe, nicht Vorzeichen der Buchung) —
 * wie `sumExpenses` und `topHaendler` es halten. Interne Umbuchungen
 * (`is_transfer`) zählen nie mit: Geld von links nach rechts ist keine
 * Ausgabe.
 */
import type { Transaction } from '@/types';
import { sumExpenses } from './analysis-data';

/** Monat einer Buchung als `yyyy-mm` — die Gruppierungsachse der Zeitreihe. */
function monatVon(transaction: Transaction): string {
  return transaction.date.slice(0, 7);
}

/**
 * Zählt die Monate, über die sich eine Menge erstreckt — KALENDERMONATE
 * zwischen erster und letzter Buchung, nicht die Zahl der Monate MIT
 * Buchungen.
 *
 * Der Unterschied ist die halbe Aussage: Wer in drei von zwölf Monaten
 * tankt, gibt fürs Tanken einen Zwölftel-Durchschnitt aus, keinen
 * Drittel-Durchschnitt. „Was kostet mich das im Monat?" fragt nach der
 * Belastung des Haushalts, nicht nach der Höhe der einzelnen Rechnung.
 */
export function monateImBestand(transactions: readonly Transaction[]): number {
  const monate = transactions.map(monatVon).filter(Boolean).sort();
  if (monate.length === 0) return 0;
  const [erstesJahr, ersterMonat] = monate[0].split('-').map(Number);
  const [letztesJahr, letzterMonat] = monate[monate.length - 1].split('-').map(Number);
  if (!erstesJahr || !ersterMonat || !letztesJahr || !letzterMonat) return 0;
  return (letztesJahr - erstesJahr) * 12 + (letzterMonat - ersterMonat) + 1;
}

/**
 * Durchschnittliche Ausgabe pro Monat.
 *
 * **Der Nenner ist der BEOBACHTUNGSZEITRAUM, nicht die Spanne der eigenen
 * Buchungen** — und das ist der ganze Unterschied: Wer nur im Juni und Juli
 * bei einem Händler war, den Bestand aber von Juni bis August führt,
 * belastet seinen Haushalt über drei Monate. Rechnet man nur über die
 * eigenen zwei, kommt eine systematisch zu hohe Zahl heraus, und je
 * seltener die Ausgabe, desto grösser der Fehler.
 *
 * Deshalb kommt `monateImZeitraum` von aussen: Die Menge selbst kann nicht
 * wissen, worüber gefragt wurde. Ohne Angabe fällt die Rechnung auf die
 * eigene Spanne zurück — das ist die schlechtere, aber einzige Auskunft,
 * die eine Menge ohne Kontext geben kann.
 *
 * `null`, wenn die Menge leer ist — „0 € im Monat" und „dazu liegt mir
 * nichts vor" sind verschiedene Aussagen (dieselbe Trennung wie beim
 * Leer- gegen Fehlerzustand, AGENTS.md §9.1).
 */
export function monatsDurchschnitt(
  transactions: readonly Transaction[],
  monateImZeitraum?: number,
): number | null {
  const eigene = monateImBestand(transactions);
  if (eigene === 0) return null;
  const nenner = monateImZeitraum && monateImZeitraum > 0 ? monateImZeitraum : eigene;
  return sumExpenses([...transactions]) / nenner;
}

/**
 * Monate zwischen zwei ISO-Daten, beide einschliesslich — der Nenner für
 * {@link monatsDurchschnitt}, wenn die Frage einen Zeitraum nennt.
 */
export function monateZwischen(vonIso: string, bisIso: string): number {
  const [vonJahr, vonMonat] = vonIso.slice(0, 7).split('-').map(Number);
  const [bisJahr, bisMonat] = bisIso.slice(0, 7).split('-').map(Number);
  if (!vonJahr || !vonMonat || !bisJahr || !bisMonat) return 0;
  return Math.max(0, (bisJahr - vonJahr) * 12 + (bisMonat - vonMonat) + 1);
}

/**
 * Anteil einer Teilmenge an einer Gesamtmenge, 0..1. `null`, wenn die
 * Gesamtmenge nichts ausgibt — durch null zu teilen ergäbe `Infinity`, und
 * „unendlich viel Prozent" ist keine Auskunft.
 */
export function anteilAnGesamt(
  teilmenge: readonly Transaction[],
  gesamtmenge: readonly Transaction[],
): number | null {
  const gesamt = sumExpenses([...gesamtmenge]);
  if (gesamt <= 0) return null;
  return sumExpenses([...teilmenge]) / gesamt;
}

/**
 * Durchschnitt je VORGANG (Summe / Anzahl Buchungen) — die Antwort auf
 * „Wie hoch war mein durchschnittlicher Einkauf?". Bewusst etwas anderes
 * als {@link monatsDurchschnitt}: Das eine misst die Haushaltsbelastung,
 * das andere die typische Rechnungshöhe.
 */
export function durchschnittJeVorgang(transactions: readonly Transaction[]): number | null {
  const ausgaben = transactions.filter((t) => !t.is_transfer && t.amount < 0);
  if (ausgaben.length === 0) return null;
  return sumExpenses(ausgaben) / ausgaben.length;
}

/** Ein Extremwert mit seinem Bezug — Monat oder einzelne Buchung. */
export interface Extremwert {
  /** Betrag, positiv. */
  betrag: number;
  /** `yyyy-mm` beim Monats-Extremwert, ISO-Datum beim Vorgangs-Extremwert. */
  bezug: string;
  /** Händler/Beschreibung beim Vorgangs-Extremwert; sonst leer. */
  label?: string;
}

/**
 * Teuerster (bzw. günstigster) MONAT der Menge — „In welchem Monat habe
 * ich am meisten für X ausgegeben?". Monate ohne Buchung erscheinen nicht:
 * Ein Monat ohne Ausgabe ist kein günstigster Monat, sondern ein Monat
 * ohne Datenlage.
 */
export function extremwertMonat(
  transactions: readonly Transaction[],
  richtung: 'hoechster' | 'niedrigster' = 'hoechster',
): Extremwert | null {
  const jeMonat = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_transfer || t.amount >= 0) continue;
    const monat = monatVon(t);
    if (!monat) continue;
    jeMonat.set(monat, (jeMonat.get(monat) ?? 0) + Math.abs(t.amount));
  }
  if (jeMonat.size === 0) return null;

  let treffer: Extremwert | null = null;
  for (const [monat, betrag] of jeMonat) {
    const besser =
      treffer === null ||
      (richtung === 'hoechster' ? betrag > treffer.betrag : betrag < treffer.betrag);
    if (besser) treffer = { betrag, bezug: monat };
  }
  return treffer;
}

/** Teuerste einzelne Buchung der Menge — „Was war mein teuerster Einkauf?". */
export function extremwertVorgang(transactions: readonly Transaction[]): Extremwert | null {
  let treffer: Extremwert | null = null;
  for (const t of transactions) {
    if (t.is_transfer || t.amount >= 0) continue;
    const betrag = Math.abs(t.amount);
    if (treffer === null || betrag > treffer.betrag) {
      treffer = { betrag, bezug: t.date, label: t.payee || undefined };
    }
  }
  return treffer;
}

/** Zwei Größen nebeneinander — das Ergebnis jeder Vergleichsfrage. */
export interface VergleichsErgebnis {
  wert: number;
  referenz: number;
  /** `wert − referenz`. Negativ heisst: die erste Größe ist kleiner. */
  differenz: number;
  /**
   * Relative Veränderung gegenüber der Referenz (−1 = auf null gefallen,
   * +0.5 = die Hälfte mehr). `null`, wenn die Referenz null ist — eine
   * prozentuale Änderung gegenüber „nichts" gibt es nicht.
   */
  quote: number | null;
}

/**
 * Vergleicht zwei bereits gefilterte Mengen. Trägt sowohl den Vergleich
 * ZWEIER GRÖSSEN („Aldi oder Lidl?") als auch den Vergleich zweier
 * ZEITRÄUME („mehr als im Vorjahr?") — es ist dieselbe Rechnung, und zwei
 * Funktionen dafür würden bloss auseinanderlaufen.
 */
export function vergleicheMengen(
  menge: readonly Transaction[],
  referenzmenge: readonly Transaction[],
): VergleichsErgebnis {
  const wert = sumExpenses([...menge]);
  const referenz = sumExpenses([...referenzmenge]);
  return {
    wert,
    referenz,
    differenz: wert - referenz,
    quote: referenz > 0 ? (wert - referenz) / referenz : null,
  };
}

/** Ein Monat der Zeitreihe. */
export interface MonatsPunkt {
  /** `yyyy-mm`. */
  monat: string;
  betrag: number;
}

/**
 * Ausgaben je Monat, aufsteigend — die Datengrundlage jeder Trendfrage.
 * Monate OHNE Buchung werden mit 0 aufgefüllt: Eine Lücke in der Reihe
 * liest sich sonst wie „kein Datenpunkt", obwohl sie „in diesem Monat
 * nichts ausgegeben" heisst — und ein Trend über eine löchrige Reihe ist
 * keiner.
 */
export function monatsReihe(transactions: readonly Transaction[]): MonatsPunkt[] {
  const jeMonat = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_transfer || t.amount >= 0) continue;
    const monat = monatVon(t);
    if (!monat) continue;
    jeMonat.set(monat, (jeMonat.get(monat) ?? 0) + Math.abs(t.amount));
  }
  if (jeMonat.size === 0) return [];

  const sortiert = [...jeMonat.keys()].sort();
  const [startJahr, startMonat] = sortiert[0].split('-').map(Number);
  const reihe: MonatsPunkt[] = [];
  for (let i = 0; i < monateImBestand(transactions); i++) {
    const datum = new Date(Date.UTC(startJahr, startMonat - 1 + i, 1));
    const monat = `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}`;
    reihe.push({ monat, betrag: jeMonat.get(monat) ?? 0 });
  }
  return reihe;
}

/**
 * Richtung einer Zeitreihe — der halbe Zeitraum am Anfang gegen den
 * halben am Ende.
 *
 * Bewusst KEINE Regression: Eine Steigung in €/Monat klingt genauer, als
 * sie ist (sie hängt am Ausreisser), und die Frage lautet „steigt das oder
 * fällt das", nicht „mit welcher Steigung". Bei weniger als vier Monaten
 * gibt es keine Antwort — zwei Punkte sind eine Verbindung, kein Trend.
 */
export function trendRichtung(
  reihe: readonly MonatsPunkt[],
): { richtung: 'steigend' | 'fallend' | 'stabil'; quote: number } | null {
  if (reihe.length < 4) return null;
  const mitte = Math.floor(reihe.length / 2);
  const summe = (teil: readonly MonatsPunkt[]) => teil.reduce((s, p) => s + p.betrag, 0);
  const frueh = summe(reihe.slice(0, mitte)) / mitte;
  const spaet = summe(reihe.slice(reihe.length - mitte)) / mitte;
  if (frueh <= 0) return null;

  const quote = (spaet - frueh) / frueh;
  // Unter 10 % Abweichung ist es Rauschen, kein Trend — dieselbe
  // Zurückhaltung wie beim Ausreisser-Schwellwert (Faktor 1,5).
  const richtung = Math.abs(quote) < 0.1 ? 'stabil' : quote > 0 ? 'steigend' : 'fallend';
  return { richtung, quote };
}
