# Zustandsabdeckung je Screen (WP-9.1)

> Erhebung vom 2026-08-06, Grundlage für Phase 9 des
> [Implementierungsplans](../implementation-plan.md) („Vollständige
> State-Coverage-Matrix für jeden Screen").

## Wie gemessen wurde — und was die Zahlen NICHT sagen

Statische Auswertung der Importkette je Route bis Tiefe 3, weil Seiten in
diesem Repo dünne Routen-Einstiege sind (AGENTS.md §3) und die Zustände in den
Komponenten darunter liegen. Ein `x` heißt: **irgendwo im Teilbaum dieses
Screens** kommt der jeweilige Zustand vor.

Das ist eine **Untergrenze, kein Gütesiegel.** Ein Screen mit `x` bei „fehler"
behandelt mindestens eine Abfrage; ob er alle behandelt, sagt die Spalte nicht.
Die schärfere Zahl steht deshalb unten.

Zwei Irrtümer bei der Erhebung selbst sind hier vermerkt, weil sie die Zahlen
verfälscht hatten und beim Wiederholen erneut zuschlagen würden:

1. Ein Regex nur auf `from '…'` übersieht jeden Import mit **doppelten**
   Anführungszeichen — `DashboardPage` fiel dadurch komplett durch und stand
   fälschlich auf „nichts abgedeckt".
2. Tiefe 2 reicht nicht: `DashboardPage → Dashboard → DesktopView →
   AccountCards` sind bereits drei Sprünge bis zum Fehlerzustand.

## Matrix

| Screen | leer | lädt | fehler | Sanfter Modus |
|---|:--:|:--:|:--:|:--:|
| AccountsPage | · | x | · | · |
| AnalysisPage | · | x | · | · |
| BudgetsPage | · | x | · | · |
| CityPage | x | x | · | x |
| CoachPage | x | x | x | x |
| ContractsPage | · | · | · | · |
| CsvPage | · | x | · | · |
| DashboardPage | x | x | x | x |
| DebtsPage | x | x | · | · |
| EuerPage | x | · | · | · |
| ExportPage | · | x | · | · |
| IncomePage | x | x | · | · |
| IncomeWrappedPage | x | · | · | · |
| LiquidityPage | · | x | x | · |
| MilestonesPage | · | x | · | · |
| NetWorthPage | x | x | · | · |
| PrivacyPage | · | x | · | · |
| SettingsPage | · | · | · | · |
| SimulationPage | · | · | · | · |
| SpecialCategoriesPage | x | x | · | · |
| TaxReportPage | x | · | · | · |
| TradingPage | · | x | · | · |
| TransactionsPage | x | x | · | x |
| **Summe** | **11/23** | **17/23** | **3/23** | **4/23** |

Zwei Zustände aus dem Plan fehlen in der Tabelle, weil es zu ihnen nichts zu
erheben gibt:

- **offline** — bei der Erhebung gab es im gesamten Quelltext **keine**
  Behandlung; der einzige `navigator.onLine`-Treffer stand dienst-intern in
  `category-template-service.ts`. Mit WP-9.3 erledigt, siehe unten.
- **gefiltert-leer** — bei der Erhebung nur auf der Buchungsseite überhaupt
  unterscheidbar, und auch dort nur als Gattung („Passe Filter oder
  Suchbegriff an"). Mit WP-9.4 benannt, siehe unten.

## Der Kernbefund

**122 `useQuery`-Aufrufe, 5 Stellen, die den Fehlerzustand lesen.**

Das Muster lautet fast überall:

```ts
const { data: txs = [], isLoading } = useQuery({ … });
```

Scheitert die Abfrage, greift der Fallback `[]`. `isEmpty` wird wahr. Der
Screen zeigt seinen **Leerzustand**.

Nachgestellt auf der Buchungsseite (Abfrage abgewiesen, sonst nichts verändert)
steht dann auf dem Bildschirm:

> 🧾 **Noch keine Buchungen**
> Importiere eine CSV deiner Bank, um deine Buchungen zu sehen und auszuwerten.

Das ist keine fehlende Rückmeldung, sondern eine **falsche Auskunft**, und zwar
die teuerste, die eine Finanz-App geben kann: Der eine Satz lädt zum Neuladen
ein, der andere zum Neuanlegen von Daten, die längst da sind. In einer
local-first App mit verschlüsseltem Speicher ist ein Lesefehler zudem
kein exotischer Fall — ein gesperrter Tresor oder ein abgewiesener
IndexedDB-Zugriff reicht.

Ein `[REGRESSION]`-Test dazu wird **nicht** hier abgelegt, sondern eröffnet
WP-9.2: Ein Test, der den Ist-Zustand grün festschreibt, zementiert den Fehler.

## Stand nach WP-9.2

Die beiden meistbesuchten Screens unterscheiden „leer" jetzt von „nicht
ladbar". Der Fehlerzustand sagt drei Dinge, in dieser Reihenfolge: **was**
nicht geladen werden konnte (nicht „ein Fehler ist aufgetreten"), dass die
Daten **nicht verloren** sind, und den **nächsten Schritt**. Der mittlere Satz
ist der wichtigste — ein Lesefehler liest sich sonst wie ein Datenverlust.

Bewusst **keine** technische Fehlermeldung: `err.message` lautet hier
„IndexedDB nicht erreichbar" und hilft niemandem, der die App benutzt statt
sie zu bauen.

Nebenbei behoben: `vitest.setup.ts` hatte keinen `matchMedia`-Shim, weshalb
jede Komponente mit eigener Breakpoint-Abfrage im Test schon beim Mounten
warf. Der Shim meldet konsequent `matches: false` — die mobile Annahme, weil
alle Abfragen `min-width`-Abfragen sind. Ein Shim mit `true` würde still den
jeweils anderen Zweig testen, ohne dass es auffiele.

## Stand nach WP-9.3 — offline ist kein Ausfall

Die naheliegende Lösung wäre ein roter Balken „Keine Internetverbindung"
gewesen. Für diese App ist das schlicht falsch: Die Finanzdaten liegen in
IndexedDB auf dem Gerät, Eintragen und Auswerten funktionieren ohne Netz
vollständig. Ein Alarm würde einen Ausfall behaupten, den es nicht gibt — und
nebenbei die beste Eigenschaft des Produkts als Mangel darstellen.

Stattdessen ein ruhiges Zeichen neben den anderen Statusanzeigen, das auf
Antippen sagt, was weiterläuft (fast alles) und was ruht (Kurse, Bankabgleich,
Cloud-Abgleich — die drei Funktionen, die echten Netzzugang brauchen). Online
rendert es **gar nichts**: Ein dauerhaftes „online"-Abzeichen wäre Rauschen.

Im Header und nicht als Streifen über dem Inhalt — ein eingeschobener Streifen
verschiebt beim Auftauchen die ganze Seite nach unten, genau der Befund, der
in WP-8.3 das CLS-Budget gerissen hat. Der Header hat feste Höhe.

**Bewusst nicht verknüpft:** `FinanceErrorState` erwähnt den Offline-Zustand
nicht. Die Buchungen kommen aus IndexedDB; kein Netz erklärt einen lokalen
Lesefehler nicht. Ein „du bist offline" an dieser Stelle wäre eine plausibel
klingende Falschauskunft.

## Stand nach WP-9.4 — der dritte Fall

Neben „nichts erfasst" und „nicht ladbar" gibt es den Fall, in dem Daten da
sind und nur der Filter nichts trifft. Bis hierher stand dort „Keine Buchungen
gefunden — Passe Filter oder Suchbegriff an": richtig, aber unbrauchbar. Bei
**sieben** Filterdimensionen ist das der Unterschied zwischen einem Hinweis
und einem Ratespiel.

Jetzt werden die wirkenden Filter einzeln benannt (Suchbegriff wörtlich,
Kategorie und Konto mit ihrem Namen statt ihrer ID). Der wichtigste Satz ist
aber der Hinweis darunter: **„Es gibt Buchungen — nur keine, die zu allen
gesetzten Filtern passt."** Er trennt diesen Zustand von „du hast noch nichts
erfasst".

Zwei Dinge, die dabei mitliefen:

- `describeActiveFilters()` und `countActiveFilters()` müssen dieselben sieben
  Dimensionen kennen. Ein Test prüft deshalb **alle 128 Kombinationen**
  gegeneinander, nicht ein Beispiel: Wird künftig eine Dimension ergänzt und
  nur eine der beiden Funktionen nachgezogen, zählt der Knopf „3 Filter aktiv",
  die Meldung nennt zwei — und der dritte bleibt unsichtbar wirksam.
- Die vier alten Schlüssel `transactions.emptyTitle`/`emptyHint` sind entfernt.
  Ungenutzte Übersetzungen bleiben sonst als Karteileichen stehen und werden
  bei der nächsten Sprache mitübersetzt.

## Ableitung für Phase 9

| WP | Inhalt |
|---|---|
| **WP-9.2** | ✅ **erledigt für Dashboard und Buchungsseite.** `FinanceErrorState` steht, `isEmpty` schliesst `hasError` aus. Die übrigen Screens ziehen nach — der Baustein ist da, es fehlt nur noch die Verdrahtung je ViewModel |
| **WP-9.3** | ✅ **erledigt.** `useOnlineStatus()` + `OfflineIndicator` im Header |
| **WP-9.4** | ✅ **erledigt für die Buchungsseite.** `describeActiveFilters()` + `FilteredEmptyState`. Andere gefilterte Listen (Verträge, Analyse) ziehen nach |
| **WP-9.5** | Sanfter Modus über alle Screens statt der heutigen vier |
| **WP-9.6** | Wächter: Kein `useQuery` ohne Aussage zum Fehlerfall. Erst bauen, wenn die Aufrufstellen stehen — sonst ist er am ersten Tag rot und wird abgeschaltet |
