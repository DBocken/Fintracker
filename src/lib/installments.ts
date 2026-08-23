/**
 * Ratenhinweise aus dem Buchungstext — die einzige Stelle, an der ein
 * Kontoauszug die **Restlaufzeit** einer Finanzierung verrät.
 *
 * Der Schuldentyp `installment` existierte bislang nur als etwas, das der
 * Nutzer selbst auswählt. Aus dem Text hat die App ihn nie gelesen, obwohl
 * „Ratenkauf 3/12" auf jedem Klarna-, Finanzierungs- und Teilzahlungsbeleg
 * steht.
 *
 * **Die Arbeitsteilung ist der Punkt.** Erkannt wird ein Muster; gerechnet
 * wird deterministisch. Aus „3 von 12" folgt `12 − 3 = 9` — dafür braucht es
 * kein Modell, und ein Modell dürfte es auch nicht ausrechnen. Erkannt wird
 * nur, was ein Kontextwort ausweist: „3/12" allein ist genauso gut der
 * 3. Dezember, ein Bruch oder eine Belegnummer.
 */
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import type { Transaction } from '@/types';

/** Ein gelesener Ratenhinweis samt der daraus gerechneten Restlaufzeit. */
export interface RatenHinweis {
  /** Die wievielte Rate diese Buchung ist. */
  nummer: number;
  /** Wie viele Raten die Finanzierung insgesamt hat. */
  gesamt: number;
  /** Restlaufzeit — gerechnet, nicht gelesen. */
  offen: number;
  /** Die Textstelle, aus der das stammt — Grundlage jeder Begründung im UI. */
  beleg: string;
}

/**
 * Wörter, die eine Zahlenpaarung überhaupt erst zu einem Ratenhinweis machen.
 * Ohne eines davon wird nicht geraten — eine erfundene Restlaufzeit wäre
 * schlimmer als gar keine.
 */
const KONTEXT = /(raten(?:kauf|zahlung)?|teilzahlung|finanzierung|\brate\b|installment)/i;

/** „3/12", „03 / 12", „3 von 12", „3 of 12". */
const PAARUNG = /(\d{1,3})\s*(?:\/|von|of)\s*(\d{1,3})/i;

/**
 * Obergrenze für die Gesamtzahl der Raten. Darüber ist die Paarung fast sicher
 * ein Datum oder eine Belegnummer, die zufällig neben dem Wort steht — 120
 * Monate sind zehn Jahre und decken auch lange Autofinanzierungen ab.
 */
const MAX_RATEN = 120;

export function erkenneRate(text: string | null | undefined): RatenHinweis | null {
  if (!text || !KONTEXT.test(text)) return null;

  const treffer = text.match(PAARUNG);
  if (!treffer) return null;

  const nummer = Number(treffer[1]);
  const gesamt = Number(treffer[2]);
  // Reihenfolge und Wertebereich müssen stimmen: „13/12" ist kein Ratenstand,
  // „3/1" auch nicht, und „0/12" gibt es nicht — Raten werden ab 1 gezählt.
  if (nummer < 1 || gesamt < 2 || nummer > gesamt || gesamt > MAX_RATEN) return null;

  return { nummer, gesamt, offen: gesamt - nummer, beleg: treffer[0] };
}

/** Eine laufende Finanzierung, so wie sie sich aus den Buchungen liest. */
export interface OffeneRate {
  /** Normalisierter Händlername — nie ein Fingerprint (der trägt eine IBAN). */
  haendler: string;
  /** Anzeigename aus der jüngsten Buchung. */
  anzeigename: string;
  gesamt: number;
  /** Restlaufzeit laut der JÜNGSTEN Buchung dieser Finanzierung. */
  offen: number;
  /** Höhe der letzten Rate. */
  monatlich: number;
  beleg: string;
}

/**
 * Fasst Ratenhinweise zu laufenden Finanzierungen zusammen.
 *
 * Zwei Festlegungen, die sonst falsche Zahlen erzeugen:
 *
 * 1. **Je Finanzierung zählt die JÜNGSTE Buchung**, nicht die Summe aller
 *    Funde. Jede Buchung derselben Finanzierung trägt einen Ratenhinweis;
 *    sie zu addieren ergäbe „noch 9 + 10 + 11 Raten". Alle älteren Stände
 *    sind überholt.
 * 2. **Getrennt wird über Händler UND Gesamtzahl.** Wer bei demselben Anbieter
 *    zwei Dinge finanziert, hat zwei Laufzeiten; „12" und „6" unterscheidet
 *    sie zuverlässiger als jeder Textvergleich.
 */
export function offeneRatenJeHaendler(transactions: readonly Transaction[]): OffeneRate[] {
  const jeFinanzierung = new Map<string, { tx: Transaction; hinweis: RatenHinweis }>();

  for (const tx of transactions) {
    const quelle = [tx.description, tx.original_text, tx.payee].filter(Boolean).join(' ');
    const hinweis = erkenneRate(quelle);
    if (!hinweis) continue;

    const haendler = normalizeMerchantName(tx.payee) || tx.payee;
    const schluessel = `${haendler}|${hinweis.gesamt}`;
    const bisher = jeFinanzierung.get(schluessel);
    if (!bisher || tx.date > bisher.tx.date || (tx.date === bisher.tx.date && hinweis.nummer > bisher.hinweis.nummer)) {
      jeFinanzierung.set(schluessel, { tx, hinweis });
    }
  }

  return [...jeFinanzierung.values()]
    // Eine abbezahlte Finanzierung ist keine offene Rate mehr.
    .filter(({ hinweis }) => hinweis.offen > 0)
    .map(({ tx, hinweis }) => ({
      haendler: normalizeMerchantName(tx.payee) || tx.payee,
      anzeigename: tx.payee,
      gesamt: hinweis.gesamt,
      offen: hinweis.offen,
      monatlich: Math.abs(tx.amount),
      beleg: hinweis.beleg,
    }))
    .sort((a, b) => b.offen - a.offen || a.haendler.localeCompare(b.haendler));
}
