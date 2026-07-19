# Feature-Strategie: Sonderkategorien („Anlässe") — Killer-Feature-Plan

> **Elevator-Pitch:** „Was hat mich mein Urlaub *wirklich* gekostet?" — nicht nur die
> TUI-Buchung, sondern auch das Restaurant per Girocard, das Trinkgeld aus der
> Barabhebung und das Taucherset, das zwei Wochen vorher bei Amazon bestellt wurde.
> Sonderkategorien sind **quer liegende Anlässe mit eigener Hierarchie**
> (Hochzeit → Flitterwochen), die Buchungen aus beliebigen Kategorien, Konten und
> Zahlungswegen bündeln — ohne dass die Buchung ihre echte Kategorie verliert.
>
> Status: **Plan** (BDD + TDD, noch keine Implementierung). Tier: **Premium**.
> Branch: `claude/special-categories-parent-hc6f36`.

---

## 1. Produktvision & Differenzierung

### 1.1 Warum Killer-Feature

Alle relevanten Wettbewerber denken in genau **einer** Dimension: der
Kategorie-Hierarchie. Wer sein Kreta-Restaurant unter „Urlaub" bucht, verliert
„Essen gehen" — und umgekehrt. Was es am Markt teilweise gibt, sind **flache
Tags** (ein Freitext-Etikett pro Buchung). Was **niemand** hat, ist die
Kombination aus:

| Baustein | Markt | Wir |
|---|---|---|
| Anlass zusätzlich zur echten Kategorie (n:m) | teils (flache Tags) | ✅ |
| **Hierarchie**: Hochzeit → Polterabend, Feier, Flitterwochen | ❌ | ✅ |
| **Teilbeträge cent-genau**: 20 € Trinkgeld aus einer 100-€-Barabhebung | ❌ | ✅ |
| **Erstattungs-bewusst**: Storno/Rückzahlung mindert die Anlass-Summe | ❌ | ✅ |
| **Zeitfenster-Vorschläge**: „2 Wochen vor Abreise bei Amazon bestellt?" | ❌ | ✅ |
| Local-first & verschlüsselbar (Lebensereignisse sind intim!) | ❌ | ✅ |

Gerade der Privacy-Winkel trägt: Hochzeit, Trennung, Umzug, Krankheit sind die
sensibelsten Ausgaben überhaupt — bei uns bleiben sie auf dem Gerät
(IndexedDB, optional AES-GCM), kein Cloud-Zwang.

### 1.2 Naming (Regel: eigener Name, eigener Text, eigenes Visual)

Arbeitstitel im Code: `SpecialCategory` / Slice `special-categories` (passend
zum Branch). **Produktname-Empfehlung: „Anlässe"** (Einzahl „Anlass") —
deutsch, warm, beschreibend und nicht mit Fremdmarken assoziiert. Alternativen
in absteigender Präferenz: „Momente", „Lebensprojekte". Vor Launch kurze
Marken-Recherche (DPMA/EUIPO), wie in `feature-strategy-budgeting.md` §0.

### 1.3 Leit-Use-Cases

1. **Urlaub Kreta 2026** unter Parent **Hochzeit** (Flitterwochen): Flug/Hotel
   (Reisen), Ausflug (Freizeit), Restaurant (Essen gehen), Taucherset (Shopping,
   14 Tage vor Abreise), Trinkgeld (Teilbetrag einer Barabhebung), Storno der
   Reiserücktrittsversicherung (Erstattung, mindert die Summe).
2. **Hochzeit gesamt** = eigene Buchungen der Hochzeit **+ alle Kind-Anlässe**
   (Polterabend, Feier, Flitterwochen) — eine Zahl, aufklappbar pro Kind.
3. **Vergleich** (Desktop-Stärke): Urlaub 2025 vs. Urlaub 2026 nebeneinander,
   aufgeschlüsselt nach echten Kategorien.

---

## 2. Datenmodell & Invarianten

Neue Typen in `src/types.ts`, Persistenz local-first wie alles andere.

```typescript
/** Quer liegender Anlass („Sonderkategorie") mit eigener Parent-Hierarchie. */
export interface SpecialCategory {
  id: string;
  user_id?: string | null;
  name: string;
  /** Parent-Anlass (z. B. Flitterwochen → Hochzeit). Zyklen verboten. */
  parent_id?: string | null;
  color?: string;
  icon?: string;
  /** Optionaler Zeitraum — Grundlage für Vorschläge, KEIN harter Filter. */
  start_date?: string | null;
  end_date?: string | null;
  /** Vorlauf-Tage für Vorschläge (Taucherset-Fall). Default 14. */
  lead_days?: number | null;
  /** Optionales Kostenziel in Cent (Anlass-Budget, Premium-Polish P3). */
  target_minor?: number | null;
  note?: string | null;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** n:m-Zuordnung Buchung ↔ Anlass, optional als cent-genauer Teilbetrag. */
export interface SpecialCategoryAssignment {
  id: string;
  special_category_id: string;
  transaction_id: string;
  /** Teilbetrag in Cent (positiv). null/undefined = ganze Buchung. */
  amount_minor?: number | null;
  /** Optional: bindet an einen konkreten Split statt an die ganze Buchung. */
  allocation_id?: string | null;
  source: 'manual' | 'suggestion';
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}
```

**Invarianten** (jede bekommt Tests, siehe §5):

- **I1 Zyklen-frei:** `parent_id`-Ketten dürfen keinen Zyklus bilden; ein
  Anlass darf nicht sein eigener Vorfahr werden (Reparenting-Guard).
- **I2 Keine Doppelzählung im Teilbaum:** dieselbe Buchung darf nicht
  gleichzeitig einem Anlass **und** einem seiner Vorfahren/Nachfahren
  zugeordnet werden (redundant → Aggregation würde doppelt zählen). Zuordnung
  zu zwei *Geschwister*-Anlässen ist erlaubt (dann je Anlass voll gezählt,
  transparent ausgewiesen).
- **I3 Teilbetrags-Deckel:** Summe aller Teilbetrags-Zuordnungen einer Buchung
  ≤ `|amount|` in Cent (`src/lib/money.ts`, nie Float).
- **I4 Vorzeichen-Treue:** Aggregation = Ausgabenanteile − Erstattungsanteile.
  Eine zugeordnete Gutschrift (Storno) **mindert** die Anlass-Summe.
- **I5 Transfer-Neutralität:** interne Überträge (`is_transfer`) tauchen in
  Vorschlägen nicht auf. Explizite Zuordnung bleibt möglich (Barabhebungs-
  Trinkgeld ohne Wallet-Tracking), mit Hinweis auf mögliche Doppelzählung,
  falls Bargeld-Buchungen ebenfalls erfasst werden.
- **I6 Konsistenz beim Löschen:** Buchung gelöscht → Zuordnungen weg
  (Muster `category-deletion-cleanup`). Anlass gelöscht → Kinder wandern zum
  Großelternteil (Reparent), Zuordnungen des gelöschten Anlasses weg;
  „Mitsamt Unter-Anlässen löschen" nur mit expliziter Bestätigung.
- **I7 Kontoneutralität:** Zuordnungen erzeugen keine Buchungen und ändern
  keine Salden — reine Auswertungs-Schicht (wie `TransactionAllocation`).

**Persistenz:** zwei neue Keys in `LOCAL_FINANCE_KEYS`
(`src/services/local-storage-keys.ts`): `specialCategories`,
`specialCategoryAssignments`. Dadurch **automatisch** in Backup/Restore,
Verschlüsselungs-Migration (`ENCRYPTED_STORAGE_KEYS`) und Daten-Reset
enthalten — abgesichert per `[INTEGRITY]`-Tests. Reine Neuanlage von
Collections ⇒ keine Schema-Migration nötig (`LOCAL_STORE_SCHEMA_VERSION`
bleibt). Datengrenzen (Backup-Import) werden mit **zod** validiert.

---

## 3. Architektur

Feature-Slice nach `docs/architecture/feature-structure.md`:

```
src/features/special-categories/
├── README.md                  # Datenflüsse, Query-Tabelle (Vorlage: dashboard)
├── domain/                    # pur: Hierarchie-, Aggregations-, Vorschlags-Logik
│   ├── special-category-types.ts
│   ├── hierarchy.ts           # Baum bauen, Zyklen-Guard, Reparenting
│   ├── event-totals.ts        # Summen je Anlass inkl. Teilbaum (Cent, money.ts)
│   └── assignment-suggestions.ts  # Zeitfenster + Heuristiken
├── data/
│   └── special-categories-query-keys.ts
├── application/
│   ├── special-categories-view-model.ts
│   └── use-special-categories-overview.ts
└── presentation/
    ├── desktop/  # Master-Detail, Vergleich, Tabellen
    ├── mobile/   # Story: eine Hauptaussage, Bottom Sheets
    └── shared/   # Zuordnungs-Picker, Anlass-Badge, Summen-Counter
```

- **Services** (einziger I/O-Weg): `src/services/special-category-service.ts`
  (CRUD Anlässe + Zuordnungen über `local-finance-store`, Cleanup-Hooks).
  Komponenten sprechen ausschließlich via TanStack Query mit dem Service.
- **Aggregation:** Vorzeichen-Logik über `@/lib/analysis-data`
  (`sumIncome`/`sumExpenses`) bzw. `sumMinor` aus `@/lib/money` — keine
  komponenten-lokalen `reduce`-Ketten.
- **Integration in Bestand:** Zuordnungs-Einstieg in der Transaktions-Slice
  (Detail-Aside/Sheet + Mehrfachauswahl), Anlass-Badges in der
  Buchungsliste, eigener Navigations-Eintrag + Route für die Anlass-Übersicht.

### 3.1 Premium-Gating

- Neuer `FeatureKey` **`specialCategories: 'premium'`** in `src/lib/tier.ts`
  (einzige Quelle), UI-Guard via `<FeatureGate feature="specialCategories">`.
- Free/Anonymous sehen den **begehrlichen Locked-Preview** (`PremiumUpsell`):
  Beispiel-Anlass „Urlaub" mit geblurrter Summe — Feature sichtbar, Wert fühlbar.
- Demo-Modus (`demoActive` ⇒ Premium) erhält **Demo-Anlässe** im
  `demo-data-service` (Try-before-buy: „Hochzeit" mit zwei Kind-Anlässen).
- Gating-Matrix-Test (`tier.gating-matrix.test.ts`) wird um den Key ergänzt.

---

## 4. BDD — Verhaltens-Szenarien (Gherkin, deutsch)

Die Szenarien sind die fachliche Quelle der Wahrheit. Das Repo nutzt Vitest
(kein Cucumber-Runner) — jedes Szenario wird **1:1** auf ein
`describe`/`it('sollte …')` abgebildet (Given/When/Then als Arrange/Act/Assert,
Szenario-ID im Testtitel). Bilinguale Komponenten-Tests via
`@/test-utils/render`.

```gherkin
Funktionalität: Anlässe (Sonderkategorien) mit Parent-Hierarchie

  Grundlage: Buchungen behalten immer ihre echte Kategorie. Ein Anlass ist eine
  zusätzliche, quer liegende Dimension.

  Szenario: S1 Anlass mit Parent anlegen
    Angenommen es existiert der Anlass "Hochzeit"
    Wenn ich den Anlass "Flitterwochen" mit Parent "Hochzeit" anlege
    Dann erscheint "Flitterwochen" unterhalb von "Hochzeit" im Anlass-Baum

  Szenario: S2 Zuordnung lässt die echte Kategorie unangetastet
    Angenommen eine Buchung "Taverne Kreta" −45,00 € in Kategorie "Essen gehen"
    Wenn ich sie dem Anlass "Flitterwochen" zuordne
    Dann bleibt ihre Kategorie "Essen gehen"
    Und sie zählt zusätzlich in die Summe von "Flitterwochen"

  Szenario: S3 Parent aggregiert den ganzen Teilbaum
    Angenommen "Hochzeit" hat eigene Buchungen über 8.000,00 €
    Und der Kind-Anlass "Flitterwochen" hat Buchungen über 4.230,00 €
    Wenn ich die Übersicht von "Hochzeit" öffne
    Dann sehe ich 12.230,00 € als Gesamtsumme
    Und eine Aufschlüsselung je Kind-Anlass

  Szenario: S4 Teilbetrag einer Buchung zuordnen (Trinkgeld)
    Angenommen eine Barabhebung über −100,00 €
    Wenn ich 20,00 € davon dem Anlass "Flitterwochen" zuordne
    Dann steigt die Summe von "Flitterwochen" um genau 20,00 €
    Und die restlichen 80,00 € bleiben ohne Anlass

  Szenario: S5 Erstattung mindert die Anlass-Summe
    Angenommen "Flitterwochen" enthält Ausgaben über 4.230,00 €
    Wenn ich eine Gutschrift "Storno Reiseversicherung" +120,00 € zuordne
    Dann zeigt "Flitterwochen" 4.110,00 € als Gesamtsumme
    Und die Erstattung ist als solche gekennzeichnet

  Szenario: S6 Zeitfenster-Vorschläge inkl. Vorlauf
    Angenommen "Flitterwochen" hat den Zeitraum 01.09.–14.09. und 14 Tage Vorlauf
    Und es gibt eine Amazon-Buchung "Taucherset" vom 20.08.
    Wenn ich die Vorschläge für "Flitterwochen" öffne
    Dann wird die Taucherset-Buchung vorgeschlagen
    Und interne Überträge werden nicht vorgeschlagen

  Szenario: S7 Batch-Zuordnung aus der Buchungsliste
    Angenommen ich habe in der Buchungsliste 5 Buchungen ausgewählt
    Wenn ich "Anlass zuordnen" wähle und "Flitterwochen" bestätige
    Dann sind alle 5 Buchungen "Flitterwochen" zugeordnet

  Szenario: S8 Doppelzählung wird verhindert
    Angenommen eine Buchung ist "Flitterwochen" zugeordnet
    Wenn ich sie zusätzlich dem Parent "Hochzeit" zuordnen will
    Dann wird das mit verständlicher Begründung abgelehnt
    Und die Summe von "Hochzeit" bleibt unverändert

  Szenario: S9 Teilbetrags-Deckel
    Angenommen eine Buchung über −100,00 € hat bereits 80,00 € Teilzuordnungen
    Wenn ich weitere 30,00 € zuordnen will
    Dann wird das abgelehnt, weil nur noch 20,00 € frei sind

  Szenario: S10 Anlass löschen mit Kindern
    Angenommen "Hochzeit" hat den Kind-Anlass "Flitterwochen"
    Wenn ich "Hochzeit" lösche und "Kinder behalten" wähle
    Dann existiert "Flitterwochen" weiter auf oberster Ebene
    Und alle Zuordnungen zu "Hochzeit" sind entfernt

  Szenario: S11 Premium-Gate
    Angenommen ich bin im Free-Tier
    Wenn ich die Anlass-Übersicht öffne
    Dann sehe ich den Locked-Preview mit Premium-Hinweis
    Und keine eigenen Anlässe können angelegt werden

  Szenario: S12 Backup-Roundtrip [INTEGRITY]
    Angenommen Anlässe mit Hierarchie und Teilbetrags-Zuordnungen existieren
    Wenn ich ein Backup exportiere und wieder importiere
    Dann sind Baum, Zuordnungen und Summen byte-identisch (idempotent)

  Szenario: S13 Feature-Parität Mobile
    Angenommen ich nutze die App auf einem schmalen Viewport
    Wenn ich "Flitterwochen" öffne
    Dann sehe ich zuerst genau eine Hauptaussage (Gesamtsumme, aufgebaut/hochzählend)
    Und erreiche Aufschlüsselung und Buchungen über progressive Offenlegung
```

---

## 5. TDD — Arbeitspakete (Test zuerst, rot → grün → refactor)

Jedes Paket = 1 logischer Commit-Block (PR-fähig), Commit-Message nennt Ziel +
Test-Abdeckung. Alle Tests in `__tests__/`-Ordnern, Titel deutsch.

### WP0 — Tier & Fundament (klein, entsperrt alles Weitere)

| Test (zuerst, rot) | Datei |
|---|---|
| Gating-Matrix um `specialCategories` ergänzt (premium; Demo/Override heben an) | `src/lib/__tests__/tier.gating-matrix.test.ts` |

Implementierung: `FeatureKey` + `FEATURES`-Eintrag, Typen in `src/types.ts`,
zod-Schemas, Storage-Keys. **DoD:** Matrix grün, `pnpm build` grün.

### WP1 — Domain: Hierarchie & Aggregation (pur, kein I/O)

| Test | Abdeckung |
|---|---|
| `hierarchy.test.ts` | S1; I1 (Zyklus/Selbst-Parent abgelehnt), Reparenting, Baum aus flacher Liste, verwaiste `parent_id` → Wurzel (defensiv) |
| `event-totals.test.ts` | S2–S5; I2–I5, I7: Teilbaum-Summe, Teilbeträge, Erstattungen, Geschwister-Doppelzuordnung transparent, alles Integer-Cent |
| `assignment-suggestions.test.ts` | S6: Zeitfenster inkl. `lead_days`, Transfers raus, bereits Zugeordnetes raus |

### WP2 — Service: CRUD, Guards, Lebenszyklus

| Test | Abdeckung |
|---|---|
| `special-category-service.test.ts` | CRUD Anlässe/Zuordnungen; I2/I3 als Service-Guards (S8, S9); Archivieren |
| `special-category-deletion-cleanup.test.ts` | S10 + Buchungs-Löschung räumt Zuordnungen ([REGRESSION]-fähiges Muster wie `category-deletion-cleanup`) |
| `backup-restore-special-categories.test.ts` | S12 `[INTEGRITY]`; zusätzlich: Verschlüsselungs-Migration umfasst neue Keys `[SECURITY]`-nah via `ENCRYPTED_STORAGE_KEYS`-Assertion |

### WP3 — Application: Hook + ViewModel

| Test | Abdeckung |
|---|---|
| `use-special-categories-overview.test.tsx` (`createHookWrapper`) | ViewModel: Baum + Summen + Vorschläge aus einem Guss; Mutationen invalidieren korrekt; keine Doppel-Queries |

### WP4 — Presentation: Desktop + Mobile (Feature-Parität)

| Test | Abdeckung |
|---|---|
| `special-categories-views.test.tsx` (bilingual de+en) | S3, S11, S13: Desktop Master-Detail & Vergleich; Mobile Story; FeatureGate-Fallback; Karten voll klickbar (`InteractiveCard`) |
| `assignment-picker.test.tsx` (bilingual) | S2, S4, S7: Zuordnen im Buchungsdetail, Teilbetrags-Eingabe über `parseEuroInput`, Batch aus Mehrfachauswahl |

UI-Regeln: Summen **zählen hoch** statt aufzupoppen (Animations-Baseline,
`prefers-reduced-motion` respektiert), Charts in `ResponsiveContainer`,
Icons `lucide-react`, i18n-Namespace `specialCategories.*` in **allen**
`SUPPORTED_LOCALES` (de, en, tlh).

### WP5 — Integration & Politur

| Test | Abdeckung |
|---|---|
| Erweiterung `transactions-views.test.tsx` | Anlass-Badge in der Buchungsliste; Einstieg aus Detail-Aside/Sheet |
| `demo-data-special-categories.test.ts` | Demo-Anlässe konsistent (Summen stimmen mit Demo-Buchungen überein) |

Zusätzlich: `docs/FEATURES.md` + Slice-README, Navigations-Eintrag,
`PremiumUpsell`-Story-Text.

### Verifikation vor jedem Push

`pnpm lint` · `pnpm test` · `pnpm test:coverage` (Schwellen Pflicht) ·
`pnpm check:i18n` · `pnpm check:test-structure` · `pnpm test:security` ·
`pnpm security:secrets`.

---

## 6. Rollout-Phasen

| Phase | Inhalt | Ergebnis für Nutzer |
|---|---|---|
| **P1 (MVP, WP0–WP4)** | Anlässe + Hierarchie, Zuordnung ganzer Buchungen, Teilbaum-Summen, Desktop+Mobile, Premium-Gate | „Was kostete der Urlaub?" beantwortbar |
| **P2 (Komfort)** | Teilbeträge (S4/S9-UI), Zeitfenster-Vorschläge (S6), Batch (S7), Badges | Trinkgeld-/Taucherset-Fall ohne Suchen |
| **P3 (Premium-Polish)** | Anlass-Vergleich Desktop, Kostenziel (`target_minor`) mit schwellwertbewusster Färbung, Anlass-Report-Export, Sunburst-Integration | Begehrlichkeit/Upsell-Material |

P1 und P2 können als getrennte PRs auf diesem Branch aufsetzen; das
Datenmodell aus §2 trägt alle drei Phasen **ohne Migration**.

---

## 7. Offene Produktentscheidungen (mit Empfehlung)

1. **Produktname:** „Anlässe" (Empfehlung) vs. „Momente"/„Lebensprojekte" —
   nur i18n-Texte betroffen, kein Code-Umbau.
2. **Free-Teaser-Tiefe:** reiner Locked-Preview (Empfehlung, konsistent zu
   `budgetPremium`) vs. „1 Anlass gratis" als Anfütterung.
3. **Maximale Baumtiefe:** technisch unbegrenzt (I1 schützt), UI empfiehlt
   ≤ 3 Ebenen (Empfehlung: kein hartes Limit, nur UI-Führung).
