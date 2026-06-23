"""Datenladen & Aufbau der täglichen Residualserie für den Forecast-Benchmark.

Spiegelt die App-Logik (``src/lib/forecast-data.ts: buildVariableExpenseBaselines``):
variable Ausgaben = Ausgaben ohne Wiederkehrer (``is_contract``), ohne interne
Transfers (``is_transfer``) und ohne Einnahmen (``amount >= 0``).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# CSV-Schema entspricht den Feldern aus src/types.ts.
EXPECTED_COLUMNS = ["date", "amount", "payee", "category", "is_transfer", "is_contract"]


def _to_bool(series: pd.Series) -> pd.Series:
    """Akzeptiert true/false, 1/0, yes/no – robust gegen Export-Varianten."""
    return (
        series.astype(str)
        .str.strip()
        .str.lower()
        .isin({"true", "1", "yes", "y", "ja"})
    )


def load_transactions(csv_path: str) -> pd.DataFrame:
    """Lädt einen App-CSV-Export und normalisiert die relevanten Felder."""
    df = pd.read_csv(csv_path)
    missing = [c for c in ("date", "amount") if c not in df.columns]
    if missing:
        raise ValueError(f"CSV fehlt Pflichtspalten: {missing}")

    for col in ("is_transfer", "is_contract"):
        df[col] = _to_bool(df[col]) if col in df.columns else False
    if "category" not in df.columns:
        df["category"] = "Sonstiges"

    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    return df.dropna(subset=["date", "amount"])


def daily_variable_series(df: pd.DataFrame) -> pd.Series:
    """Tägliche variable Ausgaben (positive Beträge = ausgegebene Summe pro Tag).

    Lückenlose Tagesachse; Tage ohne Ausgabe = 0 (wichtig für Wochentagsmuster
    und intermittente Modelle).
    """
    mask = (~df["is_transfer"]) & (~df["is_contract"]) & (df["amount"] < 0)
    spend = df.loc[mask].copy()
    spend["spend"] = spend["amount"].abs()
    daily = spend.groupby("date")["spend"].sum()
    if daily.empty:
        return daily
    full_index = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    return daily.reindex(full_index, fill_value=0.0).rename("variable_spend")


def daily_net_cashflow(df: pd.DataFrame) -> pd.Series:
    """Täglicher Netto-Cashflow (alle Nicht-Transfer-Beträge, signiert)."""
    flow = df.loc[~df["is_transfer"]].groupby("date")["amount"].sum()
    if flow.empty:
        return flow
    full_index = pd.date_range(flow.index.min(), flow.index.max(), freq="D")
    return flow.reindex(full_index, fill_value=0.0).rename("net_cashflow")


def make_synthetic(days: int = 540, seed: int = 42) -> pd.DataFrame:
    """Reproduzierbarer Demo-Datensatz mit eingebautem Wochen-/Monatsmuster.

    Eingebaut, damit der Befund verifizierbar ist:
      - Gehalt am 1. jedes Monats (Wiederkehrer, is_contract)
      - Miete am 3. (Wiederkehrer)
      - variable Ausgaben mit Wochenend-Übergewicht (Fr/Sa/So) und
        leichtem Monatsende-Effekt, plus seltene Spikes.
    """
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2024-01-01")
    rows: list[dict] = []

    for i in range(days):
        d = start + pd.Timedelta(days=i)
        dow = d.dayofweek  # 0=Mo .. 6=So
        if d.day == 1:
            rows.append(dict(date=d, amount=2500.0, payee="Arbeitgeber",
                             category="Gehalt", is_transfer=False, is_contract=True))
        if d.day == 3:
            rows.append(dict(date=d, amount=-950.0, payee="Vermieter",
                             category="Miete", is_transfer=False, is_contract=True))

        # Variable Ausgaben: Wochenend-Übergewicht + Monatsende-Effekt.
        weekend = 1.9 if dow >= 4 else 1.0
        month_end = 1.3 if d.day >= 25 else 1.0
        n_events = rng.poisson(0.8 * weekend * month_end)
        for _ in range(n_events):
            amt = -float(rng.gamma(shape=2.0, scale=18.0))
            rows.append(dict(date=d, amount=round(amt, 2), payee="Supermarkt",
                             category="Lebensmittel", is_transfer=False,
                             is_contract=False))
        if rng.random() < 0.02:  # seltener großer Spike
            rows.append(dict(date=d, amount=-round(float(rng.gamma(2.0, 120.0)), 2),
                             payee="Elektronik", category="Shopping",
                             is_transfer=False, is_contract=False))

    return pd.DataFrame(rows)
