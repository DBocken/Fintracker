# Feature-Strategie & Budget-Engine 2.0

> Ziel: In jedem Direktvergleich mit den 10 Top-Apps (siehe `competitive-analysis.md`)
> besser dastehen — durch rechtssichere Übernahme bewährter Funktionen, Copilot-Niveau-UI
> und eine eigene, prognose-bewusste Budget-Methodik, die sich aus echten Daten speist.

---

## 0. Rechtssichere Feature-Übernahme (Kurz-Primer)

**Keine Rechtsberatung** – aber die Leitplanken sind eindeutig:

| Frei nachbaubar | Geschützt – nicht übernehmen |
|---|---|
| **Funktionen & Konzepte** (Rollover, Sweep, Zero-Based, Sparen-zuerst, Schneeball/Lawine) | **Marken/Namen**: „YNAB", „Baby Steps"®, „EveryDollar", „Finanzguru", „Monarch", „Flex Budgeting", „Age of Money" |
| **Methodische Prinzipien** (jede generische Budgetmethode) | **Wörtliche Texte** (Hilfeartikel, Onboarding-Copy, Slogans) |
| **Datengetriebene Eigenlogik** | **Icon-Sets, exakte Farbpaletten, Screen-Layouts** (Trade Dress) |
| | **Quellcode** der Wettbewerber |

**Regel für uns:** gleiche Funktion → **eigener Name, eigener Text, eigenes Visual**.
Vor Launch der gewählten Feature-Namen kurze Marken-Recherche (DPMA/EUIPO).

### Umbenennungstabelle (Marke → unser Begriff)

| Fremd (geschützt/assoziiert) | Unser eigener Begriff |
|---|---|
| „7 Baby Steps" (Ramsey®) | **„Dein Finanz-Fundament" – 6 Etappen** (bewusst 6, nicht 7; eigene Texte) |
| „Debt Snowball" / „Avalanche" | **Tilgungsplan: „klein-zuerst" / „teuer-zuerst"** (beschreibend, frei) |
| „Give Every Dollar a Job" (YNAB) | **„Jeder Euro mit Aufgabe" / Null-Saldo-Budget** |
| „Flex Budgeting" (Monarch) | **„3-Topf-Budget": Fix · Flexibel · Unregelmäßig** |
| „Age of Money" (YNAB) | **„Puffer-Reichweite" (Tage, die dein Geld vorausläuft)** |
| „Sinking Funds" | **„Rücklagen-Töpfe" / Sparziele** |

---

## 1. Budget-Tanks 2.0 – Rollover (Übertrag)

Heutiger Stand: `Budget.rollover?: boolean` (Stub, `src/types.ts:210`). Wir ersetzen das durch eine
echte Konfiguration und behalten Abwärtskompatibilität (`true` → `{ mode: 'accumulate' }`).

### 1.1 Modi

| Modus | Verhalten | Vorbild |
|---|---|---|
| `off` | Tank startet jeden Monat frisch beim Basislimit | klassisch |
| `accumulate` | **Nicht genutztes Budget wandert mit** → Folgemonat-Limit = Basis + Rest | „Ansparen" |
| `overspend` | **Überzug**: Überschreitung wird vom Folgemonat abgezogen → Start bei –x | YNAB-Stil |
| `both` | Positiver *und* negativer Übertrag | Vollautomatik |

> Exakt die vom Nutzer gewünschte Logik: „entweder Budget um x erhöht **oder** Start mit –x".

### 1.2 Datenmodell (Erweiterung `src/types.ts`)

```ts
export type RolloverMode = 'off' | 'accumulate' | 'overspend' | 'both';
export type SurplusAction = 'carry' | 'sweep_savings' | 'sweep_invest';

export interface BudgetRollover {
  mode: RolloverMode;
  /** Obergrenze des angesparten positiven Übertrags in EUR (0/undefined = unbegrenzt). */
  cap?: number;
  /** Was mit positivem Rest am Periodenende passiert (Default 'carry'). */
  surplusAction?: SurplusAction;
  /** Ziel für Sweep (Tagesgeld-Konto bzw. Sparziel). Siehe §2. */
  sweepTargetAccountId?: string;
  sweepTargetGoalId?: string;
}

export interface Budget {
  // ... bestehend ...
  rollover?: boolean;                 // @deprecated – via Migration auf rolloverConfig
  rolloverConfig?: BudgetRollover;    // NEU
}
```

Zusätzlich ein **Perioden-Ledger**, damit die Kette nachvollziehbar & testbar ist:

```ts
export interface BudgetPeriodLedger {
  budgetId: string;
  period: string;        // 'YYYY-MM'
  baseLimit: number;     // Basislimit (ggf. datengetrieben, §3)
  carryIn: number;       // Übertrag aus Vormonat (kann negativ sein)
  spent: number;         // tatsächliche Ausgaben der Periode
  carryOut: number;      // an Folgemonat weitergereicht
  swept?: number;        // per Sweep abgeflossener Überschuss (§2)
}
```

### 1.3 Berechnung (`src/lib/budget-logic.ts`)

```
effectiveLimit(m) = baseLimit(m) + max(carryIn(m), accumulateOnly ? 0 : -∞)
remaining(m)      = effectiveLimit(m) − spent(m)

carryOut(m) nach Modus:
  off:        0
  accumulate: clamp(max(0, remaining(m)), 0, cap)
  overspend:  min(0, remaining(m))
  both:       clamp(remaining(m), -∞, cap)

carryIn(m+1) = carryOut(m)  (bzw. carryOut(m) − swept(m), wenn surplusAction = sweep_*)
```

Der `BudgetStatus` bekommt zusätzlich `carryIn`, `effectiveLimit`, `carryOut`, damit der Tank
„über 100 %" (Ansparen) oder „startet im Minus" (Überzug) visualisieren kann.

### 1.4 UI

- Tank zeigt eine **zweite Markierung** „Basislimit" zusätzlich zum effektiven Limit.
- Bei `accumulate`: Über-100%-Bereich in zweiter Farbe („+87 € angespart").
- Bei `overspend`: Tank startet sichtbar mit rotem Sockel („−42 € aus Vormonat").
- Mini-Sparkline „Übertrag über 6 Monate".

---

## 2. Überschuss anlegen (Sweep: Tagesgeld / ETF)

**Wichtig & ehrlich:** Wir haben nur Lesezugriff (PSD2/AIS), **keine Zahlungsauslösung**. Wir
*bewegen* kein Geld, sondern machen die beste mögliche Aktion daraus:

| Sweep-Ziel | Umsetzung bei uns |
|---|---|
| **Tagesgeld** | Vorschlag „Lege 87 € beiseite" → **EPC-/GiroCode-QR** (wir nutzen die vorhandene `qrcode`-Dep) mit vorausgefülltem SEPA-Empfänger/Betrag → Nutzer scannt im Banking. Parallel virtuelle Befüllung eines **Rücklagen-Topfs/Sparziels** (Milestones bestehen bereits). |
| **ETF** | **Vorschlag + Aufklärung**: monatliche Sparplan-Rate, schlichte Projektion (z. B. 5 %/J über N Jahre), Hinweis „kein Anlage-/Steuerberatungs-Ersatz". Keine Ausführung; optional Deep-Link zum Broker-Sparplan. |

Ablauf am Periodenende, wenn `surplusAction = sweep_*`:
1. Positiven `carryOut` ermitteln.
2. Sweep-Betrag dem Sparziel/Topf gutschreiben (virtuell), `swept` im Ledger setzen.
3. GiroCode-QR + Handlungs-Karte im „Monatsabschluss" anzeigen.
4. **Prognose-Gate (USP):** Sweep nur vorschlagen, wenn der Monte-Carlo-Forecast die nächsten
   60 Tage nicht „rot" sieht. Sonst Hinweis „Liquidität zuerst sichern".

---

## 3. Eigene Methodik: der **Liquiditäts-Wasserfall** (datengetrieben & prognose-bewusst)

Unsere Abgrenzung ist nicht „noch eine Budgetmethode", sondern **Budgets, die (a) sich aus echten
Daten selbst befüllen und (b) die Zukunft kennen** (Monte-Carlo-Forecast). Das kann keine der 10 Apps.

### 3.1 Der Wasserfall (Reihenfolge der Mittelverwendung)

```
1. Einkommen        → automatisch aus erkannten Gehalts-/Einnahme-Mustern
2. Sparen zuerst    → Pay-yourself-first: fixer % ODER Betrag wird VORAB reserviert
3. Existenzsichernd → Fixkosten (wir klassifizieren bereits 'existenzsichernd', types.ts)
4. Variable Töpfe   → Rest nach Null-Saldo („jeder Euro eine Aufgabe")
5. Überschuss       → Rollover (§1) oder Sweep (§2)
```

> Erfüllt den Nutzerwunsch exakt: „Sparen von vornherein befüllen, Rest nach YNAB-Prinzip".
> Stufe 2 ist abschaltbar/justierbar; ohne sie ist es reines Null-Saldo-Budget.

### 3.2 Budgets aus realen Daten (**Adaptive Tanks**)

- **Baseline** je Kategorie = **Median** (robust gegen Ausreißer) der letzten 3–6 Monate, nicht
  Durchschnitt. Der bestehende Vorschlag (Ø + 15 %) wird darauf umgestellt.
- **Saisonalität:** Monatsfaktor (z. B. Dezember/Urlaubsmonate) aus der Historie.
- **Auto-Retune:** monatlicher Drift-Hinweis „Lebensmittel real 480 € vs. Limit 400 € – anpassen?".
- **Konfidenz:** Tanks mit dünner Datenbasis (< 3 Monate) werden als „lernend" markiert.

### 3.3 Prognose-bewusst (der eigentliche Burggraben)

- Der Wasserfall prüft gegen die **deterministische + Monte-Carlo-Liquiditätsprognose**:
  empfiehlt keine Spar-/Investquote, die in den nächsten Wochen ein Liquiditätsloch (P10) reißt.
- „Sicher investierbar diesen Monat: **120 €**" — eine Zahl, die sonst niemand liefert.

---

## 4. Copilot-Niveau-UI – konkrete Vorschläge

Copilots Stärke ist Politur & Flow (nicht klauen — Prinzipien übernehmen, eigenes Visual):

1. **„Zu prüfen"-Inbox**: auto-kategorisierte/unsichere Tx als Swipe-Stapel (bestätigen/ändern),
   statt Liste — nutzt unsere Confidence-Scores (die Copilot *nicht* erklärt → wir zeigen den Grund).
2. **Flüssige Tank-Animation**: Framer-Motion-Spring beim Füllen (Lib vorhanden).
3. **Konsistentes Kategorie-Token-System**: Farbe + Icon + Monogramm-Fallback, app-weit identisch.
4. **„Dieser Monat"-Karten** auf dem Dashboard: Ausgegeben · Trend vs. Vormonat · **Forecast bis Monatsende**.
5. **Command-Palette / Smart Search** (⌘K): springe zu Konto/Kategorie/Transaktion.
6. **Mobile Haptics** (Capacitor Haptics) bei Bestätigen/Swipe; reduzierte Bewegung respektieren.
7. **Charts entschlacken**: weniger Gridlines, Tap-für-Detail, klare leere Zustände/Onboarding.
8. **Geschwindigkeit als Feature**: Local-First = sofort. Aktiv kommunizieren („0 ms, offline-fähig").

---

## 5. „Besser als alle 10" – Konter-Matrix

| App | Ihre Stärke | Unser Zug zum Übertreffen |
|---|---|---|
| Finanzguru | Vertragserkennung + Kündigung | Erkennung haben wir → **+ Bargeld/Beleg-OCR** (ihre Reviews-Lücke), **werbefrei**, Kündigung nachrüsten |
| YNAB | Zero-Based-Erziehung | **Wasserfall** = Zero-Based **+ Sparen-zuerst + datengetrieben**, ohne steile Lernkurve |
| EveryDollar | Baby-Steps-Programm | **„Finanz-Fundament" (6 Etappen)**, automatisch aus Daten erkannt statt manuell |
| Monarch | Investments/Net Worth | Portfolio produktreif machen; **prognose-bewusster Sweep** als Mehrwert |
| Copilot | UI/KI-Kategorisierung | UI nach §4 angleichen; **erklärbare** Kategorisierung schlägt Black-Box |
| Rocket Money | Abo-Kündigung/Verhandlung | Kündigung nachrüsten + **GiroCode-Sweep** als Plus |
| Outbank | lokaler Datenschutz | gleicher Datenschutz **+ Auto-Kategorisierung + Prognose** |
| Finanzblick | Gratis-Haushaltsbuch | Parität + **Forecast/Coach/Adaptive Tanks** |
| Actual | Datenhoheit/Open | Consumer-fertig + KI/Prognose, kein Self-Hosting nötig |
| Emma | Tracking-UX | mehr Tiefe (Forecast/Schulden) + **großzügigerer Free-Tier** |

---

## 6. „Dein Finanz-Fundament" – 6 Etappen (eigene Baby-Steps-Variante)

Datengetrieben: die App erkennt die aktuelle Etappe aus echten Konten/Schulden/Sparquote.

1. **Starthilfe** – kleiner Sofort-Puffer (Default 1.000 €)
2. **Teure Schulden raus** – Konsumschulden tilgen (Plan „teuer-zuerst" oder „klein-zuerst" wählbar)
3. **Sicherheitspolster** – 3–6 Monatsausgaben Notgroschen (aus realen Fixkosten berechnet)
4. **Zukunft besparen** – feste Sparquote/ETF (Pay-yourself-first, §3.1 Stufe 2)
5. **Große Ziele** – Eigenheim/Bildung/Familie als Rücklagen-Töpfe
6. **Frei & großzügig** – Vermögensaufbau & Schenken

Bewusst **6 statt 7**, eigene Namen, eigene Texte → keine Markenkollision mit Ramsey.

---

## 7. Umsetzungsreihenfolge (TDD nach `CLAUDE.md`)

1. **Rollover-Engine** (§1) — reine Logik in `budget-logic.ts` + Ledger; Tests zuerst
   (accumulate / overspend / both / cap / Migration `rollover:true`). *Höchster Hebel, isoliert.*
2. **Adaptive-Baseline** (§3.2) — Median + Saison im Vorschlags-Service.
3. **Sweep + GiroCode-QR** (§2) — inkl. Prognose-Gate.
4. **Wasserfall-Orchestrierung** (§3.1) über bestehende Kategorien/Klassen.
5. **UI-Politur** (§4) schrittweise.
6. **Finanz-Fundament** (§6) als Erweiterung des bestehenden Coach.

---

*Hinweis: Feature-Namen sind Arbeitstitel. Vor Veröffentlichung markenrechtlich prüfen.
ETF-/Spar-Hinweise sind keine Anlage- oder Steuerberatung.*
