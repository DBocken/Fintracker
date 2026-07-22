# Modulübergreifende Referenzen (`EntityRef`)

Status: verbindliche Konvention (ADR). Eingeführt mit Fundament-Issue #234
(Roadmap-Entscheidung AD7, siehe
`docs/product/roadmap-new-capabilities-2026-07.md`).

## Kontext

Die neuen Fähigkeiten (Ersatzplanung, Vertragsakte, Haushaltsausgleich) führen
nutzereigene Entitäten ein, die sich untereinander und mit bestehenden Daten
verknüpfen: ein bestätigter Ersatz verweist auf die reale Transaktion, ein
Ersatzplan auf seine Garantieakte, eine Ausgleichsbuchung auf die zugrunde
liegende Zahlung. Ohne einheitliche Konvention löst jedes Feld dasselbe Problem
anders — mit dem bekannten Preis: kopierte Daten laufen auseinander, gelöschte
Ziele erzeugen Geisterverweise.

## Entscheidung

**Typisierte FK-Felder bleiben die Regel, wo das Ziel statisch ist.** So wie
heute überall (`SharedExpenseSplit.transaction_id`, `PortfolioPosition.portfolio_id`,
`SpecialCategory.parent_id`) — ein Feld mit einer ID auf genau eine Ziel-Art.

**Für GENERISCHE Verweise** auf wechselnde Ziel-Arten gilt die `EntityRef`-Konvention
(`src/lib/entity-ref.ts`):

```ts
interface EntityRef { kind: EntityKind; id: string }
type EntityKind = 'transaction' | 'contract_record' | 'replacement_plan'
```

### Vier verbindliche Regeln

1. **Referenzen kopieren nie Daten.** Die Anzeige eines verknüpften Objekts läuft
   immer über einen per-Kind-Resolver (`resolveEntityRef`), nie über eine im
   verweisenden Datensatz gespeicherte Kopie.
2. **Referenzfelder sind nullable/optional und dangling-tolerant.** Ein gelöschtes
   Ziel liefert `{ status: 'missing' }` (Anzeige: „nicht mehr vorhanden") — nie
   eine Ausnahme, nie eine veraltete Kopie. Es gibt **keinen Kaskadenzwang**: das
   Löschen eines Ziels erzwingt kein Löschen der verweisenden Entität; die
   Lösch-UI der jeweiligen Entität zeigt verknüpfte Referenzen an.
3. **Kein globaler Singleton-State.** `resolveEntityRef(ref, registry)` ist eine
   pure Funktion und erhält seine Resolver-Registry als Argument (passend zur
   Trackerverse-Modularität, `docs/coding-guide.md` §13).
4. **Zukunftsmodule ergänzen nur einen `EntityKind` plus Resolver — keine
   Migration.** Module wie Car, Wealth, Meal, Fit, Sleep, Mood existieren heute
   nicht. Die geschlossene Union ist erweiterbar, ohne bestehende Referenzen
   rückwirkend zu brechen; das Referenzmodell darf **nicht** von diesen Modulen
   abhängen.

## Verworfen: generisches Link-Table

Eine zentrale Verknüpfungstabelle wurde bewusst verworfen: sie brächte O(n)-Scans
über den kv-Store, eine neue Backup-/Tombstone-Fläche und hat aktuell null
Konsumenten — ein Verstoß gegen „kleinste notwendige Erweiterung".

## Konsequenzen

- Verknüpfungen wie `ReplacementPlan.contract_record_id` (statisches Ziel) bleiben
  typisierte FK-Felder; nur echte polymorphe Verweise nutzen `EntityRef`.
- Die geschlossene Union erzwingt über `Record<EntityKind, …>`-Konstanten
  (`ENTITY_KIND_KEYS`) zur Compile-Zeit Vollständigkeit — ein neues Kind ohne
  Behandlung ist ein Typfehler.
