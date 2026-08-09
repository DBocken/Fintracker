# Slice `settings`

Kategorien, Aufbewahrung, automatische Zuordnung und die Sammel-Neukategorisierung
der Einstellungsfläche. Route: `/settings` (`src/pages/SettingsPage.tsx` — acht
Zeilen, reiner Einstieg).

Angelegt in WP 6.5b (ARCH-1). `EnhancedSettings.tsx` war neben `AccountManager`
der grösste view-data-Hotspot: 441 Zeilen mit sieben eigenen Datenzugriffen,
dazu ein achter in `CategoryManager.tsx`. Die Datenschicht liegt seither hier.

## Schichten

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `settings-overview.ts` (118 Z.) | Reine Auflösungen (`resolveRetentionMonths`, `resolveAutoConfirmMapping`, `findCategoryById`) und die Formen, die das ViewModel nach oben reicht. Kein React, kein I/O. |
| `data/` | `settings-query-keys.ts` (18 Z.) | Die sechs Query-Keys, byte-identisch zu den Literalen aus `EnhancedSettings.tsx`/`CategoryManager.tsx`. |
| `application/` | `use-settings-overview.ts` (232 Z.) | Das ViewModel: zwei lesende Bestandsabfragen, der Kategorie-Vorschlag, fünf Schreibvorgänge, die Vorschau. |
| `presentation/` | — | **Noch nicht vorhanden**, absichtlich. Begründung unten. |

## Was in WP 6.5b gewandert ist

`pnpm check:view-data`: **251 → 241**. Die zehn im Einzelnen:

| Herkunft | Zugriff | Anzahl |
|---|---|---|
| `EnhancedSettings.tsx` | `useQuery(['userSettings'])`, `useQuery(['hierarchicalCategories'])` | 2 |
| `EnhancedSettings.tsx` | `useMutation` für Einstellungen, Kategorie speichern, Kategorie löschen, Neukategorisierung, Undo | 5 |
| `EnhancedSettings.tsx` | Service-Import `category-service` | 1 |
| `CategoryManager.tsx` | `useQuery(['category-suggestion'])` | 1 |
| `CategoryManager.tsx` | Service-Import `transaction-service` (Abfrage **und** Typ `CategorySuggestion`) | 1 |

Nichts davon ist an der Zahl vorbeigetragen worden — der Umzug in eine
`presentation/` hätte genau das getan (die Zählung endet an
`src/components`/`src/pages`), und deshalb steht er hier nicht.

`CategoryManager` ist dabei props-getrieben geworden (Kochrezept Schritt 8): Der
Vorschlag kommt als `suggestion`-Eigenschaft. Sein Eintrag in
`query-error-allowlist.json` ist mitgezogen, nicht verschwunden.

Zwei Typen, die Service **und** Oberfläche brauchen, liegen seither in
`src/lib/category-types.ts` statt im `transaction-service`: `CategorySuggestion`
und `CategorizationSnapshotEntry` (AGENTS.md §3, „Wohin ein Typ gehört"). Ohne
diesen Schritt hätte `CategoryManager` den Service weiter importieren müssen —
für einen *Typ*, und der Wächter hätte es zu Recht weitergezählt.

## Bewusste Abweichung vom Bestandsverhalten

Die ausgewählte Kategorie wird als **ID** gehalten und über
`findCategoryById` im Baum aufgelöst; vorher hielt `EnhancedSettings` das
Kategorie-*Objekt* fest. Wirkung: Nach einer Umbenennung zeigt die Vorschau den
neuen Namen, nach einer Löschung gar nichts mehr — statt eines Standes, den es
nicht mehr gibt. Adressiert wird durchgehend über die stabile ID, nie über den
Anzeigenamen (AGENTS.md §6, letzte Zeile der Fallen-Tabelle). Zwei Tests halten
das fest (`settings-overview.test.ts`, `use-settings-overview.test.tsx`).

`resolveRetentionMonths` konserviert dagegen eine Eigenheit bewusst: `0` fällt
auf die Voreinstellung 36 zurück (`||`, nicht `??`). Die 0 war nie eine wählbare
Dauer, sondern der Zustand vor der ersten Speicherung.

## Warum noch keine `presentation/`

Nicht, weil es nicht lohnte — sondern weil beide Spalten der Slice-Ratsche
(`slice-presentation-budget.json`) exakt auf ihrem Maximum standen (`max: 12`,
`maxBausteine: 36`) und **nur sinken dürfen**. Nachgemessen am Bestand vor
WP 6.7:

| Umzug | Importe nach fremder Feature-UI (`max`) | Importe nach `components/common/` (`maxBausteine`) |
|---|---|---|
| nur `EnhancedSettings.tsx` | 12 → **32** (+20 Geschwister-/Nachbarbausteine) | 36 → **38** (`InfoGroup`, `FinanceErrorState`) |
| ganzes `components/settings/` | 12 → **22** (Provider, `ThemeToggle`, `TaxCategorySelect`, `FeatureSelection`, `PerformanceDashboard`, `BackupManager`, `FeatureGate`) | 36 → **50** (14× `InfoGroup`/`InteractiveCard`/`FinanceErrorState`/`DecimalInput`) |

Beide Wege brachen damals beide Ratschen. Die Baustein-Spalte war dabei kein
Fehler der Fläche: `InfoGroup`, `InteractiveCard`, `FinanceErrorState` und
`DecimalInput` sind nach AGENTS.md §8/§9 **vorgeschrieben** — dieselbe
Fehlerform, die WP 6.3 schon einmal gemessen hat, nur ein Screen weiter.

**Seit WP 6.7 ist die rechte Spalte erledigt**: `components/common/` liegt jetzt
unter `features/shared/presentation/`, `maxBausteine` steht auf 0, und keiner
der oben gerechneten Baustein-Importe zählt noch. Offen bleibt allein die linke
Spalte — die Geschwister-Bausteine aus `components/settings/`, die mit der
Fläche zusammen oder nach ihr migrieren müssen. Das ist eine andere Frage mit
einer anderen Antwort (Screen für Screen statt ein Umzug für die ganze App) und
gehört in ein eigenes Paket.

Bis dahin bleibt die Darstellung in `src/components/settings/`
(`EnhancedSettings.tsx`, 283 Zeilen — von 441). Das ist der bewusste
Zwischenzustand, kein vergessener Rest: Die Slice ist **angeschlossen** (WP 6.1),
ihr ViewModel hat mit `EnhancedSettings` und `CategoryManager` zwei echte
Konsumenten und ist kein verwaistes Verzeichnis (ARCH-2).

## Zustände

- **Fehler.** `hasLoadError` fasst die zwei Bestandsabfragen zu EINER Aussage
  zusammen. Ohne Kategorien zeigte die Fläche „0 Kategorien" und eine leere
  Verwaltung — wer daraufhin neu anlegt, erzeugt Duplikate zu Kategorien, die es
  längst gibt. Geprüft in `src/pages/__tests__/SettingsPage.error-state.test.tsx`
  (`[ZUSTAND /settings:fehler]`).
- **Leer.** Entfällt laut `state-coverage-allowlist.json`: Die Einstellungen
  zeigen immer Bedienelemente, nie eine Liste von Nutzerdaten. WP 6.5b ändert
  daran nichts — die Route bleibt `/settings`, der Tag bleibt, wo er ist.
- **Auswahl, Formular, Tab.** Bleiben in der Darstellung (`CategoryManager`),
  nicht im ViewModel. Nur die *Auswahl der Kategorie* liegt im ViewModel, weil
  die Vorschau-Abfrage an ihr hängt.

## Offen

- `presentation/` (siehe oben) — die Baustein-Spalte blockiert seit WP 6.7
  nicht mehr; offen ist nur noch die Feature-UI-Spalte (`max`).
- Die übrigen Einstellungs-Bausteine tragen weiterhin eigene Zugriffe:
  `HouseholdSettings` (6), `PrivacySyncAnalyticsSettings` (4),
  `AppearanceSettings` (3), `NavFeatureSettings` (3), `TaxReserveSettings` (3),
  `DangerZoneSettings`/`LocalEncryptionSettings`/`TelemetrySettings` (je 1).
  Das sind in sich geschlossene Unterflächen mit eigenem Zustand; sie gehören in
  eigene Schritte, nicht in diesen.
