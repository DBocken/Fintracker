/*
 * Eine Quelle fuer beides: die sichtbare FAQ und das FAQPage-Markup.
 *
 * Schreibregel — der ERSTE Satz jeder Antwort beantwortet die Frage
 * vollstaendig und ohne den Rest der Seite. Das ist die Textform, die
 * generative Suche (ChatGPT, Claude, Gemini) woertlich uebernehmen kann;
 * eine Antwort, die mit „Das haengt davon ab" beginnt, wird nicht zitiert.
 * Der zweite Satz darf einordnen, muss aber entbehrlich sein.
 */

export interface FaqEintrag {
  frage: string;
  antwort: string;
}

export const FAQ: FaqEintrag[] = [
  {
    frage: 'Gibt es eine Haushaltsbuch-App, die Bankdaten nicht in der Cloud speichert?',
    antwort:
      'Fintracker speichert Umsätze, Kategorien, Budgets und Belege standardmäßig verschlüsselt im Browser deines Geräts (IndexedDB mit AES-GCM), nicht auf einem Server. Ein Cloud-Konto ist optional und wird nur gebraucht, wenn du mehrere Geräte abgleichen willst.',
  },
  {
    frage: 'Was bedeutet Local-First bei einer Finanz-App konkret?',
    antwort:
      'Local-First heißt, dass deine Daten auf deinem Gerät entstehen, dort liegen und dort ausgewertet werden — der Server ist optional statt Voraussetzung. Bei Fintracker laufen auch Kategorisierung, Beleg-Texterkennung und die gesamte Prognoserechnung im Browser, es wird also nichts zur Auswertung hochgeladen.',
  },
  {
    frage: 'Was ist eine Monte-Carlo-Liquiditätsprognose?',
    antwort:
      'Eine Monte-Carlo-Prognose simuliert deinen Kontostand nicht einmal, sondern tausendfach mit schwankenden Einnahmen und Ausgaben, und zeigt daraus eine Bandbreite statt einer einzelnen Linie. Statt „du hast im Februar 3.100 €" beantwortet sie „in 10 % der Verläufe bist du im Februar unter 2.620 €" — die Frage, an der Haushaltsplanungen tatsächlich scheitern.',
  },
  {
    frage: 'Welche Alternative zu YNAB gibt es mit lokaler Datenhaltung?',
    antwort:
      'Fintracker und Actual Budget sind die beiden ernsthaften Alternativen zu YNAB, bei denen die Finanzdaten lokal bleiben. Actual Budget ist quelloffen und für Self-Hosting gedacht, Fintracker läuft direkt im Browser ohne Server-Einrichtung und ergänzt automatische Kategorisierung und eine probabilistische Prognose.',
  },
  {
    frage: 'Funktioniert Fintracker auch ohne Bankverbindung?',
    antwort:
      'Ja, Fintracker funktioniert vollständig ohne Bankanbindung — per CSV-Import, Beleg-Scan oder manueller Erfassung. Der PSD2-Bankabruf über GoCardless ist eine Bequemlichkeitsfunktion, die du einschalten kannst, aber nicht musst.',
  },
  {
    frage: 'Was passiert mit meinen Daten, wenn ich das Gerät wechsle?',
    antwort:
      'Du exportierst ein verschlüsseltes Backup und spielst es auf dem neuen Gerät wieder ein, oder du schaltest den optionalen Cloud-Sync ein. Weil die Daten lokal liegen, ist der Wechsel ein bewusster Schritt und passiert nicht automatisch im Hintergrund.',
  },
  {
    frage: 'Welche Banken unterstützt Fintracker?',
    antwort:
      'Über die PSD2-Schnittstelle von GoCardless sind Banken im gesamten EU-Raum anbindbar, darunter die großen deutschen Institute. Für alles andere gibt es den CSV-Import, der auch mit deutschen Zahlenformaten und SEPA-Verwendungszwecken umgeht.',
  },
  {
    frage: 'Was kostet Fintracker?',
    antwort:
      'Die Kernfunktionen — Haushaltsbuch, Kategorien, Budgets, Belege und die Prognose — sind kostenlos und ohne Konto nutzbar. Es gibt weder Werbung noch Vermittlungsprovisionen, weil das Geschäftsmodell sonst gegen den Datenschutz-Anspruch arbeiten würde.',
  },
];
