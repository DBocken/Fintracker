/*
 * Faktenbasis der Vergleichsseiten. Abgeleitet aus docs/competitive-analysis.md
 * im App-Repo (Stand Juni 2026).
 *
 * Regel fuer diese Datei: jede Zeile muss auch dann stehenbleiben koennen,
 * wenn sie gegen uns spricht. `wo_besser` ist Pflichtfeld und darf nicht leer
 * sein — eine Vergleichsseite ohne echte Schwaeche liest sich als Werbung,
 * und genau solche Seiten zitieren Sprachmodelle nicht. Sie ist ausserdem
 * der Grund, warum Nutzer der restlichen Tabelle glauben.
 */

export type Bewertung = 'ja' | 'teilweise' | 'nein';

export interface Merkmal {
  frage: string;
  fintracker: Bewertung;
  fintrackerText: string;
  andereText: string;
  andere: Bewertung;
}

export interface Konkurrent {
  slug: string;
  name: string;
  markt: string;
  preis: string;
  /** Ein Satz, der die App fair beschreibt — aus ihrer eigenen Sicht. */
  kern: string;
  staerke: string;
  /** Pflicht. Ohne echte Antwort ist die Seite Werbung, kein Vergleich. */
  wo_besser: string;
  fazit: string;
  merkmale: Merkmal[];
}

const merkmal = (
  frage: string,
  fintracker: Bewertung,
  fintrackerText: string,
  andere: Bewertung,
  andereText: string,
): Merkmal => ({ frage, fintracker, fintrackerText, andere, andereText });

export const KONKURRENTEN: Konkurrent[] = [
  {
    slug: 'finanzguru',
    name: 'Finanzguru',
    markt: 'Deutschland',
    preis: 'Gratis, Plus ab 2,99 €/Monat',
    kern: 'Der deutsche Marktführer für Multibanking mit automatischer Vertragserkennung und Ein-Klick-Kündigung.',
    staerke:
      'Bankanbindung an über 3.000 Institute und die beste Vertrags- und Versicherungserkennung im deutschen Markt — inklusive Kündigung direkt aus der App.',
    wo_besser:
      'Finanzguru kündigt Verträge für dich, Fintracker erkennt sie nur. Wer vor allem Abos loswerden will, ist dort besser aufgehoben. Außerdem ist die App seit Jahren im Play Store und App Store — die Android-App von Fintracker ist es noch nicht.',
    fazit:
      'Fintracker ist die Wahl, wenn dich das provisionsbasierte Geschäftsmodell stört oder deine Bankdaten nicht auf fremden Servern liegen sollen. Finanzguru ist die Wahl, wenn du Verträge per Knopfdruck kündigen willst.',
    merkmale: [
      merkmal('Daten liegen auf deinem Gerät', 'ja', 'Standard, AES-GCM-verschlüsselt', 'nein', 'Cloud-Konto erforderlich'),
      merkmal('Bankanbindung (PSD2)', 'ja', 'GoCardless, EU-weit', 'ja', 'Eigene PSD2-Pipeline, 3.000+ Banken'),
      merkmal('Verträge kündigen', 'nein', 'Erkennung inkl. Preisänderung, keine Kündigung', 'ja', 'Ein-Klick-Kündigung'),
      merkmal('Bargeld per Beleg erfassen', 'ja', 'OCR im Browser, kein Upload', 'nein', 'Häufigster Kritikpunkt in Rezensionen'),
      merkmal('Liquiditätsprognose mit Wahrscheinlichkeiten', 'ja', 'Monte-Carlo, 1.000 Läufe', 'nein', 'Einfache Vorschau in Plus'),
      merkmal('Werbe- oder provisionsfrei', 'ja', 'Kein Vermittlungsgeschäft', 'nein', 'Finanziert über Makler-Provisionen'),
    ],
  },
  {
    slug: 'ynab',
    name: 'YNAB',
    markt: 'USA / international',
    preis: '109 US-Dollar pro Jahr',
    kern: 'Der Goldstandard für Zero-Based-Budgeting — eine Methode, die Verhalten ändert, nicht nur Zahlen zeigt.',
    staerke:
      'Die didaktische Strenge: Jeder Euro bekommt eine Aufgabe. Nutzer sparen im Schnitt 600 US-Dollar in den ersten zwei Monaten. Ausgereifte Paar-Funktion.',
    wo_besser:
      'Die Budgetierungs-Methodik von YNAB ist konsequenter durchdacht und besser vermittelt als jede Budget-Funktion in Fintracker. Wer Zero-Based-Budgeting lernen will, lernt es dort.',
    fazit:
      'YNAB erzieht, Fintracker rechnet vor. Wenn du wissen willst, wie wahrscheinlich dein Geld bis Jahresende reicht, findest du das in YNAB nicht — dafür gibt es dort eine Budget-Disziplin, die Fintracker nicht ersetzt.',
    merkmale: [
      merkmal('Daten liegen auf deinem Gerät', 'ja', 'Standard, AES-GCM-verschlüsselt', 'nein', 'Reine Cloud-Lösung'),
      merkmal('Kostenlos nutzbar', 'ja', 'Kernfunktionen ohne Konto', 'nein', '109 US-Dollar pro Jahr nach der Testphase'),
      merkmal('Zero-Based-Budgeting', 'teilweise', 'Budget-Tanks mit Auto-Vorschlägen', 'ja', 'Die Referenz-Umsetzung'),
      merkmal('Liquiditätsprognose mit Wahrscheinlichkeiten', 'ja', 'Monte-Carlo, 1.000 Läufe', 'nein', 'Nicht vorhanden'),
      merkmal('Deutsche Banken und SEPA', 'ja', 'IBAN-Matching, deutsche CSV-Formate', 'teilweise', 'EU-Anbindung vorhanden, US-zentriert'),
      merkmal('Investment- und Vermögensübersicht', 'teilweise', 'Vermögen ja, Depots im Aufbau', 'nein', 'Kein Investment-Tracking'),
    ],
  },
  {
    slug: 'outbank',
    name: 'Outbank',
    markt: 'Deutschland',
    preis: 'ab 3,99 €/Monat',
    kern: 'Multibanking mit striktem Datenschutz: alle Daten bleiben auf dem Gerät, ohne Server dazwischen.',
    staerke:
      'Über 4.500 Banken weltweit und eine kompromisslose lokale Datenhaltung — Outbank hat den Datenschutz-Anspruch lange vor allen anderen ernst genommen.',
    wo_besser:
      'Outbank unterstützt deutlich mehr Bankinstitute, ist seit Jahren in beiden App-Stores und auf iOS zuhause. Fintracker hat bisher nur eine Android-App, und die noch nicht im Store.',
    fazit:
      'Der nächste Verwandte in der Datenphilosophie — mit dem Unterschied, dass Outbank die Daten zwar schützt, aber nicht auswertet. Kategorisierung ist dort Handarbeit, eine Prognose gibt es nicht.',
    merkmale: [
      merkmal('Daten liegen auf deinem Gerät', 'ja', 'Standard, AES-GCM-verschlüsselt', 'ja', 'Kernversprechen der App'),
      merkmal('Automatische Kategorisierung', 'ja', '3-stufig, mit Begründung je Buchung', 'nein', 'Manuelle Zuordnung'),
      merkmal('Liquiditätsprognose mit Wahrscheinlichkeiten', 'ja', 'Monte-Carlo, 1.000 Läufe', 'nein', 'Nicht vorhanden'),
      merkmal('Budgets und Coach', 'ja', 'Budget-Tanks, Roadmap-Stufen', 'nein', 'Nicht vorhanden'),
      merkmal('Anzahl angebundener Banken', 'teilweise', 'EU-weit über GoCardless', 'ja', '4.500+ weltweit'),
      merkmal('Im App-Store verfügbar', 'nein', 'Web-App, Android noch nicht im Store', 'ja', 'iOS und Android'),
    ],
  },
  {
    slug: 'actual-budget',
    name: 'Actual Budget',
    markt: 'Open Source',
    preis: 'Kostenlos, Self-Hosting oder gehosteter Dienst',
    kern: 'Quelloffenes Envelope-Budgeting mit lokaler Datenhaltung und Ende-zu-Ende-Verschlüsselung.',
    staerke:
      'Vollständige Datenhoheit durch Self-Hosting, offener Quellcode, aktive Community mit über 26.000 GitHub-Sternen. Der Beweis, dass die Nachfrage nach Datenhoheit real ist.',
    wo_besser:
      'Actual ist vollständig quelloffen und lässt sich auf eigener Hardware betreiben — wer das braucht, bekommt es bei Fintracker nicht. Und die Envelope-Budgetierung ist dort ausgereifter.',
    fazit:
      'Dieselbe Datenphilosophie, anderer Anspruch: Actual richtet sich an technisch versierte Nutzer, die einen Server betreiben. Fintracker läuft im Browser, kategorisiert automatisch und rechnet eine Prognose, die Actual nicht hat.',
    merkmale: [
      merkmal('Daten liegen auf deinem Gerät', 'ja', 'Standard, ohne Einrichtung', 'ja', 'Lokal oder selbst gehostet'),
      merkmal('Ohne Server-Einrichtung nutzbar', 'ja', 'Browser öffnen genügt', 'teilweise', 'Self-Hosting oder gehosteter Dienst'),
      merkmal('Automatische Kategorisierung', 'ja', '3-stufig, mit Begründung je Buchung', 'teilweise', 'Regelbasiert, manuell gepflegt'),
      merkmal('Liquiditätsprognose mit Wahrscheinlichkeiten', 'ja', 'Monte-Carlo, 1.000 Läufe', 'nein', 'Geplante Zahlungen, keine Simulation'),
      merkmal('Beleg-Erfassung per OCR', 'ja', 'Im Browser, kein Upload', 'nein', 'Nicht vorhanden'),
      merkmal('Quelloffen', 'nein', 'Nicht quelloffen', 'ja', 'MIT-Lizenz, 26.000+ Sterne'),
    ],
  },
];

export const konkurrentFinden = (slug: string) => KONKURRENTEN.find((k) => k.slug === slug);

/*
 * Uebersichtsmatrix der Startseite.
 *
 * Die letzten beiden Zeilen sind Absicht: eine Tabelle, in der wir jede
 * Zeile gewinnen, glaubt niemand — und sie waere gelogen. App-Store-Praesenz
 * und offener Quellcode fehlen uns tatsaechlich, und beides ist fuer einen
 * Teil der Leser das Ausschlusskriterium. Es hier zu verschweigen wuerde es
 * nur nach hinten verschieben.
 */
export const MATRIX_SPALTEN = ['Fintracker', 'Finanzguru', 'YNAB', 'Outbank', 'Actual Budget'] as const;

export interface MatrixZeile {
  merkmal: string;
  werte: Bewertung[];
}

export const MATRIX: MatrixZeile[] = [
  { merkmal: 'Daten bleiben auf dem Gerät', werte: ['ja', 'nein', 'nein', 'ja', 'ja'] },
  { merkmal: 'Automatische Kategorisierung', werte: ['ja', 'ja', 'teilweise', 'nein', 'teilweise'] },
  { merkmal: 'Prognose mit Wahrscheinlichkeiten', werte: ['ja', 'nein', 'nein', 'nein', 'nein'] },
  { merkmal: 'Beleg-Erkennung auf dem Gerät', werte: ['ja', 'nein', 'nein', 'teilweise', 'nein'] },
  { merkmal: 'Ohne Server-Einrichtung nutzbar', werte: ['ja', 'ja', 'ja', 'ja', 'teilweise'] },
  { merkmal: 'Ohne Werbung und Provisionen', werte: ['ja', 'nein', 'ja', 'ja', 'ja'] },
  { merkmal: 'Kostenlos nutzbar', werte: ['ja', 'teilweise', 'nein', 'nein', 'ja'] },
  { merkmal: 'Im App Store verfügbar', werte: ['nein', 'ja', 'ja', 'ja', 'ja'] },
  { merkmal: 'Quelloffen', werte: ['nein', 'nein', 'nein', 'nein', 'ja'] },
];

export const BEWERTUNG_TEXT: Record<Bewertung, string> = {
  ja: 'ja',
  teilweise: 'teilweise',
  nein: 'nein',
};
