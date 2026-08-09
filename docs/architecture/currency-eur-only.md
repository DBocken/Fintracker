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

VE-1 hat dazu eine zweite Hälfte mitentschieden, die **bis heute nicht
eingelöst** ist — siehe „Preis": Nicht-EUR-Buchungen sollen beim Import
abgewiesen oder sichtbar als „nicht verrechnet" markiert werden, **nie stumm
1:1 als EUR summiert**.

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

1. **Die zweite Hälfte von VE-1 ist offen.** Task T1.11 („Fremdwährung im
   Nettovermögen") ist nicht umgesetzt: `getPortfolioSummary`
   (`src/services/portfolio-service.ts:158-183`) summiert weiterhin
   `quantity × Preis` über **alle** Positionen ohne einen Blick auf
   `position.currency`; ein Flag `hasUnconvertedPositions` existiert nicht, und
   `net-worth-service.ts:113` übernimmt `summary.total_value` unverändert ins
   Nettovermögen. Das Demo-Portfolio liefert selbst zwei USD-Positionen (AAPL,
   MSFT, `portfolio-service.ts:200-201`) — der Fehler ist also schon im
   Auslieferungszustand sichtbar.
2. **Auch auf der Buchungsseite gibt es keine Abweisung.** `saveTransactions`
   validiert Datum und Cent-Genauigkeit (`transaction-service.ts:170-183`),
   aber nicht die Währung; `sumIncome`/`sumExpenses`
   (`src/lib/analysis-data.ts:23-35`) addieren jede Buchung ohne Währungsprüfung.
3. **Die Oberfläche verspricht mehr, als die Rechnung hält.** Der Kontodialog
   bietet USD, GBP und CHF zur Auswahl an
   (`src/components/accounts/AccountFormDialog.tsx:203-206`), die Kontoliste
   zeigt die Währung an (`features/accounts/presentation/AccountList.tsx:164`) —
   verrechnet wird trotzdem alles als Euro.
4. **Kein Wächter, kein Test.** Anders als die anderen Grundregeln dieses
   Repos (§12 in `AGENTS.md`) hat EUR-only keine maschinelle Absicherung. Eine
   neue Fremdwährungsquelle würde nichts rot machen.

Diese vier Punkte sind der reale Preis der Entscheidung im heutigen Stand —
**nicht** eine Neuentscheidung: EUR-only bleibt. Wer die Lücke schließt, hat
zwei anerkannte Wege (abweisen oder sichtbar als „nicht verrechnet" markieren);
beide stehen bereits in VE-1 und brauchen keine neue Abwägung, nur Arbeit.
