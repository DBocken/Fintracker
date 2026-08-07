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

## Stand nach WP-9.5 (Grundlage) — Maskieren als Eigenschaft

Die Erhebung war hier deutlich schlechter als die Matrix-Spalte nahelegte:
**78 Dateien geben Beträge aus, acht berücksichtigen den Sanften Modus** — und
diese acht mit **drei verschiedenen Masken** (`***`, `••`, leer). Das ist kein
Schludern der Aufrufstellen, sondern die Folge davon, dass Maskieren dort
überhaupt eine Entscheidung war.

Zwei Funde bei der Bestandsaufnahme:

- **Es gab einen zweiten, toten Mechanismus.** `src/index.css` trug Regeln für
  `[data-amount]`, `[data-gentle-hide]` und `[data-gentle-placeholder]` — mit
  **null** Aufrufstellen im ganzen Repo. Das ist schlimmer als gar nichts: Es
  täuscht Abdeckung vor und lässt den nächsten Entwickler ein Attribut setzen
  in dem Glauben, fertig zu sein. Entfernt, mit Begründung an Ort und Stelle.
- **Der CSS-Weg wäre auch inhaltlich falsch gewesen.** `text-transparent`
  lässt den Betrag im DOM stehen (markierbar, kopierbar, von der Sprachausgabe
  vorgelesen) und wirkt in SVG-Diagrammen gar nicht, weil dort `fill` färbt
  und nicht `color`.

`useMoneyFormat()` maskiert jetzt beim Formatieren. `mask()` gibt es zusätzlich
für Stellen mit eigenem Formatierer — Recharts-Achsen bekommen eine Funktion
hereingereicht und sollen nicht umgestellt werden müssen, nur um verdeckt zu
werden.

### Zuschnitt des verbleibenden Sweeps

Nicht alle 70 offenen Dateien gehören dazu, und das ist keine Bequemlichkeit,
sondern steht in `docs/onboarding-life-situations.md`: Der Sanfte Modus wird
für **vier** Lebenssituationen vorgeschlagen (`student_school`,
`student_university`, `single_parent`, `debt_focus`). Deren Bereichsfreigaben
enthalten **nie** Trading, EÜR, Nettovermögen oder Premium-Reports — allein
das sind rund 25 Dateien, die ein Nutzer im Sanften Modus gar nicht zu sehen
bekommt.

Im Sweep sind damit: die immer sichtbaren Screens (Coach, Dashboard,
Buchungen, Konten, CSV, Export, Einstellungen, Finanzstadt) sowie Budgets,
Meilensteine, Verträge, Liquidität, Einkommen, Schulden, Anlässe und Steuer.

### Stand nach dem zweiten Sweep

Die Dateien mit mehreren Komponenten sind nachgezogen; wo die Formatierung im
**Modulraum** liegt und kein Hook erlaubt ist, wird die Maske jetzt als
Parameter hereingereicht — genauso, wie `t` es dort schon wurde
(`fmtSigned`, `describe`, `deriveContractHints`).

**Diagramme zentral statt einzeln.** Rund zwanzig Charts reichen
`ChartFigure` je einen eigenen Formatierer herein. Sie alle anzufassen wäre
wieder eine Frage der Aufmerksamkeit gewesen — dieselbe Lücke wie bei den
Skeletten. Die Maske sitzt deshalb in `ChartFigure` (Tabellenzellen) und in
`useSeriesSummary()` (der zusammenfassende Satz). Damit respektiert **jede**
barrierefreie Chart-Entsprechung den Sanften Modus, auch die von Diagrammen,
die es noch nicht gibt.

Maskiert werden dort nur **Zahlenspalten**. Ein maskiertes Datum wäre keine
Schonung, sondern Datenverlust: Ohne die Zeitachse ist die Tabelle nicht mehr
lesbar, nur noch leer.

**Ein Nebenbefund, dieselbe Klasse wie in `WaterfallPanel`.**
`deriveContractHints()` baute seine Hinweistexte **hartcodiert auf Deutsch**
zusammen („… Abos", „Auf einen reduzieren spart bis zu …", „ein
Anbietervergleich kann die Fixbelastung dauerhaft senken"). Der i18n-Wächter
prüft den Diff, und diese Zeilen hatte lange niemand angefasst — sichtbar wurde
der Verstoß erst, als der Sanfte Modus die Datei berührte. Fünf neue Schlüssel
in allen vier Sprachbäumen.

### Offen: die sichtbare Achsen- und Tooltip-Beschriftung

Was in Diagrammen **sichtbar** an Beträgen steht (Y-Achsen-Ticks, Tooltips),
ist bewusst nicht maskiert — und das ist keine Bequemlichkeit, sondern eine
Frage, die eine Entscheidung braucht:

- Eine Achse, die durchgehend `***` zeigt, macht das Diagramm unlesbar, ohne
  ruhiger zu werden.
- Eine Achse, die weiter „3.000 €" zeigt, unterläuft genau das Versprechen des
  Sanften Modus.

Der wahrscheinlich richtige Weg ist ein dritter: In diesem Modus die
**Wertachse ganz weglassen** und nur die Form zeigen — die Kurve trägt die
Aussage „es wird besser/schlechter" auch ohne Skala. Das ist eine
Gestaltungsentscheidung und gehört zusammen mit der Tutorial-Einladung in
Phase 10.

**Zwei Dateien bleiben bewusst ausgenommen:** `AnalyticsTransparencyPreview`
zeigt, was die App senden *würde* — wer das prüft, will die echten Werte sehen,
eine Maske wäre dort das Gegenteil von Transparenz. Und `BankCallbackPage` ist
eine Durchgangsseite, kein Screen, auf dem man verweilt.

## Ableitung für Phase 9

| WP | Inhalt |
|---|---|
| **WP-9.2** | ✅ **erledigt für Dashboard und Buchungsseite.** `FinanceErrorState` steht, `isEmpty` schliesst `hasError` aus. Die übrigen Screens ziehen nach — der Baustein ist da, es fehlt nur noch die Verdrahtung je ViewModel |
| **WP-9.3** | ✅ **erledigt.** `useOnlineStatus()` + `OfflineIndicator` im Header |
| **WP-9.4** | ✅ **erledigt für die Buchungsseite.** `describeActiveFilters()` + `FilteredEmptyState`. Andere gefilterte Listen (Verträge, Analyse) ziehen nach |
| **WP-9.5** | ⏳ **Grundlage + zwei Sweeps.** Abdeckung 8/78 → **41/78** direkt, plus alle Chart-Tabellen und -Zusammenfassungen zentral. Offen bleibt nur die SICHTBARE Achsen-/Tooltip-Beschriftung in Diagrammen — das ist eine Gestaltungsfrage, siehe unten |
| **WP-9.6** | ✅ **erledigt.** `pnpm check:query-errors` mit Ausnahmeliste als Backlog. Stand: **21/150** Aufrufe behandelt, 129 im Backlog — die Zahl je Datei darf nur sinken |


## Stand nach WP-9.6 — der Fehlerfall bekommt einen Wächter

Der Kernbefund oben nannte 122 Aufrufe; die genauere Zählung des Wächters
(inklusive der generischen Schreibweise `useQuery<T>()`, die ein einfacher
Regex übersieht) ergibt **150 Aufrufe, 21 behandelt**.

`pnpm check:query-errors` verlangt ab sofort, dass jede neue Aufrufstelle den
Fehlerfall **in die Hand nimmt** — ihn destrukturiert (`isError`, `error`,
`status`) oder ihn per `throwOnError` bewusst an eine Error Boundary abgibt.
Was sie damit anfängt, kann eine statische Prüfung nicht wissen; sie sorgt nur
dafür, dass die Frage überhaupt gestellt wird.

**Die Ausnahmeliste führt eine ZAHL je Datei, nicht nur den Dateinamen.** Ohne
sie könnte eine Datei mit drei offenen Aufrufen einen vierten dazubekommen,
ohne dass etwas rot wird. Die Zahl darf nur sinken; steht sie zu hoch, meldet
der Check das ebenfalls und erzwingt das Nachziehen.

Drei Screens sind in diesem Zug migriert, ausgewählt nach dem Schaden, den ein
falscher Leerzustand dort anrichtet:

| Screen | Warum zuerst |
|---|---|
| **Schulden** | Ein leerer Schulden-Screen liest sich wie **Entwarnung**. Die darf ein Lesefehler nicht geben |
| **Vermögen** | Ein leerer Vermögens-Screen liest sich wie **Verlust** |
| **Coach** | Scheitert dort die eine Datenabfrage, bleibt `hasData` `undefined` — der Screen zeigte dann weder Leerzustand noch Inhalt, sondern eine halb gefüllte Seite ohne jede Erklärung. Noch undurchsichtiger als eine falsche Auskunft |

## Nebenbefund für Phase 10: die E2E-Suite ist nicht stabil

Zweimal in dieser Runde ist ein E2E-Spec **im Gesamtlauf** rot geworden und
**allein grün** — einmal der Performance-Lauf (CLS 0,1002 gegen 0,1), einmal
die Visual Regression. Grobe Rate: 2 Fehlschläge auf rund 12 Gesamtläufe.

Was es **nicht** ist: `playwright.config.ts` fährt `workers: 1`, es gibt keine
Parallelität, und der Container hat 16 GB frei. Beide Fehlschläge trafen
zeitkritische Zusicherungen im späten Teil eines Laufs, in dem alle Specs sich
einen langlebigen Dev-Server teilen.

**Bewusst nicht mit `retries` übertüncht.** Ein Retry würde genau diese
Fehlschläge verschwinden lassen — und mit ihnen die echten. Eine Suite, die
gelegentlich grundlos rot ist, verliert ihre Autorität; eine Suite, die
Fehlschläge wegwiederholt, hat sie schon verloren. Die Ursache gehört
gemessen, nicht weggeschaltet: Phase 10.
