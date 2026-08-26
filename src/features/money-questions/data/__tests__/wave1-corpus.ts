/**
 * Messkorpus der Welle 1 — die Fragekategorien des 2000-Fragen-Auftrags,
 * die diese Welle abdeckt.
 *
 * **Warum eine eigene Datei neben dem 243er-Korpus:** Der bestehende Korpus
 * ist die Ratsche des WP-F-Auftrags und darf nie regressieren; dieser hier
 * misst den NEUEN Auftrag. Zwei Messgrößen, zwei Dateien — in einer
 * vermischt wären die Zahlen nicht mehr auseinanderzuhalten.
 *
 * **Zwei Sorten Zeile, und das ist der Kern:**
 *
 * 1. `muster` — die Sätze aus den Satzmustern des Auftraggebers, sauber
 *    formuliert. Sie sind die PFLICHT: 100 % müssen zur richtigen Familie
 *    routen.
 * 2. `variante` — dieselbe Absicht, wie ein Mensch sie tippt: Tippfehler,
 *    halbe Sätze, Umgangssprache. Ohne sie misst der Korpus, ob der Router
 *    vier Schablonen auswendig kann, nicht ob er die Frage versteht. Genau
 *    dieselbe Lehre wie beim Tippfehler-Block des 243er-Korpus.
 *
 * Die Werte in den Mustern sind SLOTS (Händler, Kategorie, Zeitraum) — je
 * Muster steht deshalb eine Handvoll Belegungen, nicht alle zehn: Zehn
 * Händler durch dieselbe Schablone zu schicken misst zehnmal dasselbe.
 * Was gemessen werden muss, ist die Bandbreite der FORMULIERUNGEN.
 */

export interface WelleZeile {
  frage: string;
  /** Ziel-Eintrags-ID oder 'luecke'. */
  familie: string;
  art: 'muster' | 'variante';
}

const m = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'muster' });
const v = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'variante' });

export const WELLE1_KORPUS: readonly WelleZeile[] = [
  // ── Händlerausgaben: Durchschnitt je Vorgang ────────────────────────────
  m('Wie hoch war mein durchschnittlicher Einkauf bei Aldi in den letzten 90 Tagen?', 'ausgaben.jeVorgang'),
  m('Wie hoch war mein durchschnittlicher Einkauf bei Rewe in den letzten 90 Tagen?', 'ausgaben.jeVorgang'),
  v('was leg ich bei aldi so im schnitt pro einkauf hin', 'ausgaben.jeVorgang'),
  v('durchschnittlicher bon bei rewe', 'ausgaben.jeVorgang'),

  // ── Händlervergleich ────────────────────────────────────────────────────
  m('Gebe ich mehr bei Aldi oder bei Lidl aus?', 'vergleich.haendler'),
  m('Was ist für mich teurer: Rewe oder Edeka?', 'vergleich.haendler'),
  m('Bei welchem von beiden lasse ich mehr Geld, Amazon oder Zalando?', 'vergleich.haendler'),
  m('Vergleiche meine Ausgaben bei dm und Rossmann in den letzten 12 Monaten.', 'vergleich.haendler'),
  v('wo geb ich mehr aus aldi oder lidl', 'vergleich.haendler'),
  v('rewe oder edeka was ist teurer bei mir', 'vergleich.haendler'),

  // ── Kategorieausgaben: Monatsdurchschnitt ───────────────────────────────
  m('Was kostet mich Lebensmittel im Durchschnitt pro Monat?', 'ausgaben.durchschnitt'),
  m('Was kostet mich Freizeit im Durchschnitt pro Monat?', 'ausgaben.durchschnitt'),
  m('Was kostet mich Mobilität im Durchschnitt pro Monat?', 'ausgaben.durchschnitt'),
  v('wieviel geht im schnitt pro monat für lebensmittel drauf', 'ausgaben.durchschnitt'),
  v('freizeit monatlich im mittel wie teuer', 'ausgaben.durchschnitt'),

  // ── Kategorieausgaben: Anteil ───────────────────────────────────────────
  m('Welchen Anteil meiner Gesamtausgaben macht Wohnen aus?', 'ausgaben.anteil'),
  m('Welchen Anteil meiner Gesamtausgaben macht Shopping aus?', 'ausgaben.anteil'),
  v('wie viel prozent meiner ausgaben ist wohnen', 'ausgaben.anteil'),

  // ── Mobilität (= Kategorie über den Oberbegriff, WP-G) ──────────────────
  m('Wie viel kostet mich Tanken pro Monat?', 'ausgaben.durchschnitt'),
  m('Wie viel habe ich für Parken dieses Jahr ausgegeben?', 'ausgaben.kategorie'),
  v('was kostet mich tanken im monat so', 'ausgaben.durchschnitt'),

  // ── Wohnen ──────────────────────────────────────────────────────────────
  m('Wie viel kostet mich Strom im Monat?', 'ausgaben.durchschnitt'),
  m('Wie viel habe ich für Möbel in den letzten 12 Monaten bezahlt?', 'ausgaben.kategorie'),
  v('strom im monat wieviel ungefähr', 'ausgaben.durchschnitt'),

  // ── Lebensmittel & Alltag: Extremwert und Trend ─────────────────────────
  m('Wie hoch war mein teuerster Monat für Restaurants?', 'ausgaben.extremwert'),
  m('Wie hoch war mein teuerster Monat für Lieferdienste?', 'ausgaben.extremwert'),
  m('Sind meine Ausgaben für Restaurants in den letzten drei Monaten gestiegen?', 'ausgaben.trend'),
  v('welcher monat war bei restaurants am teuersten', 'ausgaben.extremwert'),
  v('werden meine lieferdienst kosten mehr mit der zeit', 'ausgaben.trend'),

  // ── Trends & Zeitverläufe ───────────────────────────────────────────────
  m('Wie haben sich meine Gesamtausgaben in den letzten 6 Monaten entwickelt?', 'ausgaben.trend'),
  m('Wie haben sich meine Fixkosten in den letzten 6 Monaten entwickelt?', 'ausgaben.trend'),
  m('Gibt es bei meinen Shoppingausgaben einen erkennbaren Aufwärts- oder Abwärtstrend?', 'ausgaben.trend'),
  // „ungewöhnlich“ fragt nach dem AUSREISSER, nicht nach dem Maximum — das
  // beantwortet die Bestandsfamilie, und zwar richtig.
  m('Welcher Monat war bei meinen Lebensmittelausgaben ungewöhnlich hoch oder niedrig?', 'ausgaben.ungewoehnlich'),
  v('geht das mit meinen ausgaben rauf oder runter über die monate', 'ausgaben.trend'),
  v('wie is der verlauf bei meinen shoppingkosten', 'ausgaben.trend'),

  // ── Zeitvergleich ───────────────────────────────────────────────────────
  m('Sind meine Mobilitätskosten höher als im Vorjahr?', 'vergleich.zeitraum'),
  m('Sind meine Lebensmittelausgaben höher als im Vorjahr?', 'vergleich.zeitraum'),
  m('Ist Strom im Vergleich zum Vorjahr teurer geworden?', 'vergleich.zeitraum'),
  v('zahl ich für strom mehr als letztes jahr', 'vergleich.zeitraum'),
  v('sind meine kosten fuers tanken teurer geworden als letztes jahr', 'vergleich.zeitraum'),

  // ── Kategorievergleich ──────────────────────────────────────────────────
  m('Gebe ich mehr für Freizeit oder für Shopping aus?', 'vergleich.kategorie'),
  m('Was ist für mich teurer: Restaurants oder Lebensmittel?', 'vergleich.kategorie'),
  v('was kostet mehr freizeit oder shopping', 'vergleich.kategorie'),

  // ── Abgrenzung: Diese Sätze dürfen NICHT bei den neuen Familien landen ──
  // Sie tragen dieselben Wörter, meinen aber die Bestandsfamilien. Ohne sie
  // misst der Korpus nur, dass die neuen Einträge greifen — nicht, dass sie
  // sich zurückhalten.
  m('Wie viel habe ich bei Aldi diesen Monat ausgegeben?', 'ausgaben.haendler'),
  m('Wie viel habe ich für Lebensmittel diesen Monat ausgegeben?', 'ausgaben.kategorie'),
  m('Wie viel habe ich letzten Monat insgesamt ausgegeben?', 'ausgaben.gesamt'),
  m('Wofür habe ich dieses Jahr am meisten Geld ausgegeben?', 'ausgaben.topKategorien'),
  m('Welche Ausgaben waren diesen Monat ungewöhnlich hoch?', 'ausgaben.ungewoehnlich'),

  // ── Benannte Grenzen: bleiben Lücke, auch wenn die Wörter passen ───────
  // „pro Nutzung" braucht Fahrten und Besuche — die gibt es nicht. Der
  // Monatsdurchschnitt wird beantwortet, der Nutzungsdurchschnitt nicht.
  m('Was kostet mich mein Auto im Durchschnitt pro Nutzung?', 'luecke'),
  m('Was kostet mich Carsharing im Durchschnitt pro Nutzung?', 'luecke'),
  v('was kostet mich eine fahrt mit dem auto im schnitt', 'luecke'),
];
