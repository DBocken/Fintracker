/**
 * Messkorpus der Welle 5 — die schreibenden Befehle.
 *
 * **Der Schwerpunkt ist ein anderer als in den Lese-Wellen.** Dort ging es
 * darum, die richtige Rechnung zu treffen; hier geht es zuerst darum, eine
 * FRAGE nie als Befehl zu deuten. Deshalb steht neben jedem Befehl seine
 * Frage-Form als Lücken-Zeile: Sie sind einander zum Verwechseln ähnlich,
 * und die Verwechslung ist der teure Fall — eine falsch beantwortete Frage
 * zeigt eine falsche Zahl, ein falsch gedeuteter Befehl schlägt eine
 * Änderung an den Daten vor.
 *
 * Ein Befehl gilt als richtig geroutet, wenn er in seiner Aktions-Familie
 * landet; die Fläche zeigt dann eine VORSCHAU, geschrieben ist nichts.
 */

import type { WelleZeile } from './wave1-corpus';

const m = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'muster' });
const v = (frage: string, familie: string): WelleZeile => ({ frage, familie, art: 'variante' });

export const WELLE5_KORPUS: readonly WelleZeile[] = [
  // ── Kategorisieren: Korrektur ───────────────────────────────────────────
  m('Ordne die Rewe-Buchungen zu Lebensmitteln', 'kategorie.aktion'),
  m('Weise alle Aldi-Buchungen der Kategorie Lebensmittel zu', 'kategorie.aktion'),
  v('kategorisiere netflix als freizeit', 'kategorie.aktion'),

  // ── Kategorisieren: Dauerregel ──────────────────────────────────────────
  m('Ordne Rewe künftig immer Lebensmitteln zu', 'kategorie.aktion'),
  v('merk dir dass aldi immer lebensmittel ist', 'kategorie.aktion'),

  // ── Anlass ──────────────────────────────────────────────────────────────
  m('Leg einen Anlass Urlaub Italien an', 'anlass.aktion'),
  m('Ordne die Buchungen dem Anlass Hochzeit zu', 'anlass.aktion'),
  v('erstell einen neuen anlass umzug', 'anlass.aktion'),

  // ── Übertrag ────────────────────────────────────────────────────────────
  m('Markiere die Umbuchungen als Überträge', 'transfer.aktion'),
  v('verknüpf die erkannten überträge', 'transfer.aktion'),

  // ── Budget (WP-I, muss weiter tragen) ───────────────────────────────────
  m('Lege ein Budget von 200 € für Lebensmittel an', 'budget.aktion'),
  m('Erhöhe mein Freizeitbudget um 50', 'budget.aktion'),
  v('lösch das budget für kino', 'budget.aktion'),

  // ── Die Frage-Formen derselben Sätze ────────────────────────────────────
  // Der eigentliche Prüfpunkt dieser Welle. Die Zusage ist NICHT „diese
  // Fragen bleiben unbeantwortet" — mehrere sind zu Recht beantwortbar, und
  // eine Lese-Familie darf sie nehmen. Die Zusage ist: **nie eine
  // Aktions-Familie.** Sie steht als eigene Zusicherung im Ratschen-Test und
  // gilt für JEDE Zeile dieses Korpus, nicht nur für diese hier.
  //
  // Wo eine Lese-Familie die ehrliche Antwort ist, steht sie hier als Ziel;
  // wo es keine gibt, bleibt es bei der Lücke.
  m('Wie ordne ich Rewe zu Lebensmitteln?', 'luecke'),
  m('Welche Buchungen soll ich Lebensmitteln zuordnen?', 'luecke'),
  // „Soll ich die Umbuchungen markieren?" fragt nach Rat — die Kandidaten zu
  // zeigen ist die tragfähige Antwort darauf.
  m('Soll ich die Umbuchungen markieren?', 'transfer.kandidaten'),
  m('Wie lege ich einen Anlass an?', 'luecke'),
  // „Kann ich mein Budget erhöhen?" fragt nach dem Spielraum; der Stand der
  // Budgets ist die Grundlage dafür.
  m('Kann ich mein Budget erhöhen?', 'budget.status'),
  v('anlass anlegen?', 'luecke'),
  v('darf ich das budget für kino löschen', 'budget.rest'),
];
