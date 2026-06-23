# Befunde: Modell-Benchmark für tägliche Transaktionsprognosen

> Status: **Demo-Lauf auf synthetischem Datensatz** (`load.make_synthetic`). Mit echten
> CSV-Exporten erneut ausführen und diese Tabelle ersetzen, bevor die TS-Profile final
> kalibriert werden. Confidence der Default-Architektur (Research-Doc): 0,86 —
> Confidence für genau einen Einzelsieger: 0,62.

## Setup

- Zielserie: tägliche **variable Ausgaben** (ohne Wiederkehrer/Transfers/Einnahmen).
- Rolling-Origin-Backtest, 6 Folds, Horizont 14 Tage, `min_train=120`.
- Baseline für MASE: seasonal-naive mit Periode 7 (Wochenmuster).

## Ergebnis (synthetisch, 540 Tage)

| Modell | MAE | MASE | Anmerkung |
|---|---|---|---|
| SARIMAX (1,0,1)(1,0,1,7) | 39.87 | **0.661** | bestes Modell |
| UCM (local level + seasonal 7) | 40.24 | 0.670 | strukturell, gleichauf |
| ETS (add seasonal 7) | 40.30 | 0.670 | starke, billige Baseline |
| naive_mean | 43.30 | 0.716 | |
| STL + ETS | 53.11 | 0.881 | hier schwächer (synth. Trend flach) |
| seasonal_naive | 54.89 | 0.912 | Referenz |
| TBATS | — | — | optionale Lib nicht installiert |
| LightGBM | — | — | optionale Lib nicht installiert |

## Empirisches Wochentags-Profil (direkter Input für Phase 1)

Aus derselben Serie abgeleitete, auf Mittel = 1.0 normierte Gewichte:

| Mo | Di | Mi | Do | Fr | Sa | So |
|---|---|---|---|---|---|---|
| 0.60 | 0.89 | 0.55 | 0.82 | 1.10 | 1.49 | 1.55 |

Monatsende-Effekt (Tag ≥ 25 vs. Rest): **×1.07**.

## Schlussfolgerungen für die TS-Implementierung

1. **Wochenmuster ist signifikant und dominant.** Alle saisonalen Modelle schlagen die
   seasonal-naive-Baseline deutlich (MASE ≈ 0.66–0.67 vs. 0.91). Das empirische Profil
   rekonstruiert sauber den eingebauten Wochengang (Sa/So ≈ 1.5, Mo/Mi ≈ 0.6).
   → **Phase 1 (Wochentags-Gewichte) ist gerechtfertigt und genügt als Kern.**
2. **Kein schweres In-App-Modell nötig.** ETS/UCM liegen praktisch gleichauf mit SARIMAX
   bei minimalem Aufwand. Die leichtgewichtige TS-Profil-Approximation (Wochentag +
   optional Monatstag/Payday) reicht, um den linearen Abfall zu ersetzen. SARIMAX/UCM/
   TBATS bleiben Offline-Validierung.
3. **Monatstag/Payday-Effekt ist schwach** (×1.07 im synthetischen Set). In echten Daten
   prüfen; nur als optionale zweite Profil-Dimension umsetzen, wenn signifikant.
4. **Mehrfachsaison/TBATS** war hier nicht nötig. Erst aktivieren, wenn die EDA auf echten
   Daten zusätzlich eine klare Jahressaison zeigt.
5. **STL** war auf der trendarmen synthetischen Serie schwächer; auf echten Daten mit
   stärkerem Trend/Ausreißern (Phase 2, robust) erneut bewerten.

## Nächste Schritte

- Mit echtem Export laufen lassen: `python benchmark.py --csv <export>.csv --target variable`.
- `tbats`/`lightgbm` aus `requirements.txt` einkommentieren, um die optionalen Challenger
  mitzubewerten.
- Befund (Wochentags-Gewichte) als Default in `src/lib/forecast-profile.ts` (Phase 1)
  übernehmen.
