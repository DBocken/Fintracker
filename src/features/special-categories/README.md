# Feature-Slice: `special-categories` (Anlässe / Sonderkategorien)

Quer zur Kategorie-Hierarchie liegende **Anlässe** mit eigener Parent-Hierarchie
(Hochzeit → Flitterwochen). Eine Buchung behält ihre echte `category_id` und wird
**zusätzlich** einem Anlass zugeordnet (n:m, optional cent-genauer Teilbetrag).
Premium-Feature (`FeatureKey specialCategories`). Vollständige Strategie:
`docs/feature-strategy-sonderkategorien.md`.

## Schichten

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `hierarchy.ts`, `event-totals.ts`, `assignment-suggestions.ts`, `assignment-guards.ts`, `special-category-types.ts` | Reine Logik: Baum/Zyklen-Guard (I1), Teilbaum-Summen (I2–I5,I7, Integer-Cent), Zeitfenster-Vorschläge, Zuordnungs-Guards. Kein React, kein I/O. |
| `data/` | `special-categories-query-keys.ts` | Query-Keys. Transaktionen teilen sich bewusst `financeKeys.transactions` (kein zweiter 5000er-Load). |
| `application/` | `special-categories-view-model.ts`, `use-special-categories-overview.ts` | Purer Builder (`buildSpecialCategoriesData`) + Hook: lädt Daten, leitet Baum/Summen/Vorschläge ab, stellt Mutationen mit Invalidierung bereit. |
| `presentation/` | `desktop/`, `mobile/`, `shared/` | Gleiches ViewModel (CSS `lg:hidden`-Dual-Render). Desktop informationsreich, Mobile eine Hauptaussage/Karte. `shared/SpecialCategoryTree` (rekursiv, klickbar), `shared/EventTotalAmount` (Count-up), `shared/AssignmentPicker` + `shared/TransactionOccasions` (Zuordnung im Buchungsdetail), `special-categories-view-props.ts`. |

I/O ausschließlich über `src/services/special-category-service.ts` (CRUD,
Guards I2/I3, Lösch-/Cleanup-Semantik). Page: `src/pages/SpecialCategoriesPage.tsx`
(FeatureGate + Erstell-Dialog als Interaktionszustand). Route: `/occasions`.

## Datenfluss

```
special-category-service ──┐
transaction-service ───────┼─► use-special-categories-overview
                            │       │  buildSpecialCategoriesData (pur)
                            │       ▼
                            └─► ViewModel ─► Desktop-/Mobile-View (gleiches Objekt)
```

## Invarianten (getestet)

I1 zyklenfrei · I2 keine Doppelzählung im Teilbaum (Geschwister erlaubt) ·
I3 Teilbetrags-Deckel · I4 Vorzeichen-Treue (Erstattung mindert) ·
I5 Transfer-Neutralität · I6 Lösch-Konsistenz (Reparent/Cleanup) ·
I7 Kontoneutralität. Persistenz in `LOCAL_FINANCE_KEYS` → automatisch in
Backup/Verschlüsselung/Reset (`[INTEGRITY]`-Test).

## Offen (Folge-PRs)

- Batch-Zuordnung aus der Buchungsliste (P2) und Anlass-Badges in der Liste.
  Der Einzel-Picker ist erledigt (`shared/AssignmentPicker`, im Buchungsdetail
  über `shared/TransactionOccasions` verdrahtet).
- Teilbetrags-Eingabe-UI (P2), Anlass-Vergleich/Kostenziel/Report (P3).
- Demo-Anlässe im `demo-data-service` (Try-before-buy).
