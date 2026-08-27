/**
 * Messkorpus der Welle 2 — Konten, Vermögen, Depots, Anlässe, Transfers,
 * Steuer.
 *
 * Aufbau wie `wave1-corpus.ts`: `muster` sind die Satzmuster des Auftrags und
 * PFLICHT, `variante` ist dieselbe Absicht so getippt, wie Menschen tippen.
 * Ohne die zweite Sorte misst der Korpus, ob der Router vier Schablonen
 * auswendig kann, nicht ob er die Frage versteht.
 *
 * Eigene Datei neben dem 243er- und dem Welle-1-Korpus: Drei Messgrößen,
 * drei Dateien — vermischt wären die Zahlen nicht mehr auseinanderzuhalten,
 * und genau die Trennung macht sichtbar, welche Welle etwas kaputt macht.
 */

import type { WelleZeile } from './wave1-corpus';

const m = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'muster' });
const v = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'variante' });

export const WELLE2_KORPUS: readonly WelleZeile[] = [
  // ── Kontostand eines einzelnen Kontos ───────────────────────────────────
  m('Wie viel Geld habe ich auf meinem Girokonto?', 'konto.saldo'),
  m('Wie hoch ist das Guthaben auf meinem Sparkonto?', 'konto.saldo'),
  m('Wie ist der Saldo von meinem Girokonto?', 'konto.saldo'),
  v('was liegt aufm girokonto', 'konto.saldo'),
  v('guthaben sparkonto', 'konto.saldo'),

  // ── Geld über alle Konten ───────────────────────────────────────────────
  m('Wie viel Geld habe ich insgesamt?', 'konto.gesamt'),
  m('Wie viel liegt auf allen Konten zusammen?', 'konto.gesamt'),
  v('wieviel geld hab ich alles in allem', 'konto.gesamt'),
  // Browser-Fund: Der PLURAL schliesst die Rückfrage „welches Konto?" aus —
  // wer nach „meinen Konten" fragt, hat sich gerade nicht für eines
  // entschieden. Bis dahin gewann der Auslöser „geld habe ich auf".
  m('Wie viel Geld habe ich auf meinen Konten?', 'konto.gesamt'),
  v('was liegt auf den konten', 'konto.gesamt'),

  // ── Frei verfügbar bis zum Gehalt ───────────────────────────────────────
  m('Wie viel Geld bleibt mir bis zum nächsten Gehalt?', 'verfuegbar.bisGehalt'),
  v('was bleibt bis zum lohn übrig', 'verfuegbar.bisGehalt'),

  // ── Nettovermögen ───────────────────────────────────────────────────────
  m('Wie hoch ist mein Nettovermögen?', 'vermoegen.gesamt'),
  m('Wie viel Vermögen habe ich insgesamt?', 'vermoegen.gesamt'),
  v('was bin ich unterm strich wert', 'vermoegen.gesamt'),

  // ── Vermögens-Aufteilung ────────────────────────────────────────────────
  m('Woraus besteht mein Vermögen?', 'vermoegen.aufteilung'),
  m('Wie setzt sich mein Vermögen zusammen?', 'vermoegen.aufteilung'),
  v('wie ist mein vermögen aufgeteilt', 'vermoegen.aufteilung'),

  // ── Depotwert ───────────────────────────────────────────────────────────
  m('Wie viel ist mein Depot wert?', 'depot.wert'),
  m('Was ist der Wert meiner Wertpapiere?', 'depot.wert'),
  v('wieviel steckt aktuell im depot', 'depot.wert'),

  // ── Depot-Rendite ───────────────────────────────────────────────────────
  m('Wie viel Gewinn habe ich in meinem Depot?', 'depot.rendite'),
  m('Wie ist die Rendite meiner Anlagen?', 'depot.rendite'),
  v('bin ich mit meinen aktien im plus oder minus', 'depot.rendite'),

  // ── Depot-Positionen ────────────────────────────────────────────────────
  m('Welche Positionen habe ich in meinem Depot?', 'depot.positionen'),
  m('Was ist meine größte Position im Depot?', 'depot.positionen'),
  v('welche aktien hab ich eigentlich', 'depot.positionen'),

  // ── Anlass-Kosten ───────────────────────────────────────────────────────
  m('Was hat mich mein Urlaub Italien gekostet?', 'anlass.kosten'),
  m('Wie teuer war meine Hochzeit?', 'anlass.kosten'),
  v('was hat der urlaub italien gekostet insgesamt', 'anlass.kosten'),

  // ── Anlass-Liste ────────────────────────────────────────────────────────
  m('Welche Anlässe habe ich angelegt?', 'anlass.liste'),
  m('Welcher Anlass war am teuersten?', 'anlass.liste'),
  v('zeig mir meine anlässe mit kosten', 'anlass.liste'),

  // ── Anlass-Vorschläge ───────────────────────────────────────────────────
  m('Welche Buchungen gehören noch zu Urlaub Italien?', 'anlass.vorschlag'),
  v('was fehlt noch bei hochzeit an buchungen', 'anlass.vorschlag'),

  // ── Transfers ───────────────────────────────────────────────────────────
  m('Habe ich Umbuchungen, die nicht als solche erkannt sind?', 'transfer.kandidaten'),
  m('Gibt es Überträge zwischen meinen Konten?', 'transfer.kandidaten'),
  v('unerkannte eigenüberträge finden', 'transfer.kandidaten'),

  // ── Gewinn nach EÜR ─────────────────────────────────────────────────────
  m('Wie viel Gewinn habe ich dieses Jahr gemacht?', 'steuer.gewinn'),
  v('was ist mein überschuss aus der selbständigkeit', 'steuer.gewinn'),

  // ── Steuerrücklage ──────────────────────────────────────────────────────
  m('Wie viel muss ich für Steuern zurücklegen?', 'steuer.ruecklage'),
  m('Reicht meine Steuerrücklage?', 'steuer.ruecklage'),
  v('hab ich genug fürs finanzamt beiseite', 'steuer.ruecklage'),

  // ── Weitere getippte Varianten ──────────────────────────────────────────
  // Bewusst quer über alle sechs Themen: Eine Sorte mehrfach zu variieren
  // misst dieselbe Formulierung zweimal.
  v('wieviel liegt insgesamt auf meinen konten rum', 'konto.gesamt'),
  v('wie hoch ist mein depotbestand gerade', 'depot.wert'),
  v('lohnt sich mein depot bisher', 'depot.rendite'),
  v('welche titel liegen bei mir im depot', 'depot.positionen'),
  v('woraus setzt sich mein besitz zusammen', 'vermoegen.aufteilung'),
  v('wie viel muss ich noch fürs finanzamt zurücklegen', 'steuer.ruecklage'),
  v('gibt es paare die eigentlich überträge sind', 'transfer.kandidaten'),
  v('was hat die hochzeit alles gekostet', 'anlass.kosten'),

  // ── Benannte Grenzen ────────────────────────────────────────────────────
  // Diese bleiben Lücke, und der Chat soll sich zurückhalten statt zu raten.
  // Sie stehen hier, damit die Zurückhaltung GEMESSEN ist und nicht behauptet.
  m('Wie viel Umsatzsteuer muss ich abführen?', 'luecke'),
  m('Was habe ich in fremden Währungen bezahlt?', 'luecke'),
  m('Wie hat sich mein Vermögen über die letzten Jahre entwickelt?', 'luecke'),
  v('wieviel vorsteuer kann ich ziehen', 'luecke'),
];
