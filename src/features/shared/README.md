# Feature-Slice: Shared (slice-übergreifende Fachbasis)

## Zweck

Bausteine, die **mindestens zwei** Feature-Slices (z. B. Dashboard + Transactions) fachlich
benötigen — keine Sammelstelle für alles Wiederverwendbare.

## Aufnahme-Kriterium

Nur hierher heben, wenn ≥ 2 Slices den Code brauchen (siehe `docs/architecture/feature-structure.md`).
Bestehende Slice-Module re-exportieren von hier, statt den Code zu duplizieren.

Für `domain/` und `data/` gelten dieselben Regeln wie in jeder anderen Slice: kein React, kein
`@tanstack/react-query`, keine Browser-APIs — reine Funktionen/Typen.

## `presentation/` — die app-eigenen Bausteine (seit WP 6.7)

Hier liegen die Bausteine, die AGENTS.md §8/§9 vorschreibt: `InteractiveCard`,
`InfoGroup`/`InfoStatStrip`, `DecimalInput`, `EmptyState`/`FilteredEmptyState`/`FinanceEmptyState`,
`FinanceErrorState`, `ChartFigure`, `LoadingSwap`, `InfoSheet`, `PageHeader` und die übrigen aus
dem früheren `src/components/common/`.

**Warum sie hier stehen und nicht unter `src/components/`.** Sie lagen dort nur, weil es
`features/shared/presentation/` historisch nicht gab — nicht, weil sie zur Alt-Oberfläche gehören.
Der Unterschied ist keine Kosmetik: Solange eine Slice ihre vorgeschriebenen Bausteine aus
`components/` holte, zählte jede Nutzung als Kopplung an die Alt-Oberfläche
(`slice-presentation-budget.json`, Spalte `maxBausteine`) — und eine Screen-Migration wurde
bestraft, weil sie sich an die Design-Regeln hielt. Seit dem Umzug steht die Spalte auf **0** und
bleibt als Wächter gegen den Rückfall stehen.

**Abgrenzung zu `src/components/ui/`.** Die shadcn-Primitive bleiben, wo sie sind: Sie sind ein
Fremdbaukasten und laut AGENTS.md §7 die ausschließliche UI-Quelle. `presentation/` hier baut auf
ihnen auf, ersetzt sie nicht.

**Ein neuer app-eigener Baustein gehört hierher**, nicht unter `src/components/common/` — dieses
Verzeichnis existiert nicht mehr, und `pnpm check:slice-presentation` wird rot, wenn es wieder
auftaucht.

**Was hier NICHT hingehört:** Gates und Provider. `RequireTier` lag bis WP 6.7 ebenfalls unter
`components/common/`, ist aber ein deprecated Alias auf `FeatureGate` — und das gilt der Codebasis
als Infrastruktur, nicht als Darstellung (`istInfrastruktur()` in `scripts/view-data-core.mjs`).
Es liegt deshalb neben dem Gate, das es wrappt: `src/components/RequireTier.tsx`.

Für `presentation/` gelten die Regeln jeder Slice-Presentation: React ja, aber keine eigene
Datenschicht. Eine Ausnahme trägt `FinanceEmptyState` bewusst (Beispieldaten laden ist die
Aktion, die dieser Leerzustand anbietet); sie ist in `view-data-budget.json` mitgezählt.
