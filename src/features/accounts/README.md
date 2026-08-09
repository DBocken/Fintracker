# Slice `accounts`

Konten anlegen, bearbeiten, mit einer Bank verbinden, synchronisieren und
interne Überträge verknüpfen. Route: `/accounts`
(`src/pages/AccountsPage.tsx` — dünner Einstieg, siehe unten).

Angelegt in WP 6.5a (ARCH-1). `AccountManager.tsx` war mit 549 Zeilen und
**10 gezählten Datenzugriffen** (3 `useQuery`, 4 `useMutation`, 3
Service-Importe) der größte verbliebene view-data-Hotspot: Die Fläche **war**
ihre Datenschicht, und damit ließ sich keine zweite Präsentation danebenstellen,
ohne die Datenbeschaffung ein zweites Mal zu schreiben (AGENTS.md §4).

## Schichten

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `consent-status.ts`, `transfer-pairs.ts`, `institution-search.ts` | Reine Ableitungen: abgelaufene/bald ablaufende Bankfreigabe, Zusammenfassen verknüpfter Überträge, Filter und Rangfolge der Banksuche. Kein React, kein I/O. |
| `data/` | `account-query-keys.ts` | Query-Keys als Konstanten — **byte-identisch** zu den vorherigen Literalen. |
| `application/` | `use-account-manager.ts`, `use-transfer-suggestions.ts`, `use-accounts-load-state.ts`, `use-bank-institutions.ts` | Die vier ViewModels. Hier liegt jeder Datenzugriff der Fläche. |
| `presentation/` | `AccountList.tsx`, `AccountDataQualityBadge.tsx` | Darstellung ohne jeden Datenzugriff. |

### Warum vier ViewModels und nicht eines

- **`use-account-manager`** — der Kern: Kontenbestand, Konto-Limit,
  Bankfreigaben, die vier Schreibvorgänge sowie Sync- und
  Wiederverbinden-Ablauf.
- **`use-transfer-suggestions`** — die Übertrags-Erkennung. Sie liest einen
  **Vollabzug der Buchungen** (10 000) und ist damit die teuerste Abfrage der
  Fläche; sie hängt deshalb hinter „mehr als ein Konto vorhanden" und bleibt vom
  Kern getrennt.
- **`use-accounts-load-state`** — der Lesezustand für die Route. Zwei Karten
  derselben Seite lesen denselben Bestand; die Aussage über einen Lesefehler
  gehört der Seite (WP-9.6).
- **`use-bank-institutions`** — die Bankenliste der GoCardless-Anbindung. Sie
  geht ins Netz, betrifft nur die Verbinden-Karte und lädt bewusst weiter
  imperativ (siehe „Bewusste Abweichungen").

## Zustände

- **Leer vs. Fehler.** `isEmpty` ist nur wahr, wenn der Bestand **gelesen** und
  leer ist. Vor WP 6.5a stand nach einem Lesefehler „Noch keine Konten angelegt"
  neben der Fehlermeldung — genau die Verwechslung, gegen die
  `pnpm check:state-coverage` gebaut wurde. Festgenagelt in
  `src/components/accounts/__tests__/AccountManager.test.tsx`
  (`[REGRESSION] [ZUSTAND /accounts:fehler]`).
- **Dasselbe bei den Übertrags-Vorschlägen.** Die Karte verschwindet, wenn es
  nichts zu verknüpfen gibt — aber **nicht** bei einem Lesefehler, sonst hieße
  „ich weiß es nicht" auf dem Bildschirm „es gibt nichts".
- **Abgelaufen vs. läuft bald ab** sind zwei Aussagen und schließen einander
  aus (`domain/consent-status.ts`).
- **Dialog und Rückfragen** (`confirm` vor Löschen/Trennen) leben in der
  Darstellung, nicht im ViewModel — Kochrezept Schritt 5.

## Wo die Darstellung heute steht

`AccountManager.tsx`, `AccountFormDialog.tsx`, `TransferSuggestions.tsx` und
`GoCardlessConnect.tsx` liegen **weiterhin unter `src/components/`**. Das ist
eine gerechnete Entscheidung, keine Nachlässigkeit: Jede dieser Dateien benutzt
mindestens einen app-eigenen Baustein aus `@/components/common/` —
`FinanceErrorState`, `LoadingSwap`, `RequireTier`, `DecimalInput` (nach §8 sogar
per `check:decimal-inputs` erzwungen) und `InfoSheet`. Zögen sie mit in die
Slice, stiege die Spalte `maxBausteine` in `slice-presentation-budget.json`
(36) — eine Ratsche, die nur sinken darf. Dieselbe Entscheidung hat WP 6.4 für
`EmptyState`/`FinanceErrorState` in der `CityPage` getroffen. Frei wird der
Umzug mit **WP 6.7** (`components/common/` → `features/shared/presentation/`).

Nach `presentation/` gezogen ist deshalb genau das, was **ohne** einen solchen
Baustein auskommt: die Kontenliste samt Leerzustand und das
Datenqualitäts-Abzeichen. Beide sind props-getrieben und damit das Stück, an
dem eine zweite (mobile) Präsentation ansetzen kann.

## Bewusste Abweichungen

- **`use-bank-institutions` benutzt kein `useQuery`.** Der Ablauf (Laden beim
  Montieren, ausdrücklicher Neuversuch) ist unverändert aus
  `GoCardlessConnect` übernommen, damit dieser Umzug das Verhalten nicht
  nebenbei ändert. Eine Umstellung auf React Query verschiebt Cache-Dauer und
  Neuladeverhalten und wäre eine eigene, begründete Entscheidung.
- **`ConsentSnapshot` statt `ConsentCheckResult`.** Die `domain` darf nicht in
  `src/services/` greifen (`check:layers`). `ConsentSnapshot` beschreibt
  strukturell dasselbe; der Service-Typ ist darauf zuweisbar. Wandert
  `ConsentCheckResult` einmal nach `src/lib/` (er wird von Service **und**
  Oberfläche gebraucht), kann `ConsentSnapshot` durch ihn ersetzt werden.

## Offen

- `deriveAccountDataQuality` ist eine **reine** Funktion und liegt in
  `src/services/account-data-quality-service.ts`. Nach der Tabelle „Wohin ein
  Typ gehört" (AGENTS.md §3) gehörte sie samt ihren Typen nach `src/lib/`. Nicht
  angefasst, weil das den Service und seine Tests betrifft — Kandidat für
  WP 6.6 (ARCH-6).
- `GoCardlessConnect.tsx` (450 Zeilen) und `AccountFormDialog.tsx` sind noch
  nicht in Bausteine zerlegt; die Verbinden-Karte hat weiterhin keinen
  Komponententest.
- Desktop und Mobil teilen sich eine responsive Präsentation. Eine Aufteilung
  nach `desktop/`/`mobile/` (Muster: `features/dashboard`) ist bisher nicht
  nötig gewesen.
