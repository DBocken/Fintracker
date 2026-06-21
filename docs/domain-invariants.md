# Fachliche Invarianten

Stand: 21.06.2026

Diese Regeln sind Sicherheitsgrenzen der Finanzlogik. Änderungen an Import, Persistenz, Verträgen, Transfers, Splits oder Analysen müssen sie durch automatisierte Tests erhalten.

1. Eine Originalbuchung beeinflusst einen Kontostand genau einmal.
2. Ein interner Transfer verändert das Gesamtvermögen nicht und zählt weder als Einnahme noch als Ausgabe.
3. Der erneute Import derselben Quelldatei erzeugt keine zweite Buchung.
4. Bestehende manuelle Kategorien und Nutzerentscheidungen werden durch einen identischen Reimport nicht überschrieben.
5. Geldbeträge werden an fachlichen Grenzen in ganzzahligen Cent validiert.
6. Die Summe aller Aufteilungen entspricht exakt dem Absolutbetrag der Originalbuchung.
7. Aufteilungen verändern den Kontostand nicht; sie ersetzen nur die analytische Kategorieverteilung.
8. Ohne Aufteilungen verwendet die Analyse die Kategorie der Originalbuchung.
9. Eine ausdrücklich abgelehnte, beendete oder archivierte Vertragsfamilie wird durch historische Buchungen nicht reaktiviert.
10. Aktive Nutzerentscheidungen haben Vorrang vor Kategorie-Metadaten und automatischer Erkennung.
11. Familienänderungen betreffen nur vorher angezeigte, bestätigte Buchungen und respektieren „Auf ähnliche Buchungen anwenden“.
12. Undo stellt alle von einer Sammeländerung betroffenen Felder wieder her.
13. Dashboard, Vertragsübersicht und Filter verwenden dieselbe Vertragsentscheidung.
14. Premiumfunktionen prüfen Berechtigungen am Feature beziehungsweise an der Route, nicht nur im Menü.
15. Ein gesperrter lokaler Tresor liefert keine entschlüsselten Finanzdaten.
16. Verschlüsselte Backups und Vault-Dateien enthalten keine Händler, Beträge oder Kategorien im Klartext.
17. Ein fremdes Benutzerbackup wird nicht still importiert.
18. Ungültige oder nur teilweise parsebare Importe werden nicht unbemerkt als gültige Nullwerte gespeichert.
19. Exporte neutralisieren Tabellenformeln aus nutzerkontrollierten Textfeldern.
20. Rohtexte aus Bank- und Belegimporten bleiben für Nachvollziehbarkeit erhalten, werden aber nie als ausführbarer Inhalt gerendert.
