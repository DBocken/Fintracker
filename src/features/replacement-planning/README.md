# Feature-Slice: `replacement-planning` (lebensdauerbasierte Ersatzplanung)

> **Status: angeschlossen, ohne eigene Oberfläche.** Anders als die beiden
> Nachbar-Slices ist dieser hier **nicht** verwaist: `domain/` wird von zwei
> Services produktiv konsumiert und wirkt bis in die Liquiditätsansicht. Was fehlt,
> ist die Fläche, mit der Nutzer einen Ersatzplan überhaupt anlegen. Nachgemessen
> und entschieden in WP 6.1 (ARCH-2).

## Zweck

Bekannte Wiederbeschaffungen (Auto, Heizung, Laptop …) als planbare, teils
probabilistische Ereignisse mit Rücklagenlogik — Epic A der Roadmap
`docs/product/roadmap-new-capabilities-2026-07.md` (Architekturleitplanke **AD1**,
Slices S1–S5 / Issues #239–#243).

Leitgedanke: **Input-Transformation vor unverändertem Kern.** Der Slice erzeugt
keine zweite Forecast- oder Monte-Carlo-Engine, sondern füttert die bestehende mit
Transfers, geplanten und probabilistischen Ereignissen.

## Bestand und tatsächliche Konsumenten

| Datei | Wer benutzt sie heute |
|---|---|
| `domain/replacement-plan.ts` | transitiv über `forecast-expansion.ts` und `reserve-sufficiency.ts` (Preismodi, Inflationsrate, Ersatzdatum, Rücklagenbeitrag, Drei-Sichten-ViewModel) |
| `domain/forecast-expansion.ts` | `src/services/forecast-data.ts:29` → `expandReplacementPlans` erweitert `transfers`, `plannedEvents`, `probabilisticEvents` |
| `domain/cycle-restart.ts` | `src/services/replacement-plan-service.ts:16` → `confirmReplacement` (Zyklus-Neustart nach Ersatz) |
| `domain/reserve-sufficiency.ts` | **niemand** außerhalb der eigenen Tests |

Wirkkette bis zur Oberfläche:

```
replacement-plan-service (Collection `replacementPlans`)
        │  getReplacementPlans
        ▼
forecast-data ─ expandReplacementPlans ─► ForecastInput
        ▼
useForecast ─► LiquidityReport · UpcomingChargesList · DisposableTankCard ·
               IncomeStressTestDialog · finance-city/use-city-model
```

Damit ist die Ablage korrekt: Feature-`domain` liegt auf `lib`-Höhe, ein Service
darf sie benutzen (AGENTS.md §3). Die Richtung ist maschinell geprüft
(`pnpm check:layers`).

| Schicht | Zustand |
|---|---|
| `domain/` | vollständig, getestet, konsumiert |
| `data/` | fehlt (unnötig, solange keine Fläche cached) |
| `application/` | fehlt |
| `presentation/` | fehlt |

## Was noch fehlt

1. **Eingabe.** `upsertReplacementPlan` hat keinen Aufrufer — die Collection
   `replacementPlans` bleibt für Nutzer heute leer, und `expandReplacementPlans`
   arbeitet folglich immer auf der leeren Liste. Der Forecast ist verdrahtet, aber
   ohne Bestand wirkungslos.
2. **`confirmReplacement`** (Zyklus-Neustart) hat ebenfalls keinen Aufrufer.
3. **`reserve-sufficiency.ts`** — Rücklagen-Suffizienz, erwarteter Fehlbetrag,
   aggregiertes Risiko und `overlappingReplacements` (Häufungsfenster) sind fertig
   und ungenutzt; sie gehören in eine Ersatzplanungs-Ansicht neben den Forecast.

Erst diese drei Punkte zusammen ergeben die in #239 geplante Drei-Sichten-Anzeige
(`buildReplacementViewModel` liegt dafür bereit).

## Offen (nicht in WP 6.1 behoben)

- `replacementPlans` fehlt in `VaultPayload` (`src/services/vault-format.ts`) —
  Backup deckt die Collection generisch ab, der Cloud-Sync nicht.
