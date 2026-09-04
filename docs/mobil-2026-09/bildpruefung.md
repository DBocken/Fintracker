# Bildprüfung aller Flächen bei 360 px (2026-09-04)

Erhoben mit `e2e-tests/all-screens-shots.spec.ts` (`E2E_SHOTS=1`), ausgewertet
von neun Prüf-Agenten gegen `docs/architecture/darstellungsdichte.md` Regel 9,
9a, 9b und 10 sowie eine Philosophie der kognitiven Entlastung.

**Protokoll, keine Vorgabe** — verbindlich ist die ADR. Diese Datei hält fest,
was gemessen wurde, damit die Flächenarbeit nicht auf Vermutungen aufsetzt. Die
zwölf Entwürfe in [`flaechen.md`](flaechen.md) sind aus dem Quelltext
entstanden; sie konnten nicht sehen, wie eine Fläche aussieht. Diese Prüfung
konnte es.

## Wie zu lesen — zwei Fallstricke, beide belegt

**Ganzseitige Aufnahmen stellen `fixed`-Elemente falsch dar.** Die
Bodennavigation erscheint darin mitten im Dokumentfluss. Im Repo ist daraus
schon einmal der Fehlbefund „zwei Navigationsebenen im Inhalt" entstanden. Die
ganzseitige Aufnahme beantwortet **nur** „wie lang ist die Fläche"; wie sie
aussieht, beantwortet allein die Sichtfeld-Aufnahme.

**Eingefrorene Zeit unterdrückt den Aufbau.** `freezeTime` fälscht auch
`requestAnimationFrame`; die datengetriebenen Aufbau-Animationen starten dann
bei `opacity: 0` und laufen nie an. Auf `/liquidity` war die Folge eine über
4228 px durchgehend **leere** Aufnahme — der Inhalt lag im DOM, belegte seine
volle Höhe und war unsichtbar. Eine Gegenprobe ohne eingefrorene Zeit fand dort
648 Elemente, 2768 Zeichen Text und genau drei unsichtbare Knoten
(Recharts-Tooltips). Die Fläche ist in Ordnung, die Aufnahme war es nicht.
Behoben durch erzwungene reduzierte Bewegung; die Höhen blieben danach
byte­gleich, was die Diagnose bestätigt.

Ohne diese Gegenprobe wäre ein Phantombefund „Liquidität rendert nicht" in die
Planung eingegangen.

## Die Messung

25 Routen, Sichtfeld 360×800, Dichte auf allen Routen korrekt `fokussiert`,
**nirgends waagerechter Überlauf**. Bildschirmlängen = Scrollhöhe geteilt durch
Sichtfeldhöhe; über 1,0 heißt, die Fläche scrollt.

| Fläche | Längen | Höhe | Fläche | Längen | Höhe |
|---|---|---|---|---|---|
| /settings | **19,02** | 15212 | /trading | 2,31 | 1844 |
| /transactions | 7,17 | 5732 | /contracts | 2,21 | 1768 |
| /liquidity | 5,29 | 4228 | /income | 2,18 | 1742 |
| /simulation | 5,29 | 4228 | /budgets | 1,47 | 1177 |
| /premium | 5,23 | 4183 | /export | 1,33 | 1064 |
| /tutorials | 4,50 | 3597 | /milestones | 1,28 | 1023 |
| /accounts | 4,02 | 3217 | /euer | 1,27 | 1018 |
| /privacy | 3,37 | 2694 | /net-worth | 1,23 | 983 |
| /dashboard | 3,33 | 2663 | /city | 1,06 | 846 |
| /debts | 2,93 | 2344 | /coach /fragen /occasions /billing /csv | 1,00 | 800 |
| /tax | 2,37 | 1896 | | | |

**20 von 25 Flächen scrollen.** Die Spitze ist `/settings` mit dem
Zweieinhalbfachen der zweitschlimmsten Fläche.

Drei der fünf Flächen bei genau 1,00 halten die Regel nicht wirklich:
`/occasions` steht im Leerzustand (der Demo-Datensatz kennt keine Anlässe),
`/fragen` zeigt den Zustand vor einer Antwort, `/csv` nur Schritt 1 von drei.
Ihre Zahl ist ein Artefakt, kein Beleg. Belastbar halten die Regel nur `/coach`
und `/billing`.

## Befunde jenseits der Darstellung

Diese wiegen schwerer als jeder Layoutbefund, weil sie falsche Auskunft geben
oder Funktion entziehen.

**B1 — Die Geldfluss-Visualisierung rendert auf dem Telefon gar nicht.**
`SankeyChart` übergibt `ResponsiveContainer` eine Prozenthöhe. Zwischen dem
einzigen pixelgenauen Anker und dem Container liegen drei Ebenen ohne eigene
Höhe, sodass die Auflösung 0 ergibt. Der Nutzer sieht mehrere hundert Pixel
leere Fläche mit einem Höhenregler darunter, ohne jeden Hinweis. Die Ursache
ist sauber isoliert: Zeitverlauf und Wochenmuster benutzen **dieselbe** Hülle,
geben aber eine feste Pixelhöhe — und genau sie rendern. Das ist keine
Anpassung, sondern die Amputation, die §4 verbietet.

**B2 — Das Kontenverzeichnis zeigt keinen einzigen Kontostand.** Die Kontozeile
trägt Symbol, bis zu fünf Abzeichen, Typ, Datenqualität und Währung — keinen
Saldo. Ein Kontenverzeichnis ohne Salden beantwortet die Frage nicht, wegen der
man es öffnet.

**B3 — Nettovermögen rechnet mit einem Posten, den es nicht ausweist.** Manuell
erfasste Vermögenswerte fließen in die Hauptzahl ein, erscheinen aber weder in
der Aufschlüsselung noch in der Zusammensetzungsgrafik. Im Demo-Datensatz ist
das unsichtbar, weil der Posten dort null ist. Sobald jemand einen Wert
erfasst, ändert sich die Hauptzahl, ohne dass irgendeine Zeile es erklärt.

**B4 — Die Vertragsfläche schreibt beim bloßen Ansehen.** Jeder Seitenaufruf
löst ungefragt einen Abgleich über den gesamten Buchungsbestand aus, ohne
Nutzerinteraktion.

**B5 — Der Simulationsparameter ist tot.** Er wird an sechs Stellen
geschrieben und an keiner gelesen. Wer über die Weiterleitung oder einen
Verweis aus dem Frage-Router kommt, landet am Kopf einer Fläche von 5,29
Bildschirmlängen statt am Annahme-Editor.

**B6 — Der Export nannte seinen Zeitraum nicht.** Behoben, siehe Commit
„Export-Bericht nennt seinen Zeitraum".

**B7 — Die Filter-Spiegelung löscht fremde Adressparameter.** Auf `/transactions`
baut die Spiegelung die Abfragezeichenkette komplett neu und ersetzt sie. Ein
`?detail=` würde beim nächsten Tastendruck im Suchfeld verschwinden — und schon
beim ersten Rendern. Das ist ein **harter Blocker für Regel 9b** auf zwei
Flächen und gehört in S3: Die Spiegelung muss zusammenführen statt ersetzen.

**B8 — Der Import fragt nach etwas, das er schon weiß.** Schritt 2 verlangt die
Kontoart ein zweites Mal, obwohl Schritt 1 sie aus dem gewählten Konto ableitet.
Ein Widerspruch zwischen Konto und Kontoart ist dadurch herstellbar.

## Blinde Flecken der Wächter

**W1 — Die Tippziel-Ratsche kennt keine Eingabefelder.** Ihre Liste
interaktiver Elemente führt Schaltflächen, Verweise und Auswahlfelder, aber
kein `input`. Das Haupteingabefeld von `/fragen` misst 40 px und wird deshalb
nie gezählt, nicht einmal als benannte Grenze wie die Standardhöhe der
Schaltfläche.

**W2 — Die Karten-Ratsche sieht nur migrierte Flächen.** Boxen zählt sie unter
`presentation/mobile/`. Von den 25 Routen liegen dort drei. Die vier
Kartenrahmen auf `/privacy`, die fünf auf `/premium` und die 33 in den
Einstellungen sind für sie unsichtbar.

**W3 — Die Karten-Regel prüft je Datei, nicht je Karte.** Auf `/privacy` lässt
ein „Zurück"-Verweis **ganz oben, außerhalb jeder Karte** die gesamte Datei als
interaktiv durchgehen, während darunter zwei vollständig tote Karten stehen.

## Was die Prüfung an früheren Annahmen korrigiert

Ehrlichkeitshalber festgehalten — mehrere Punkte aus den Quelltext-Entwürfen
haben der Messung nicht standgehalten.

| Annahme | Befund |
|---|---|
| Einstellungen lässt sich props-getrieben ohne Ratschenbewegung umbauen | **Falsch.** Rund 15 Untersysteme halten ihre Abfragen in der eigenen Komponentendatei. Eine Fassung, die diese Dateien nicht einbindet, kann sie nicht umhüllen. Der Umbau geht nur Unterbereich für Unterbereich. |
| Die Zahlungszuordnung fehlt auf dem Telefon ganz | **Falsch.** Sie liegt vollständig im Detailsheet. Feature-Parität ist gegeben, sie liegt nur eine Ebene tiefer. |
| Der Aufschlüsselungs-Ring fehlt auf dem Telefon ersatzlos | **Falsch.** Eine antippbare Liste mit denselben Kategorien tritt an seine Stelle. Anpassung, keine Amputation. |
| Neun Meilensteine | **Fünf.** Die Zahl der Aussagen stimmt zufällig, die Herleitung nicht. |
| Datenschutz ist versehentlich doppelt geroutet | **Beabsichtigt.** Einmal vor der Anmeldung ohne Rahmen, einmal darin. Die Messung gilt nur für den zweiten Fall. |
| Drei Flächen zeigen im Demo-Einstieg den Upsell | **Falsch.** Die aktive Demo hebt die Stufe selbst an. Ein Kontrolllauf mit angehobener Stufe lieferte bytegleiche Maße. |
| Die Karten der Meilensteinfläche sind alle getönt | **Zwei von fünf.** Der wiederholte Rahmen liegt in `MilestonesStrip`, nicht auf der Seite. |

## Je Fläche

Reihenfolge nach Bildschirmlängen. „→" nennt die Änderung, die folgt.

**/settings — 19,02.** Elf Abschnitte gleichzeitig offen, genau ein Akkordeon
staffelt, und zwar den unwichtigsten Bereich. 33 Kartenrahmen in vier Dateien;
eine Vorschau ist Karte-in-Karte-in-Liste-mit-Karte-je-Zeile. Zwei
Textbausteine stehen wortgleich doppelt. → Drei Aussagen (Kategorien und
Aufbewahrung, Verschlüsselungsstand, letzte Sicherung) plus ein flaches
Verzeichnis aus elf Zeilen, jede hinter einen eigenen Detailschritt. Zwei
E2E-Specs brauchen dann einen Schritt „Gruppe öffnen".

**/transactions — 7,17.** Sechs Aussagen über der Liste, darunter zwei fast
gleiche große Zahlen nebeneinander, weil der Vorgabezeitraum „Gesamt" ist. →
Eine Zahl über der Liste, die mit dem Filterzustand wechselt; die Liste rückt
so weit nach oben, dass die erste Zeile ohne Scrollen sichtbar ist. Blocker B7
zuerst.

**/liquidity — 5,29.** Die schwerste Verletzung im Baum: rund 19 Abschnitte,
drei Auswahlfelder noch im ersten Sichtfeld, also Konfiguration vor Aussage,
und genau ein aufklappbarer Block als einzige Staffelung. → Tiefststand,
Prognosekurve, Frag-dein-Geld; alles Übrige hinter fünf benannte
Detailschritte. Das Diagramm ist mit 288 px höher als breit bei 264 px
nutzbarer Breite, obwohl seine Achse Prognosetage trägt.

**/premium — 5,23.** Fünf gleichrangige Diagrammabschnitte ohne Register und
ohne Staffelung; vierzehn Kategorie-Auswahlfelder stehen auf derselben Ebene
wie die Aussage. Dazu B1. → Drei Aussagen, alles Übrige hinter
Detailschritte; Seitenverhältnisse reparieren.

**/tutorials — 4,50.** Als Verzeichnis von „ein Bildschirm" ausgenommen, aber
23 bis 26 Kapitel tragen je einen eigenen Kartenrahmen, und die 18
Bereichsüberschriften sind bloße Überschriften statt Akkordeons. → Gruppen
werden aufklappbar, Kapitel werden eine Liste mit Haarlinien.

**/accounts — 4,02.** Drei Handlungskarten füllen den ganzen ersten Bildschirm;
die Kontenliste beginnt erst danach. Dazu B2. → Saldo auf die Zeile,
Gesamtsumme nach oben, ein Handlungsaufruf statt drei.

**/privacy — 3,37.** Vier Kartenrahmen, davon zwei unter jedem Zustand
vollständig tot. Dazu W3. → Drei Aussagen; der Erklärtext und die
Analytics-Vorschau hinter Detailschritte.

**/dashboard — 3,33.** Zwei vollständige Fassungen gleichzeitig im DOM, per
Klasse bei 1024 px umgeschaltet statt nach der Dichte bei 768. Suchfeld und
Filter stehen **vor** der ersten Kennzahl. Sieben Aussagen allein im ersten
Sichtfeld. Der Kontostand ist hier anders gerechnet als auf `/coach` und trägt
denselben Namen. → Nur eine Fassung laden; drei Aussagen; Konfiguration nach
unten.

**/debts — 2,93.** Zwölf Aussagen, über zwölf gleichzeitige Entscheidungen,
jeder Schuldeneintrag mit eigenem Kartenrahmen. Der Registerzustand liegt im
Primitiv statt in der Adresse. → Gesamtschuld, „schuldenfrei in", die Liste
ohne Rahmen je Zeile.

**/tax — 2,37.** Die Kennzahlenreihe füllt das Budget allein aus, danach folgen
sieben weitere Blöcke. Jede Vorschlagskarte trägt einen eigenen Rahmen.
Positiv: Jede Summe ist sichtbar an ein Steuerjahr gebunden, und die Fußzeile
nennt es zusätzlich. Kein stiller Zahlenfehler.

**/trading — 2,31.** Über zwanzig gleichzeitige Entscheidungen. Sechs Tabellen
in vier Dateien, die breiteste mit zehn Spalten auf 264 px, also unter 26 px je
Spalte. → **Nicht anfassen.** Das ist eine Produktentscheidung, siehe unten.

**/contracts — 2,21.** Beide Listen je zweimal im DOM. Dazu B4. Das Diagramm
ist mit 256 px nahezu quadratisch bei einer Zeitachse über zwölf Monate.

**/income — 2,18.** Über fünfzehn Aussagen; die Strömeliste hängt unter drei
Abschnitten und einem Upsell, die wichtigste Information steht also unten. Das
Zeitverlaufsdiagramm ist mit 176 px zu 264 px **richtig** proportioniert — kein
Befund.

**/budgets — 1,47.** Die Vorschlagsliste verdrängt die eigentliche Aussage: Das
einzige reale Budget erscheint erst nach dem Scrollen. Der Betrag steht auf der
Kachel **nur** im Zugänglichkeitsnamen, visuell ist sie zahlenfrei.

**/export — 1,33.** Sieben Bedienelemente ohne Reihenfolge. B6 behoben.

**/milestones — 1,28.** Elf Aussagen bei null Bedienelementen. Der wiederholte
Rahmen liegt in `MilestonesStrip`, das auch der Coach benutzt — einmal
entrahmen wirkt an beiden Stellen.

**/euer — 1,27.** Acht Blöcke ohne Staffelung; beide Zeilenlisten können
gleichzeitig offen stehen. Summen sind an das Steuerjahr gebunden, kein
Zahlenfehler.

**/net-worth — 1,23.** Vier Zeilen mit je eigenem Rahmen. Dazu B3.

**/city — 1,06.** Erfüllt „ein Bildschirm" fast, überschreitet aber die
Aussagen. Zwei Wege zur selben Navigation gleichzeitig sichtbar. Drei Zustände
ohne Adresse. Ein Rahmen **um** die gerenderte Fläche.

**/coach — 1,00.** Hält alle drei Maße: genau drei Aussagen, Kontostand als
erste und größte Zahl, keine Box, ein Bildschirm mit Reserve. Der Detailschritt
legt korrekt einen Verlaufseintrag an. **Ein Restbefund:** Der Seitenname steht
doppelt, weil die App-Leiste ihn unabhängig von der Dichte rendert. Die Fläche
taugt als Vorlage — außer in dieser einen Annahme.

**/billing — 1,00.** Zwei Abschnitte, zwei Entscheidungen, die regelkonformste
Fläche neben dem Coach. Einziger Befund ist der Rahmen des Leerzustands, und
der gehört einem geteilten Baustein.

**/fragen, /occasions, /csv — 1,00, aber nicht belastbar.** Siehe oben.

## Der Rahmen — er läuft auf allen 25 Routen mit

Oben verbraucht er 56 px, mit dem Demo-Streifen rund 92 von 800 px, bevor eine
Fläche etwas sagen darf. Unten reserviert der Inhaltsbereich 80 px für eine
Leiste, die rund 55 px hoch ist.

Der Seitenname steht in der App-Leiste **auf jeder Route** und wird dort
abgeschnitten: „Ei…", „A…", „H…", „Fi…". Fünf Bedienelemente und der
Anmelde-Knopf lassen ihm den Platz für zwei bis drei Zeichen. Gleichzeitig
trägt praktisch jede Fläche denselben Namen noch einmal als eigene Überschrift.
Ein abgeschnittener Name ist schlechter als kein Name.

Die sicheren Ränder sind an allen sechs Stellen gesetzt, an denen fixierte oder
bodennahe Elemente liegen. **Keine Lücke gefunden**, auch nicht für die
Gestennavigation.

Die Bodenleiste trägt fünf Einträge, also 72 px je Tab. Mit vier werden es
90 px. Die Beschriftung liegt bei 11 px, exakt auf der Grenze des Wächters und
unterhalb der benannten Skala — die gewonnene Breite gehört in einen Sprung auf
12 px, nicht in längere Beschriftungen.

## Folgen für den Plan

1. **S3 wächst um B7.** Ohne Zusammenführen der Adressparameter ist Regel 9b
   auf `/transactions` und `/dashboard` nicht umsetzbar.
2. **Einstellungen ist kein Kandidat für „höchster Ertrag ohne Aufwand" mehr.**
   Die Fläche bleibt in Welle 1, aber als Verzeichnis plus schrittweise
   Migration der Unterbereiche, nicht als ein Zug.
3. **B1 wird vorgezogen.** Eine Funktion, die auf dem Telefon leer bleibt, ist
   nicht Teil der Darstellungsarbeit, sondern ein Fehler.
4. **W1 und W2 gehören in S7.** Ein Wächter, der das Hauptbedienelement einer
   Fläche nicht kennt, misst dort nichts.
5. **Die vier Tabellen auf `/trading` bleiben unverändert** und gehen als
   Entwurf in die Vorlage: Aufschlüsselung je Zeile, Detailschritt für die
   übrigen Spalten, und eine bewusst betretene waagerechte Datensicht für den
   Fall, dass der Vergleich über Zeilen selbst die Aussage ist.
