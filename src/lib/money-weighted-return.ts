/**
 * Geldgewichtete Rendite eines Depots — der interne Zinsfuß (Welle 4).
 *
 * #333 liess die Wahl zwischen zeitgewichtet und geldgewichtet ausdrücklich
 * offen und nannte sie eine echte Entscheidung. Sie ist getroffen:
 * **geldgewichtet**, weil sie „was hat MEIN GELD gebracht" beantwortet — die
 * Frage eines Privatanlegers. Die zeitgewichtete misst, wie gut die Auswahl
 * war, unabhängig davon, wann wie viel Geld drinsteckte; das ist die
 * Kennzahl, an der sich ein Fondsmanager messen lässt, nicht die, nach der
 * hier jemand fragt. Beide gleichzeitig zu zeigen verwirrt, eine falsch
 * benannte täuscht.
 *
 * Rein und ohne I/O.
 */

/** Eine Bewegung: negativ = eingezahlt, positiv = entnommen oder Endwert. */
export interface Zahlung {
  /** ISO `YYYY-MM-DD`. */
  datum: string;
  betrag: number;
}

export type RenditeErgebnis =
  | { art: 'rendite'; jaehrlich: number; jahre: number }
  /**
   * Warum es KEINE Zahl gibt. Eine Rendite, die aus zu wenig Information
   * entsteht, ist schlimmer als keine — und eine, die aus einer
   * Abbruchgrenze fällt, ist gar keine (AGENTS.md §3: eine Abbruchgrenze ist
   * kein Ergebnis).
   */
  | { art: 'unbestimmt'; grund: 'keineZahlungen' | 'keineEinzahlung' | 'keinVorzeichenwechsel' | 'keineKonvergenz' };

/** Höchstzahl der Bisektions-Schritte. Wird sie erreicht, GILT das als Nicht-Ergebnis. */
export const MAX_ITERATIONEN = 80;

/** Genauigkeit, ab der ein Kapitalwert als null gilt (Euro). */
export const KONVERGENZ_SCHWELLE = 1e-7;

/**
 * Jahresbruchteil nach der **365-Tage-Konvention** — dieselbe, die XIRR in
 * Tabellenkalkulationen benutzt.
 *
 * Mit 365,25 (dem astronomisch genaueren Jahr) ergäbe eine Verdopplung über
 * genau ein Kalenderjahr 100,09 % statt 100 %. Beides ist rechnerisch
 * vertretbar; entschieden ist die Konvention, deren Ergebnis der Nutzer aus
 * anderen Werkzeugen wiedererkennt. Eine Kennzahl, die um Zehntelprozent von
 * der gewohnten abweicht, kostet mehr Vertrauen, als die Genauigkeit wert
 * ist.
 */
function jahreSeit(startMs: number, datum: string): number {
  const ms = Date.parse(`${datum}T00:00:00Z`);
  return (ms - startMs) / (365 * 86_400_000);
}

/** Kapitalwert der Zahlungen bei Zinssatz `rate`. */
function kapitalwert(zahlungen: readonly Zahlung[], startMs: number, rate: number): number {
  return zahlungen.reduce((summe, z) => {
    const t = jahreSeit(startMs, z.datum);
    return summe + z.betrag / Math.pow(1 + rate, t);
  }, 0);
}

/**
 * Der interne Zinsfuß über alle Zahlungen.
 *
 * Bewusst mit Bisektion statt Newton: Newton ist schneller, springt aber bei
 * ungünstigen Startwerten aus dem sinnvollen Bereich und liefert dann eine
 * Zahl, die aussieht wie eine Rendite und keine ist. Die Bisektion braucht
 * mehr Schritte und kann dafür nur zwischen zwei Grenzen landen, deren
 * Vorzeichen den Nullpunkt einschliessen — und wenn sie es nicht tut, SAGT
 * sie das.
 */
export function geldgewichteteRendite(zahlungen: readonly Zahlung[]): RenditeErgebnis {
  const sortiert = [...zahlungen]
    .filter((z) => Number.isFinite(z.betrag) && !Number.isNaN(Date.parse(`${z.datum}T00:00:00Z`)))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  if (sortiert.length < 2) return { art: 'unbestimmt', grund: 'keineZahlungen' };
  if (!sortiert.some((z) => z.betrag < 0)) return { art: 'unbestimmt', grund: 'keineEinzahlung' };
  if (!sortiert.some((z) => z.betrag > 0)) return { art: 'unbestimmt', grund: 'keinVorzeichenwechsel' };

  const startMs = Date.parse(`${sortiert[0].datum}T00:00:00Z`);
  const jahre = jahreSeit(startMs, sortiert[sortiert.length - 1].datum);
  // Unter einem Monat ist jede Hochrechnung auf ein Jahr Zierde: Aus drei
  // Tagen Kursbewegung eine Jahresrendite zu machen erzeugt Zahlen wie
  // „+4200 %", die nichts über das Depot aussagen.
  if (jahre < 1 / 12) return { art: 'unbestimmt', grund: 'keineZahlungen' };

  // −99,9 % bis +1000 % p. a. — ausserhalb davon ist keine Aussage mehr
  // sinnvoll, und die Grenze wird geprüft statt bloss gesetzt.
  let unten = -0.999;
  let oben = 10;
  let wertUnten = kapitalwert(sortiert, startMs, unten);
  const wertOben = kapitalwert(sortiert, startMs, oben);

  // Schliessen die Grenzen den Nullpunkt nicht ein, gibt es in diesem Bereich
  // keine Rendite — und die Bisektion würde eine der Grenzen zurückgeben,
  // also eine Zahl, die keine Aussage ist.
  if (wertUnten * wertOben > 0) return { art: 'unbestimmt', grund: 'keineKonvergenz' };

  for (let i = 0; i < MAX_ITERATIONEN; i += 1) {
    const mitte = (unten + oben) / 2;
    const wertMitte = kapitalwert(sortiert, startMs, mitte);

    if (Math.abs(wertMitte) < KONVERGENZ_SCHWELLE || oben - unten < 1e-9) {
      return { art: 'rendite', jaehrlich: mitte, jahre };
    }

    if (wertUnten * wertMitte < 0) {
      oben = mitte;
    } else {
      unten = mitte;
      wertUnten = wertMitte;
    }
  }

  // Die Grenze ist erreicht — das ist ein Nicht-Ergebnis, keine Rendite.
  return { art: 'unbestimmt', grund: 'keineKonvergenz' };
}

/**
 * Die Zahlungsreihe für den internen Zinsfuß: Einzahlungen negativ,
 * Entnahmen positiv — und der heutige Marktwert als abschliessender Rückfluss.
 *
 * Der Endwert gehört DAZU und ist kein Zahlungsvorgang: Ohne ihn wäre die
 * Rechnung die Frage „was habe ich herausgenommen", nicht „was hat mein Geld
 * gebracht".
 *
 * Liegt hier und nicht im Dienst: Sie ist rein, und ein Registereintrag darf
 * einen Service gar nicht importieren (`check:layers` — `domain` liegt auf
 * der Höhe von `lib`).
 */
export function zahlungsreihe(
  cashflows: readonly { date: string; amount: number; direction: 'deposit' | 'withdrawal' }[],
  marktwert: number,
  stichtag: string,
): Zahlung[] {
  const zahlungen: Zahlung[] = cashflows.map((c) => ({
    datum: c.date,
    betrag: c.direction === 'deposit' ? -Math.abs(c.amount) : Math.abs(c.amount),
  }));
  if (marktwert !== 0) zahlungen.push({ datum: stichtag, betrag: marktwert });
  return zahlungen;
}
