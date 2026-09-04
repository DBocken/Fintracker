# Feature-Slice `coach` — die Einstiegsfläche der App

`/` leitet auf `/coach` um. Das ist der Bildschirm, den ein Nutzer als Erstes
sieht — und bis zu dieser Migration war er ausgerechnet der unbearbeitetste:
`src/pages/CoachPage.tsx` trug 255 Zeilen mit vier eigenen Abfragen, sechs
Service-Importen und einem einzigen Baum für beide Plattformen.

Migriert nach dem Kochrezept in `docs/architecture/feature-structure.md`
(Kandidat #2 in dessen Liste), Referenz ist `src/features/dashboard/`.

## Ist-Datenflüsse vor der Migration

Alle vier Abfragen lagen direkt in der Seite. Die Query-Keys sind
**byte-identisch** übernommen (`data/coach-query-keys.ts`) — jede Abweichung
hätte bestehende Caches und Invalidierungen stillschweigend getrennt.

| Query-Key | Quelle | Wozu |
|---|---|---|
| `['coach-overview', locale, includeTaxReserve, tutorialChapter]` | `getCoachOverview()` | Empfehlungen, Roadmap-Etappe, Schulden-Zusammenfassung |
| `['financial-health', locale]` | `getFinancialHealth()` | Score, Teilscores, Netto-Vermögen — geteilt mit `DashboardMobileStory` |
| `['milestones', locale]` | `evaluateMilestones()` | Meilenstein-Streifen |
| `['has-finance-data']` | `getTransactionsPage(1, 0)` + `getDebts()` + `getReceivables()` | **Nur** die Bestandsfrage, nicht der Bestand |

Die letzte ist die wichtigste und die unscheinbarste: Sie unterscheidet „noch
nichts erfasst" von „nicht ladbar". Scheitert sie, bliebe `hasData`
`undefined` — die Fläche zeigte dann weder Leerzustand noch Inhalt, sondern
eine halb gefüllte Seite ohne jede Erklärung (WP-9.6). Deshalb schliesst
`isEmpty` im ViewModel `hasError` ausdrücklich aus.

## Schichten

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `data/` | `coach-query-keys.ts` | Query-Keys als Konstanten |
| `application/` | `coach-overview-view-model.ts`, `use-coach-overview.ts` | Die vier Abfragen, gemeinsamer Lade-/Leer-/Fehlerzustand, fachliche Rangfolge der Empfehlungen |
| `presentation/shared/` | `CoachFeedCard`, `CoachStatusGrid`, `FoundationLadder`, `DisposableTankCard`, `UpcomingChargesList`, `CategorySuggestionsInbox`, `HealthScoreCard` | Bausteine, die BEIDE Präsentationen benutzen |
| `presentation/desktop/` | `CoachDesktopView.tsx` | Informationsreich: alles gleichzeitig sichtbar |
| `presentation/mobile/` | `CoachMobileToday.tsx` | Eine Hauptaussage, alles Übrige in vier Registern |

Kein `domain/`: Der `coach-service` liefert bereits ein ViewModel-artiges
Objekt, und es gab in der Seite keine reine Berechnung zu extrahieren. Ein
leerer Ordner wäre Zeremonie, kein Aufbau.

## Warum zwei Präsentationen und nicht eine responsive

Der Entscheidungsbaum aus `feature-structure.md` fragt nach der
Informations**hierarchie**, nicht nach der Breite. Desktop zeigt zehn
Abschnitte gleichzeitig — das ist auf einem grossen Bildschirm sein Vorteil.
Dieselbe Anordnung auf einem Telefon ergibt zehn Bildschirmlängen Scrollen
ohne Rangfolge, also genau den häufigsten Fehler nach AGENTS.md §4: Mobil als
kleinerer Desktop.

Mobil trägt die Fläche deshalb **eine** Hauptaussage (Prinzip 3) — den
priorisierten nächsten Schritt — und staffelt den Rest in vier adressierbare
Ansichten:

| Register | Inhalt |
|---|---|
| Status | Statusraster, Finanzlandschaft (kompakt), Health-Score |
| Geld | Verfügbar bis Gehalt (Tank), anstehende Abbuchungen |
| Ziele | Finanz-Fundament, Meilensteine |
| Mehr | Roadmap, Schuldenkontext, weitere Empfehlungen, Weg ins Dashboard |

**Nichts ist amputiert** (§4 „Anpassen, nicht amputieren"): Jeder
Desktop-Abschnitt hat hier seinen Ort, nur anders gestaffelt. Die aktive
Ansicht steht in der URL (`?view=`), ist also verlinkbar — eingeklappt, nicht
entfernt. Die Wisch-Geste teilt sich die Regeln mit der Dashboard-Story
(`features/shared/domain/swipe-navigation.ts`), damit sich beide Flächen
gleich anfühlen.

## Was der Umzug an den Ratschen bewegt hat

| Ratsche | Vorher | Nachher |
|---|---|---|
| `check:view-data` | 220 | **204** |
| `check:slice-presentation` (Feature-UI) | 12 | **11** |

Zur Ehrlichkeit der ersten Zahl gehört: 10 der 16 sind wirklich aufgelöst (die
vier Abfragen und ihre sechs Service-Importe liegen jetzt in `application/`),
die übrigen 6 sind ein Ortswechsel — die Bausteine unter
`presentation/shared/` holen ihre Daten weiterhin selbst, liegen aber nicht
mehr dort, wo diese Zahl hinsieht. Für die Fachfrage der Ratsche („lässt sich
eine zweite Präsentation danebenstellen?") ist das gelöst, weil beide
Präsentationen jetzt dieselben Bausteine benutzen. Kochrezept-Schritt 8
(Kind-Komponenten props-getrieben) bleibt für sie **offen**.

## Was bewusst NICHT in dieser Slice liegt

- `FinancialLandscape` und `MilestonesStrip` → `features/shared/presentation/`.
  Die Landschaft benutzen zwei Slices (coach, dashboard), der
  Meilenstein-Streifen zeigt Meilenstein-Domänendaten und hat mit
  `/milestones` einen naheliegenden zweiten Abnehmer. Beide in die
  Coach-Slice zu legen hiesse, dass die nächste Fläche in eine fremde Slice
  greifen muss.
- `BudgetTank` → `features/shared/presentation/`. Zwei Features nutzen ihn
  (budgets, coach) — §3: ab zwei Slices nach `features/shared/`.
