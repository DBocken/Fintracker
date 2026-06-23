# Offline-Research: Mathematische Modelle für tägliche Transaktionsprognosen

Dieses Verzeichnis ist **reine Offline-Forschung**. Es ist **nicht** Teil des
App-Bundles (kein Import aus `src/`), läuft lokal in Python und dient dazu, vor der
TS-Implementierung empirisch zu klären:

> **Welche Saison-/Profilstruktur** (Wochentag, Monatstag, Payday-Abstand,
> Jahressaison, Mehrfachsaison) ist in echten Daten signifikant — und welche
> Profil-Granularität muss die App (`src/lib/forecast-profile.ts`) abbilden, damit der
> heutige **lineare Saldo-Abfall zwischen Gehaltstagen** verschwindet?

Hintergrund: Der aktuelle Forecast verteilt variable Ausgaben gleichmäßig über den
Monat (`src/lib/forecast.ts`, Schritt 2). Ziel der App-Seite ist ein profilgewichtetes
Tagesmuster. Diese Studie validiert, welches Muster nötig ist.

## Zieldefinition

Wir modellieren die **tägliche variable Ausgaben-Residualserie**: alle Ausgaben
*ohne* erkannte Wiederkehrer (`is_contract`), *ohne* interne Transfers
(`is_transfer`) und *ohne* Einnahmen (`amount >= 0`). Das entspricht genau dem Teil,
den die App heute glättet. Optionale Zweitserie: **Netto-Cashflow** (alle Beträge).

## Modelle im Benchmark

| Modell | Bibliothek | Rolle |
|---|---|---|
| Naive (Gesamtmittel) | — | Untergrenze |
| Wochentagsmittel (seasonal naive, period=7) | — | starke Baseline |
| ETS / Exponential Smoothing | statsmodels | Baseline |
| SARIMAX (+ Kalender-Exogs) | statsmodels | Kernmodell |
| UnobservedComponents (UCM) | statsmodels | strukturell |
| STL + ETS/ARIMA | statsmodels | Wochenmuster + Rest |
| TBATS | `tbats` (optional) | Mehrfachsaison-Spezialist |
| LightGBM (Lag-/Kalender-/Payday-Features, Quantil) | `lightgbm` (optional) | tabellarischer Challenger |

Optionale Modelle werden übersprungen, wenn die Bibliothek fehlt (siehe
`requirements.txt`).

## Bewertung

Rolling-Origin-Backtest (mehrere Folds, expandierendes Fenster). Fehlermaße:
- **MAE** — absolute Genauigkeit
- **MASE** — relativ zur seasonal-naive-Baseline (period=7); < 1 = besser als Baseline
- **Pinball/Quantil-Loss** (P10/P50/P90) — Qualität der Unsicherheitsbänder

## Nutzung

```bash
cd research/forecasting
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# A) Mit echtem CSV-Export aus der App:
python benchmark.py --csv pfad/zu/transactions.csv --target variable

# B) Ohne Daten – synthetischer, reproduzierbarer Demo-Datensatz:
python benchmark.py --synthetic --target variable
```

Erwartetes CSV-Schema (Felder aus `src/types.ts`, Komma-getrennt, Header):
`date, amount, payee, category, is_transfer, is_contract`
(`amount` signiert: negativ = Ausgabe; `is_*` als `true`/`false`/`1`/`0`).

## Output

`benchmark.py` schreibt eine Ergebnis-Tabelle nach `results.csv` und gibt sie auf der
Konsole aus. Die Befunde (welche Komponenten signifikant sind, Confidence) werden
anschließend in `FINDINGS.md` festgehalten — das ist der Input für die TS-Phasen 1–4.
