"""Rolling-Origin-Benchmark verschiedener Forecast-Modelle auf der täglichen
variablen Ausgaben-Serie (oder Netto-Cashflow).

Ziel: empirisch bestimmen, welche Saisonstruktur (Wochentag/Monatstag/Payday)
signifikant ist, um die TS-Profile in der App zu kalibrieren.

Nutzung:
    python benchmark.py --synthetic --target variable
    python benchmark.py --csv transactions.csv --target net
"""
from __future__ import annotations

import argparse
import warnings

import numpy as np
import pandas as pd

import load

warnings.filterwarnings("ignore")  # statsmodels-Konvergenzwarnungen ausblenden

SEASONAL_PERIOD = 7  # Wochenmuster


# --------------------------------------------------------------------------- #
# Fehlermaße
# --------------------------------------------------------------------------- #
def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def mase(y_true: np.ndarray, y_pred: np.ndarray, y_train: np.ndarray,
         period: int = SEASONAL_PERIOD) -> float:
    """MASE relativ zur seasonal-naive-Baseline auf den Trainingsdaten."""
    if len(y_train) <= period:
        return float("nan")
    scale = np.mean(np.abs(y_train[period:] - y_train[:-period]))
    if scale == 0:
        return float("nan")
    return mae(y_true, y_pred) / scale


def pinball(y_true: np.ndarray, q_pred: np.ndarray, q: float) -> float:
    diff = y_true - q_pred
    return float(np.mean(np.maximum(q * diff, (q - 1) * diff)))


# --------------------------------------------------------------------------- #
# Modelle: jede Funktion gibt eine Punktprognose über `horizon` Tage zurück.
# --------------------------------------------------------------------------- #
def fc_mean(train: pd.Series, horizon: int) -> np.ndarray:
    return np.repeat(train.mean(), horizon)


def fc_seasonal_naive(train: pd.Series, horizon: int) -> np.ndarray:
    last = train.values[-SEASONAL_PERIOD:]
    return np.array([last[i % SEASONAL_PERIOD] for i in range(horizon)])


def fc_ets(train: pd.Series, horizon: int) -> np.ndarray:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    model = ExponentialSmoothing(
        train, trend=None, seasonal="add", seasonal_periods=SEASONAL_PERIOD
    ).fit()
    return np.asarray(model.forecast(horizon))


def fc_sarimax(train: pd.Series, horizon: int) -> np.ndarray:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    model = SARIMAX(
        train, order=(1, 0, 1), seasonal_order=(1, 0, 1, SEASONAL_PERIOD),
        enforce_stationarity=False, enforce_invertibility=False,
    ).fit(disp=False)
    return np.asarray(model.forecast(horizon))


def fc_ucm(train: pd.Series, horizon: int) -> np.ndarray:
    from statsmodels.tsa.statespace.structural import UnobservedComponents
    model = UnobservedComponents(
        train, level="local level", seasonal=SEASONAL_PERIOD
    ).fit(disp=False)
    return np.asarray(model.forecast(horizon))


def fc_stl_ets(train: pd.Series, horizon: int) -> np.ndarray:
    from statsmodels.tsa.forecasting.stl import STLForecast
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    stlf = STLForecast(
        train, ExponentialSmoothing, period=SEASONAL_PERIOD,
        model_kwargs=dict(trend="add"),
    ).fit()
    return np.asarray(stlf.forecast(horizon))


def fc_tbats(train: pd.Series, horizon: int) -> np.ndarray:
    from tbats import TBATS  # optional
    estimator = TBATS(seasonal_periods=[7, 30.4], use_box_cox=False)
    fitted = estimator.fit(train.values)
    return np.asarray(fitted.forecast(steps=horizon))


def _calendar_features(index: pd.DatetimeIndex) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "dow": index.dayofweek,
            "dom": index.day,
            "is_weekend": (index.dayofweek >= 5).astype(int),
            "is_month_end": (index.day >= 25).astype(int),
            "days_since_payday": ((index.day - 1) % 30),  # Proxy: Gehalt am 1.
        },
        index=index,
    )


def fc_lightgbm(train: pd.Series, horizon: int) -> np.ndarray:
    """LightGBM mit Lag-/Kalender-/Payday-Features, rekursive Mehrschritt-Prognose."""
    import lightgbm as lgb  # optional

    lags = [1, 2, 3, 7, 14, 28]

    def build(series: pd.Series) -> pd.DataFrame:
        feat = _calendar_features(series.index).copy()
        for lag in lags:
            feat[f"lag_{lag}"] = series.shift(lag).values
        feat["y"] = series.values
        return feat.dropna()

    frame = build(train)
    x_cols = [c for c in frame.columns if c != "y"]
    model = lgb.LGBMRegressor(
        n_estimators=300, learning_rate=0.05, num_leaves=31,
        objective="quantile", alpha=0.5, verbose=-1,
    )
    model.fit(frame[x_cols], frame["y"])

    history = train.copy()
    preds: list[float] = []
    for _ in range(horizon):
        next_day = history.index[-1] + pd.Timedelta(days=1)
        row = _calendar_features(pd.DatetimeIndex([next_day]))
        for lag in lags:
            row[f"lag_{lag}"] = history.values[-lag] if len(history) >= lag else 0.0
        yhat = float(model.predict(row[x_cols])[0])
        preds.append(yhat)
        history = pd.concat([history, pd.Series([yhat], index=[next_day])])
    return np.array(preds)


MODELS = {
    "naive_mean": fc_mean,
    "seasonal_naive": fc_seasonal_naive,
    "ets": fc_ets,
    "sarimax": fc_sarimax,
    "ucm": fc_ucm,
    "stl_ets": fc_stl_ets,
    "tbats": fc_tbats,          # optional (tbats)
    "lightgbm": fc_lightgbm,    # optional (lightgbm)
}


# --------------------------------------------------------------------------- #
# Rolling-Origin-Backtest
# --------------------------------------------------------------------------- #
def rolling_backtest(series: pd.Series, horizon: int = 14, folds: int = 6,
                     min_train: int = 120) -> pd.DataFrame:
    n = len(series)
    if n < min_train + horizon:
        raise ValueError(
            f"Serie zu kurz: {n} Tage, brauche >= {min_train + horizon}."
        )

    # Gleichmäßig verteilte Origins über den hinteren Teil der Serie.
    origins = np.linspace(min_train, n - horizon, folds, dtype=int)
    records: list[dict] = []

    for name, fn in MODELS.items():
        fold_mae, fold_mase = [], []
        skipped = None
        for origin in origins:
            train = series.iloc[:origin]
            test = series.iloc[origin:origin + horizon]
            try:
                pred = fn(train, horizon)[:horizon]
            except ImportError:
                skipped = "Bibliothek fehlt"
                break
            except Exception as exc:  # Modell konvergiert nicht o. Ä.
                skipped = f"Fehler: {type(exc).__name__}"
                break
            fold_mae.append(mae(test.values, pred))
            fold_mase.append(mase(test.values, pred, train.values))

        if skipped:
            records.append(dict(model=name, mae=np.nan, mase=np.nan, note=skipped))
        else:
            records.append(dict(
                model=name,
                mae=round(float(np.mean(fold_mae)), 2),
                mase=round(float(np.nanmean(fold_mase)), 3),
                note="",
            ))

    result = pd.DataFrame.from_records(records).sort_values("mase", na_position="last")
    return result.reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="Pfad zum App-CSV-Export")
    parser.add_argument("--synthetic", action="store_true",
                        help="Synthetischen Demo-Datensatz verwenden")
    parser.add_argument("--target", choices=["variable", "net"], default="variable")
    parser.add_argument("--horizon", type=int, default=14)
    parser.add_argument("--folds", type=int, default=6)
    args = parser.parse_args()

    if args.synthetic or not args.csv:
        if not args.synthetic:
            print("Kein --csv angegeben → synthetischer Datensatz.\n")
        df = load.make_synthetic()
    else:
        df = load.load_transactions(args.csv)

    series = (
        load.daily_variable_series(df)
        if args.target == "variable"
        else load.daily_net_cashflow(df)
    )
    print(f"Zielserie: {series.name} | Tage: {len(series)} | "
          f"Mittel/Tag: {series.mean():.2f}\n")

    table = rolling_backtest(series, horizon=args.horizon, folds=args.folds)
    print(table.to_string(index=False))
    table.to_csv("results.csv", index=False)
    print("\nGeschrieben: results.csv")
    print("MASE < 1 = besser als die saisonale Wochen-Baseline (period=7).")


if __name__ == "__main__":
    main()
