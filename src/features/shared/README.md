# Feature-Slice: Shared (slice-übergreifende Fachbasis)

## Zweck

Bausteine, die **mindestens zwei** Feature-Slices (z. B. Dashboard + Transactions) fachlich
benötigen — keine Sammelstelle für alles Wiederverwendbare.

## Aufnahme-Kriterium

Nur hierher heben, wenn ≥ 2 Slices den Code brauchen (siehe `docs/architecture/feature-structure.md`).
Für die betroffenen Slices gelten dieselben Domain-Regeln wie überall: kein React, kein
`@tanstack/react-query`, keine Browser-APIs — reine Funktionen/Typen. Bestehende Slice-Module
re-exportieren von hier, statt den Code zu duplizieren.
