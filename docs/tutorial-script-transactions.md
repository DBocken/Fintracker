# Drehbuch: Buchungen — vollständige Führung

Status: **umgesetzt.** Alle 30 Schritte laufen, alle Anker sind gesetzt.

Ausformuliertes Beispiel für den Detailgrad, den eine Führung haben soll:
**jede Option erklärt, jede Interaktion nachvollziehbar.** Gilt als Vorlage für
die übrigen Bereiche.

Vorher lesen: `docs/tutorial-sequence.md` (Reihenfolge der Kapitel, Datenreife)
und `docs/tutorial-progressive-disclosure.md` (Overlay-Mechanik).

## Was dieses Drehbuch an den Vorgaben ändert

Zwei frühere Festlegungen halten diesem Detailgrad nicht stand und werden
hiermit ersetzt:

| Alt | Neu | Grund |
|---|---|---|
| „2–4 Schritte je Kapitel, ein Kapitel = ein Bildschirm" | **2–8 Schritte je Kapitel, ein Kapitel = ein Arbeitsschritt** | Die Buchungsseite hat allein 30 erklärbare Bedienelemente. In vier Kapitel geschnitten bleibt jedes verdaulich; in eines gepresst wäre es ein Marathon. |
| Mobil wird aus dem Popover ein Bottom Sheet | **Immer ein an das Ziel geheftetes Popover** | Ein Bottom Sheet nimmt die untere Bildschirmhälfte — und damit oft genau das Element, von dem der Schritt spricht. Bewusste Ausnahme von AGENTS.md §4: gleiche Präsentation ist hier nicht Sparzwang, sondern Bedingung. |

Dazu zwei Fähigkeiten, ohne die das Drehbuch nicht spielbar ist:

- **Scrollen zum Ziel.** Worauf gezeigt wird, muss im Bild sein. Ohne das
  zeigt die Führung ins Nichts, sobald ein Anker weiter unten liegt.
- **Schritte, die etwas öffnen** (`openAnchor`). Die Detailansicht und das
  Aufteilen-Panel existieren erst nach einem Klick. Öffnet die Führung sie
  selbst, ist die Folge deterministisch; überließe man es dem Nutzer, bräche
  sie beim ersten Fehlklick ab.

## Aufbau: vier Akte

| Akt | Kapitel-ID | Was gelernt wird | Schritte |
|---|---|---|---|
| I | `transactions` | Die Liste lesen | 6 |
| II | `transactionsFilter` | Finden: Suche, Zeitraum, Filter | 7 |
| III | `transactionDetails` | Eine Buchung verstehen und korrigieren | 11 |
| IV | `transactionSplit` | Eine Buchung aufteilen | 6 |

Akt II–IV sind eigene Kapitel im Lehrplan und schalten nichts frei — sie
vertiefen den Kernbereich, den Akt I eröffnet. Wer abbricht, hat trotzdem das
Wichtigste (Akt I) gesehen.

---

## Akt I — Die Liste lesen

| # | Mechanik | Anker | Text (DE) |
|---|---|---|---|
| 1 | — (Seitenüberblick) | `transactions-page` | **Hier stehen alle deine Buchungen.** Jede Zeile ist eine Bewegung auf einem deiner Konten. Alles Weitere in der App rechnet mit genau diesen Zeilen. |
| 2 | scrollt zur ersten Zeile | `transactions-first-row` | **Eine Zeile, vier Angaben.** Links das Symbol der Kategorie, daneben der Zahlungsempfänger, rechts der Betrag — rot für Ausgaben, grün für Einnahmen. |
| 3 | Hervorhebung Datumskopf | `transactions-day-header` | **Sortiert nach Tag.** Buchungen desselben Tages stehen zusammen. Der neueste Tag steht oben. |
| 4 | Hervorhebung laufender Saldo | `transactions-running-balance` | **Der laufende Kontostand.** Rechts siehst du, wie viel nach dieser Buchung noch da war — so findest du den Tag, an dem es eng wurde. |
| 5 | scrollt zu den Kennzahlen | `transactions-stats` | **Die Summe über dem, was du gerade siehst.** Einnahmen, Ausgaben, Saldo und Anzahl beziehen sich immer auf die aktuelle Filterung — nicht auf alles. |
| 6 | Hervorhebung Hinzufügen-Knopf | `transactions-add` | **Bar bezahlt?** Was nicht über ein Konto lief, trägst du hier von Hand nach. Alles andere kommt aus Import oder Bankverbindung. |

## Akt II — Finden

| # | Mechanik | Anker | Text (DE) |
|---|---|---|---|
| 1 | scrollt nach oben | `transactions-search` | **Suchen statt scrollen.** Tippe einen Zahlungsempfänger oder einen Begriff aus dem Verwendungszweck — die Liste filtert sofort mit. |
| 2 | Hervorhebung | `filter-timerange` | **Der Zeitraum ist der wichtigste Filter.** Er entscheidet, worüber die Kennzahlen oben reden. Standard sind die letzten Monate; „Benutzerdefiniert" öffnet Tage, Wochen oder Monate. |
| 3 | Hervorhebung | `filter-category` | **Nach Kategorie einschränken.** Zeigt nur Buchungen einer Kategorie — nützlich, wenn du prüfen willst, was wirklich unter „Freizeit" gelandet ist. |
| 4 | Hervorhebung | `filter-account` | **Nach Konto einschränken.** Bei mehreren Konten siehst du so nur eines — etwa das Geschäftskonto. |
| 5 | Hervorhebung | `filter-contract` | **Verträge ein- oder ausblenden.** „Nur Verträge" zeigt, was monatlich ohne dein Zutun abgeht. „Ohne Verträge" zeigt den Rest, den du tatsächlich steuern kannst. |
| 6 | Hervorhebung | `filter-essential` | **Notwendig oder nicht.** Miete und Strom sind unvermeidbar, das Kino nicht. Der Filter trennt beides — die Einstufung kommt aus der Kategorie. |
| 7 | Hervorhebung | `filter-reset` | **Zurücksetzen.** Sobald ein Filter aktiv ist, erscheint dieser Knopf. Er räumt alle auf einmal weg — praktisch, wenn du dich verlaufen hast. |

## Akt III — Eine Buchung verstehen und korrigieren

| # | Mechanik | Anker | Text (DE) |
|---|---|---|---|
| 1 | scrollt zur ersten Zeile | `transactions-first-row` | **Klick auf eine Zeile öffnet die Details.** Dort steht alles, was zu dieser Buchung bekannt ist — und dort korrigierst du sie. |
| 2 | **öffnet** die Detailansicht | `transaction-detail` | **Die Detailansicht.** Auf dem Desktop rechts neben der Liste, auf dem Handy als Blatt von unten. Die Liste bleibt daneben sichtbar. |
| 3 | Hervorhebung | `detail-basics` | **Datum, Beschreibung, Betrag, Konto.** Das kommt aus dem Import und stimmt fast immer. Ändern kannst du es trotzdem — etwa wenn dein Kontoauszug kryptisch ist. |
| 4 | Hervorhebung | `detail-payee` | **Zahlungsempfänger.** Danach erkennt die App Wiederholungen. Ein aufgeräumter Name hier hilft der automatischen Zuordnung später. |
| 5 | **Hervorhebung der Auswahl** | `detail-category` | **Kategorie und Unterkategorie sind schon gesetzt** — die App hat sie aus dem Text geraten. Stimmt sie nicht, stell sie hier um; erst zwei Ebenen ergeben eine brauchbare Auswertung. |
| 6 | Hervorhebung | `detail-apply-similar` | **Auf ähnliche anwenden.** Damit gilt deine Korrektur für alle Buchungen desselben Empfängers — und für künftige gleich mit. Aus einer Korrektur wird eine Regel. |
| 7 | Hervorhebung | `detail-expense-class` | **Ausgabenklasse.** Sagt, wie fest die Ausgabe ist — davon lebt die Budget-Planung. Fixkosten kannst du nicht kürzen, den Rest schon. |
| 8 | Hervorhebung | `detail-tax` | **Steuer-Rubrik.** Was absetzbar ist, markierst du hier einmal und findest es im Frühjahr wieder — statt Belege zu suchen. |
| 9 | Hervorhebung | `detail-transfer` | **Umbuchung.** Geld von deinem Giro- auf dein Sparkonto ist keine Ausgabe. So markiert, zählt es in keiner Auswertung mehr als Ausgabe mit. |
| 10 | Hervorhebung | `detail-contract` | **Verhält sich wie ein Vertrag.** Erkennt die App eine Wiederholung nicht selbst, sagst du es ihr hier — samt Rhythmus. Danach taucht sie unter „Abos & Verträge" auf. |
| 11 | Hervorhebung | `detail-visibility` | **Ausblenden statt löschen.** Eine ausgeblendete Buchung bleibt erhalten, zählt aber nicht mehr mit. Löschen ist daneben — und endgültig. |

## Akt IV — Aufteilen

| # | Mechanik | Anker | Text (DE) |
|---|---|---|---|
| 1 | **öffnet** das Aufteilen-Panel | `split-panel` | **Eine Buchung, mehrere Kategorien.** Beim Discounter landen Lebensmittel und eine Jeans auf demselben Beleg — hier trennst du sie. |
| 2 | Hervorhebung erste Zeile | `split-row` | **Eine Zeile je Teil.** Kategorie wählen, Betrag eintragen, bei Bedarf eine Notiz dazu. |
| 3 | Hervorhebung | `split-add-row` | **Weitere Teile hinzufügen.** So viele, wie der Beleg hergibt. |
| 4 | **Hervorhebung Gesamtbetrag** | `split-remaining` | **Achte auf den Rest.** Hier steht, was noch nicht zugeordnet ist. Passt die Summe nicht zum Gesamtbetrag, warnt die App — eine halb aufgeteilte Buchung verfälscht sonst jede Auswertung. |
| 5 | Hervorhebung | `split-fill-remaining` | **Rest zuweisen.** Nimmt dir das Rechnen ab: Der offene Betrag wandert in die markierte Zeile. |
| 6 | Hervorhebung | `split-save` | **Speichern.** Danach erscheint die Buchung in der Liste eingerückt mit ihren Teilen — aufklappbar über den Pfeil rechts. |

---

## Anker, die dafür gesetzt werden müssen

Alle über `data-tour-id`. Keiner adressiert sichtbaren Text — eine Umbenennung
darf die Führung nie brechen.

| Anker | Ort |
|---|---|
| `transactions-page` | `TransactionsPage`, Inhalts-Container |
| `transactions-search` | `TransactionsListPane`, Suchfeld |
| `filter-timerange`, `filter-category`, `filter-account`, `filter-contract`, `filter-essential` | `TransactionFilters`, je Select |
| `filter-reset` | `TransactionsListPane`, Zurücksetzen-Knopf |
| `transactions-stats` | `TransactionStats` |
| `transactions-add` | `TransactionsPage`, Kopf-Knopf |
| `transactions-first-row`, `transactions-day-header`, `transactions-running-balance` | `TransactionDayList`, jeweils nur am **ersten** Element |
| `transaction-detail`, `detail-basics`, `detail-payee`, `detail-category`, `detail-apply-similar`, `detail-expense-class`, `detail-tax`, `detail-transfer`, `detail-contract`, `detail-visibility` | `TransactionDetailsPanel` |
| `split-panel`, `split-row`, `split-add-row`, `split-remaining`, `split-fill-remaining`, `split-save` | `TransactionSplitPanel` |

## Regeln, die aus dem Drehbuch folgen

1. **Ein Schritt, eine Sache.** Sobald ein Text zwei Bedienelemente erklärt,
   gehört er geteilt.
2. **Der Text sagt, was es *nützt*, nicht was es *ist*.** „Auf ähnliche
   anwenden" ist der Name; „aus einer Korrektur wird eine Regel" ist der Grund.
3. **Kein Schritt ohne sichtbares Ziel.** Fehlt der Anker zur Laufzeit, wird
   der Schritt übersprungen — nie blockiert.
4. **Was der Schritt braucht, öffnet er selbst.** Kein „bitte klicke jetzt
   auf …", das die Führung dem Zufall überlässt.
5. **Kein Schritt zeigt auf ein Schloss.** Eine Führung, die auf eine
   Tarif-Schranke zeigt, verkauft, statt zu erklären. Haushalts-Aufteilung und
   Anlässe bekommen deshalb keinen Schritt — und beim Bauen kam heraus, dass
   auch das **Aufteilen selbst** hinter `FeatureGate splitTransactions` liegt:
   Akt IV läuft daher nur mit Zugang (`hasPremiumAccess` in der
   Kapitel-Voraussetzung). Ohne diesen Fund hätte die Führung Freinutzer vor
   ein Schloss geführt.
