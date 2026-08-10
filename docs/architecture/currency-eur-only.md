# Währung: EUR-only, ohne Multi-Currency-Vorbereitung

Status: verbindliche Konvention (ADR). **Entschieden am 2026-07-02** als
Querschnitts-Vorentscheidung **VE-1** im Umsetzungsleitfaden zum Code-Audit
(`docs/archive/umsetzungsleitfaden-2026-07-02.md`, Teil C; Auslöser war Befund
**F-DEBT-2** in `docs/archive/codequalitaet-audit-2026-07-02.md`).
**Nachgetragen als ADR am 2026-08-09** im Rahmen des Qualitätsprogramms 10/10,
Arbeitspaket 7.5 (Befund GOV-4 in `docs/qualitaet-2026-08/audit.md`).

Geltende Kurzform: `docs/coding-guide.md` §4. Das Programm 10/10 führt „keine
Multi-Currency-Vorbereitung" ausdrücklich unter „Was dieses Programm bewusst
NICHT tut" (`docs/qualitaet-2026-08/plan.md`).

## Kontext

Fintracker rechnet in Euro: jede Aggregation, jeder Puffer, jede Prognose, jede
Steuerauswertung. Das Datenmodell trägt trotzdem an mehreren Stellen ein
Währungsfeld — `Transaction.currency` (optional, `src/lib/transaction-types.ts`),
`Account.currency`, `Portfolio.currency` und `PortfolioPosition.currency`
(`src/lib/portfolio-types.ts`). Es kommt dort nicht aus einer
Multi-Currency-Absicht, sondern von den Importquellen: GoCardless liefert
`transactionAmount.currency` je Buchung, der CSV-Import kennt eine Spalte
`Waehrung`, eToro rechnet in USD.

Der Audit vom 02.07.2026 hat daraus den konkreten Schaden abgeleitet (F-DEBT-2):
`getPortfolioSummary` summierte den Marktwert über alle Positionen, USD wie EUR,
1:1 ins Nettovermögen — bei damaligem EUR/USD-Kurs rund 8 % Fehler auf der
Investment-Zeile. Der Audit hielt außerdem fest, dass EUR-only **nirgends
dokumentiert oder erzwungen** war; genau diese Lücke schließt dieses Dokument
für die Dokumentationshälfte.

## Entscheidung

**Die App ist EUR-only, bis auf Weiteres.** Es gibt keine Wechselkursquelle,
keine Umrechnung, keinen Kurs je Buchungstag und keine Basiswährungs-Einstellung.

Das Währungsfeld bleibt trotzdem im Modell und wird beim Import **mitgeführt**
statt weggeworfen (`transaction-service.ts:192`, `gocardless-sync-service.ts:332`,
`account-service.ts:97`, `portfolio-service.ts:105` — jeweils
`currency: … || 'EUR'`). Eine importierte Fremdwährungsangabe verschwindet damit
nicht, sie wird nur nicht verrechnet.

VE-1 hat dazu eine zweite Hälfte mitentschieden: Nicht-EUR soll abgewiesen oder
sichtbar als „nicht verrechnet" markiert werden, **nie stumm 1:1 als EUR
summiert**. Für **Depot und Nettovermögen** ist das seit WP 7.7 eingelöst
(siehe „Preis", Punkt 1); für **Konten und Buchungen** steht es weiterhin aus
(Punkte 2 und 3).

Daraus folgt die Regel, die der Code seither trägt: **Summiert wird nur
Gleichwährendes.** Innerhalb eines Depots ist die Depotwährung die
Rechenwährung — ein eToro-Depot in USD zeigt seine Kennzahlen ehrlich in USD;
im Nettovermögen ist die Rechenwährung immer der Euro. Beide Zerlegungen stehen
an einer Stelle (`src/lib/portfolio-currency.ts`), damit sie nicht
auseinanderlaufen.

## Verworfene Alternativen

**Echte Multi-Currency mit Umrechnung.** Verworfen wegen der Kette, die daran
hängt: eine Kursquelle (also ein Netzabruf — in einer local-first App eine neue
Datenabflussgrenze, `docs/security-boundaries.md`), Kurshistorie je
Buchungsdatum statt Tageskurs, ein persistierter Umrechnungskurs je Buchung
(sonst ändern sich vergangene Monatsabschlüsse rückwirkend), und eine Antwort
auf die steuerliche Frage, welcher Kurs für die EÜR gilt. *Rekonstruiert:* Der
Leitfaden nennt nur das Ergebnis („keine FX-Integration in dieser Welle",
T1.11); die Aufzählung der Folgekosten ist aus dem Code und der local-first-Regel
abgeleitet, nicht zitiert.

**Das Währungsfeld ganz entfernen.** Verworfen, weil die Importquellen den Wert
liefern und sein Wegwerfen aus fremdwährungsbehafteten Daten *stillschweigend*
Euro machen würde — genau der Fehler aus F-DEBT-2, nur eine Ebene früher und
ohne Chance, ihn später zu bemerken. *Rekonstruiert* aus dem Umgang im Code
(überall `|| 'EUR'` statt Verwerfen); als Alternative ist sie nirgends
schriftlich abgewogen.

## Preis

**Das teuerste an dieser Entscheidung ist nicht die fehlende Umrechnung,
sondern die fehlende Durchsetzung.**

1. ~~**Die zweite Hälfte von VE-1 ist offen.**~~ **Erledigt in WP 7.7**
   (T1.11). `getPortfolioSummary` summiert nur noch Positionen in der
   Depotwährung und liefert den Rest als `unconverted_positions` (Symbol,
   Währung, Marktwert in der Fremdwährung); `getNetWorthBreakdown` nimmt nur
   den Euro-Anteil in `investments` und weist den Rest als
   `unconvertedInvestments` aus. Beide Flächen zeigen ihn über denselben
   Baustein `features/shared/presentation/UnconvertedCurrencyNotice`.
   Belegt durch `[REGRESSION]`-Tests in `portfolio-service.test.ts`,
   `net-worth-service.currency.test.ts`, `portfolio-currency.test.ts` sowie
   bilinguale Flächentests für Depot und Nettovermögen.
   **Das Demo-Portfolio behält seine zwei USD-Positionen** (AAPL, MSFT):
   Sie zeigen den Hinweis im Auslieferungszustand, statt die Fremdwährung
   wegzudefinieren — die Demo ist damit ehrlich *und* erklärt die Regel.
   Gemessen: Der Demo-Gesamtwert sinkt von 8.231,10 € auf 4.337,00 €, und
   genau die Differenz (3.894,10 $) war der stumme Fehler.
   Beim Nachziehen fiel dieselbe Umdeutung eine Zeile tiefer auf: Die
   Positionstabelle beschriftete Gewinn/Verlust mit der **Depot**währung, über
   dem Gewinn einer USD-Position stand also ein Euro-Zeichen
   (`PositionTable.tsx`). Sie liest jetzt `position.currency` wie die beiden
   Kursspalten daneben; die dafür durchgereichte `currency`-Prop entfällt
   ersatzlos.
2. **Auch auf der Buchungsseite gibt es keine Abweisung.** `saveTransactions`
   validiert Datum und Cent-Genauigkeit (`transaction-service.ts:170-183`),
   aber nicht die Währung; `sumIncome`/`sumExpenses`
   (`src/lib/analysis-data.ts:23-35`) addieren jede Buchung ohne Währungsprüfung.
3. ~~**Die Oberfläche verspricht mehr, als die Rechnung hält.**~~ **Die
   Neuanlage ist geschlossen** (VE-1, „Blutung stoppen"): Der Kontodialog
   bietet nur noch EUR an (`src/components/accounts/AccountFormDialog.tsx`,
   `waehrungsOptionen()`). Ein Fremdwährungskonto ist über die Oberfläche
   **nicht mehr neu anlegbar**; die Kontoliste zeigt die Währung weiterhin an
   (`features/accounts/presentation/AccountList.tsx:164`).

   **Bestandsdaten bleiben unangetastet.** Trägt das bearbeitete Konto bereits
   eine andere Währung (Bestand oder Import), bleibt genau diese eine wählbar
   und wird als ihr Code angezeigt. Das ist kein Zugeständnis, sondern die
   Vermeidung eines schlimmeren Fehlers: Ein Radix-`Select` mit einem Wert ohne
   passenden `SelectItem` zeigt einen **leeren** Auslöser — der Nutzer sähe ein
   scheinbar unausgefülltes Pflichtfeld, wählte EUR, und das Zurücknehmen des
   Angebots hätte Bestandsdaten stillschweigend umgeschrieben. Der Weg zurück
   nach EUR steht offen, der Weg zu einer neuen Fremdwährung ist zu. Dazu ein
   Hinweistext, sobald die gewählte Währung nicht EUR ist
   (`accounts.formDialog.currencyForeignHint`) — er sagt, dass nicht
   umgerechnet wird, und behauptet ausdrücklich **nicht**, die Buchungen seien
   ausgenommen. Die drei Beschriftungen `currencyUsd`/`currencyGbp`/
   `currencyCHF` sind damit in allen vier Sprachbäumen entfallen; eine
   Handliste hätte für jeden anderen ISO-Code ohnehin leer gelassen.
   Belegt durch vier `[REGRESSION]`-Tests in
   `src/components/accounts/__tests__/AccountFormDialog.test.tsx` (nur EUR
   wählbar, bilingual; Bestands-USD-Konto zeigt und **speichert** weiterhin
   USD).

   **Offen bleibt der eigentliche Rechenfehler.** Ein Bestandskonto in USD
   schickt seine Buchungen unverändert 1:1 als Euro in jede Aggregation. Was
   hier geschlossen wurde, ist die Neuanlage, nicht die Verrechnung.

   **Nachgeprüft in WP 7.7, und bewusst dort belassen.** `Account.currency` wird
   ausschließlich *geschrieben* (`account-service.ts:97`) und *angezeigt*
   (`AccountList.tsx:164`); **keine** Rechnung liest sie. Ein USD-Konto wirkt
   deshalb nicht nur auf den Saldo (`net-worth-service`, `cash`), sondern über
   seine Buchungen auf `sumIncome`/`sumExpenses` (`lib/analysis-data.ts`) und
   damit auf Analyse, Budgets, Prognose, EÜR und Finanzgesundheit.
   Das ist der Grund, warum hier **nicht** dieselbe Bauform wie beim Depot
   greift: Beim Depot ist die Position der Rechenposten und der einzige
   Anschluss die Vermögenszeile. Beim Konto ist die **Buchung** der
   Rechenposten, und sie hat sechs Anschlüsse. Nur den Saldo aus `cash`
   herauszunehmen, während dieselben Buchungen weiter als Einnahme und Ausgabe
   zählen, wäre keine halbe Lösung, sondern eine neue Ungereimtheit: zwei
   Flächen, die sich über dieselben Daten widersprechen. Wer den Rest schließt,
   entscheidet deshalb zuerst über die Buchungen (abweisen bei `saveTransactions`
   vs. markieren in jeder Aggregation) — die *Verrechnung* im Kontodialog ist
   die Folge dieser Entscheidung, nicht ihr Anfang. Das *Angebot* im Dialog
   war davon unabhängig und ist deshalb vorgezogen worden: Es braucht keine
   Produktentscheidung, um aufzuhören, einen Zustand anzubieten, den die App
   nicht rechnen kann.
4. **Kein Wächter — für die Depotseite jetzt aber Tests.** Ein Skript, das eine
   neue Fremdwährungsquelle rot macht, gibt es weiterhin nicht (§12 in
   `AGENTS.md`). Für Depot und Nettovermögen ist die Regel seit WP 7.7
   immerhin durch `[REGRESSION]`-Tests festgenagelt: Wer dort wieder 1:1
   summiert, bekommt vier rote Tests. Für den **Kontodialog** gilt seit VE-1
   („Blutung stoppen") dasselbe: Wer USD, GBP oder CHF wieder anbietet,
   bekommt zwei rote Tests. Für die **Buchungen** (Punkt 2) gilt der Befund
   unverändert — dort würde nichts rot.

Diese vier Punkte sind der reale Preis der Entscheidung im heutigen Stand —
**nicht** eine Neuentscheidung: EUR-only bleibt. Wer die Lücke schließt, hat
zwei anerkannte Wege (abweisen oder sichtbar als „nicht verrechnet" markieren);
beide stehen bereits in VE-1 und brauchen keine neue Abwägung, nur Arbeit.
