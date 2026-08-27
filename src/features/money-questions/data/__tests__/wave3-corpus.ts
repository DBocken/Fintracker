/**
 * Messkorpus der Welle 3 — Zielrückrechnung, Reichweite, Abbuchungen,
 * Einkommensarten, Tilgung und Erklärbarkeit.
 *
 * Aufbau wie die Korpora der Wellen 1 und 2: `muster` sind die Satzmuster des
 * Auftrags und PFLICHT, `variante` ist dieselbe Absicht so getippt, wie
 * Menschen tippen.
 */

import type { WelleZeile } from './wave1-corpus';

const m = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'muster' });
const v = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'variante' });

export const WELLE3_KORPUS: readonly WelleZeile[] = [
  // ── Zielrückrechnung: Obergrenze ────────────────────────────────────────
  m('Wie hoch darf mein Urlaubsbudget höchstens sein, damit mein Puffer hält?', 'ziel.obergrenze'),
  m('Was darf ich maximal ausgeben, ohne ins Minus zu rutschen?', 'ziel.obergrenze'),
  v('wie teuer darf die anschaffung höchstens werden', 'ziel.obergrenze'),

  // ── Zielrückrechnung: Sparrate ──────────────────────────────────────────
  m('Wie viel muss ich monatlich sparen, um 5000 Euro zu schaffen?', 'ziel.sparrate'),
  v('welche sparrate brauche ich für 3000', 'ziel.sparrate'),

  // ── Reichweite ──────────────────────────────────────────────────────────
  m('Wie lange reicht mein Geld noch?', 'liquiditaet.reichweite'),
  m('Wie viele Monate komme ich mit meinem Guthaben hin?', 'liquiditaet.reichweite'),
  v('wie lange halte ich damit durch', 'liquiditaet.reichweite'),

  // ── Nächste Abbuchungen ─────────────────────────────────────────────────
  m('Was wird demnächst abgebucht?', 'abbuchung.naechste'),
  m('Welche Abbuchungen kommen in den nächsten Wochen?', 'abbuchung.naechste'),
  v('was geht mir demnächst noch vom konto', 'abbuchung.naechste'),

  // ── Letzte Buchung ──────────────────────────────────────────────────────
  m('Wann war ich zuletzt bei Rewe?', 'abbuchung.letzte'),
  m('Wann habe ich zuletzt bei Aldi eingekauft?', 'abbuchung.letzte'),
  v('letzter einkauf bei lidl wann', 'abbuchung.letzte'),

  // ── Einkommensarten ─────────────────────────────────────────────────────
  m('Woher kommt mein Geld?', 'einkommen.arten'),
  m('Welche Einnahmen habe ich?', 'einkommen.arten'),
  v('woraus besteht mein einkommen eigentlich', 'einkommen.arten'),

  // ── Tilgungsdauer ───────────────────────────────────────────────────────
  m('Wie lange zahle ich noch an meinen Schulden?', 'schulden.dauer'),
  m('Wann bin ich schuldenfrei?', 'schulden.dauer'),
  v('wie viele monate noch bis die schulden weg sind', 'schulden.dauer'),

  // ── Zinssumme ───────────────────────────────────────────────────────────
  m('Wie viel Zinsen zahle ich insgesamt?', 'schulden.zinsen'),
  v('was kosten mich meine kredite an zinsen', 'schulden.zinsen'),

  // ── Sondertilgung ───────────────────────────────────────────────────────
  m('Was bringt es, wenn ich monatlich 100 Euro mehr zahle?', 'schulden.sondertilgung'),
  v('wie viel spare ich mit 200 sondertilgung', 'schulden.sondertilgung'),

  // ── Erklärbarkeit ───────────────────────────────────────────────────────
  m('Warum ist die Buchung bei Rewe in Lebensmittel?', 'kategorie.begruendung'),
  v('wieso wurde aldi so einsortiert', 'kategorie.begruendung'),

  // Welle 4 hat diese Lücke GESCHLOSSEN — und zwar ohne das Sparziel-
  // Datenmodell, das #333 dafür vorsah: Die Vertragsableitung kennt die
  // Zyklen, `jahresRuecklage` verteilt sie auf Monate. Der Prüfpunkt bleibt
  // derselbe, nur andersherum: Die Frage nennt keinen Zielbetrag, also darf
  // sie auch jetzt nicht bei `ziel.sparrate` landen.
  m('Wie viel sollte ich monatlich zurücklegen, damit jährliche Rechnungen mich nicht überraschen?', 'ruecklage.jahresrechnungen'),

  // ── Benannte Grenzen ────────────────────────────────────────────────────
  m('Was kostet mich mein Auto pro Fahrt?', 'luecke'),
];
