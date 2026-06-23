#!/usr/bin/env python3
"""
Umfassende kategoriespezifische Analyse: Wochentag × Quartal × Trend × Volatilität

Verwendung:
    python3 analyze_categories.py /pfad/zu/transactions.csv

oder mit vorgegebener CSV (wenn im gleichen Verzeichnis):
    python3 analyze_categories.py transactions_converted.csv
"""
import sys
import csv
import pandas as pd
import numpy as np
from datetime import datetime
from collections import defaultdict

def load_transactions(csv_path):
    """Lädt CSV und normalisiert Felder."""
    df = pd.read_csv(csv_path)

    required = ["date", "amount"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV fehlt Spalten: {missing}")

    for col in ("is_transfer", "is_contract"):
        if col not in df.columns:
            df[col] = False
        else:
            df[col] = df[col].astype(str).str.lower().isin({"true", "1", "yes", "y", "ja"})

    if "category" not in df.columns:
        df["category"] = "Sonstiges"

    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    return df.dropna(subset=["date", "amount"])

def analyze_category(subset, category_name):
    """Analysiert eine einzelne Kategorie auf Saisonalität."""
    if len(subset) < 5:
        return None

    subset = subset.copy()
    subset["spend"] = subset["amount"].abs()
    subset["dow"] = subset["date"].dt.dayofweek
    subset["quarter"] = subset["date"].dt.quarter
    subset["year"] = subset["date"].dt.year

    # ===== WOCHENTAG =====
    dow_stats = subset.groupby("dow")["spend"].mean()
    dow_weights = (dow_stats / dow_stats.mean()).round(2)
    dow_range = dow_weights.max() - dow_weights.min()

    # ===== QUARTAL =====
    q_stats = subset.groupby("quarter")["spend"].mean()
    q_weights = {}
    if len(q_stats) > 0:
        q_base = q_stats.mean()
        q_weights = {i: round(q_stats.get(i, q_base) / q_base, 2) for i in range(1, 5)}
    q_range = max(q_weights.values()) - min(q_weights.values()) if q_weights else 0

    # ===== TREND (Jahr-über-Jahr) =====
    yearly = subset.groupby("year")["spend"].mean()
    yearly_range = (yearly.max() - yearly.min()) / yearly.mean() if yearly.mean() > 0 else 0

    # ===== VOLATILITÄT & HÄUFIGKEIT =====
    cv = subset["spend"].std() / subset["spend"].mean() if subset["spend"].mean() > 0 else 0
    daily = subset.set_index("date").resample("D")["spend"].sum()
    activity_rate = (daily > 0).sum() / len(daily) if len(daily) > 0 else 0

    # ===== MONATLICHES MUSTER (Dauerauftrag?) =====
    monthly = subset.groupby(subset["date"].dt.to_period("M"))["spend"].sum()
    monthly_cv = monthly.std() / monthly.mean() if monthly.mean() > 0 else 0
    is_recurring = monthly_cv < 0.15

    return {
        "category": category_name,
        "n_txn": len(subset),
        "days_span": (subset["date"].max() - subset["date"].min()).days,
        "date_range": f"{subset['date'].min().date()} — {subset['date'].max().date()}",
        "total_spend": subset["spend"].sum(),
        "avg_spend_per_txn": subset["spend"].mean(),
        "dow_range": dow_range,
        "dow_weights": dict(sorted(enumerate(dow_weights), key=lambda x: x[0])),
        "q_range": q_range,
        "q_weights": q_weights,
        "yearly_trend_pct": yearly_range * 100,
        "yearly_data": dict(yearly.items()),
        "activity_rate": activity_rate,
        "cv": cv,
        "monthly_cv": monthly_cv,
        "is_recurring": is_recurring,
    }

def main():
    if len(sys.argv) < 2:
        print("Verwendung: python3 analyze_categories.py <csv_pfad>")
        print("Beispiel:   python3 analyze_categories.py /home/user/transactions.csv")
        sys.exit(1)

    csv_path = sys.argv[1]

    try:
        df = load_transactions(csv_path)
    except Exception as e:
        print(f"Fehler beim Laden der CSV: {e}")
        sys.exit(1)

    print("\n" + "="*100)
    print("TRANSAKTIONS-ANALYSE: KATEGORIESPEZIFISCHE SAISONALITÄT")
    print("="*100)
    print(f"\nDatei: {csv_path}")
    print(f"Zeitbereich: {df['date'].min().date()} — {df['date'].max().date()}")
    print(f"Tage gesamt: {(df['date'].max() - df['date'].min()).days}")
    print(f"Transaktionen gesamt: {len(df)}")

    # Analysiere jede Kategorie
    results = []
    for cat in sorted(df[df["category"] != "Transfers"]["category"].unique()):
        subset = df[(df["category"] == cat) & (~df["is_transfer"].astype(bool))]
        analysis = analyze_category(subset, cat)
        if analysis:
            results.append(analysis)

    if not results:
        print("Keine Kategorien mit ausreichend Daten gefunden.")
        sys.exit(1)

    # ===== ÜBERSICHTSTABELLE =====
    print("\n" + "="*100)
    print("ÜBERSICHT")
    print("="*100)
    print(f"\n{'Kategorie':<25} {'Txn':<7} {'Tage':<8} {'Aktivität':<12} {'Wochentag':<12} {'Quartal':<12} {'Trend':<10}")
    print("-"*100)

    for r in results:
        activity = f"{r['activity_rate']*100:.1f}%"

        dow_char = "FLACH"
        if r["dow_range"] > 0.35:
            dow_char = "⚡ STARK"
        elif r["dow_range"] > 0.15:
            dow_char = "MITTEL"

        q_char = ""
        if r["q_range"] > 0.35:
            q_char = "⚡ STARK"
        elif r["q_range"] > 0.15:
            q_char = "SCHWACH"
        else:
            q_char = "KEINE"

        trend_char = ""
        if abs(r["yearly_trend_pct"]) > 15:
            trend_char = f"{r['yearly_trend_pct']:+.0f}%"
        else:
            trend_char = "STABIL"

        print(f"{r['category']:<25} {r['n_txn']:<7} {r['days_span']:<8} {activity:<12} {dow_char:<12} {q_char:<12} {trend_char:<10}")

    # ===== DETAILLIERTE BEFUNDE =====
    print("\n" + "="*100)
    print("DETAILLIERTE BEFUNDE PRO KATEGORIE")
    print("="*100)

    days_short = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

    for r in results:
        print(f"\n{'─'*100}")
        print(f"{r['category'].upper()}")
        print(f"{'─'*100}")
        print(f"  Zeitraum:         {r['date_range']}")
        print(f"  Transaktionen:    {r['n_txn']} | Gesamt: {r['total_spend']:.2f}€ | Ø pro Txn: {r['avg_spend_per_txn']:.2f}€")

        # Wochentag
        print(f"\n  📅 WOCHENTAG-PROFIL (1.0 = neutral):")
        dow_w = r["dow_weights"]
        for dow_idx, weight in dow_w.items():
            bar = "█" * int(weight * 10)
            print(f"      {days_short[dow_idx]}: {weight:.2f}  {bar}")
        print(f"      Spannweite: {r['dow_range']:.2f} (0.0=flach, 1.0+=stark)")

        # Quartal
        if r["q_weights"]:
            print(f"\n  🌡️  QUARTAL-PROFIL (Jahressaison):")
            for q in range(1, 5):
                w = r["q_weights"].get(q, 1.0)
                bar = "█" * int(w * 10)
                names = {1: "Q1 Jan-Mär", 2: "Q2 Apr-Jun", 3: "Q3 Jul-Sep", 4: "Q4 Okt-Dez"}
                print(f"      {names[q]}: {w:.2f}  {bar}")
            print(f"      Spannweite: {r['q_range']:.2f}")

        # Trend
        print(f"\n  📈 JAHRES-TREND:")
        for year, amount in sorted(r["yearly_data"].items()):
            print(f"      {int(year)}: {amount:.2f}€/Txn")
        if abs(r["yearly_trend_pct"]) > 0.1:
            direction = "📊 Anstieg" if r["yearly_trend_pct"] > 0 else "📉 Rückgang"
            print(f"      {direction}: {r['yearly_trend_pct']:+.1f}%")
        else:
            print(f"      ➡️  STABIL (Trend ≈ 0%)")

        # Volatilität
        print(f"\n  ⚡ VOLATILITÄT & MUSTER:")
        print(f"      Aktivität:        {r['activity_rate']*100:.1f}% der Tage mit Ausgaben")
        print(f"      Variationskoeff.: {r['cv']:.2f} (0.5=gering, 2.0+=sehr spiky)")
        print(f"      Monatliche CV:    {r['monthly_cv']:.3f}")
        print(f"      Typ:              {'🔄 DAUERAUFTRAG (stabil)' if r['is_recurring'] else '📊 VARIABEL (spiky)'}")

    # ===== MODELL-EMPFEHLUNGEN =====
    print("\n" + "="*100)
    print("MODELL-EMPFEHLUNGEN & PROGNOSE-STRATEGIE")
    print("="*100)

    for r in results:
        print(f"\n{r['category'].upper()}:")
        recs = []

        if r["is_recurring"]:
            recs.append("  → Regelmodell: Datum-basiert (z.B. jeden 1. des Monats)")
        else:
            recs.append("  → Prognosemodell: statistisch, nicht deterministisch")

        if r["dow_range"] > 0.30:
            recs.append(f"  → STARKE Wochentags-Saisonalität: separate Gewichte pro Tag")
            dow_w = r["dow_weights"]
            dominant = max(dow_w, key=dow_w.get)
            print(f"     (Schwerpunkt: {days_short[dominant]} mit Gewicht {dow_w[dominant]:.2f})")
        elif r["dow_range"] > 0.12:
            recs.append(f"  → Moderate Wochentags-Saisonalität: optional anwenden")

        if r["q_range"] > 0.30:
            recs.append(f"  → STARKE Jahressaison: Prognose per Quartal gewichten")
            dominant_q = max(r["q_weights"], key=r["q_weights"].get)
            recs.append(f"     (z.B. Q{dominant_q} stärker als Q{(dominant_q % 4) + 1})")
        elif r["q_range"] > 0.15:
            recs.append(f"  → Schwache Jahressaison: ggf. berücksichtigen")

        if abs(r["yearly_trend_pct"]) > 15:
            direction = "steigend" if r["yearly_trend_pct"] > 0 else "fallend"
            recs.append(f"  → TREND: {r['yearly_trend_pct']:+.0f}% {direction} → Prognose hochrechnen")

        if r["cv"] > 1.2 or r["activity_rate"] < 0.25:
            recs.append(f"  → Hochvolatil/sparse: Occurrence-Amount-Modell (Ereignis + Betrag)")

        for rec in recs:
            print(rec)

    print("\n" + "="*100)
    print("ZUSAMMENFASSUNG FÜR PHASE 1 IMPLEMENTIERUNG")
    print("="*100)

    strong_dow = sum(1 for r in results if r["dow_range"] > 0.30)
    strong_q = sum(1 for r in results if r["q_range"] > 0.30)
    trending = sum(1 for r in results if abs(r["yearly_trend_pct"]) > 15)

    print(f"\n✓ {strong_dow}/{len(results)} Kategorien: STARKE Wochentags-Saisonalität")
    print(f"✓ {strong_q}/{len(results)} Kategorien: STARKE Jahressaison-Saisonalität")
    print(f"✓ {trending}/{len(results)} Kategorien: signifikanter Jahres-Trend")

    print("\nEMPFOHLENE PROGNOSE-ARCHITEKTUR:")
    print("  1. Basis: Kategoriespezifische Wochentags-Profile (gewichtet nach Befund)")
    print("  2. Optional: Quartal-Faktoren für Kategorien mit Q_range > 0.30")
    print("  3. Optional: Trend-Anpassung für Kategorien mit Trend > ±15%")
    print("  4. Monte Carlo: Volatilität (CV) für Unsicherheitsbänder nutzen")
    print("  5. Occurrence-Amount für hochvolatile/sparse Kategorien")

    print("\n" + "="*100 + "\n")

if __name__ == "__main__":
    main()
