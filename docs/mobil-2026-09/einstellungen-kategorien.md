# Einstellungen und Kategorien — Kartierung (2026-09-04)

Erhoben von acht Leseagenten über `src/components/settings/**`,
`src/features/settings/**`, die Kategorie-Domäne, die Übernahme, das gelernte
Modell, die Texte, die Tests und die vorhandenen Bausteine. 51 der Befunde sind
adversarisch gegengeprüft worden; der Lauf brach danach am Sitzungslimit ab,
die übrigen tragen deshalb kein Urteil.

**Protokoll, keine Vorgabe.** Jeder Befund nennt seine Datei. Was hier steht,
ist gemessen — was ungeprüft blieb, ist als solches gekennzeichnet.

## Zahlen

| | |
|---|---|
| Befunde gesamt | 139 |
| davon Korrektheit | 61 |
| davon Bedienbarkeit | 32 |
| davon Architektur | 27 |
| davon Darstellung | 19 |
| adversarisch geprüft | 51 |
| davon widerlegt und verworfen | 3 |

---

## Was die App schon kann und was als Vorbild taugt — Bestandsaufnahme der gemeinsamen Bausteine, ihre Eignung für /settings, die fehlenden Bausteine für ein Verzeichnis aus elf Zielen und für eine Kategorie-Übernahme, sowie der Zustand von ListRow

### Datenfluss

DATENFLUSS HEUTE. `SettingsPage.tsx` (8 Z., keine Dichteweiche) rendert `EnhancedSettings`. Diese holt EIN ViewModel: `useSettingsOverview()` (features/settings/application) mit zwei lesenden Abfragen (`userSettings`, `hierarchicalCategories`), dem Kategorie-Vorschlag, fünf Schreibvorgängen und der Vorschau. Das ist bereits ADR Regel 1 erfüllt und muss bleiben. Die elf Abschnitte darunter sind aber KEINE reinen Props-Konsumenten: Nur `CategoryManager`, `CategoryPreview`, `TimeRangeSettings`, `AutoCategorizationSettings` und `BulkAssignment` werden aus dem ViewModel gespeist; `HouseholdSettings`, `PrivacySyncAnalyticsSettings`, `AppearanceSettings`, `NavFeatureSettings`, `TaxReserveSettings`, `LocalEncryptionSettings`, `TelemetrySettings`, `DangerZoneSettings`, `BackupManager`, `CloudMcpSyncCard`, `DiagnosticsSettings` tragen je eigene Zugriffe (src/features/settings/README.md:109-114). Für den Umbau ist das eher Vorteil als Last: Sie sind in sich geschlossen und lassen sich unverändert in einen `DetailSchritt` hängen — genau das, was der README dort schon als „gehören in eigene Schritte\" notiert.

DER KRITISCHE PFAD (Kategorie übernehmen) läuft heute so: Formular-Entwurf lebt lokal in `CategoryManager` (formName/formColor/formFilters/formAttributes, Z. 33-37) → `onSave` schreibt über `saveCategoryMutation` → onSuccess setzt `selectedCategoryId = null` (VM Z. 98). Parallel und unverbunden: Klick auf eine Baumzeile → `onCategoryEdit` → `selectCategory(id)` (VM Z. 175) → `loadPreview()` → `getCategoryPreview(id)` (Service Z. 544) → `preview.transactions` → `CategoryPreview`. Der Anwenden-Knopf verlässt diesen Pfad vollständig und ruft `recategorizeTransactions()` ohne Argument (Service Z. 452). Der Rückweg entsteht erst IM Schreibvorgang aus einem zweiten Lesen (Service Z. 489-493) und liegt danach in flüchtigem React-Zustand (VM Z. 51). Entwurf → Vorschau → Wirkung → Rückweg sind also vier Stationen, die einander nie sehen.

WELCHER BAUSTEIN AUF WELCHEN TEIL PASST.
• Aussage 1+2 (Kategorien/Aufbewahrung, Verschlüsselungsstand, letzte Sicherung) → `InfoStatStrip`. Sitzt bereits auf der Fläche (EnhancedSettings 108-120) mit genau zwei der drei Werte und ist als einziger Baustein schon dichtebewusst kastenlos (InfoGroup 80-84). Der dritte Wert (Verschlüsselung/Sicherung) muss ins ViewModel gehoben werden — heute liegt er in `LocalEncryptionSettings`/`BackupManager` mit eigenen Zugriffen.
• Das Verzeichnis aus elf Zeilen → FEHLT (`Verzeichnis`, siehe Befund). Basis: `ListRow` ohne `icon`, in `<ul className=\"divide-y divide-border/60\">`. NICHT `InteractiveCard` (Kartenchrome, ADR Regel 9).
• Jede der elf Zeilen → `DetailSchritt` mit eigenem `wert` (`?detail=kategorien`, `?detail=sicherung`, `?detail=aussehen`, …). Die Regel-9b-Konventionen (Verlaufseintrag, fremde Parameter) kommen dabei gratis aus `useDetailParam`.
• Der Seitenname → `SeitennameContext`, entweder über `PageHeader` oder durch Streichen des eigenen h1 (EnhancedSettings 99).
• Erklärtexte je Abschnitt → `InfoGroup` mit `title`/`description` statt `SectionHeader` + Karte (dieselbe Behebung, die WP-8.1 an vier Bausteinen schon gemacht hat).
• Kategorie-Baum → `ListRow` mit Einrückung; `CategoryTree` hat die Haarlinie (Z. 135) schon richtig, die Aktionsknöpfe je Zeile (Z. 86-125) gehören auf einen Detailschritt statt in die Zeile.
• Betroffene Buchungen in der Vorschau → `ListRow` (heute eine Karte je Buchung, CategoryPreview 90).
• Übernehmen/Zurücknehmen → FEHLT (`useUebernahme`/`UebernahmeSchritt`, siehe Befund); Vorlage ist `use-kategorie-action.ts` + `KategorieAktionAntwort.tsx`, Wort für Wort.
• `ChartFigure` → auf /settings nur für den Technischen Status relevant (PerformanceDashboard); kein Bedarf im Hauptfluss.
• `SeitennameContext`, `PageHeader`, `SectionHeader` sind Rahmen und zählen nach Regel 9 nicht gegen die drei Aussagen.

### Befunde — hoch

**Vorschau und Wirkung rechnen mit verschiedenen Regeln — die Vorschau lügt** *(korrektheit)*

`getCategoryPreview` (src/services/transaction-service.ts:544-558) läuft über ALLE Buchungen und nimmt `categorizer.categorize(t)` (Zeile 554) — also die Zuordnung OHNE Vertrauens-Schwelle und OHNE Rücksicht auf `confirmed`. Der Schreibpfad `recategorizeTransactions` (Zeile 452-500) überspringt jede bestätigte Buchung (`if (tx.confirmed) { … continue; }`, Zeile 477-481) und benutzt `categorizeConfident` (Zeile 483), das nur oberhalb von `MIN_SILENT_ASSIGN_CONFIDENCE` etwas zurückgibt (src/lib/categorization.ts:302-305). Zwei Wege zu derselben Menge, die auseinanderlaufen müssen.

*Warum es schadet:* Der Auftraggeber verlangt ausdrücklich: „der Nutzer muss vorher sehen, was passiert". Heute sieht er eine Menge, die der Schreibvorgang nachweislich nicht anfasst — jede vom Nutzer bestätigte Buchung steht in der Vorschau und bleibt beim Anwenden unverändert, und jede Buchung mit Konfidenz unter der Schwelle ebenso. Das ist genau der Fall, den AGENTS.md §3 „Was geschlossen wurde, wird geprüft" verbietet: ein Ergebnis ohne belastbaren Rückweg. `use-kategorie-action.ts:9-13` hat dieselbe Falle bereits benannt und gelöst („Der Schnappschuss kommt deshalb aus der VORSCHAU und nicht aus einem zweiten Lesen") — /settings hat die Lehre nicht bekommen.

*Beleg:* `src/services/transaction-service.ts:554 (`categorizer.categorize(t)`) gegen src/services/transaction-service.ts:477 und :483 (`if (tx.confirmed) … continue` / `categorizer.categorizeConfident(tx)`); Schwelle in src/lib/categorization.ts:302-305`

**Der Knopf „Anwenden" in der Kategorie-Vorschau wendet nicht die Kategorie an, sondern kategorisiert alles neu** *(korrektheit)*

`CategoryPreview` zeigt Symbol, Name und Filterzahl EINER Kategorie (src/components/settings/CategoryPreview.tsx:40-50) und darunter den Knopf `onApply` (Zeile 65-72). Verdrahtet ist er in src/components/settings/EnhancedSettings.tsx:143 mit `settings.recategorize` — und das ist `recategorizeTransactions()` ohne jedes Argument (src/features/settings/application/use-settings-overview.ts:134 und :223), also ein Lauf über den GESAMTEN Buchungsbestand. Derselbe parameterlose Aufruf hängt zusätzlich an drei weiteren Knöpfen: `onApplySuggestion` (EnhancedSettings.tsx:137), `onBulkAssign` und `onRecategorize` (EnhancedSettings.tsx:219-221).

*Warum es schadet:* Vier Knöpfe an drei Stellen der Fläche lösen exakt dieselbe Schreiboperation aus, aber jeder verspricht durch seinen Ort etwas Engeres. Wer in der Vorschau einer Kategorie „Anwenden" drückt, rechnet mit acht geänderten Buchungen und bekommt einen Lauf über alle. Das ist keine Feinheit der Beschriftung, sondern eine Schreiboperation mit einer anderen Reichweite als der angezeigten — und die Reichweite ist der Punkt, an dem `KategorieAktionAntwort.tsx:112-118` sie ausdrücklich benennt („Eine Dauerregel wirkt auf Buchungen, die es noch gar nicht gibt").

*Beleg:* `src/components/settings/CategoryPreview.tsx:65-72 gegen src/components/settings/EnhancedSettings.tsx:143, src/features/settings/application/use-settings-overview.ts:223, src/services/transaction-service.ts:452 (`recategorizeTransactions()` ohne Parameter)`

**Eine neue oder gerade geänderte Kategorie lässt sich überhaupt nicht in der Vorschau prüfen** *(korrektheit)*

Drei Sperren hintereinander. (1) `getCategoryPreview` bricht ab, wenn die ID nicht im Bestand liegt: `if (!catExists) return [];` (src/services/transaction-service.ts:546-547) — eine noch nicht gespeicherte Kategorie hat keine ID. (2) `selectedCategoryId` wird ausschliesslich über `onCategoryEdit` gesetzt, und das ruft nur eine bestehende Baumzeile auf (src/components/settings/EnhancedSettings.tsx:136 ← src/components/settings/CategoryManager.tsx:52 ← src/components/settings/CategoryTree.tsx:57). (3) Nach erfolgreichem Speichern setzt das ViewModel die Auswahl selbst auf `null` zurück (src/features/settings/application/use-settings-overview.ts:98) — direkt nach dem Bearbeiten zeigt die Vorschau also gar nichts mehr. Dazu kommt: Der Formular-Entwurf lebt als lokaler Zustand in `CategoryManager` (Zeilen 33-37), die Vorschau liest den PERSISTIERTEN Stand (`findCategoryById`, use-settings-overview.ts:173 und :206). Beide reden nie miteinander.

*Warum es schadet:* Damit ist der Kern des Auftrags — „eine geänderte oder neue Kategorie muss auf den Bestand angewandt werden können, und der Nutzer muss vorher sehen, was passiert" — für den häufigsten Fall (neue Kategorie, neuer Filter) nicht nur unbequem, sondern unmöglich. Der Nutzer muss blind speichern, dann die Zeile im Baum wiederfinden, dann antippen, dann Vorschau drücken. Das ist die Reihenfolge Konfiguration → Wirkung, also genau umgekehrt zu ADR Regel 3 (Aussage → Detail → Konfiguration).

*Beleg:* `src/services/transaction-service.ts:546-547; src/components/settings/EnhancedSettings.tsx:136; src/features/settings/application/use-settings-overview.ts:98, :173, :206; src/components/settings/CategoryManager.tsx:33-37 und :50`

**Das Zurücknehmen überlebt keinen Flächenwechsel — der Rückweg ist an React-Zustand geknüpft** *(korrektheit)*

Der Undo-Schnappschuss liegt in `useState` im ViewModel: `const [undoSnapshot, setUndoSnapshot] = useState<CategorizationSnapshotEntry[]>([])` (src/features/settings/application/use-settings-overview.ts:51), gefüllt aus `summary.undo` (Zeile 143). Nirgends im Baum wird er persistiert — die Grep über `undoSnapshot`/`CategorizationSnapshotEntry` findet ausser dem Typ und dem Service (src/services/transaction-service.ts:471, :510) keine Speicherstelle. Sobald `/settings` unmountet (Navigation, Dichtewechsel nach ADR Regel 8, Absturz der Fehlergrenze in AppShell.tsx:250), sind die Vorwerte von möglicherweise hunderten Buchungen weg.

*Warum es schadet:* „und es danach zurücknehmen können" ist eine Zusage über eine Schreiboperation, nicht über eine Bildschirmsitzung. Besonders scharf im Zusammenspiel mit ADR Regel 8: Ein Dichtewechsel baut die nicht gewählte Fassung ab und darf laut Regel „nie etwas verlieren, was der Nutzer schon eingegeben hat" — hier verliert er den Rückweg aus einer bereits ausgeführten Massenänderung. Der Bestand hat dafür bereits ein Vorbild (`features/onboarding/data/onboarding-draft-store.ts`, in der ADR Regel 8 namentlich genannt).

*Beleg:* `src/features/settings/application/use-settings-overview.ts:51 und :143; keine weitere Fundstelle ausser src/services/transaction-service.ts:471/:510 und src/lib/category-types.ts:103`

**/settings hat keine Dichteweiche — die Fläche ist von der ADR technisch noch nicht erreichbar** *(architektur)*

`SettingsPage.tsx` ist acht Zeilen und rendert bedingungslos `<EnhancedSettings />` (src/pages/SettingsPage.tsx:6-8). Die Vorlage steht daneben: `CoachPage.tsx` liest `useDisplayDensity()` (Zeile 34), lädt je Dichte EIN Bündel per `lazy` (Zeilen 19-20) und verzweigt im Rendern (Zeilen 57-66), mit dem Kommentar auf ADR Regel 6. Solange /settings diese Weiche nicht hat, gibt es keinen Ort, an dem eine fokussierte Fassung überhaupt hängen könnte.

*Warum es schadet:* Ohne Weiche muss jede Regel-9-Massnahme in DIE EINE Datei, die auch der Desktop bekommt — und dann ist der Umbau entweder eine Regression für die kompakte Dichte oder ein `hidden`-Zwilling, den ADR Regel 6 ausdrücklich verbietet (doppeltes DOM, beide Fassungen im Bündel). Der Feature-UI-Zähler dazu steht auf 11 und darf nur sinken (slice-presentation-budget.json), was den Umbau in derselben Bewegung an den Umzug von `components/settings/` nach `features/settings/presentation/` bindet — src/features/settings/README.md:105-114 hat das bereits als offene Rechnung notiert.

*Beleg:* `src/pages/SettingsPage.tsx:6-8 gegen src/pages/CoachPage.tsx:19-20, :34, :57-66; slice-presentation-budget.json (`max: 11`); src/features/settings/README.md:60-89`

**Drei Tutorial-Anker liegen in Abschnitten, die hinter einen Detailschritt sollen — und der Detailschritt hängt sie ab** *(architektur)*

`DetailSchritt` rendert ein Radix-Sheet ohne `forceMount` (src/features/shared/presentation/DetailSchritt.tsx:37-49; Portal in src/components/ui/sheet.tsx:64-77); im geschlossenen Zustand ist der Inhalt NICHT im DOM — der eigene Test hält das fest (src/features/shared/presentation/__tests__/DetailSchritt.test.tsx:64). Genau in solchen Abschnitten sitzen drei Tutorial-Anker: `backup-create` und `backup-restore` (src/lib/tutorial-steps.ts:274-275 → src/components/BackupManager.tsx:284 und :376) sowie `encryption-setup` (src/lib/tutorial-steps.ts:280 → src/components/settings/LocalEncryptionSettings.tsx:272). Der Overlay sucht sie per `document.querySelector('[data-tour-id=…]')` (src/components/tutorial/TutorialOverlay.tsx:93, Selektor in src/lib/tutorial-steps.ts:399-401). Der Mechanismus zum Vorher-Öffnen EXISTIERT (`openAnchor`, TutorialOverlay.tsx:88-96, klickt das Element selbst), aber die drei Schritte übergeben ihren Anker als dritten Parameter `anchor`, nicht als vierten `openAnchor` (Signatur src/lib/tutorial-steps.ts:74-89).

*Warum es schadet:* ADR Regel 5 nennt das als eine der zwei Folgen, die an der Routen-Identität hängen: „Jeder Anker muss in beiden Fassungen existieren, sonst zeigt die Führung in einer Dichte ins Leere." Ein Umbau, der elf Abschnitte hinter Detailschritte legt, bricht drei Führungsschritte lautlos — kein Test wird rot, das Overlay findet nur nichts. Die Behebung ist klein und muss trotzdem VOR dem Umbau entschieden werden: Jede Verzeichniszeile braucht ein eigenes `data-tour-id`, und die drei Schritte bekommen es als `openAnchor` zusätzlich zum bestehenden `anchor`. Daraus folgt eine harte Anforderung an den fehlenden Verzeichnis-Baustein: Er MUSS ein `data-tour-id` durchreichen können.

*Beleg:* `src/lib/tutorial-steps.ts:74-89, :274-275, :280, :399-401; src/components/tutorial/TutorialOverlay.tsx:88-96; src/components/BackupManager.tsx:284, :376; src/components/settings/LocalEncryptionSettings.tsx:272; src/features/shared/presentation/DetailSchritt.tsx:37-49`

**Fehlender Baustein 1: `Verzeichnis` — die Liste aus Zielen, die es noch nicht gibt** *(architektur)*

Neu unter `src/features/shared/presentation/Verzeichnis.tsx`, deutsch benannt wie `DetailSchritt`/`useDetailParam`/`SeitennameContext`. AUFBAU: `<ul className="divide-y divide-border/60">` — kein Rahmen, kein Hintergrund, kein Schatten (ADR Regel 9), Gliederung ausschliesslich über Haarlinie und Weissraum. PROPS: `eintraege: VerzeichnisEintrag[]` und `className`. Je Eintrag: `{ id: string; titel: string; stand?: ReactNode; standTon?: 'normal'|'gut'|'warnung'|'kritisch'; hinweis?: string; ziel: {art:'detail', wert:string} | {art:'route', to:string}; tourId?: string; gesperrt?: boolean }`. VERHALTEN: (a) `ziel.art==='detail'` rendert einen `<button>`, der `useDetailParam(wert).oeffnen()` aufruft — damit erbt jede Zeile ohne Zutun beide Regeln aus 9b (Verlaufseintrag beim Öffnen, fremde Adressparameter unberührt, useDetailParam.ts:40-48); `ziel.art==='route'` rendert ein echtes `<Link to>`, damit ein Sprung auf eine andere Fläche als Link vorgelesen und kopierbar ist. (b) `tourId` landet als `data-tour-id` auf dem Klickelement — Bedingung aus dem Anker-Befund. (c) Trefferbereich `min-h-11`, Chevron rechts, KEINE Symbolkachel. (d) `hinweis` steht zweizeilig und wird NICHT abgeschnitten — er trägt den Status („Ende-zu-Ende verschlüsselt · zuletzt gesichert vor 3 Tagen"), und ein abgeschnittener Status ist keiner. (e) `gesperrt` zeigt die Zeile weiter an und markiert sie (Premium), statt sie zu entfernen — AGENTS.md §4 „Anpassen, nicht amputieren". (f) Optionales `gruppe`-Feld ordnet die elf Zeilen in drei bis vier Blöcke mit grösserem Abstand, ohne Überschriften und ohne Kästen. ABGRENZUNG: `InteractiveCard` scheidet aus — sie trägt `ds-section`-Kartenchrome (src/features/shared/presentation/InteractiveCard.tsx:65), also genau die Box, die Regel 9 verbietet und die `card-rule-budget.json` mit `maxFokussiert` auf Ziel 0 zählt. `Verzeichnis` baut deshalb auf `ListRow` auf, nicht auf `InteractiveCard`.

*Warum es schadet:* Ohne diesen Baustein baut jede der elf Zeilen ihr Klickverhalten, ihre Haarlinie und ihren Verlaufseintrag selbst — und der Bestand zeigt, wohin das führt: Dieselbe Haarlinie steht heute schon in drei Stärken im Baum (`divide-border/70` in TransactionListMobile.tsx:69, `divide-border/60` in UpcomingChargesList.tsx:78 und CategoryTree.tsx:135), und die Detailschritt-Regeln mussten laut useDetailParam.ts:9-11 in elf Entwürfen einzeln nachgebaut werden, bevor sie einmal zentral standen. Ein Verzeichnis aus elf Zielen ist genau der Fall, für den ADR Regel 10 „ein wiederholter Eintrag bekommt keine Karte je Stück" formuliert ist.

*Beleg:* `Vorbild und Lücke: src/features/shared/presentation/ListRow.tsx:92-102 (keine Box, Kachel optional ab Zeile 65), src/features/shared/presentation/useDetailParam.ts:40-48; Gegenbeispiel src/features/shared/presentation/InteractiveCard.tsx:65; Divergenz src/components/dashboard/TransactionListMobile.tsx:69, src/features/coach/presentation/shared/UpcomingChargesList.tsx:78, src/components/settings/CategoryTree.tsx:135`

**Fehlender Baustein 2: `useUebernahme` + `UebernahmeSchritt` — Vorschau, Bestätigen, Zurücknehmen als EIN Ablauf** *(architektur)*

Der Bestand hat den Ablauf bereits fertig, nur an einer anderen Fläche: `use-kategorie-action.ts` führt den Zustand `{art:'offen'} | {art:'erledigt', vorschlag} | {art:'zurueckgenommen'}` (Zeilen 28-31), schreibt ausschliesslich im Bestätigen-Klick (Zeilen 53-81), nimmt den Schnappschuss AUS DER VORSCHAU statt aus einem zweiten Lesen (Zeilen 9-13 und :62-66, :84-90) und lässt den Rückgängig-Knopf dort stehen, wo die Aktion passiert ist (KategorieAktionAntwort.tsx:64-78) — alles ohne eine einzige Box (`InfoGroup`). ZU BAUEN: (1) rein, in `src/features/settings/domain/kategorie-uebernahme.ts`: `planeUebernahme(entwurf: Partial<Category> & {name:string}, buchungen, kategorien, regeln): Uebernahmeplan` mit `Uebernahmeplan = { betroffen: {id, vorher: string|null, nachher: string}[]; anzahl: number; gekappt: boolean }`. Nimmt den ENTWURF, nicht die gespeicherte Kategorie — damit ist eine neue Kategorie vorschaubar. Benutzt zwingend DIESELBE Bedingung wie der Schreibpfad (`confirmed` überspringen, `categorizeConfident`), sonst entsteht die Lüge aus Befund 1 neu. (2) `src/features/settings/application/use-uebernahme.ts`: Zustand `offen | vorschau(plan) | erledigt(plan) | zurueckgenommen`, `bestaetigen(plan)` schreibt genau `plan.betroffen`, `zuruecknehmen()` schreibt `vorher` zurück. Der Plan IST der Schnappschuss. (3) `UebernahmeSchritt` als `<DetailSchritt wert="uebernahme" …>` mit: EIN Satz („8 von 412 Buchungen wechseln zu Lebensmittel"), die betroffenen Zeilen als `ListRow` ohne Rahmen, `Bestätigen`/`Abbrechen`, danach an derselben Stelle `Zurücknehmen`. (4) Der Plan gehört in denselben Entwurfs-Mechanismus wie laufende Formulare (ADR Regel 8, Vorbild `features/onboarding/data/onboarding-draft-store.ts`), damit der Rückweg einen Flächen- oder Dichtewechsel überlebt.

*Warum es schadet:* Ohne ihn bleibt „intuitiv übernehmbar" auf vier Knöpfe an drei Stellen verteilt, die alle dasselbe tun und Verschiedenes versprechen (Befund 2), und das Zurücknehmen bleibt an eine Bildschirmsitzung geknüpft (Befund 4). Dass die App denselben Ablauf im Chat schon korrekt kann, macht die Lücke nicht kleiner, sondern grösser: Zwei Wege zu derselben Schreiboperation sind nach AGENTS.md §3 zwei Wege, auf denen sie auseinanderlaufen — und sie laufen bereits auseinander, der eine nimmt seinen Schnappschuss aus der Vorschau, der andere aus einem zweiten Lesen beim Schreiben (transaction-service.ts:489-493).

*Beleg:* `Vorbild: src/features/money-questions/application/use-kategorie-action.ts:9-13, :28-31, :53-81, :83-100 und src/features/money-questions/presentation/KategorieAktionAntwort.tsx:42-97, :112-134; Lücke: src/features/settings/application/use-settings-overview.ts:51, :143, :179-192, :223; src/services/transaction-service.ts:489-493`

### Befunde — mittel

**`canUndo` wird berechnet, nicht durchgereicht — der Rückgängig-Knopf antwortet mit einer Fehlermeldung** *(bedienbarkeit)*

Das ViewModel liefert `bulk.canUndo: undoSnapshot.length > 0` (src/features/settings/application/use-settings-overview.ts:214). `EnhancedSettings` reicht an `CategoryPreview` nur `category`, `affectedTransactions`, `onPreview`, `onApply`, `onUndo`, `isProcessing` (Zeilen 139-146) — `canUndo` ist nicht dabei, und `CategoryPreviewProps` kennt es gar nicht (src/components/settings/CategoryPreview.tsx:10-17). Der Knopf steht deshalb immer und immer aktiv da (Zeilen 120-127); beim Drücken ohne Schnappschuss kommt `showError('Nichts zum Rückgängigmachen')` (use-settings-overview.ts:225-228).

*Warum es schadet:* Ein Bedienelement, das im Regelfall nichts kann und das mit einer Fehlermeldung sagt, ist eine Fehlbedienung mit angehängter Schuldzuweisung. Der Zustand ist bekannt und gerechnet — er wird nur nicht angezeigt. Für „intuitiv zurücknehmbar" ist das die billigste vorhandene Verbesserung.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:214 und :225-228; src/components/settings/EnhancedSettings.tsx:139-146; src/components/settings/CategoryPreview.tsx:10-17 und :120-127`

**ListRow: Symbolkachel und Rahmen sind NICHT das Problem — drei andere Eigenschaften fehlen** *(bedienbarkeit)*

Der Entwurf verlangt eine Variante ohne Symbolkachel und ohne Rahmen je Zeile. Beides kann `ListRow` heute schon: Die Kachel hängt an `icon !== undefined` und verschwindet beim Weglassen (src/features/shared/presentation/ListRow.tsx:65-73, die Prop-Beschreibung sagt es in Zeile 8), und die Komponente rendert überhaupt keinen Rahmen — die äusserste Hülle ist `flex items-center gap-3` (Zeile 92). Wo heute Rahmen um Zeilen stehen, kommen sie von der AUFRUFSTELLE, nicht vom Baustein. Es fehlen stattdessen: (1) `to?: string` — die Zeile rendert nur `<button>` (Zeile 95); ein Verzeichniseintrag, der auf eine andere Route führt, muss ein `<a>` sein, sonst ist er weder kopierbar noch als Link vorgelesen. (2) Ein Durchreichen von `data-*`/`id` — die Prop-Liste ist geschlossen, kein `...rest` (Zeilen 7-30); ohne das kann keine Zeile einen Tutorial-Anker tragen. (3) `subtitle` läuft in `truncate` (Zeile 79) und `valueTone` kennt kein `kritisch` (Zeilen 32-37, nur default/positive/warning/muted) — für eine Statuszeile („Verschlüsselung: aus") ist beides zu wenig. Dazu fehlt der LISTENRAHMEN als Baustein: `<ul>`/`<li>` und die Haarlinie baut heute jede Aufrufstelle selbst nach, in drei Varianten.

*Warum es schadet:* Wer die Aufgabe als „Variante ohne Kachel und ohne Rahmen bauen" liest, baut eine zweite Zeilen-Komponente neben eine, die das schon kann — und zwei Zeilen-Primitive driften genauso auseinander, wie es die drei Haarlinienstärken bereits vorgemacht haben. Die richtige Arbeit ist kleiner und an einer anderen Stelle: drei Eigenschaften an `ListRow` ergänzen und den Listen-Container einmal bauen (siehe `Verzeichnis`).

*Beleg:* `src/features/shared/presentation/ListRow.tsx:8, :32-37, :65-73, :79, :92-102; Aufrufstellen mit eigenem Container: src/components/dashboard/TransactionListMobile.tsx:69, src/features/coach/presentation/shared/UpcomingChargesList.tsx:78, src/components/contracts/ContractsDashboard.tsx:274`

**Der Seitenname steht in der fokussierten Dichte zweimal auf /settings** *(darstellung)*

`/settings` hat einen Navigationseintrag (src/components/layout/nav-config.ts:203), also liefert `getSeitenname` einen Namen (src/components/layout/AppShell.tsx:84-88) und die Shell rendert ihn als `<h1 … kompakt:hidden>` im Inhalt (AppShell.tsx:242-246). `EnhancedSettings` setzt daneben ein eigenes `<h1>` „Einstellungen" mit Zahnrad-Icon (src/components/settings/EnhancedSettings.tsx:99-102) — ohne `fokussiert:hidden` und ohne `PageHeader`, der genau diese Unterdrückung über `useShellTraegtSeitenname()` bereits eingebaut hat (src/features/shared/presentation/PageHeader.tsx:24, :32-40).

*Warum es schadet:* Der Kopfblock (EnhancedSettings.tsx:92-122) ist ausserdem selbst eine Karte mit Rahmen, Hintergrund, Schatten und Backdrop-Filter — auf einer fokussierten Fläche nach ADR Regel 9 eine Box um den Inhalt, und nach Prinzip 8 ein Klickversprechen, das nichts einlöst. Positiv und erhaltenswert: Der `InfoStatStrip` darin (Zeilen 108-120) zeigt bereits genau die zwei Grössen, die das Zielbild der Bildprüfung als Aussage 1 nennt („Kategorien und Aufbewahrung") — und `InfoStatStrip` hat für `fokussiert` schon die kastenlose Fassung mit Haarlinien (src/features/shared/presentation/InfoGroup.tsx:80-84).

*Beleg:* `src/components/layout/nav-config.ts:203; src/components/layout/AppShell.tsx:84-88, :242-246; src/components/settings/EnhancedSettings.tsx:92-122; src/features/shared/presentation/PageHeader.tsx:32-40; src/features/shared/presentation/InfoGroup.tsx:80-84`

### Befunde — niedrig

**Zwei Überschriftenblöcke stehen wortgleich doppelt, weil Abschnittskopf und Karte dieselben i18n-Schlüssel rendern** *(darstellung)*

`EnhancedSettings` rendert für „Bereiche & Navigation" einen `SectionHeader` mit `t('onboarding.manage.title')` und `t('onboarding.manage.description')` (src/components/settings/EnhancedSettings.tsx:162-166). Unmittelbar darunter rendert `NavFeatureSettings` in seinem `CardHeader` GENAU DIESELBEN beiden Schlüssel (src/components/settings/NavFeatureSettings.tsx:50-58). Derselbe Fehler, denselben Ursprung, ist in vier anderen Bausteinen schon behoben worden — der Test dazu benennt ihn ausdrücklich: „im Sprach-Abschnitt stand ‚Sprache' dadurch zweimal" (src/components/settings/__tests__/settings-card-rule.test.tsx:18-19).

*Warum es schadet:* Doppelter Text ist doppelte Höhe auf der mit Abstand längsten Fläche der App, und die Karte darum ist zusätzlich eine tote Schachtel — angeklickt werden die Kästchen darin, nicht sie (ADR Regel 10, `check:card-rule` sieht diesen Fall laut card-rule-budget.json ausdrücklich nicht). Die Behebung ist dieselbe wie bei den vier bereits bereinigten Bausteinen: Karten-Chrome und Kopf raus, die Gliederung trägt der Abschnittskopf der Seite.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:162-166 gegen src/components/settings/NavFeatureSettings.tsx:48-58; Präzedenzfall src/components/settings/__tests__/settings-card-rule.test.tsx:9-23`

**`InfoSheet` taugt nicht als Vorbild für einen Detailschritt und sollte nicht dafür herhalten** *(bedienbarkeit)*

`InfoSheet.tsx` sieht aus wie der naheliegende Baustein für „mehr dazu", ist es aber nicht: Der Auslöser misst `h-7 w-7`, also 28 px (src/features/shared/presentation/InfoSheet.tsx:47) — unter dem 44-px-Mindestmass aus AGENTS.md §9; die Ratsche `touch-target-budget.json` steht auf 0, zählt aber laut ihrem eigenen Hinweistext nur `h-8`, `size-8` und `h-[36px]`, sieht `h-7` also gar nicht. Ausserdem hat das Sheet keinen Adressparameter und legt keinen Verlaufseintrag an — die Zurücktaste verlässt damit die Fläche statt das Sheet zu schliessen, genau der Fehler, den `useDetailParam.ts:14-19` am Coach gemessen und behoben hat. Und die Datei heisst `InfoSheet.tsx`, exportiert aber `InfoButton` (Zeile 33).

*Warum es schadet:* Bei elf Detailschritten ist die Versuchung gross, den vorhandenen Sheet-Baustein zu nehmen. Dann bekommt die schlimmste Fläche der App elf Auslöser unter dem Mindestmass und elf Sheets, aus denen die Zurücktaste herausführt statt heraus. `DetailSchritt` ist der richtige Baustein und ist genau dafür gebaut (src/features/shared/presentation/DetailSchritt.tsx:13-32).

*Beleg:* `src/features/shared/presentation/InfoSheet.tsx:33, :43-53 (Auslöser `h-7 w-7` in Zeile 47); touch-target-budget.json Zeilen 23 und 76; src/features/shared/presentation/useDetailParam.ts:14-19`

### Unsicher

1. „33 Kartenrahmen in vier Dateien\": Ich habe nachgezählt und komme auf einen ähnlichen, aber nicht identischen Schnitt — die vier schwersten Dateien sind PerformanceDashboard.tsx (12), PrivacySyncAnalyticsSettings.tsx (11), BackupManager.tsx (6) und LocalEncryptionSettings.tsx (5) = 34, gezählt als `<Card` plus Ad-hoc-Boxen (rounded-* zusammen mit border). Welche Zählweise die Bildprüfung benutzt hat, weiss ich nicht; an den Befunden ändert die Differenz nichts.

2. Ob das Tutorial-Overlay mit `openAnchor` auf einer Verzeichniszeile zuverlässig arbeitet, habe ich NICHT ausprobiert. Der Mechanismus ist da (TutorialOverlay.tsx:88-96 klickt das Element), aber zwischen Klick, Sheet-Animation und der Messung durch `useAnchorRect` liegt Zeit, die ich nicht gemessen habe. Vor dem Umbau an einem der drei betroffenen Schritte ausprobieren.

3. Dass Radix das Sheet-Inhaltselement im geschlossenen Zustand aus dem DOM nimmt, habe ich aus dem Portal ohne `forceMount` (sheet.tsx:64-77) und aus der Zusicherung im eigenen Test (DetailSchritt.test.tsx:64) geschlossen, nicht am Gerät nachgemessen.

4. Ob der 28-px-Auslöser in `InfoSheet.tsx:47` wirklich an `check:touch-targets` vorbeigeht, habe ich aus dem Hinweistext der Ratsche gelesen (touch-target-budget.json Z. 23 nennt nur h-8, size-8, h-[36px]), nicht durch Ausführen des Wächters bestätigt.

5. Die Zuordnung „drei Aussagen\" der Bildprüfung (Kategorien und Aufbewahrung / Verschlüsselungsstand / letzte Sicherung) setzt voraus, dass Verschlüsselungsstand und letzte Sicherung ins gemeinsame ViewModel gehoben werden. Ob das ohne Anstieg von `check:view-data` (Ratsche 204, darf nur sinken) geht, habe ich nicht durchgerechnet — die Zugriffe verschwinden aus `components/settings/`, tauchen aber in der Slice wieder auf, und wie der Wächter das saldiert, weiss ich nicht sicher.

6. Zur Benennung (AGENTS.md „Absicht vor Auftrag\", Punkt 3): Die gemeinsamen Bausteine tragen zwei Sprachen — `DetailSchritt`/`useDetailParam`/`SeitennameContext` deutsch, `ListRow`/`InfoGroup`/`InteractiveCard`/`ChartFigure` englisch. Ich schlage für die zwei neuen deutsche Namen vor, weil die jüngeren Bausteine dieser Achse folgen und die Oberfläche deutsch spricht. Das ist eine Entscheidung mit Bleibewirkung (Dateipfad, Import in elf Aufrufstellen) und gehört vor dem Bauen bestätigt, nicht danach.

---

## Aufbau der Einstellungsflaeche /settings — Abschnittsgliederung, Datenhaltung je Untersystem und der Kategorie-Uebernahmeweg

### Datenfluss

Route `/settings` -> `SettingsPage.tsx` (8 Zeilen, bedingungslos) -> `EnhancedSettings.tsx`. Dort gibt es genau ZWEI Datenquellen auf der obersten Ebene: `useSettingsOverview()` (das Slice-ViewModel) und `useBusinessMode()` (eine eigene, sechste Abfrage auf `['userSettings']`, nur um den Steuer-Puffer-Baustein zu gaten).

Das ViewModel `src/features/settings/application/use-settings-overview.ts` haelt drei lesende Abfragen (`['userSettings']` Z.57, `['hierarchicalCategories']` Z.67, `['category-suggestion']` Z.73) und fuenf Schreibvorgaenge (Einstellungen Z.77, Kategorie speichern Z.86, Kategorie loeschen Z.101, Neukategorisierung Z.134, Ruecknahme Z.157), dazu sechs lokale Zustaende. Es reicht seine Werte als Props an genau FUENF Bausteine weiter: CategoryManager, CategoryPreview (EnhancedSettings Z.131-146), TimeRangeSettings, AutoCategorizationSettings, BulkAssignment (Z.207-223).

Alle uebrigen 16 Bausteine der Flaeche beschaffen ihre Daten selbst — teils per react-query in der eigenen Datei (HouseholdSettings 6, BackupManager 4, PrivacySyncAnalyticsSettings 3, AppearanceSettings 2, NavFeatureSettings 2, TaxReserveSettings 2), teils ueber einen eigenen Hook mit Abfragen darin (LearnedCategorizationSettings -> useCategoryModelReport, 3 useQuery; QuestionLearningSettings -> useQuestionLearning, 1 useQuery + 1 useMutation), teils per direktem Service-Aufruf in einem `useEffect` ohne react-query (CloudMcpSyncCard, DiagnosticsSettings, PerformanceDashboard), teils ueber Provider und Flag-Speicher (LocalEncryptionSettings, TelemetrySettings) oder direkt aus dem i18n-Kern (WordingSettings, LanguageSettings).

Der Schluessel `['userSettings']` wird auf DIESER EINEN Flaeche an fuenf Stellen abgefragt (ViewModel Z.57, AppearanceSettings Z.24, NavFeatureSettings Z.29, TaxReserveSettings Z.24, useBusinessMode Z.15) und von vier Mutationen geschrieben — ueber zwei verschiedene Service-Fassaden (`transaction-service` und `user-settings-service`), die beide nur an `local-settings-service` durchreichen.

Der Kategorie-Uebernahmeweg: CategoryPreview 'Vorschau' -> `settings.loadPreview()` -> `getCategoryPreview(id)` (categorize, Limit 50, ohne confirmed-Filter) -> lokaler State `previewTransactions`. CategoryPreview 'Anwenden' -> `settings.recategorize()` -> `recategorizeTransactions()` OHNE Argument (categorizeConfident ab 0,7, mit confirmed-Filter, ueber den Vollbestand) -> Ergebnis in `bulk.results` (nur in BulkAssignment gerendert) und Vorwerte in `undoSnapshot` -> 'Rueckgaengig' -> `restoreCategorization(undoSnapshot)`. Vorschau und Anwenden teilen also nur den Knopf-Nachbarn, keine Menge.

### Befunde — hoch

**Vorschau und Anwenden rechnen mit zwei verschiedenen Regeln** *(korrektheit)*

Die Vorschau (`getCategoryPreview`) benutzt `categorizer.categorize(t)` — also JEDES Ergebnis, unabhaengig von der Konfidenz — und ueberspringt bestaetigte Buchungen NICHT. Das Anwenden (`recategorizeTransactions`) ueberspringt `tx.confirmed` und benutzt `categorizer.categorizeConfident(tx)`, also nur Ergebnisse ab Konfidenz 0,7. Die Vorschau zeigt damit systematisch eine echte OBERMENGE dessen, was das Anwenden tut.

*Warum es schadet:* Der Auftraggeber verlangt ausdruecklich, dass der Nutzer VORHER sieht, was passiert. Genau das leistet die Flaeche nicht: Sie zeigt eine Liste, druckt darauf 'Anwenden', und der Lauf aendert eine andere, kleinere Menge. Es gibt keine Fehlermeldung, keinen Hinweis, keinen Test — die Abweichung ist unsichtbar. AGENTS.md Paragraf 3 'Was geschlossen wurde, wird geprueft' verlangt fuer Ebene-3-Ergebnisse einen Rueckweg auf genau die Menge, aus der die Zahl entstand; hier zeigt der Rueckweg eine andere Menge als die Aktion.

*Beleg:* `src/services/transaction-service.ts:553-556 (Vorschau: `categorizer.categorize(t)`, kein `confirmed`-Filter) gegen src/services/transaction-service.ts:477-482 (`if (tx.confirmed) … continue;` und `categorizer.categorizeConfident(tx)`); Schwelle: src/lib/categorization.ts:347 `MIN_SILENT_ASSIGN_CONFIDENCE = 0.7`, angewandt in src/lib/categorization.ts:302-304. Verdrahtung: src/components/settings/EnhancedSettings.tsx:142 (`onPreview`) gegen :143 (`onApply`).`

**Die Vorschau ist bei 50 gedeckelt, und die Zeile '+N weitere' nennt eine falsche Zahl** *(korrektheit)*

`getCategoryPreview(categoryId, limit = 50)` schneidet nach 50 Buchungen ab. Das ViewModel ruft sie ohne Limit auf, bekommt also hoechstens 50. Die Darstellung zeigt davon 10 und rechnet die Restzeile als `affectedTransactions.length - 10` — also hoechstens 40.

*Warum es schadet:* Sind 300 Buchungen betroffen, steht auf dem Bildschirm '40 weitere'. Der Nutzer entscheidet ueber eine Sammelaenderung an 300 Buchungen auf der Grundlage der Zahl 50. Das ist keine Andeutung, sondern eine falsche Auskunft an genau der Stelle, an der der Auftraggeber Sichtbarkeit vor dem Uebernehmen verlangt. Die Kappung ist zudem nirgends beschriftet.

*Beleg:* `src/services/transaction-service.ts:544 (`limit: number = 50`) und :558 (`affected.slice(0, limit)`); Aufruf ohne Limit in src/features/settings/application/use-settings-overview.ts:183 (`await getCategoryPreview(selectedCategoryId)`); falsche Restzahl in src/components/settings/CategoryPreview.tsx:105-108.`

**Vier Schaltflaechen in drei Karten und zwei Abschnitten loesen exakt dieselbe globale Neukategorisierung aus** *(bedienbarkeit)*

`settings.recategorize` ist an vier Stellen verdrahtet: 'Vorschlag anwenden' (CategoryManager), 'Anwenden' (CategoryPreview), 'Zuordnen' und 'Neu kategorisieren' (BulkAssignment). `recategorizeTransactions()` nimmt KEIN Argument — es laeuft immer ueber `getAllTransactions()`.

*Warum es schadet:* Die Beschriftungen versprechen vier verschiedene, eingegrenzte Handlungen; ausgefuehrt wird jedesmal derselbe Vollbestandslauf. Wer 'Vorschlag anwenden' fuer die Kategorie X drueckt, kategorisiert seinen gesamten Buchungsbestand neu. Das ist die schwerste Verletzung des Auftrags 'uebernehmen': Es gibt gar keine Uebernahme EINER Kategorie, nur den Alles-Knopf mit vier Namen. Zugleich ist es der Grund, warum die Flaeche so lang ist — dieselbe Funktion wird dreimal bebildert.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:137 (`onApplySuggestion={settings.recategorize}`), :143 (`onApply={settings.recategorize}`), :220 (`onBulkAssign={settings.recategorize}`), :221 (`onRecategorize={settings.recategorize}`); Signatur ohne Parameter: src/services/transaction-service.ts:452-462.`

**'Rueckgaengig' ist immer klickbar — das dafuer berechnete `canUndo` benutzt niemand** *(bedienbarkeit)*

Das ViewModel berechnet `bulk.canUndo` und die Domaene typisiert es. Die Rueckgaengig-Schaltflaeche in `CategoryPreview` hat kein `disabled`, und `EnhancedSettings` reicht `canUndo` gar nicht durch. Ein Klick ohne Schnappschuss endet in einer Fehlermeldung.

*Warum es schadet:* Der Auftraggeber verlangt, dass der Nutzer eine Uebernahme zuruecknehmen kann. Der Knopf dafuer sieht zu jedem Zeitpunkt gleich aus — vor dem Anwenden, nach dem Anwenden, nach einem bereits erfolgten Zuruecknehmen. Er beantwortet also die einzige Frage nicht, wegen der man ihn ansieht: Gibt es gerade etwas zurueckzunehmen? Ein berechnetes ViewModel-Feld ohne Konsumenten ist ausserdem toter Zustand (AGENTS.md Paragraf 3: ein deklarierter Datenbedarf, den niemand erfuellt).

*Beleg:* `Berechnet in src/features/settings/application/use-settings-overview.ts:214 (`canUndo: undoSnapshot.length > 0`), typisiert in src/features/settings/domain/settings-overview.ts:79, nirgends konsumiert (Suche ueber src/components/settings und src/features/settings ergibt nur diese zwei Stellen). Knopf ohne `disabled`: src/components/settings/CategoryPreview.tsx:120-127. Nicht durchgereicht: src/components/settings/EnhancedSettings.tsx:139-146. Fehlermeldung statt Sperre: use-settings-overview.ts:224-227.`

**'Anwenden' ist waehrend des Anwendens nicht gesperrt — der zweite Klick zerstoert den Rueckweg** *(korrektheit)*

`CategoryPreview` bekommt `isProcessing={settings.preview.isLoading}`, also die Ladeanzeige der VORSCHAU. Das richtige Flag `bulk.isRunning` existiert und geht nur an `BulkAssignment`. Der Anwenden-Knopf ist damit gesperrt, waehrend die Vorschau laedt, und offen, waehrend der Bestand umgeschrieben wird.

*Warum es schadet:* Ein zweiter Klick startet einen zweiten Vollbestandslauf. Dessen `onSuccess` ueberschreibt `undoSnapshot` mit den Vorwerten NACH dem ersten Lauf — der Ausgangszustand ist damit endgueltig weg, und 'Rueckgaengig' stellt einen Zwischenstand her, den der Nutzer nie gesehen hat. Genau die Ruecknahmefaehigkeit, die der Auftraggeber verlangt, geht am haeufigsten Bedienfehler ueberhaupt (Doppelklick auf einen Knopf ohne Rueckmeldung) verloren.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:145 (`isProcessing={settings.preview.isLoading}`) gegen :222 (`isRecategorizing={settings.bulk.isRunning}`); Knopf: src/components/settings/CategoryPreview.tsx:65-72 (`disabled={isProcessing}`); Ueberschreiben des Schnappschusses: src/features/settings/application/use-settings-overview.ts:145 (`setUndoSnapshot(summary.undo)`).`

**Eine neu angelegte Kategorie kann nie in der Vorschau erscheinen** *(bedienbarkeit)*

`selectCategory` des ViewModels wird ausschliesslich aus `onCategoryEdit` gerufen, also nur beim BEARBEITEN einer bestehenden Kategorie. Der Erstellen-Tab und 'Unterkategorie hinzufuegen' setzen nur den lokalen Zustand von `CategoryManager`. Und nach dem Speichern setzt das ViewModel `selectedCategoryId` auf `null`.

*Warum es schadet:* Der Auftrag lautet: erstellen, bearbeiten UND uebernehmen. Fuer eine gerade erstellte Kategorie ist die Vorschau strukturell unerreichbar — man muss sie erst suchen, im Baum auf 'Bearbeiten' druecken und dann die Vorschau laden. Genau der Weg, an dessen Ende der Nutzer sehen wuerde, was seine neue Regel anrichtet, ist der einzige, der nach dem Anlegen nicht angeboten wird.

*Beleg:* `Einzige Verdrahtung von `selectCategory`: src/components/settings/EnhancedSettings.tsx:136 (`onCategoryEdit={(category) => settings.selectCategory(category.id)}`); nur lokale Zustaende beim Anlegen: src/components/settings/CategoryManager.tsx:51 (`handleCategoryFormReset`) und :66 (`onAddSubcategory`); Zuruecksetzen nach dem Speichern: src/features/settings/application/use-settings-overview.ts:97 (`setSelectedCategoryId(null)`).`

**Ein Lesefehler der Einstellungen entzieht Verschluesselung, Backup und die Loeschfunktion** *(korrektheit)*

`EnhancedSettings` gibt bei `hasLoadError` die GANZE Flaeche als `FinanceErrorState` zurueck. `hasLoadError` ist `settingsError || categoriesError` — also auch dann wahr, wenn nur `['userSettings']` nicht lesbar war.

*Warum es schadet:* `SettingsPage.tsx` haelt in seinem Kommentar ausdruecklich fest, dass Kategorien, lokale Verschluesselung, Backups und die Danger-Zone bewusst NICHT gegated sind, weil auch anonyme Nutzer sie brauchen. Der Fruehausstieg gated sie trotzdem — an einer Voreinstellungsabfrage, die mit keiner dieser Funktionen zu tun hat. Wer sein Konto nach DSGVO Art. 17 loeschen oder eine Sicherung wiederherstellen will, kommt nicht mehr hin. Nebenwirkung: der eigene, sorgfaeltig begruendete Inline-Fehlerzustand von `AppearanceSettings` haengt an demselben Query-Key und ist damit toter Code — er kann nie gerendert werden.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:85-87 (`if (settings.hasLoadError) return <FinanceErrorState … />`); Zusammenfassung beider Abfragen: src/features/settings/application/use-settings-overview.ts:205 (`hasLoadError: settingsError || categoriesError`); Widerspruch zum Kommentar in src/pages/SettingsPage.tsx:3-5; unerreichbarer Inline-Fehlerzustand: src/components/settings/AppearanceSettings.tsx:44-48 mit demselben Key `['userSettings']` (:25).`

**16 Untersysteme halten ihre Daten selbst — der bekannte Befund ist bestaetigt und liegt eher hoeher** *(architektur)*

Von 21 Bausteinen der Flaeche werden genau FUENF aus dem ViewModel versorgt (CategoryManager, CategoryPreview, TimeRangeSettings, AutoCategorizationSettings, BulkAssignment). Alle uebrigen beschaffen ihre Daten selbst. Gezaehlt je Untersystem (Abfragen = useQuery/useMutation, dazu direkte Service-/IO-Importe): HouseholdSettings 6 Abfragen + 1 Service-Import; BackupManager 4 + 2; PrivacySyncAnalyticsSettings 3 + 2; AppearanceSettings 2 + 1; NavFeatureSettings 2 + 1; TaxReserveSettings 2 + 1; LearnedCategorizationSettings 3 Abfragen (ueber useCategoryModelReport); QuestionLearningSettings 2 (ueber useQuestionLearning); CloudMcpSyncCard 6 Service-Funktionen + eigener Ladeeffekt; DiagnosticsSettings 3 Service-Funktionen + eigener Ladeeffekt; PerformanceDashboard 1 Lib-Import + eigener Effekt; LocalEncryptionSettings 1 Service-Import + Provider; TelemetrySettings 1 Service-Import + Flag-Hook; DangerZoneSettings 1 Service-Import; WordingSettings liest die i18n-Overlays direkt; LanguageSettings liest den i18n-Kontext. Dazu haelt `EnhancedSettings` selbst noch `useBusinessMode`, das eine SECHSTE eigene Abfrage auf `['userSettings']` aufmacht.

*Warum es schadet:* Der Schluessel `['userSettings']` wird auf EINER Flaeche an fuenf unabhaengigen Stellen abgefragt und von vier unabhaengigen Mutationen geschrieben — und zwar ueber zwei verschiedene Service-Fassaden, die beide nur an `local-settings-service` durchreichen. Damit ist genau das Versprechen aus AGENTS.md Paragraf 4 gebrochen ('gleiche Daten, gleiche Berechnungen, gleiches ViewModel — keine doppelten Queries'): Eine zweite, fokussierte Fassung der Einstellungen muesste die Beschaffung sechzehnmal neu schreiben. Das ist auch der eigentliche Grund fuer die 19,02 Bildschirmlaengen — jedes Untersystem bringt seinen eigenen Rahmen, seine eigene Ueberschrift und seinen eigenen Fehlerzustand mit, weil es niemanden gibt, der sie zusammenfasst.

*Beleg:* `ViewModel-Konsumenten: src/components/settings/EnhancedSettings.tsx:131-146 und :207-223. Eigene Abfragen: HouseholdSettings.tsx:33,40,52,60,68,73 (+Service-Import :16); BackupManager.tsx:103,109,122,135; PrivacySyncAnalyticsSettings.tsx:99,105,119 (+:35); AppearanceSettings.tsx:24,31 (+:6); NavFeatureSettings.tsx:29,31 (+:5); TaxReserveSettings.tsx:24,29; LearnedCategorizationSettings.tsx:22 -> src/hooks/useCategoryModelReport.ts:31,39,43; QuestionLearningSettings.tsx:15 -> src/hooks/useQuestionLearning.ts:14,18; CloudMcpSyncCard.tsx:17-25 und :48; DiagnosticsSettings.tsx:16-21 und :38-40; PerformanceDashboard.tsx:12; LocalEncryptionSettings.tsx:13,35; TelemetrySettings.tsx:5-6; DangerZoneSettings.tsx:15; WordingSettings.tsx:10-13; LanguageSettings.tsx:9-11. Fuenfte userSettings-Abfrage: src/components/settings/EnhancedSettings.tsx:74 -> src/hooks/useBusinessMode.ts:15. Zwei Fassaden fuer denselben Speicher: src/services/transaction-service.ts:595-601 und src/services/user-settings-service.ts:16-27.`

**Die Flaeche hat keine fokussierte Fassung — die 19,02 Bildschirmlaengen sind das Desktop-Layout auf 360 px** *(darstellung)*

`SettingsPage` rendert `EnhancedSettings` bedingungslos. Unter `src/components/settings/` und in `SettingsPage.tsx` kommt kein Dichte-Kriterium vor (kein `useDensity`, kein `fokussiert`/`kompakt`). Die einzige fokussierte Fassung im Baum ist `CoachFokussiert`. Die Anpassung an schmale Breiten geschieht ausschliesslich ueber Tailwind-Breakpoints (`xl:grid-cols-2`, `xl:grid-cols-3`), die unterhalb von 1280 px einfach alles untereinander stapeln.

*Warum es schadet:* Das ist der Lehrbuchfall aus AGENTS.md Paragraf 4: 'Mobile als kleinerer Desktop — dieselbe Anordnung, nur enger.' Regel 9 der Darstellungsdichte verlangt fuer die fokussierte Dichte einen Bildschirm, hoechstens drei Aussagen und keine Boxen; geliefert werden elf gleichzeitig offene Abschnitte mit rund 34 Kastenrahmen. Weil es keine zweite Praesentation gibt, ist auch der Umbau nicht lokal moeglich — er scheitert an genau der Datenverteilung aus dem vorigen Befund.

*Beleg:* `src/pages/SettingsPage.tsx:6-8 (bedingungsloses Rendern); keine Dichte-Referenz in src/components/settings/** und src/pages/SettingsPage.tsx; einzige fokussierte Fassung: src/features/coach/presentation/mobile/CoachFokussiert.tsx. Elf Abschnitte: src/components/settings/EnhancedSettings.tsx:124,150,159,171,185/190 (Paar aus FeatureGate, sich gegenseitig ausschliessend),200,240,264,273,282,302 — zwoelf `<section>`-Elemente, elf gleichzeitig sichtbar. Einziges Akkordeon: :283-299 ('Technischer Status').`

### Befunde — mittel

**Der Waechter `check:view-data` sieht mehrzeilige Service-Importe nicht — die Ratsche steht zu niedrig** *(architektur)*

Die Erkennung `SERVICE_IMPORT` ist zeilenweise auf `^\s*import … from '@/services/…'` verankert. Ein Import, dessen Namensliste ueber mehrere Zeilen geht, endet auf `} from '@/services/…';` — diese Zeile beginnt nicht mit `import` und faellt durch. Auf der Einstellungsflaeche betrifft das vier Dateien, im ganzen Baum neun.

*Warum es schadet:* `CloudMcpSyncCard` importiert sechs Funktionen des Cloud-Sync-Service (also den Baustein, der als einziger bewusst gegen das Local-only-Prinzip verstoesst) und wird vom Waechter mit NULL Zugriffen gezaehlt. `DiagnosticsSettings` ebenso. Die Ratsche steht bei 204 und darf nur sinken — sie ist damit um mindestens neun zu niedrig verankert, und ausgerechnet die Bauform, die ein Untersystem am staerksten an seine Datenschicht bindet (viele Funktionen aus einem Service), ist die unsichtbare. Der Waechter meldet Fortschritt, wo eine Refaktorierung eine einzeilige Importzeile bloss umbricht.

*Beleg:* `Regex und Zeilenschleife: scripts/view-data-core.mjs:31 (`const SERVICE_IMPORT = /^\s*import\s[^;]*?from …/`) und :89-92. Betroffen: src/components/settings/CloudMcpSyncCard.tsx:17-25 (6 Funktionen, vom Waechter 0 gezaehlt), src/components/settings/DiagnosticsSettings.tsx:16-21, src/components/settings/HouseholdSettings.tsx:16, src/components/settings/PrivacySyncAnalyticsSettings.tsx:35. Gegenprobe: `node scripts/check-view-data.mjs` meldet 204; `grep -rE "^\} from '(@/services/|\.\./services/)" src/components src/pages` findet 9 unsichtbare Importe.`

**Der Ergebnisbericht der Uebernahme steht fuenf Bildschirme unterhalb des Knopfes, der sie ausloest** *(bedienbarkeit)*

Die einzige Stelle, die `bulk.results` (gesamt / zugeordnet / nicht zugeordnet) anzeigt, ist `BulkAssignment` im Abschnitt 'Automatisierung'. Wer die Uebernahme im Abschnitt 'Kategorien' ausloest, bekommt dort nur einen Toast; die Zahlen erscheinen weit unterhalb des Sichtfelds.

*Warum es schadet:* Der Auftrag verlangt, dass der Nutzer sieht, was passiert ist. Das Ergebnis existiert im Zustand, wird gerendert — nur nicht dort, wo gehandelt wurde. Dasselbe gilt fuer den Rueckgaengig-Knopf, der umgekehrt nur im Kategorien-Abschnitt steht: Wer im Automatisierungs-Abschnitt 'Zuordnen' drueckt, sieht das Ergebnis, aber keinen Weg zurueck.

*Beleg:* `Auslöser oben: src/components/settings/EnhancedSettings.tsx:143 (Abschnitt ab :124). Ergebnisanzeige unten: :217-223 (Abschnitt ab :200), gerendert in src/components/settings/BulkAssignment.tsx:79-104. Rueckgaengig nur oben: src/components/settings/CategoryPreview.tsx:120-127.`

**Zwei Wahrheiten fuer 'welche Kategorie ist ausgewaehlt'** *(architektur)*

`CategoryManager` haelt `selectedCategory` als OBJEKT im lokalen Zustand und speist daraus das Formular; das ViewModel haelt parallel `selectedCategoryId` und loest ueber `findCategoryById` auf. Beide werden beim Bearbeiten gesetzt, danach laufen sie auseinander.

*Warum es schadet:* Die README der Slice begruendet den Umstieg auf die ID ausdruecklich damit, dass nach einer Umbenennung der neue Name erscheint und nach einer Loeschung gar nichts mehr, statt eines Standes, den es nicht mehr gibt. Dieser Gewinn gilt nur fuer die Vorschau. Das Formular haelt weiterhin das eingefrorene Objekt — die Eigenschaft, gegen die die Entscheidung getroffen wurde, besteht in der Haelfte der Flaeche fort. Die Begruendung im Dokument ist damit weiter, als der Code reicht.

*Beleg:* `Lokales Objekt: src/components/settings/CategoryManager.tsx:30 und :41-48 (`useEffect` schreibt das Formular aus `selectedCategory`); ID im ViewModel: src/features/settings/application/use-settings-overview.ts:48 und :170 (`findCategoryById`); beide gesetzt in src/components/settings/CategoryManager.tsx:52; Begruendung: src/features/settings/README.md, Abschnitt 'Bewusste Abweichung vom Bestandsverhalten'.`

**Zwei wortgleiche Doppelungen bestaetigt — Abschnittskopf und Kartenkopf sagen dasselbe** *(darstellung)*

'Bereiche & Navigation' samt Beschreibung steht zweimal untereinander: einmal als `SectionHeader` in `EnhancedSettings`, einmal als `CardHeader` in `NavFeatureSettings` — mit denselben i18n-Schluesseln. Bei 'Haushalt' dasselbe Muster mit zwei verschiedenen Schluesseln, deren deutscher Text im Titel identisch und in der Beschreibung nahezu identisch ist.

*Warum es schadet:* Der Befund der Bildpruefung ('Zwei Textbausteine stehen wortgleich doppelt') ist damit belegt und hat eine strukturelle Ursache, keine redaktionelle: Jedes Untersystem bringt sein eigenes Karten-Chrome mit Titel und Beschreibung mit, weil es fuer sich allein entworfen wurde; `EnhancedSettings` setzt einen zweiten Kopf davor, weil es die Abschnitte gliedern muss. Solange die Bausteine ihre eigenen Koepfe tragen, kostet jeder Abschnitt zwei Ueberschriften und zwei Beschreibungssaetze — auf elf Abschnitten ist das ein messbarer Teil der 15212 px.

*Beleg:* `Identische Schluessel: src/components/settings/EnhancedSettings.tsx:162-166 (`onboarding.manage.title` / `onboarding.manage.description`) und src/components/settings/NavFeatureSettings.tsx:48-58 (dieselben zwei Schluessel). Haushalt: EnhancedSettings.tsx:193-194 (`settings.householdTitle` = 'Haushalt', src/i18n/translations/de.ts:1296) und src/components/settings/HouseholdSettings.tsx:84-86 (`householdSettings.title` = 'Haushalt', de.ts:3517).`

**`/settings#backups` springt nirgendwo hin — und zwei alte Routen leiten ohne Anker hierher um** *(bedienbarkeit)*

`DataIntegrityWarning` verlinkt auf `/settings#backups`, und der Abschnitt traegt tatsaechlich `id="backups"`. Es gibt im ganzen `src`-Baum aber keine Auswertung von `location.hash` und kein `scrollIntoView` ausserhalb des Tutorials. Zusaetzlich leiten `/backups` und `/performance` per `<Navigate to="/settings" replace />` um — ohne Anker.

*Warum es schadet:* Wer aus einer Datenintegritaets-Warnung heraus 'Sicherung pruefen' drueckt, landet am Kopf einer Flaeche von 19 Bildschirmlaengen und muss rund neun Bildschirme weit scrollen, um den Abschnitt zu finden, auf den der Link zeigte. Dasselbe gilt fuer jedes Lesezeichen auf `/backups` und `/performance`. Der Anker ist gesetzt, gepflegt und wirkungslos — die Flaechenlaenge macht aus einem kosmetischen Mangel einen Funktionsverlust.

*Beleg:* `Link: src/features/shared/presentation/DataIntegrityWarning.tsx:54 (`<Link to="/settings#backups">`); Ziel-Anker: src/components/settings/EnhancedSettings.tsx:264 (`<section className="mb-10" id="backups">`); Umleitungen ohne Anker: src/App.tsx:239-240; keine Hash-Auswertung: Suche nach `location.hash`/`ScrollRestoration`/`scrollIntoView` ueber src ergibt nur src/components/tutorial/useAnchorRect.ts:86.`

**Der Sicherheitsabschnitt verspricht die Backup-Funktion, die im naechsten Abschnitt liegt** *(darstellung)*

Die Beschreibung des Abschnitts 'Lokale Sicherheit & Sync-Datei' lautet '… Hier kannst du eine Sicherungskopie erstellen oder wiederherstellen.' In diesem Abschnitt stehen aber nur `LocalEncryptionSettings`, `PrivacySyncAnalyticsSettings` und `TelemetrySettings`. Die Sicherungskopie wird erst im FOLGENDEN Abschnitt 'Backups' vom `BackupManager` angeboten.

*Warum es schadet:* 'Hier' ist falsch — und weil beide Abschnitte zusammen mehrere Bildschirme fuellen, ist die Aussage nicht bloss ungenau, sondern schickt den Nutzer an die falsche Stelle. Fachlich gehoert beides ohnehin zusammen: Verschluesselung, Sync-Datei und Backup beantworten dieselbe Frage. Der Text sagt das bereits; die Struktur folgt ihm nicht.

*Beleg:* `Beschreibung: src/components/settings/EnhancedSettings.tsx:244 -> src/i18n/translations/de.ts:1315; Inhalt des Abschnitts: EnhancedSettings.tsx:246-255; die tatsaechliche Backup-Funktion: EnhancedSettings.tsx:264-271 (`<BackupManager />`).`

**Der Kartenrahmen-Bestand: rund 34 Kaesten, die schwersten vier Dateien tragen 34 von ihnen** *(darstellung)*

Gezaehlt wurden `<Card>`-Rahmen und handgebaute Kaesten (`rounded-* … border`) je Datei: PerformanceDashboard 12, PrivacySyncAnalyticsSettings 11, BackupManager 6, LocalEncryptionSettings 5 — allein 34 in vier Dateien; dazu CategoryPreview 4, AppearanceSettings 4, CloudMcpSyncCard 3 und weitere. `CategoryPreview` schachtelt dabei Karte in Karte in Liste mit Karte je Zeile.

*Warum es schadet:* Regel 9 der Darstellungsdichte verbietet in der fokussierten Dichte Rahmen, Hintergrund und Schatten um Inhalt; Regel 10 und AGENTS.md Paragraf 9 verbieten in BEIDEN Dichten eine Karte um eine Liste und eine Karte je wiederholtem Eintrag. Die Vorschauliste verletzt beides gleichzeitig: eine `Card` um die Liste, und in ihr ein gerahmter Kasten je Buchung. Jeder Rahmen kostet zweimal 16 px Rand — bei rund 34 Kaesten ist das der direkt messbare Anteil der 15212 px, und keiner dieser Rahmen loest eine Aktion aus.

*Beleg:* `Karte um die Liste: src/components/settings/CategoryPreview.tsx:76 (`<Card>` um die Vorschau) innerhalb der aeusseren Karte :31; Karte je Zeile: :90 (`<div className="rounded-xl border border-border bg-card p-3">` im `.map`). Zaehlung je Datei ueber `grep -cE "<Card[ >]|rounded-(md|lg|xl|2xl|3xl)[^\"]*border"` auf src/components/settings/*.tsx, src/components/BackupManager.tsx, src/components/PerformanceDashboard.tsx.`

**Der Uebernahme-Weg ist der einzige Teil der Flaeche ohne Test** *(korrektheit)*

Unter `src/components/settings/__tests__/` liegen zwoelf Tests, dazu `SettingsPage.error-state.test.tsx` und die 17 Tests des ViewModels. Fuer `CategoryPreview`, `BulkAssignment` und die Verdrahtung in `EnhancedSettings` gibt es keinen einzigen.

*Warum es schadet:* Das ViewModel ist gruendlich getestet — Vorschau laden, Sammellauf, Ruecknahme, Fehlerfall, alles vorhanden. Genau deshalb ist die Luecke gefaehrlich: Jeder der oben genannten Befunde (vier gleiche Knoepfe, falsches `isProcessing`, ungenutztes `canUndo`, nie ausgewaehlte neue Kategorie) sitzt AUSSCHLIESSLICH in der Verdrahtung, die kein Test beruehrt. Die gruene Suite bestaetigt eine korrekte Datenschicht und sagt nichts ueber die Flaeche, die der Nutzer bedient — dieselbe Fehlerform, die AGENTS.md fuer `check:state-coverage` beschreibt ('es gab Tests, sie waren gruen, und sie prueften, DASS gerendert wird, nicht WAS behauptet wird').

*Beleg:* `Vorhandene Tests: `ls src/components/settings/__tests__/` (CategoryFormTax, CategoryManager.suggestion, CloudMcpSyncCard, DiagnosticsSettings, LearnedCategorizationSettings, LocalEncryptionSettings.autolock, LocalEncryptionSettings.security, NavFeatureSettings, SnapshotVersionConflictDialog, TaxReserveSettings, TelemetrySettings, WordingSettings, settings-card-rule) — kein CategoryPreview, kein BulkAssignment, kein EnhancedSettings. ViewModel-Tests: src/features/settings/application/__tests__/use-settings-overview.test.tsx:83-321.`

### Unsicher

1. Die Bildpruefung nennt '33 Kartenrahmen in vier Dateien'. Ich komme mit meiner Zaehlung (`<Card>` plus handgebaute `rounded-* … border`-Kaesten) auf 34 in den vier schwersten Dateien und rund 57 ueber die ganze Flaeche. Die Differenz haengt an der Zaehlweise (Zaehle ich `<Card>` oder das gerenderte DOM? Zaehle ich `InfoGroup`/`InteractiveCard` mit?) — ich habe nicht im Browser nachgemessen, sondern im Quelltext. Die Groessenordnung ist bestaetigt, die exakte Zahl 33 kann ich weder belegen noch widerlegen.

2. Den Befund 'rund 15 Untersysteme' habe ich mit 16 bestaetigt, aber die Abgrenzung ist Auslegung: `LanguageSettings` liest nur den i18n-Kontext (kein I/O), `TelemetrySettings` liest localStorage-Flags ueber `useFeatureFlags`. Zaehlt man beide nicht mit, sind es 14. Die harte, nicht auslegbare Zahl ist: fuenf von 21 Bausteinen werden aus dem ViewModel versorgt, 16 nicht.

3. Die 19,02 Bildschirmlaengen habe ich NICHT nachgemessen — ich habe keinen Browser laufen lassen. Ich uebernehme die Zahl aus docs/mobil-2026-09/bildpruefung.md:47 und belege nur ihre strukturellen Ursachen im Quelltext.

4. Ob die vier `['userSettings']`-Mutationen sich gegenseitig ueberschreiben koennen, haengt an `updateLocalUserSettings` in `local-settings-service` — ob das Lesen-Aendern-Schreiben dort unter `withKeyLock` steht (AGENTS.md `check:store-serialization`). Das habe ich nicht geprueft; es liegt ausserhalb meines Gebiets, ist aber die naheliegende Anschlussfrage.

5. Die Behauptung, `AppearanceSettings.tsx:44-48` sei toter Code, setzt voraus, dass beide Abfragen auf `['userSettings']` denselben Cache-Eintrag treffen und damit denselben `isError` liefern. Das ist bei react-query mit identischem Key so, und beide `queryFn` reichen an dieselbe Speicherfunktion durch — aber ich habe es nicht durch einen laufenden Test bewiesen, sondern aus dem Code hergeleitet.

---

## Gelernte Kategorisierung und Vorschläge (/settings, Coach-Posteingang, Chat-Kategorisieraktion)

### Datenfluss

WIE DIE APP LERNT. Vier Stufen, in einer Kaskade (categorization.ts:204-292): 1. Händlerregel (`merchant_rule`, 0,95) — ein normalisierter Empfängername zeigt fest auf eine Kategorie. 2. Gelerntes Modell, wenn alle drei Gates halten (0,80, wird still geschrieben). 3. Kategorie-Stichwörter (`category_filter`, 0,85/0,70). 4. Gelerntes Modell ohne Gates (0,60 — unter der Schwelle 0,7, erscheint deshalb NUR als Vorschlag). 5. Allgemeiner Regex-Rückfall (0,55). Das Modell selbst ist ein Complement-Naive-Bayes in reinem TypeScript (category-model.ts): Merkmale sind Empfänger-Tokens und -Bigramme mit Herkunftspräfix (`p:`, `p2:`, `d:`, `o:`), Richtung (`dir:in/out`) und ein grobes Betragsband; trainiert wird in einem Zähldurchlauf, deterministisch, nichts wird persistiert (useCategoryModel.ts:28-33 — in ~80 ms neu ableitbar). Drei Gates entscheiden, ob still geschrieben werden darf: ≥ 12 bestätigte Beispiele in der Klasse, ein Belegtoken ≥ 3-mal gesehen, Marge ≥ 0,5 log-Punkte UND kreuzvalidierte Klassen-Präzision ≥ 0,9 (category-model.ts:31-40, :312-317). Die rohe Posterior wird ausdrücklich nie als Konfidenz durchgereicht.\n\nWAS EINE „BESTÄTIGTE\" BUCHUNG IST. `transaction.confirmed === true` — und nur solche gehen ins Training (category-model.ts:195), plus Übertragungen und Buchungen ohne Kategorie fallen raus. Der Kommentar begründet das ausdrücklich: `auto_mapped`-Buchungen sind die eigene Ausgabe der Kaskade, sie als Eingabe zu nehmen wäre ein Selbstbestätigungskreis (:161-165). Gesetzt wird `confirmed` an vier Stellen: manuelle Erfassung (TransactionFormDialog.tsx:142), GoCardless-Sync (:159), Demodaten — und, entscheidend, in `updateTransaction` bei JEDER Kategorieänderung (transaction-service.ts:340-343). Über diese vierte Tür wird auch das Annehmen eines Coach-Vorschlags zu bestätigter Wahrheit: useAutomationSuggestions.ts:85 ruft genau diesen Weg. Ein Vorschlag, den das Modell selbst erzeugt hat (Stufe 4), kann so mit einem Klick als Trainingsmaterial zurückfliessen — und legt im selben Zug eine Händlerregel mit dreifachem Gewicht an (:349-353).\n\nWO DER NUTZER DIE GRÜNDE SIEHT. `CategorizationResult.reasons[]` entsteht an vier Stellen (categorization.ts:196-201, :219, :263, :288) mit den i18n-Texten aus de.ts:5265-5268. Sichtbar werden sie an genau drei Orten, alle mit Einschränkung: (a) Coach-Posteingang — nur `reasons[0]`, einzeilig abgeschnitten (CategorySuggestionsInbox.tsx:64-66); (b) Buchungs-Detail — nur `reasons[0]`, und nur solange die Buchung UNzugeordnet und die Sicherheit < 0,85 ist (transaction-details.ts:141-143, Rendering TransactionDetailsPanel.tsx:327-328); (c) die Chat-Frage „warum ist das X?\" — die vollständigen reasons plus eine Quellen-Erklärung (metric-questions.ts:531-546), aber ohne Modell gerechnet, also mit potenziell falscher Quelle. Für eine Buchung, die die App bereits selbst eingeordnet hat, gibt es in der Oberfläche keine Stelle, die „warum steht die hier?\" beantwortet. In /settings erscheint kein einziger Grund.\n\nOB ER WIDERSPRECHEN KANN, UND OB DIE APP DARAUS LERNT. Zustimmung wird gelernt, Widerspruch nicht. Wer im Detail eine Kategorie ändert, erzeugt `confirmed = true` plus eine Händlerregel (transaction-service.ts:340-353) — das wirkt sofort und stark. Wer im Coach das X drückt, erzeugt nur `status: \"rejected\"` auf dem Vorschlagsobjekt (useAutomationSuggestions.ts:101-109); das erreicht weder Modell noch Regeln, und eine Gegen-Kategorie lässt sich dort gar nicht angeben. Die dafür vorgesehenen Aktions-IDs `accept_once`/`accept_always`/`reject_always` stehen unbenutzt im Typ (automation-suggestion-model.ts:28-38).\n\nDER ENTSCHEIDENDE PUNKT — GIBT ES VORSCHLÄGE FÜR EINE NEUE KATEGORIE? JA, ZWEIMAL, UND BEIDE SIND VERSTECKT. (1) `getCategoryPreview(categoryId)` (transaction-service.ts:544-559) beantwortet exakt die Frage „welche Buchungen bekämen diese Kategorie?\" — dargestellt in CategoryPreview.tsx. Erreichbar aber nur über: Kategorie speichern → Register „Verwalten\" → Stift-Symbol → in die Nachbarkarte wechseln → „Vorschau\". Denn `selectedCategoryId` wird ausschliesslich von `onCategoryEdit` gesetzt (EnhancedSettings.tsx:136) und beim Speichern einer neuen Kategorie auf `null` zurückgesetzt (use-settings-overview.ts:98) — der naheliegende Weg endet im Fehler-Toast. Die im Formular getippten Stichwörter wirken zudem erst nach dem Speichern. Und der „Anwenden\"-Knopf daneben wendet nicht diese Kategorie an, sondern kategorisiert alles neu. (2) Der ausgereiftere Weg liegt im Chat: `kategorie.aktion` (metric-questions.ts:563-626) rechnet eine reine Vorschau („{anzahl} Buchungen bekommen die Kategorie X\"), schliesst bereits richtig zugeordnete Buchungen aus, hält den Rückgängig-Schnappschuss VOR dem Schreiben fest und führt erst im Bestätigen-Klick aus (use-kategorie-action.ts). Das ist genau die vom Auftraggeber verlangte Form — nur bezieht sie ihre Menge ausschliesslich über einen HÄNDLER, nie über die Stichwörter einer neuen Kategorie, und sie ist nur über einen getippten Satz auf /fragen erreichbar. Aus den Einstellungen führt kein einziger Verweis dorthin.

### Befunde — hoch

**Vorschau und Anwenden rechnen mit verschiedenen Regeln — die angekündigte Zahl kann die Wirkung um ein Vielfaches übersteigen** *(korrektheit)*

Die Vorschau (`getCategoryPreview`, src/services/transaction-service.ts:553-556) und der Vorschlag (`getTopCategorySuggestion`, :573-578) benutzen `categorizer.categorize(t)` — das liefert JEDE Kategorie ab Konfidenz 0, also auch den Regex-Rückfall mit 0,55. Der Schreiblauf `recategorizeTransactions` (:483) benutzt `categorizeConfident`, also die Schwelle MIN_SILENT_ASSIGN_CONFIDENCE = 0,7 (src/lib/categorization.ts:349), und überspringt zusätzlich jede bestätigte Buchung (:477-481). Die Vorschau kennt weder die Schwelle noch den `confirmed`-Ausschluss.

*Warum es schadet:* Der Auftraggeber verlangt, dass der Nutzer VORHER sieht, was passiert. Was er sieht, ist eine andere Menge als die, die geschrieben wird — und zwar systematisch eine grössere. Wer manuell sortiert hat (also genau der Nutzer, dessen Bestand am meisten `confirmed` trägt), bekommt die höchste Zahl angekündigt und die kleinste Wirkung. Genau diesen Fehler benennt der Bestand an anderer Stelle selbst als unzulässig: „‚8 Buchungen ändern‘, wenn nur 3 sich ändern, ist eine falsche Ankündigung" (src/features/transactions/domain/metric-questions.ts:596-599). Dort wurde er behoben, hier steht er noch.

*Beleg:* `src/services/transaction-service.ts:554 · src/services/transaction-service.ts:574 · src/services/transaction-service.ts:477-483 · src/lib/categorization.ts:349`

**„Regel anwenden" wendet keine Regel an, sondern kategorisiert den gesamten Bestand neu** *(korrektheit)*

Der Vorschlagskasten sagt „{count} Transaktionen könnten zur Kategorie \"{category}\" passen" (de.ts:3500) und bietet „Regel anwenden" (de.ts:3501). Der Knopf ist verdrahtet als `onApplySuggestion={settings.recategorize}` (src/components/settings/EnhancedSettings.tsx:137) — das ist `recategorizeTransactions()`, ein Lauf über ALLE Buchungen und ALLE Kategorien ohne jeden Bezug zur genannten Kategorie. Es entsteht auch keine Regel; der Titel „Neue Regel gefunden" (de.ts:3498) beschreibt nichts, was im Code existiert.

*Warum es schadet:* Der Nutzer stimmt einer benannten, gezählten Änderung an EINER Kategorie zu und löst eine unbenannte Änderung an allen aus. Der Kasten trägt keine Liste der betroffenen Buchungen und keinen Rückgängig-Knopf; der einzige Rückweg liegt in der Nachbarkarte (CategoryPreview.tsx:120), von der aus nicht erkennbar ist, dass sie zu dieser Aktion gehört. Das ist das Gegenteil von „vorher sehen, danach zurücknehmen".

*Beleg:* `src/components/settings/EnhancedSettings.tsx:137 · src/components/settings/CategoryManager.tsx:74 · src/i18n/translations/de.ts:3498-3501 · src/services/transaction-service.ts:452`

**Die gelernte Stufe umgeht den Richtungs-Guard und darf eine Ausgabe still in eine Einnahmen-Kategorie schreiben** *(korrektheit)*

`createCategorizer` baut `incomeCategoryIds` und den Prüfer `isBlockedByDirection` (src/lib/categorization.ts:137-141, 186-187). Angewandt wird er auf Stufe 3 (Filter, :250) und Stufe 5 (Regex, :285). Stufe 2 — das gelernte Modell mit Konfidenz 0,80, also OBERHALB der Schwelle für stilles Schreiben — kehrt bei :240-241 zurück, ohne ihn je zu fragen; Stufe 4 (:274-275) ebenso. Geprüft wird dort nur, ob die Kategorie-ID noch existiert (:190-191).

*Warum es schadet:* Der Guard existiert wegen eines benannten Schadensfalls: „eine Ausgabe (z. B. eBay-Kauf) darf nicht als ‚Verkäufe‘-Einnahme fehlkategorisiert werden" (:124-129). Eine so fehlgeleitete Buchung verfälscht Einkommen, Budgets und EÜR gleichzeitig. Dass das Modell ein `dir:out`-Merkmal kennt, macht den Fehler unwahrscheinlich, nicht unmöglich — ein Guard ist eine Invariante, keine Wahrscheinlichkeit. AGENTS.md §3 formuliert genau diese Klasse: „Ein Gate gehört an JEDE Stufe, die es umgehen könnte", gelernt an einem Fund derselben Bauart.

*Beleg:* `src/lib/categorization.ts:240-241 · src/lib/categorization.ts:274-275 · src/lib/categorization.ts:250 · src/lib/categorization.ts:285 · src/lib/categorization.ts:124-129`

**Jede Kategorie-Korrektur legt still eine „immer"-Händlerregel an, die der Nutzer nirgends sehen, prüfen oder löschen kann** *(architektur)*

`updateTransaction` legt bei JEDEM gesetzten `category_id` eine Händlerregel aus dem normalisierten Empfänger an (src/services/transaction-service.ts:349-353) — ohne Nachfrage, ohne Rückmeldung. Diese Regeln sind Stufe 1 der Kaskade mit Konfidenz 0,95 (categorization.ts:216-222) und wiegen im Training dreifach (REGEL_GEWICHT = 3, category-model.ts:48). Eine Oberfläche, die sie auflistet, existiert nicht: `deleteMerchantRule` wird nur im Rückgängig der Chat-Aktion (use-kategorie-action.ts:92) und beim Löschen der ganzen Kategorie (services/category-service.ts:68) aufgerufen.

*Warum es schadet:* Der Kommentar an der Regel nennt sie „eine ausdrückliche Nutzerentscheidung (‚immer diese Kategorie‘)" (category-model.ts:44-47) — sie ist es aber nicht: sie entsteht als Nebenwirkung einer Einzelkorrektur. Wer eine Amazon-Buchung einmal auf „Elektronik" schiebt, lenkt damit dauerhaft jede künftige Amazon-Buchung dorthin, schlägt damit auch das gelernte Modell, und hat keinen Weg zurück ausser die Kategorie zu löschen. Der Auftrag verlangt intuitiv BEARBEITBARE Kategorien; der wirkmächtigste Teil der Zuordnung ist unsichtbar und unbearbeitbar.

*Beleg:* `src/services/transaction-service.ts:349-353 · src/lib/category-model.ts:44-48 · src/lib/categorization.ts:216-222 · src/services/merchant-rules-service.ts:60`

**Die Kreuzvalidierung trainiert auf ihren eigenen Testdaten — die Präzisionszahl in den Einstellungen ist geschönt, und Gate 2 lässt sich von einer einzigen Regel erfüllen** *(korrektheit)*

`computeClassPrecision` teilt die bestätigten Buchungen in fünf Folds, trainiert je Fold auf `training` — reicht aber die VOLLSTÄNDIGEN `merchantRules` mit hinein (src/lib/category-model-evaluation.ts:99); `foldLauf` tut dasselbe (:206, :211). Weil transaction-service.ts:352 zu jeder bestätigten Buchung eine Regel aus ihrem Empfänger anlegt, steht das Empfängermerkmal der Testbuchung mit Gewicht 3 im Trainingsmodell. Da REGEL_GEWICHT = 3 und MIN_EVIDENZ_SUPPORT = 3 (category-model.ts:36, :48), erfüllt eine einzige durchgesickerte Regel Gate 2 im Alleingang — `evidenzStaerke` liest genau dieses `p:`-Merkmal (category-model.ts:296-303).

*Warum es schadet:* Die so gemessene Zahl wird dem Nutzer als Rechenschaft ausgegeben („{correct} von 100 richtig", LearnedCategorizationSettings.tsx:46-49) UND speist Gate 3, an dem hängt, ob das Modell still schreiben darf (category-model.ts:312-317). Ein Modell, das auf dem Test trainiert, misst Wiedererkennung — AGENTS.md §3 nennt genau das als eigenen Fund („wer auf dem Test trainiert, misst Auswendiglernen"), und dieselbe Datei hat für Gate 1 ausdrücklich vorgesorgt (Regeln zählen nicht in `klassenSupport`, category-model.ts:198-201), für Gate 2 aber nicht.

*Beleg:* `src/lib/category-model-evaluation.ts:99 · src/lib/category-model-evaluation.ts:206-211 · src/lib/category-model.ts:36 · src/lib/category-model.ts:48 · src/services/transaction-service.ts:352`

**Die einzige Fläche, die „warum diese Kategorie?" beantwortet, rechnet ohne das gelernte Modell — sie kann nur eine falsche Quelle nennen** *(korrektheit)*

Der Registereintrag `kategorie.begruendung` ruft `explainCategorization(juengste, categories, merchantRules)` mit DREI Argumenten (src/features/transactions/domain/metric-questions.ts:493-499) — der vierte, `context` mit dem Modell, fehlt. Er kann auch nicht gefüllt werden: `QuestionData` hat gar keinen Kanal dafür (src/features/shared/domain/question-registry.ts:363, `DataNeed` :292-307). Der Antworttext `financeQuestions.quelle.learned_model` („Weil deine eigenen bestätigten Buchungen dieses Muster zeigen", de.ts:4722) ist damit unerreichbar, obwohl der Doc-Kommentar des Eintrags ausdrücklich „gelernte Regel, Kategorie-Filter, gelerntes Modell oder Stichwort-Rückfall" verspricht (:466-469).

*Warum es schadet:* Es fehlt nicht bloss eine Möglichkeit — die Antwort ist falsch. Wurde eine Buchung von Stufe 2 (learned_model, 0,80) geschrieben, fällt der modelllose Nachlauf auf `category_filter`, `regex_fallback` oder `none` durch und nennt dem Nutzer eine Begründung, die nicht die Begründung war. AGENTS.md §3 verlangt für Ebene 3 „nie ein Ergebnis ohne Beleg und nie eine Zahl ohne Rückweg" und nennt `reasons[]` namentlich als Einlösung — die Einlösung greift ins Leere.

*Beleg:* `src/features/transactions/domain/metric-questions.ts:493-499 · src/features/shared/domain/question-registry.ts:363 · src/i18n/translations/de.ts:4722 · src/features/transactions/domain/metric-questions.ts:466-469`

**Der Weg „neue Kategorie → welche Buchungen passen dazu?" existiert, wird aber genau im Moment des Anlegens abgeschnitten** *(bedienbarkeit)*

`getCategoryPreview` (src/services/transaction-service.ts:544) beantwortet genau die Frage des Auftraggebers. Sie hängt an `selectedCategoryId`, und das wird ausschliesslich von `onCategoryEdit` gesetzt (EnhancedSettings.tsx:136 ← CategoryTree.tsx:57/104, der Stift). Beim Speichern einer Kategorie setzt `saveCategoryMutation.onSuccess` es auf `null` (use-settings-overview.ts:98). Wer also eine Kategorie anlegt und danach „Vorschau" drückt, bekommt den Fehler-Toast „Bitte zuerst eine Kategorie auswählen" (:180-183). Zusätzlich liest die Vorschau nur PERSISTIERTE Filter (:546, :554) — die im Formular getippten Stichwörter (CategoryManager.tsx:36, formFilters) wirken bis zum Speichern gar nicht.

*Warum es schadet:* Die Funktion, die der Auftrag ausdrücklich verlangt, ist gebaut und liegt hinter der einen Bedienfolge, die niemand findet: speichern → Register „Verwalten" → Stift → in die zweite Karte wechseln → „Vorschau". Der naheliegende Weg (anlegen und sehen, was greift) endet in einer Fehlermeldung. Auf dem Telefon steht die Vorschaukarte ausserdem unterhalb der Verwaltungskarte (`xl:grid-cols-2`, EnhancedSettings.tsx:130) — auf einer Fläche von 19 Bildschirmlängen ohne jeden Verweis zwischen beiden.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:98 · src/features/settings/application/use-settings-overview.ts:180-183 · src/components/settings/EnhancedSettings.tsx:130-146 · src/services/transaction-service.ts:544-558`

**Das Rückgängig der Chat-Kategorisierung stellt den Vorzustand nicht her — es bestätigt die Buchungen und legt dabei neue Regeln an** *(korrektheit)*

`use-kategorie-action.ts:85-90` nimmt zurück, indem es `updateTransaction` mit den alten Kategorie-IDs aufruft. Dieser Weg setzt aber bei jeder berührten Kategorie `confirmed = true` und `auto_mapped = false` (transaction-service.ts:340-343) und legt bei jedem nicht-leeren `category_id` eine Händlerregel an (:349-353). Gelöscht wird beim Rückgängig nur die EINE ausdrücklich gemerkte Regel (:91-94). Dieselbe Nebenwirkung trifft schon den Hinweg: Auch die Variante `zuordnen` erzeugt N Regeln, obwohl ihr Vorschautext sie ausdrücklich nur der Variante `merken` zuschreibt (de.ts:4727-4728).

*Warum es schadet:* Der Modulkopf verspricht „vor dem Klick ist NICHTS geschrieben, und danach steht der Rückweg bereit" (:5-6) und „eine halb zurückgenommene Aktion wäre schlimmer als keine" (:15-16). Beides hält nicht: Nach dem Rückgängig sind die Buchungen bestätigt (also Trainingsmaterial und für den Sammellauf gesperrt), und Regeln stehen im Bestand, die vorher nicht da waren. Die Vorschau sagt zu, keine Regel anzulegen, und legt welche an — der Nutzer stimmt einer kleineren Änderung zu, als ausgeführt wird.

*Beleg:* `src/features/money-questions/application/use-kategorie-action.ts:85-94 · src/services/transaction-service.ts:340-343 · src/services/transaction-service.ts:349-353 · src/i18n/translations/de.ts:4727-4728`

### Befunde — mittel

**Zweimal „Anwenden" löscht den Rückweg der ersten Änderung** *(korrektheit)*

`recategorizeMutation.onSuccess` ersetzt den Rückgängig-Vorrat vollständig: `setUndoSnapshot(summary.undo)` (use-settings-overview.ts:143). Der zweite Lauf ist weitgehend idempotent — was der erste geschrieben hat, ändert er nicht mehr, also ist sein `undo` fast oder ganz leer (transaction-service.ts:489-493). Damit fällt `canUndo` auf false und die Vorwerte des ersten Laufs sind fort. Drei Knöpfe lösen denselben Lauf aus (EnhancedSettings.tsx:137, :143, :220-221), zwei davon direkt nebeneinander in derselben Karte mit unterschiedlicher Beschriftung („Jetzt zuweisen" / „Neu kategorisieren", de.ts:1218-1219).

*Warum es schadet:* Der Vorrat liegt zudem nur in `useState` — ein Neuladen der Seite verliert ihn ebenfalls. Eine Sammeländerung über den gesamten Buchungsbestand, deren Rückweg ein zweiter Klick auf einen von drei gleich aussehenden Knöpfen still entfernt, ist die gefährlichste Bedienform, die diese Fläche anbietet.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:143 · src/features/settings/application/use-settings-overview.ts:51 · src/components/settings/EnhancedSettings.tsx:137 · src/components/settings/EnhancedSettings.tsx:220-221`

**Der Rückgängig-Knopf ist immer aktiv, obwohl das ViewModel weiss, ob es etwas zurückzunehmen gibt** *(bedienbarkeit)*

`BulkCategorizationState.canUndo` ist typisiert (settings-overview.ts:79) und berechnet (use-settings-overview.ts:214) — und wird nirgends gerendert; `grep canUndo` findet ausser Definition und Berechnung keine Fundstelle. Der Knopf in CategoryPreview.tsx:120-127 hat kein `disabled` und ruft bei leerem Vorrat nur einen Fehler-Toast „Nichts zum Rückgängigmachen" (use-settings-overview.ts:225-227).

*Warum es schadet:* Ein stets aktiver Rückgängig-Knopf sagt „das lässt sich zurücknehmen", auch wenn es das nicht tut — und meldet den Unterschied erst nach dem Klick als Fehler. Zusammen mit Befund 9 heisst das: Nach einem zweiten Anwenden sieht der Knopf unverändert aus und ist wirkungslos.

*Beleg:* `src/features/settings/domain/settings-overview.ts:79 · src/features/settings/application/use-settings-overview.ts:214 · src/components/settings/CategoryPreview.tsx:120-127 · src/features/settings/application/use-settings-overview.ts:225-227`

**Die Vorschau zeigt zehn Buchungen und nennt eine Restzahl, die bei mehr als fünfzig Treffern falsch ist** *(korrektheit)*

`getCategoryPreview` lädt höchstens `limit = 50` (transaction-service.ts:544, :558). Die Karte rendert die ersten zehn (CategoryPreview.tsx:89) und schreibt darunter „... und {count} weitere" mit `affectedTransactions.length - 10` (:105-108). Bei 300 betroffenen Buchungen steht dort „und 40 weitere".

*Warum es schadet:* Das ist wieder die Vorschau, die den Umfang der Änderung kleiner ausweist, als er ist — diesmal um eine Grössenordnung. Wer die Wirkung eines Filters abschätzen will, liest genau diese Zahl, und sie ist eine Eigenschaft des Ladelimits, nicht des Bestands.

*Beleg:* `src/components/settings/CategoryPreview.tsx:105-108 · src/services/transaction-service.ts:544 · src/services/transaction-service.ts:558`

**Der Erklärtext der Massenzuweisung beschreibt zwei von fünf Kaskadenstufen und warnt vor einer Wirkung, die es nicht gibt** *(korrektheit)*

Die vier Schritte nennen ausschliesslich Stichwort-Filter (de.ts:1214-1215) — Händlerregeln (Stufe 1) und das gelernte Modell (Stufen 2 und 4) kommen nicht vor. Schritt 4 sagt „Bereits kategorisierte Transaktionen werden überschrieben" (de.ts:1216); `recategorizeTransactions` überspringt jede bestätigte Buchung ausdrücklich (transaction-service.ts:475-481) und rührt sie nie an.

*Warum es schadet:* Der eine falsche Satz kostet die Funktion: Wer von Hand sortiert hat, liest „meine Arbeit wird überschrieben" und drückt nicht — dabei ist genau seine Arbeit die einzige, die geschützt ist. Umgekehrt erfährt niemand, dass hier auch die gelernte Zuordnung wirkt. AGENTS.md §3 verlangt für die Stufen 2 und 3 Beleg und Rückweg; hier steht nicht einmal, dass sie beteiligt sind.

*Beleg:* `src/i18n/translations/de.ts:1213-1216 · src/services/transaction-service.ts:475-481 · src/lib/categorization.ts:240-241`

**Widersprechen heisst im Coach-Posteingang nur „wegklicken" — die Ablehnung wird nirgends gelernt, und eine bessere Kategorie lässt sich nicht angeben** *(architektur)*

Der Posteingang bietet Annehmen und ein X (CategorySuggestionsInbox.tsx:69-81). Das X schreibt lediglich `status: "rejected"` auf den Vorschlag (useAutomationSuggestions.ts:101-109) — es erreicht weder das Modell noch die Regeln; im Training kommt der Status nicht vor (category-model.ts:190-202 kennt nur `confirmed`). Eine Korrektur („nicht Freizeit, sondern Versicherung") gibt es hier nicht; die Aktions-IDs `accept_once`/`accept_always`/`reject_always` sind im Modell deklariert (automation-suggestion-model.ts:28-38) und werden von keiner Zeile ausserhalb der Typdeklaration benutzt.

*Warum es schadet:* Die App lernt nur aus Zustimmung, nie aus Widerspruch. Genau die Buchung, bei der sie danebenlag, ist die lehrreichste — und sie fällt lautlos aus der Liste, um beim nächsten Bestand identisch wieder vorgeschlagen zu werden (die Vorschläge sind on-demand berechnet, automation-suggestions.ts:46-62). Der Nutzer erlebt eine Automatik, die seinen Einspruch vergisst.

*Beleg:* `src/hooks/useAutomationSuggestions.ts:101-109 · src/features/coach/presentation/shared/CategorySuggestionsInbox.tsx:69-81 · src/lib/category-model.ts:195 · src/lib/automation-suggestion-model.ts:28-38`

**Das Buchungs-Detail rechnet ohne das gelernte Modell und widerspricht damit dem Coach für dieselbe Buchung** *(korrektheit)*

`TransactionDetailsPanel.tsx:161` ruft `explainCategorization(transaction, categories, learnedRules)` ohne vierten Parameter. Der Hook `useCategoryModel` existiert genau dafür und wird an drei Stellen benutzt (ReviewTable.tsx:233, useAutomationSuggestions.ts:69, use-money-questions.ts:336) — hier nicht. Der Coach-Posteingang zieht dieselbe Buchung MIT Modell durch dieselbe Kaskade (automation-suggestions.ts:43/51).

*Warum es schadet:* Zwei Flächen zeigen für dieselbe Buchung verschiedene Vorschläge und verschiedene Gründe, ohne dass eine von beiden sagt, warum. Genau diese Abweichung zu verhindern ist der ausdrückliche Zweck von `review-preview.ts` („nutzt exakt dieselbe Engine ... die angezeigte Auto-Kategorie kann damit nie von der später geschriebenen abweichen", :4-9); die CSV-Vorschau hält das ein, das Detail-Sheet nicht. Zusätzlich zeigt das Sheet den Grund nur, solange die Buchung UNkategorisiert und die Sicherheit < 0,85 ist (transaction-details.ts:141-143) — für eine bereits automatisch zugeordnete Buchung ist „warum steht die hier?" in der Oberfläche unbeantwortbar.

*Beleg:* `src/components/dashboard/TransactionDetailsPanel.tsx:161 · src/hooks/useCategoryModel.ts:34 · src/components/dashboard/transaction-details.ts:141-143 · src/lib/review-preview.ts:4-9`

**Die Vorschaukarte ist Karte-in-Karte-in-Liste-mit-Karte-je-Zeile** *(darstellung)*

CategoryPreview.tsx:31 öffnet eine `Card`, :41 setzt einen zweiten gerahmten Block hinein, :76 eine weitere `Card` für die Trefferliste, und :90 gibt jeder einzelnen Buchungszeile noch einen eigenen Rahmen. Vier Rahmenebenen für eine Liste, in der nichts anklickbar ist — keiner dieser Rahmen löst eine Aktion aus.

*Warum es schadet:* Darstellungsdichte Regel 10 verbietet beides ausdrücklich: „Eine Liste bekommt keine Karte um sich" und „Ein wiederholter Eintrag bekommt keine Karte je Stück — zehn Karten untereinander sind keine zehn Aktionen, sondern eine Liste mit neunfachem Rand". AGENTS.md §9 wiederholt es für beide Dichten. Auf 360 px kosten die vier Ebenen je Zeile ~64 px Rand und versprechen nach Prinzip 8 eine Klickbarkeit, die keine Zeile einlöst — auf der Fläche, die mit 19,02 Bildschirmlängen ohnehin die schlimmste der App ist.

*Beleg:* `src/components/settings/CategoryPreview.tsx:31 · src/components/settings/CategoryPreview.tsx:76 · src/components/settings/CategoryPreview.tsx:90 · docs/architecture/darstellungsdichte.md:224-251`

### Befunde — niedrig

**Der Titel jedes Kategorie-Vorschlags ist hart deutsch verdrahtet** *(darstellung)*

`buildCategorySuggestion` baut `title: \`Kategorie-Vorschlag für ${transaction.payee || 'Buchung'}\`` als Literal (automation-suggestion-model.ts:73). Die Nachbarfunktion `buildTaxSuggestion` macht es im selben File über `t()` richtig (:115-118). Der Titel wird prominent gerendert (CategorySuggestionsInbox.tsx:56) und geht zusätzlich in das `aria-label` des Ablehnen-Knopfes ein (:78).

*Warum es schadet:* Auf Englisch, Russisch oder Klingonisch steht dort deutscher Text — auch im Vorlesetext des einzigen Knopfes, mit dem man widersprechen kann. AGENTS.md §6 verlangt Bildschirmtext ausschliesslich aus dem Sprachbaum, und die Nachbarfunktion zeigt, dass es hier keinen Sachgrund für die Ausnahme gibt.

*Beleg:* `src/lib/automation-suggestion-model.ts:73 · src/lib/automation-suggestion-model.ts:115-118 · src/features/coach/presentation/shared/CategorySuggestionsInbox.tsx:56`

### Unsicher

1. Ich habe die App nicht laufen lassen. Alle Befunde stammen aus dem Quelltext; die Zahlen 19,02 Bildschirmlängen und „33 Kartenrahmen\" habe ich aus docs/mobil-2026-09/bildpruefung.md:47 und :164-170 übernommen, nicht selbst gemessen.\n2. Beim Richtungs-Guard (Befund 3) ist die LÜCKE belegt, nicht ihr Eintreten: Das Merkmal `dir:out` macht es unwahrscheinlich, dass das Modell einer Ausgabe eine Einkommens-Kategorie gibt. Ich habe keinen Datensatz konstruiert, der es auslöst. Bei stark unbalancierten Klassen und Complement-NB halte ich es für möglich, kann es aber nicht beziffern.\n3. Bei der Leckage in der Kreuzvalidierung (Befund 5) ist der Mechanismus belegt (volle `merchantRules` in jedem Fold, REGEL_GEWICHT = MIN_EVIDENZ_SUPPORT = 3). Wie stark die ausgewiesene Präzision dadurch steigt, hängt vom Bestand ab — bei einem Nutzer ohne manuelle Korrekturen gibt es kaum Regeln und damit kaum Leckage. Eine Messung fehlt.\n4. Bei Befund 9 (zweites Anwenden löscht den Rückweg) habe ich die Idempotenz des zweiten Laufs aus dem Code hergeleitet (`prevCat !== newCat` als einzige Änderungsbedingung, transaction-service.ts:489), nicht ausgeführt. Wenn ein zweiter Lauf durch das inzwischen neu trainierte Modell doch andere Ergebnisse liefert, ist der Schnappschuss nicht leer, aber immer noch der falsche.\n5. Ob die drei Knöpfe, die `recategorize` auslösen, in der gerenderten Fläche wirklich gleichzeitig sichtbar sind, hängt von Feature-Gates und Bildschirmhöhe ab; ich habe nur die Verdrahtung gelesen (EnhancedSettings.tsx:137, :143, :220-221).\n6. Ich habe die E2E-Specs nicht gelesen. Die Bildprüfung erwähnt, dass zwei davon nach einem Umbau einen Schritt „Gruppe öffnen\" brauchen — welche das sind und ob sie die hier genannten Wege abdecken, weiss ich nicht.

---

## Die Sprache der Einstellungen und der Kategorien (/settings): i18n-Namensräume settings, categoryForm, categoryManager, categoryTree, learnedCategorization, autoCategorization in src/i18n/translations/de.ts und ihr Alltagssprache-Overlay src/i18n/overlays/everyday/de.ts, gegengelesen an den elf Abschnitten von EnhancedSettings.tsx und den vier Kategorie-Bausteinen.

### Datenfluss

Sprachlich läuft alles über EINEN Baum und ein Overlay: `src/i18n/translations/de.ts` (Basis, Fachsprache) wird von `src/i18n/overlays/everyday/de.ts` punktuell überschrieben; `useI18n().t(key)` löst über `lookupWorded`/`lookupTranslation` (I18nProvider) auf, der Nutzer schaltet in `WordingSettings.tsx:40-55` zwischen 'technical' und 'everyday'. Fehlt ein Schlüssel im Overlay, kommt still der Basistext — deshalb ist die Lücke im Namensraum `settings` unsichtbar und wird von keinem Wächter gemeldet.\n\nAuf der Fläche: `SettingsPage` → `EnhancedSettings.tsx` rendert elf `<section>`, jede mit `SectionHeader` (h2 = ein i18n-Titel, p = eine i18n-Beschreibung) und darunter eine Komponente, die ihren eigenen Kartenkopf mitbringt — daraus entstehen die vier Doppelungen (onboarding.manage.*, mcpTitle≡cloudMcpSync.title, languageSettingsTitle≡language, appearanceTitle/appearance.title).\n\nFachlich hängt das Kategorie-Vokabular an genau einem Zustand: `useSettingsOverview` (features/settings/application) hält `categories`, `preview`, `bulk`, `undoSnapshot` und stellt EINE Schreib-Aktion bereit — `recategorize()` → `recategorizeTransactions()` (transaction-service.ts:452, kein Parameter, ganzer Bestand, überspringt `confirmed`, liefert `changed` + `undo`). EnhancedSettings verteilt genau diese Funktion auf vier Knöpfe (Zeile 137, 143, 219, 220) mit vier Beschriftungen. Die Vorschau daneben kommt aus einem anderen Pfad — `getCategoryPreview(categoryId)` (transaction-service.ts:544) mit `categorize` statt `categorizeConfident` und ohne `confirmed`-Prüfung. Vorschautext und Wirkung stammen damit aus zwei verschiedenen Rechnungen, tragen aber dieselben Wörter („betroffen\", „würden verändert\").\n\nDer Rückweg existiert im Modell (`undoSnapshot` als React-State, `bulk.canUndo`), erreicht die Oberfläche aber nur als ein immer aktiver Knopf in CategoryPreview; `canUndo` liest niemand, und die Massenzuweisung zeigt gar keinen Undo.

### Befunde — hoch

**Sieben Namen für eine Sache: die Stichwortliste einer Kategorie** *(bedienbarkeit)*

Dieselbe Datenstruktur (`Category.filters`, ein Array von Wörtern) heisst in der Oberfläche: „Filter" (de.ts:3024 addFilterLabel, 3029 activeFiltersLabel, 1227 „{count} Filter aktiv"), „Stichwörter" (de.ts:3027), „Stichworte" (de.ts:1211), „Filter-Schlüsselwörter" (de.ts:1214), „Kategorie-Regeln" (de.ts:1233), „Regeln" (de.ts:1291 categoriesDescription, 3498 ruleFoundTitle, 3501 applySuggestionButton, 3509 rulesCount) und — abgegrenzt, aber verwechselbar — „Schlagwörter" (de.ts:3058 tagsDescription). Zusätzlich: „hierarchische Filter" (de.ts:1100).

*Warum es schadet:* Zwei dieser Namen stehen für DIESELBE Zahl gleichzeitig auf dem Bildschirm: CategoryTree.tsx:47 berechnet `filterCount = category.filters.length` und rendert ihn als „{count} Regeln" (CategoryTree.tsx:81), CategoryPreview.tsx:46 rendert `category.filters.length` als „{count} Filter aktiv". Beide Karten liegen im selben Abschnitt nebeneinander (EnhancedSettings.tsx:130-147, `xl:grid-cols-2`). Der Nutzer muss raten, ob „Regeln" und „Filter" dasselbe sind — genau die Frage, die intuitives Bearbeiten unmöglich macht. Ausserdem sucht das Suchfeld nach „Kategorien oder Filter" (de.ts:3496), während das Ergebnis „Regeln" zählt.

*Beleg:* `src/i18n/translations/de.ts:1100,1211,1214,1227,1233,1291,3024,3027,3029,3058,3496,3498,3501,3509 · src/components/settings/CategoryTree.tsx:47,81 · src/components/settings/CategoryPreview.tsx:46 · src/components/settings/EnhancedSettings.tsx:130-147`

**Vier Beschriftungen für EINEN Knopf: `recategorize()` heisst viermal anders** *(korrektheit)*

`useSettingsOverview.recategorize` (use-settings-overview.ts:222) ruft `recategorizeTransactions()` — eine Funktion ohne Parameter, die den GESAMTEN Buchungsbestand durchgeht (transaction-service.ts:452). Diese eine Funktion hängt an vier verschieden beschrifteten Knöpfen: „Anwenden" (de.ts:1229, CategoryPreview.tsx:66), „Regel anwenden" (de.ts:3501, CategoryManager.tsx:74), „Jetzt zuweisen" (de.ts:1218, BulkAssignment.tsx:52) und „Neu kategorisieren" (de.ts:1219, BulkAssignment.tsx:69). Die letzten zwei stehen direkt nebeneinander in einer Zeile und sind in EnhancedSettings.tsx:219-221 beide auf `settings.recategorize` verdrahtet.

*Warum es schadet:* Zwei benachbarte Knöpfe mit verschiedenen Wörtern und verschiedenen Icons (Play vs. RotateCcw) versprechen zwei verschiedene Dinge und tun dasselbe. Schlimmer sind „Anwenden" und „Regel anwenden": Beide stehen unter einer Anzeige, die EINE Kategorie benennt („{count} Filter aktiv", „{count} Transaktionen könnten zur Kategorie "{category}" passen"), lösen aber einen Lauf über alle Kategorien und alle Buchungen aus. Der Text sagt „diese Regel", die Wirkung ist global. Das ist genau das „Übernehmen", das der Auftraggeber verlangt — nur mit falscher Beschriftung.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:222 · src/services/transaction-service.ts:452 (Signatur ohne Parameter) · src/components/settings/EnhancedSettings.tsx:137,143,219,220 · src/components/settings/BulkAssignment.tsx:52,69 · src/components/settings/CategoryManager.tsx:74 · src/i18n/translations/de.ts:1218,1219,1229,3501`

**„Bereits kategorisierte Transaktionen werden überschrieben" — der Code tut das Gegenteil** *(korrektheit)*

`settings.bulkAssignment.step4` (de.ts:1216) steht als Aufzählungspunkt unter „Wie funktioniert die Massenzuweisung?" (BulkAssignment.tsx:46). Der Lauf überspringt aber jede Buchung mit `tx.confirmed` ausdrücklich — transaction-service.ts:474-481 mit Kommentar „Vom Nutzer bestätigte Kategorien sind manuelle Arbeit und werden vom Bulk-Lauf NIE überschrieben". Identisch falsch im Englischen (en.ts:1215 „Already categorized transactions are overwritten").

*Warum es schadet:* Der einzige Satz, der die Angst vor dem Knopf nehmen müsste, erzeugt sie. Wer von Hand kategorisiert hat, liest hier „meine Arbeit wird überschrieben" und drückt nie. Wer drückt, erwartet ein Überschreiben und bekommt es nicht — und sucht danach den Fehler an der falschen Stelle. Der Satz, der stattdessen fehlt („Was du selbst zugeordnet hast, bleibt unangetastet"), ist genau die Zusage, die „übernehmen" erst intuitiv macht.

*Beleg:* `src/i18n/translations/de.ts:1216 · src/i18n/translations/en.ts:1215 · src/services/transaction-service.ts:474-481 · src/components/settings/BulkAssignment.tsx:46`

**„Betroffene Transaktionen" zeigt Buchungen, die „Anwenden" nicht anfasst** *(korrektheit)*

Die Vorschau `getCategoryPreview` (transaction-service.ts:544-559) filtert mit `categorizer.categorize(t)` — das liefert JEDE Zuordnung, unabhängig von der Confidence (categorization.ts:300) — und prüft `tx.confirmed` gar nicht. Der Anwenden-Lauf nimmt dagegen `categorizeConfident` (Schwelle `MIN_SILENT_ASSIGN_CONFIDENCE`, categorization.ts:302-305) und überspringt `confirmed`. Beschriftet wird die Liste als „Betroffene Transaktionen" (de.ts:1232) und ihr Leerzustand als „Keine Transaktionen würden durch diese Kategorie-Regeln verändert." (de.ts:1233).

*Warum es schadet:* Der Auftraggeber verlangt: „der Nutzer muss vorher sehen, was passiert". Die Wörter „betroffen" und „würden verändert" sind eine Zusage auf genau das — die Liste löst sie nicht ein und ist im Zweifel zu lang. Die Vorschau ist damit keine Vorschau, sondern eine zweite, laxere Kategorisierung mit dem Etikett der ersten. AGENTS.md §3 („Ein unprüfbares Versprechen wird zum Etikett") beschreibt exakt diesen Fall.

*Beleg:* `src/services/transaction-service.ts:544-559 vs. 452-501 · src/lib/categorization.ts:300-305 · src/i18n/translations/de.ts:1232,1233 · src/components/settings/CategoryPreview.tsx:80,113`

**„Sprache" steht zweimal untereinander, und die Beschreibung nennt eine Sprache, die es nicht gibt** *(korrektheit)*

EnhancedSettings.tsx:174 rendert `settings.languageSettingsTitle` = „Sprache" (de.ts:1294) als `<h2>`; unmittelbar darunter rendert LanguageSettings.tsx:27 `settings.language` = „Sprache" (de.ts:1194) als InfoGroup-Titel (InfoGroup.tsx:36 gibt ihn aus). Zwei Schlüssel, identische Zeichenkette, direkt untereinander. Die beiden Beschreibungen widersprechen sich ausserdem: „Wähle die Sprache der App (Deutsch/Englisch/Klingonisch)." (de.ts:1295) gegen „Sprache der App. Betrifft zunächst ausgewählte Bereiche." (de.ts:1195). Wählbar sind laut locale.ts:20 `de/en/ru` — Klingonisch ist NICHT wählbar, Russisch (de.ts:1198 languageRussian) ist wählbar und wird nicht genannt.

*Warum es schadet:* Der Kommentar in LanguageSettings.tsx:21-25 sagt ausdrücklich, das Karten-Chrome sei entfernt worden, weil „im Sprach-Abschnitt stand "Sprache" dadurch zweimal" — der Titel blieb stehen, die Doppelung ist unrepariert. Und die eine Beschreibung, die ein Versprechen macht, zählt eine nicht existierende Sprache auf und verschweigt eine existierende: Wer Russisch sucht, liest, es gebe es nicht.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:174-175 · src/components/settings/LanguageSettings.tsx:21-27 · src/features/shared/presentation/InfoGroup.tsx:36 · src/i18n/translations/de.ts:1194,1195,1294,1295 · src/i18n/locale.ts:20`

**Die Alltagssprache endet an der Kategorie-Fläche — mitten im selben Raster** *(bedienbarkeit)*

`src/i18n/overlays/everyday/de.ts` überschreibt aus dem gesamten Einstellungs- und Kategoriegebiet genau EINEN Schlüssel: `categoryForm.propertyFixedCosts` (Zeile 327-329). Kein `settings`, kein `categoryManager`, kein `categoryTree`, kein `autoCategorization`. `learnedCategorization` ist dagegen vollständig übersetzt (Zeilen 41-48: „Wie gut ordnet Fintracker zu?", „Buchungen" statt „Zuordnungen"). `src/i18n/overlays/everyday/en.ts` hat dieselbe Lücke.

*Warum es schadet:* Beide Karten liegen im selben Raster (EnhancedSettings.tsx:206-237): Mit „Alltagssprache" liest man in `LearnedCategorizationSettings` „Wie gut ordnet Fintracker zu? … Grundlage: 412 Buchungen, die du selbst bestätigt hast" und eine Kachel weiter unverändert „Massenzuweisung der Kategorien — Weise vordefinierte Kategorien basierend auf Stichworten automatisch allen Transaktionen zu" und „Transaktionen werden automatisch anhand hierarchischer Filter kategorisiert". Der Schalter darüber (`settings.wording.description`, de.ts:1202) verspricht „Wie die App Fachbegriffe schreibt. Jederzeit umschaltbar" — für die Fläche, auf der er steht, löst er nichts ein.

*Beleg:* `src/i18n/overlays/everyday/de.ts:41-48 (vorhanden) und 327-329 (einziger categoryForm-Eintrag) · src/i18n/translations/de.ts:1100,1210,1211,1202 · src/components/settings/EnhancedSettings.tsx:206-237 · src/components/settings/WordingSettings.tsx:33-38`

**„Letzte Aktion rückgängig" — ein Knopf, der meistens absagt, und im Massenlauf gar nicht existiert** *(bedienbarkeit)*

`settings.categoryPreview.undoButton` = „Letzte Aktion rückgängig" (de.ts:1234) steht dauerhaft und ohne `disabled` in CategoryPreview.tsx:120-127. Der Zustand, der sagt, ob es etwas zurückzunehmen gibt, EXISTIERT (`bulk.canUndo`, settings-overview.ts:79, gesetzt in use-settings-overview.ts:214) — er wird von keiner Komponente gelesen. Gedrückt ohne Schnappschuss antwortet die Fläche mit einem Fehler-Toast „Nichts zum Rückgängigmachen" (de.ts:1288). Umgekehrt hat BulkAssignment.tsx (Knöpfe in Zeile 51-76) gar keinen Undo-Knopf, obwohl dieselbe Mutation dort denselben Schnappschuss anlegt.

*Warum es schadet:* Der Auftraggeber verlangt: „danach zurücknehmen können". Wer den Massenlauf über „Jetzt zuweisen" im Abschnitt Automatisierung startet, sieht keinen Rückweg — der einzige Undo-Knopf steht im Abschnitt Kategorien, rund 14 Bildschirmlängen weiter oben, und heisst „Letzte Aktion", ohne zu sagen, welche. Zusätzlich fehlt jeder Text zur Haltbarkeit: `undoSnapshot` ist React-State (use-settings-overview.ts:51) und ist nach einem Seitenwechsel weg — kein Satz sagt das.

*Beleg:* `src/i18n/translations/de.ts:1234,1288 · src/components/settings/CategoryPreview.tsx:120-127 · src/components/settings/BulkAssignment.tsx:50-77 · src/features/settings/application/use-settings-overview.ts:51,214,224-230 · src/features/settings/domain/settings-overview.ts:79`

**„Übernehmen" ist das Hauswort der App — nur die Kategorien kennen es nicht** *(bedienbarkeit)*

Für „einen Vorschlag auf den Bestand anwenden" sagt die App an sechs Stellen „Übernehmen": de.ts:1976 (acceptSuggestion), 2882 (atmAccept), 3303/3305 (applySuggestion, „Alle sicheren übernehmen ({count})"), 3358 (suggestionAccept), 3796 („{amount}/Mo. übernehmen"), 5007 (chipUebernehmen), 1661 („Als Schuld übernehmen"). Im Kategorie-Gebiet kommt das Wort kein einziges Mal vor — dort heisst es „Anwenden", „Regel anwenden", „Jetzt zuweisen", „Neu kategorisieren".

*Warum es schadet:* Der Auftraggeber benennt die Funktion selbst als „übernehmen". Die App hat dieses Wort bereits, mit einer eingespielten Bedeutung (Vorschlag ansehen → übernehmen → rückgängig). Genau die Fläche, an der es am meisten trägt, benutzt es nicht — und muss dem Nutzer stattdessen vier neue Verben beibringen. Der Zeitpunkt für die Umbenennung ist jetzt: kein Test greift auf diese Zeichenketten zu (geprüft: Treffer für „Massenzuweisung", „Jetzt zuweisen", „Regel anwenden" liegen ausschliesslich in Kommentaren, CategoryManager.suggestion.test.tsx:2, settings-overview.test.ts:82, category-types.ts:87).

*Beleg:* `src/i18n/translations/de.ts:1661,1976,2882,3303,3305,3358,3796,5007 gegen 1218,1219,1229,3501 · Test-Gegenprobe: src/components/settings/__tests__/CategoryManager.suggestion.test.tsx:2, src/features/settings/domain/__tests__/settings-overview.test.ts:82`

### Befunde — mittel

**Bestätigter Befund: derselbe Fliesstext einmal als h3, einmal als p** *(darstellung)*

PrivacySyncAnalyticsSettings.tsx:255-261 rendert `privacy.privacySync.syncPathInfo` zweimal hintereinander im selben `<div>`: einmal als `<h3 className="font-semibold">` mit Icon, direkt darunter als `<p className="text-sm leading-6">`. Der Text ist 341 Zeichen lang und besteht aus drei vollständigen Sätzen (de.ts:2277: „Im Moment wird die Sync-Datei beim Export als Download-Datei … zum Beispiel iCloud Drive, Dropbox oder einen lokalen Ordner.").

*Warum es schadet:* Ein dreisätziger Fliesstext als Überschrift ist keine Überschrift; verdoppelt kostet er auf 360 px rund 200 px reine Höhe (zwei Blöcke à ~5 Zeilen). Der Abschnitt hat damit keinen Titel — nur denselben Absatz zweimal fett und einmal grau. Vermutlich sollte hier `privacy.privacySync.syncPathTitle` stehen; ein solcher Schlüssel existiert nicht.

*Beleg:* `src/components/settings/PrivacySyncAnalyticsSettings.tsx:255-261 · src/i18n/translations/de.ts:2277`

**Bestätigter Befund: „Bereiche & Navigation" — Titel und Beschreibung stehen zweimal** *(darstellung)*

EnhancedSettings.tsx:162-166 rendert `onboarding.manage.title` und `onboarding.manage.description` im SectionHeader (h2 + p). Die dort eingesetzte Komponente rendert dieselben zwei Schlüssel sofort noch einmal: NavFeatureSettings.tsx:50-52 als `CardTitle`, :53-58 als `CardDescription`.

*Warum es schadet:* Vier Textzeilen, zwei Aussagen. Zusätzlich verletzt die Karte AGENTS.md §9 / Regel 10: Der Kartenrahmen um NavFeatureSettings umschliesst eine Liste von Schaltern und ist als Ganzes tot. Wer die Karte entfernt, löst beide Befunde in einem Schnitt — der SectionHeader trägt die Gliederung bereits.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:162-166 · src/components/settings/NavFeatureSettings.tsx:48-59`

**Zwei weitere wortgleiche Doppel, die die Bildprüfung nicht gezählt hat** *(darstellung)*

(a) `settings.mcpTitle` (de.ts:1319) und `settings.cloudMcpSync.title` (de.ts:1344) sind zeichengleich („Sprach-/KI-Zugriff (MCP) · Proof of Concept"). Beide werden nacheinander gerendert: EnhancedSettings.tsx:276 als SectionHeader-h2, CloudMcpSyncCard.tsx:125 als Kartentitel. Die beiden Beschreibungen (de.ts:1320 und 1345) sagen inhaltlich dasselbe in anderen Worten. (b) `settings.appearanceTitle` „Erscheinungsbild" + Beschreibung „Wähle Theme und Darstellung …" (de.ts:1292-1293, EnhancedSettings.tsx:153-154) steht direkt über `settings.appearance.title` „Theme" + „Wähle den Look der gesamten Oberfläche." (de.ts:1238-1239, AppearanceSettings.tsx:51-52).

*Warum es schadet:* Die Bildprüfung nennt „Zwei Textbausteine stehen wortgleich doppelt"; tatsächlich sind es mit Befund 6, 7 und diesem vier Doppel — die Zahl im Prüfbericht ist zu niedrig, und wer nur zwei repariert, lässt die Hälfte stehen. Bei (b) kommt hinzu: „Erscheinungsbild", „Theme", „Look" und „Darstellung" sind vier Wörter für eine Sache, alle vier innerhalb von sechs Zeilen sichtbar.

*Beleg:* `src/i18n/translations/de.ts:1238,1239,1292,1293,1319,1320,1344,1345 · src/components/settings/EnhancedSettings.tsx:153-154,276-277 · src/components/settings/CloudMcpSyncCard.tsx:125,128 · src/components/settings/AppearanceSettings.tsx:51-52`

**„Payee" — ein englisches Datenbankfeld steht im deutschen Erklärtext** *(bedienbarkeit)*

`settings.bulkAssignment.step3` (de.ts:1215): „Transaktionen werden basierend auf Payee und Beschreibung kategorisiert". Überall sonst heisst dasselbe Feld „Empfänger" (de.ts dashboard.payee, csv.payeeColumn) und das zweite „Verwendungszweck" (csv.descriptionColumn) — die richtige Formulierung steht sogar schon im Repo: `categoryForm.filterDescription` (de.ts:3027) sagt „im Empfänger und Verwendungszweck gesucht".

*Warum es schadet:* Der Aufzählungspunkt soll erklären, WORAUF die Stichwörter passen — die Antwort ist der einzige Satz, den ein Nutzer für ein gutes Stichwort braucht. In dem Satz steht ein Wort aus dem Datenmodell, das in der Oberfläche nirgends auftaucht, plus „Beschreibung" statt „Verwendungszweck". Zwei Sätze, die dasselbe erklären, benennen dieselben zwei Felder verschieden.

*Beleg:* `src/i18n/translations/de.ts:1215 vs. 3027 · src/components/settings/BulkAssignment.tsx:45`

**„Transaktion" gegen „Buchung": die Fläche spricht gegen die Hausordnung** *(bedienbarkeit)*

Im gesamten `de.ts` steht „Buchung" 161-mal, „Transaktion" 81-mal; das Alltags-Overlay schreibt konsequent „Buchungen" (everyday/de.ts:43,45,46,47). Im Namensraum `settings` (de.ts:1178-1400) kehrt sich das Verhältnis um: 9-mal „Transaktion" (1211,1213,1215,1216,1232,1233,1280), 2-mal „Buchung" (1284 undoRestored, 1180-Block).

*Warum es schadet:* Dieselbe Aktion meldet ihren Erfolg als „Transaktionen neu kategorisiert" (de.ts:1280) und ihr Zurücknehmen als „{count} Buchungen zurückgesetzt" (de.ts:1284) — zwei Toasts hintereinander, zwei Wörter für dieselben Zeilen. Der Nutzer kann nicht wissen, ob dieselbe Menge gemeint ist.

*Beleg:* `src/i18n/translations/de.ts:1211,1213,1215,1216,1232,1233,1280,1284 · src/i18n/overlays/everyday/de.ts:43-47`

**Der Erfolgstoast nennt keine Zahl, obwohl die Zahl vorliegt** *(korrektheit)*

`recategorizeTransactions` liefert `changed` zurück (transaction-service.ts:456,501). Der ViewModel-Erfolgspfad (use-settings-overview.ts:138-149) liest `total`, `assigned`, `unassigned` — `changed` wird verworfen. Gemeldet wird `settings.recategorizationSuccess` = „Transaktionen neu kategorisiert" (de.ts:1280), ohne Zahl. Das Zurücknehmen meldet dagegen „{count} Buchungen zurückgesetzt" (de.ts:1284).

*Warum es schadet:* Die einzige Rückmeldung nach einer Schreiboperation über den gesamten Bestand sagt nicht, wie viel geschrieben wurde. Der Nutzer weiss danach nicht, ob 0 oder 4000 Zeilen anders sind — und damit auch nicht, ob er rückgängig machen will. Die Undo-Meldung nennt ihre Zahl; die Hin-Meldung nicht. AGENTS.md §3: eine Zahl ohne Rückweg gibt es nicht, hier fehlt sogar die Zahl.

*Beleg:* `src/services/transaction-service.ts:456,501 · src/features/settings/application/use-settings-overview.ts:138-149 · src/i18n/translations/de.ts:1280,1284`

**Bearbeiten findet im Register „Erstellen" statt, und der Knopf heisst weder Speichern noch wie der Toast** *(bedienbarkeit)*

CategoryManager.tsx:52 setzt beim Klick auf „Bearbeiten" `setActiveTab('create')` — das Register trägt die Beschriftung `categoryManager.createTab` = „Erstellen" (de.ts:3495). Im Formular wechselt der Knopf dann zwischen `categoryForm.updateButton` = „Aktualisieren" (de.ts:3060) und `createButton` = „Erstellen" (de.ts:3061), CategoryForm.tsx:452. Der Erfolgs-Toast heisst in beiden Fällen `settings.categorySaved` = „Kategorie gespeichert" (de.ts:1276).

*Warum es schadet:* Drei Wörter für eine Handlung: der Nutzer drückt „Aktualisieren" im Register „Erstellen" und liest danach „gespeichert". Wer eine Kategorie ändern will, sucht ein Register „Bearbeiten" und findet nur „Verwalten" und „Erstellen" — die Fläche versteckt ihre wichtigste Funktion hinter dem falschen Wort. „Aktualisieren" ist im Web ausserdem mit „neu laden" besetzt.

*Beleg:* `src/components/settings/CategoryManager.tsx:52,61-62 · src/components/settings/CategoryForm.tsx:452 · src/i18n/translations/de.ts:1276,3060,3061,3494,3495`

**Sechs Namen für die Sicherungsdatei — und ein Satz, der dem Abschnitt darunter widerspricht** *(korrektheit)*

Innerhalb von zwei Abschnitten heisst dieselbe Datei: „Sync-Datei" (de.ts:1314 securityTitle, 2251 labelField, 2257 privacySync.title), „Sicherungskopie" (de.ts:1315), „Backups" (de.ts:1317 backupsTitle), „Sicherungen" (de.ts:1318), „Snapshot" (de.ts cloudMcpSync.successDisabledMessage, SnapshotVersionConflictDialog) und „verschlüsselter lokaler Datenstand" (de.ts:2258). Dazu behauptet `privacy.privacySync.manageDescription` (de.ts:2279): „Diese Datei ersetzt das klassische Backup." — gerendert in PrivacySyncAnalyticsSettings.tsx:271, also in dem Abschnitt, unter dem EnhancedSettings.tsx:264-271 einen eigenen Abschnitt „Backups" mit dem BackupManager öffnet.

*Warum es schadet:* Die Fläche sagt, das klassische Backup sei ersetzt, und bietet zwei Bildschirmlängen tiefer ein klassisches Backup an. Der Nutzer, der seine Daten sichern will — die einzige Aufgabe, bei der ein Irrtum unwiederbringlich ist — muss zwischen sechs Wörtern und zwei widersprechenden Angeboten wählen.

*Beleg:* `src/i18n/translations/de.ts:1314,1315,1317,1318,2251,2257,2258,2279 · src/components/settings/PrivacySyncAnalyticsSettings.tsx:271 · src/components/settings/EnhancedSettings.tsx:240-271`

**Fünf Schlüssel für eine fokussierte Einstellungsfläche liegen tot im Baum — und sie sind besser formuliert als die lebende** *(architektur)*

`settings.fokussiert` (de.ts:1179-1185) enthält `dataStateLabel` „Deine Daten auf diesem Gerät", `securityAction` „Verschlüsselung einrichten und verwalten", `categoryCount` „{count} Kategorien", `retentionMonths` „Aufbewahrung {months} Monate" und `groupDisplay` „Aussehen & Sprache". Kein Quelltext liest einen dieser Schlüssel (gegen alle .ts/.tsx ausserhalb von i18n geprüft). Andere Flächen haben ihren `fokussiert`-Block dagegen verdrahtet (z. B. `dashboard.fokussiert`, `csv.fokussiert`).

*Warum es schadet:* Das ist der Beleg, dass /settings als einzige der zwölf entworfenen Flächen ihre fokussierte Fassung nie bekommen hat — und zugleich ein fertiger Sprachvorrat für den Umbau: „Aussehen & Sprache" fasst in drei Wörtern zusammen, was die lebende Fläche als zwei Fachsprachen-Abschnitte („Erscheinungsbild", „Sprache") mit vier Überschriften und vier Absätzen darstellt. Auch „Aufbewahrung {months} Monate" steht neben drei anderen Namen für dasselbe („Aufbewahrungsdauer" de.ts:1267, „Aufbewahrung" de.ts:1272, „wie lange Daten sichtbar bleiben" de.ts:1299).

*Beleg:* `src/i18n/translations/de.ts:1179-1185 (unbenutzt), 1267,1272,1292,1294,1299 · src/components/settings/EnhancedSettings.tsx:111-118 (nutzt stattdessen `common.categoriesLabel` und `settings.retentionMonthsShort`)`

**Statistik-Fachsprache und Behördendeutsch im selben Raster wie sorgfältige Alltagssprache** *(bedienbarkeit)*

Im Abschnitt Automatisierung (EnhancedSettings.tsx:206-237) stehen nebeneinander: „Güte der automatischen Kategorisierung … Präzision mit gelerntem Modell: {correct} von 100 Zuordnungen korrekt … bei einer Abdeckung von {coverage} … fünffach kreuzvalidiert" (de.ts:1089-1095), „Massenzuweisung der Kategorien" (de.ts:1210), „Transaktionen werden automatisch anhand hierarchischer Filter kategorisiert" (de.ts:1100), „Nice-to-have" (de.ts:3042), „Icon" (de.ts:3023), „Giro" (de.ts:3036) — und die Datenschutztexte derselben Seite, die durchweg persönlich und einfach schreiben: „ohne dass etwas über dein Geld das Gerät verlässt" (de.ts telemetry.description), „sie verlassen dein Gerät nie automatisch" (de.ts diagnostics.description).

*Warum es schadet:* Es ist nicht eine Sprache mit Fachbegriffen, sondern zwei Register ohne Grenze. „Güte", „Präzision", „Abdeckung", „kreuzvalidiert", „Massenzuweisung", „hierarchisch" sind sämtlich Wörter aus dem Maschinenraum, und für sie existiert nachweislich schon eine bessere Fassung — everyday/de.ts:41-48 übersetzt genau diese Karte („Wie gut ordnet Fintracker zu?", „Von 100 automatisch zugeordneten Buchungen waren im Test {correct} richtig."). Der Nachbar bleibt Fachsprache, weil ihm der Overlay-Eintrag fehlt (siehe Befund 9). Wer das nachträgt, hat den Registerbruch geschlossen, ohne den Basisbaum anzufassen.

*Beleg:* `src/i18n/translations/de.ts:1089-1095,1100,1210,3023,3036,3042 · src/i18n/overlays/everyday/de.ts:41-48 · src/components/settings/EnhancedSettings.tsx:206-237`

### Unsicher

1. Die Zeilennummern beziehen sich auf den Arbeitsstand von Branch mobile-ui am 2026-09-04, ungestaged geprüft. Ich habe die Fläche NICHT gerendert — alle Aussagen über „steht untereinander\" sind aus der JSX-Reihenfolge gelesen, nicht gemessen. Die Höhenschätzung im Befund zum doppelten h3/p (~200 px) ist gerechnet, nicht gemessen.\n2. Ob `MIN_SILENT_ASSIGN_CONFIDENCE` in der Praxis viele oder wenige Zeilen zwischen Vorschau und Wirkung auseinanderfallen lässt, habe ich nicht quantifiziert — ich belege nur, dass es zwei verschiedene Funktionen sind (categorization.ts:300 vs. 302-305).\n3. Ich habe die russische Übersetzung (ru.ts) und die klingonische (tlh.ts) nicht auf dieselben Doppelungen geprüft; die Vorschläge unten müssten dort mitgezogen werden.\n4. Ob `settings.fokussiert` bewusst als Vorrat für einen kommenden Umbau liegen gelassen wurde oder ein Rückstand ist, lässt der Quelltext offen — ich habe keinen Kommentar und keinen Eintrag im Änderungsprotokoll dazu gefunden. Ich lese es als Vorrat und empfehle, ihn zu benutzen.\n5. Die vorgeschlagenen neuen Schlüssel setzen voraus, dass die Anwenden-Aktion einen Umfang bekommt (eine Kategorie vs. alle) — das ist eine Funktionsentscheidung, nicht nur eine Textentscheidung. Ohne sie bleiben `categoryApply.scope*` ohne Gegenstück im Code.\n6. Zur Prüfung, ob Umbenennungen Tests brechen, habe ich nur nach den sichtbaren deutschen Zeichenketten gesucht (Massenzuweisung, Jetzt zuweisen, Neu kategorisieren, Kategorieverwaltung, Regel anwenden, Vorschau & Zuweisung). E2E-Specs, die über Rollen/Testids statt über Text greifen, sind davon unberührt; ob eine von ihnen an der Reihenfolge der Abschnitte hängt, habe ich nicht geprüft.\n\nZUSATZ — welche NEUEN Texte eine intuitive Kategorie-Bedienung braucht (je Schlüssel de/en):\n\nA) Stichwörter — EIN Name statt sieben (ersetzt filterDescription, addFilterLabel, activeFiltersLabel, filtersActive, rulesCount, ruleFoundTitle-Wortwahl):\n· categoryRules.label — de „Stichwörter\" / en „Keywords\"\n· categoryRules.help — de „Steht eines dieser Wörter im Empfänger oder im Verwendungszweck, landet die Buchung in dieser Kategorie.\" / en „If one of these words appears in the payee or the reference, the booking goes into this category.\"\n· categoryRules.count — de „{count} Stichwörter\" / en „{count} keywords\"\n· categoryRules.addPlaceholder — de „Wort hinzufügen, z. B. rewe\" / en „Add a word, e.g. rewe\"\n· categoryRules.empty — de „Noch keine Stichwörter — diese Kategorie vergibst du bisher nur von Hand.\" / en „No keywords yet — for now you assign this category by hand.\"\n\nB) Übernehmen — das Hauswort der App, mit Vorschau und Rückweg (ersetzt applyButton, applySuggestionButton, assignButton, recategorizeButton):\n· categoryApply.title — de „Auf deine Buchungen übernehmen\" / en „Apply to your bookings\"\n· categoryApply.scopeThis — de „Nur diese Kategorie\" / en „This category only\"\n· categoryApply.scopeAll — de „Alle Kategorien neu durchgehen\" / en „Re-check every category\"\n· categoryApply.previewChanging — de „{count} Buchungen ändern sich\" / en „{count} bookings will change\"\n· categoryApply.previewNone — de „Nichts ändert sich — keine Buchung passt auf diese Stichwörter.\" / en „Nothing changes — no booking matches these keywords.\"\n· categoryApply.previewProtected — de „{count} hast du selbst zugeordnet. Die bleiben, wie sie sind.\" / en „{count} you assigned yourself. Those stay as they are.\"  ← löst den falschen step4 ab\n· categoryApply.previewUncertain — de „{count} passen nur ungefähr und werden nicht angefasst.\" / en „{count} are only a loose match and stay untouched.\"  ← macht die Confidence-Schwelle sichtbar\n· categoryApply.confirmButton — de „{count} Buchungen übernehmen\" / en „Apply to {count} bookings\"\n· categoryApply.running — de „Wird übernommen …\" / en „Applying …\"\n· categoryApply.doneToast — de „{changed} von {total} Buchungen geändert\" / en „{changed} of {total} bookings changed\"  ← nutzt das heute verworfene `changed`\n· categoryApply.undoButton — de „Rückgängig\" / en „Undo\"\n· categoryApply.undoWindow — de „Rückgängig möglich, solange du diese Seite offen hast.\" / en „You can undo this as long as you stay on this page.\"  ← ehrlich, weil der Schnappschuss React-State ist\n· categoryApply.undoneToast — de „{count} Buchungen zurückgesetzt\" / en „{count} bookings restored\" (Umzug von settings.undoRestored)\n\nC) Vorschlag mit Begründung (der Beleg-Pflicht aus AGENTS.md §3 folgend; `CategorizationResult.reasons[]` liegt bereits vor):\n· categorySuggestion.found — de „{count} Buchungen sehen nach „{category}\" aus\" / en „{count} bookings look like “{category}”\"\n· categorySuggestion.why — de „Woran erkannt?\" / en „Why?\"\n· categorySuggestion.reason — de „Gleicher Empfänger wie {count} Buchungen, die du selbst „{category}\" zugeordnet hast.\" / en „Same payee as {count} bookings you assigned to “{category}” yourself.\"\n· categorySuggestion.accept — de „Übernehmen\" / en „Apply\"\n· categorySuggestion.reject — de „Passt nicht\" / en „Doesn’t fit\"\n\nD) Anlegen und Ändern (ersetzt createTab/updateButton/createButton-Dreiklang):\n· categoryForm.tabEdit — de „Bearbeiten\" / en „Edit\"\n· categoryForm.tabNew — de „Neu\" / en „New\"\n· categoryForm.saveButton — de „Speichern\" / en „Save\"  ← deckt sich endlich mit dem Toast „Kategorie gespeichert\"\n· categoryForm.pendingApplyHint — de „Gespeichert. Auf den Bestand wirkt die Änderung erst, wenn du sie übernimmst.\" / en „Saved. It only affects existing bookings once you apply it.\"\n\nE) Reparaturen an bestehenden Schlüsseln, ohne die keine Umbenennung hilft:\n· settings.bulkAssignment.step3 — de „Gesucht wird im Empfänger und im Verwendungszweck\" / en „Searched in the payee and the reference\" (statt „Payee\")\n· settings.bulkAssignment.step4 — de „Was du selbst zugeordnet hast, bleibt unangetastet\" / en „Anything you assigned yourself stays untouched\" (heute die Gegenaussage)\n· settings.languageSettingsDescription — de „Wähle die Sprache der App.\" / en „Choose the app’s language.\" (Sprachliste raus: sie war falsch und muss bei jeder neuen Sprache nachgezogen werden; die Auswahl steht direkt darunter)\n· settings.language / settings.languageSettingsTitle — einen der beiden streichen, nicht beide behalten\n· settings.mcpTitle bzw. settings.cloudMcpSync.title — einen streichen\n· privacy.privacySync.syncPathTitle — NEU, de „Wo die Datei landet\" / en „Where the file ends up\" (damit das h3 aufhört, den Absatz zu wiederholen)\n· neue Overlay-Einträge in everyday/de.ts und everyday/en.ts für settings.bulkAssignment.*, autoCategorization.*, categoryManager.*, categoryTree.*, categoryApply.*, categoryRules.* — sonst bleibt der Sprachstil-Schalter auf seiner eigenen Fläche wirkungslos.

---

## Daten und Rechnung hinter Kategorien (/settings): Datenmodell, Hierarchie, Speicherung/Serialisierung, IDs, Kategorisierungs-Kaskade und die Folgen von Löschen/Umbenennen/Verschieben für Buchungen

### Datenfluss

AUFBAU. Eine `Category` (src/lib/category-types.ts:50-77) ist flach: `id`, `name`, optionaler `name_key`, `color`, `icon`, `filters[]` (deutsche Such-Stichwörter, nie übersetzt), `is_default`, `parent_id`, ein ungenutztes `level` und ein Beutel `attributes` mit 28 optionalen Feldern (Vertrag, Rhythmus, Ausgabenklasse, Budget, Steuer-Rubrik, Sichtbarkeit, Sortierung …). Kein `created_at`/`updated_at`, kein Löschmarker.

HIERARCHIE. Reine Elternzeiger über `parent_id`; die Defaults sind zwei Ebenen tief (`local-cat-<slug>` Haupt → `local-cat-<slug>` Unter, src/data/merchant-keywords.ts:918-951), die Oberfläche erlaubt aber eine dritte (CategoryTree.tsx:87-98). Es gibt KEINE Materialisierung und keinen Zyklusschutz. `HierarchicalCategory` ist rein abgeleitet: `getHierarchicalCategories` (transaction-service.ts:395-418) kopiert die flache Liste in eine Map, hängt `children` an und setzt zusätzlich einen Rückzeiger `parent` — der Baum ist damit zyklisch verlinkt und weder serialisierbar noch als Query-Ergebnis vergleichbar. Er wird nie persistiert; alles unter `src/lib` liest die Kette stattdessen selbst hoch (`resolveHierarchy`, `resolveAusgabenklasse`, `resolveEssenziell`, `isCategoryInFilter` — jeweils mit `visited`-Set).

SPEICHERUNG. Alles liegt lokal unter EINEM IndexedDB-Schlüssel `LOCAL_CATEGORIES_KEY`, optional AES-GCM-verschlüsselt (local-settings-service.ts:63-148). Beim ersten Lesen wird der Default-Satz geseedet; bei jedem weiteren laufen acht reine Migrationen (category-migrations.ts) und schreiben nur bei echter Änderung zurück. `getLocalCategories()` gibt eine LOKALISIERTE Fassung heraus (name_key → t()), alle Schreibpfade arbeiten auf der rohen. Der Schreibpfad IST serialisiert: `mutiereKategorien` (:159-166) legt Lesen, Ändern und Schreiben in `withKeyLock(LOCAL_CATEGORIES_KEY)`, die Dubletten-Prüfung liegt korrekt INNERHALB des Locks (:264), und `readLocalCategoriesRaw`/`writeLocalCategories` nehmen den Lock bewusst nicht selbst (nicht reentrant). `pnpm check:store-serialization` läuft grün — nachgeprüft. Die Lücke liegt eine Ebene weiter: `deleteCategory` liest und ersetzt die BUDGETS ungesperrt über zwei Servicegrenzen hinweg (Befund 15).

IDs. Stabil und sprechend sind nur die Defaults: `local-cat-<slug>`, erzeugt aus der Taxonomie, von den Migrationen namentlich gepflegt und vom Regex-Fallback direkt nachgeschlagen. Selbst angelegte Kategorien bekommen `crypto.randomUUID()` ohne Präfix (:168-173). Buchungen halten zwei Zeiger — `category_id` (Haupt) und `subcategory_id` (Blatt); jede Auswertung liest `subcategory_id ?? category_id`. Aufteilungen (`transactionAllocations`) halten dasselbe Paar noch einmal und übersteuern die Buchung, sobald sie existieren.

RECHNUNG. Die Kaskade (categorization.ts) läuft in fünf Stufen: Händlerregel (0,95) → gelerntes Modell mit erfüllten Gates (0,80) → Filter-Spezifität (0,85/0,70) → Modell ohne Gates (0,60) → Regex-Fallback (0,55). `createCategorizer` baut Index, Einkommensmenge und vorbereitete Stichwörter EINMAL vor der Schleife. Ab 0,70 (`MIN_SILENT_ASSIGN_CONFIDENCE`) darf still geschrieben werden.

WAS BEI ÄNDERUNGEN PASSIERT. Löschen (category-service.ts:28-79) entfernt Kategorie plus direkte Kinder, löscht Budgets auf gelöschte Hauptkategorien, streicht gelöschte IDs aus `subcategory_ids` und löscht Händlerregeln — und lässt Buchungen ausdrücklich mit verwaister `category_id` zurück. Enkel, Aufteilungen und `subcategory_id` fallen dabei durch. Umbenennen einer Standard-Kategorie legt eine Kopie mit neuer ID an, ohne die Vorlage zu entfernen. Verschieben ist im Datenpfad möglich und in der Oberfläche unerreichbar. ÜBERNEHMEN gibt es nur in EINER Form: `recategorizeTransactions()` über den ganzen Bestand und alle Kategorien, mit Vorwerte-Schnappschuss für ein Undo — und die Vorschau davor (`getCategoryPreview`, `getTopCategorySuggestion`) rechnet mit einer anderen Regel als der Lauf selbst. Aufgeräumt wird nichts: die einzige Umhänge-Funktion (`remapCategoryInLocalTransactions`) hat produktiv keinen Aufrufer, und keine Fläche zählt, wie viele Buchungen auf eine gelöschte Kategorie zeigen.

### Befunde — hoch

**Eine Standard-Kategorie lässt sich nicht bearbeiten, solange ihr Name bleibt** *(korrektheit)*

`updateInKategorien` leitet jede Bearbeitung einer Kategorie mit `is_default: true` an `saveInKategorien` um (Kopie statt Änderung). Dort steht die Dubletten-Prüfung gegen die ANGEZEIGTEN Namen — und die Standard-Kategorie, die gerade bearbeitet wird, steht selbst noch in `categories`. Wer nur Farbe, Icon, Filterwörter oder Attribute ändert und den Namen stehen lässt, trifft immer auf den eigenen Namen und bekommt `categoryNameExists`.

*Warum es schadet:* Der Auftraggeber verlangt intuitiv BEARBEITBARE Kategorien. Im Auslieferungszustand sind alle ~110 Kategorien (110 `slug`-Einträge in `src/data/merchant-keywords.ts`) Standard-Kategorien — also ist im Normalfall KEINE Kategorie bearbeitbar, ohne sie zugleich umzubenennen. Die Oberfläche meldet dazu nur `settings.saveFailed` („Fehler beim Speichern"), nicht den Grund. Kein Test deckt `updateLocalCategory` auf einer Standard-Kategorie ab (Suche über `src/**/__tests__` findet nur `use-settings-overview.test.tsx`/`use-finance-overview.test.tsx`, beide ohne diesen Fall).

*Beleg:* `src/services/local-settings-service.ts:294 (`if (existing?.is_default)` → `saveInKategorien`), src/services/local-settings-service.ts:264-266 (`if (localizeCategories(categories).some((c) => c.name === name)) throw`), src/features/settings/application/use-settings-overview.ts:100 (`onError: () => showError(t('settings.saveFailed'))`)`

**Eine umbenannte Standard-Kategorie ist eine tote Kopie — die alte bleibt und gewinnt** *(korrektheit)*

Der Fork in `updateInKategorien` legt über `saveInKategorien` eine NEUE Kategorie mit neuer ID an und schreibt `[...categories, next]` — die alte Standard-Kategorie bleibt unverändert in der Liste, samt identischer `filters`. Im Kategorisierer entscheidet bei gleicher Trefferzahl `matches.length > bestSpecificity` (echt größer), also gewinnt der ERSTE Eintrag im Array, das ist die alte Standard-Kategorie.

*Warum es schadet:* Nach dem Umbenennen sieht die Nutzerin zwei Kategorien mit denselben Stichwörtern; alle Bestandsbuchungen hängen weiter an der alten ID, und jede neue Buchung geht ebenfalls an die alte. Die Umbenennung wirkt wie eine Nullhandlung mit Doppeleintrag. Zusätzlich zeigen die Regex-Fallbacks weiter auf die alte ID (`local-cat-${rule.categorySlug}`), die neue Kopie ist für sie unerreichbar.

*Beleg:* `src/services/local-settings-service.ts:294-302 (Fork), src/services/local-settings-service.ts:268-283 (`id: generateLocalCategoryId()`, `writeLocalCategories([...categories, next])` — kein Entfernen der Vorlage), src/lib/categorization.ts:255 (`if (matches.length > bestSpecificity)`), src/lib/categorization.ts:284 (`byId.get('local-cat-' + rule.categorySlug)`)`

**Vorschau und Übernehmen rechnen mit zwei verschiedenen Regeln** *(korrektheit)*

`getCategoryPreview` sammelt Buchungen über `categorizer.categorize(t)` — das ist die Kaskade OHNE Konfidenzschwelle, inklusive Regex-Fallback mit 0,55 — und übergeht `tx.confirmed` vollständig. `recategorizeTransactions`, also das tatsächliche Übernehmen, benutzt `categorizer.categorizeConfident(tx)` (Schwelle `MIN_SILENT_ASSIGN_CONFIDENCE = 0.7`) und überspringt jede bestätigte Buchung.

*Warum es schadet:* Genau die Forderung „der Nutzer muss vorher sehen, was passiert" wird gebrochen: Die Vorschau listet Buchungen, die der Lauf nachweislich nicht anfassen wird (alles unter 0,7 und jede bestätigte Buchung). Es gibt keinen Test, der Vorschaumenge gegen Wirkmenge hält. AGENTS.md §3 verlangt für genannte Zahl und verlinkte Menge ausdrücklich dieselbe Grundlage.

*Beleg:* `src/services/transaction-service.ts:554 (`const newCat = categorizer.categorize(t);` in `getCategoryPreview`), src/services/transaction-service.ts:477 (`if (tx.confirmed) { … continue; }`), src/services/transaction-service.ts:483 (`categorizer.categorizeConfident(tx)`), src/lib/categorization.ts:347 (`MIN_SILENT_ASSIGN_CONFIDENCE = 0.7`)`

**Beide „Übernehmen"-Knöpfe lösen einen globalen Lauf über ALLE Kategorien aus** *(korrektheit)*

Die Vorschau zeigt die Auswirkung EINER ausgewählten Kategorie (`getCategoryPreview(categoryId)`), und der Vorschlag nennt EINE Kategorie mit ihrer Trefferzahl (`CategorySuggestion`). Beide Knöpfe sind auf dieselbe Funktion verdrahtet: `settings.recategorize` → `recategorizeTransactions()`, die den gesamten Bestand gegen den gesamten Kategoriensatz neu kategorisiert.

*Warum es schadet:* Der Nutzer sieht eine Vorschau über 50 Zeilen einer Kategorie und löst damit eine Änderung an beliebig vielen Buchungen in beliebig vielen anderen Kategorien aus. Die Vorschau ist damit keine Vorschau der Aktion, sondern eines Ausschnitts davon — genau die stille Falschaussage, die AGENTS.md §3 unter „Ein unprüfbares Versprechen wird zum Etikett" beschreibt.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:143 (`onApply={settings.recategorize}`), src/components/settings/EnhancedSettings.tsx:137 (`onApplySuggestion={settings.recategorize}`), src/features/settings/application/use-settings-overview.ts:223 (`recategorize: () => recategorizeMutation.mutate()`), src/services/transaction-service.ts:452-499 (`recategorizeTransactions` ohne Kategorie-Parameter)`

**Aufgeteilte Buchungen: die Übernahme wirkt nicht, wird aber als Änderung gezählt** *(korrektheit)*

`getCategoryContributions` ignoriert `transaction.category_id` vollständig, sobald zu der Buchung Aufteilungen (`transactionAllocations`) vorliegen — dann zählen ausschließlich die Anteile mit ihren eigenen `category_id`/`subcategory_id`. `recategorizeTransactions` schreibt aber nur `tx.category_id` und kennt die Aufteilungen nicht; `getCategoryPreview` ebenfalls nicht.

*Warum es schadet:* Für jede gesplittete Buchung meldet der Lauf `changed += 1` und `assigned += 1`, während sich in jeder Auswertung — Sunburst, Sankey, Budgets, Kennzahlen — kein einziger Cent bewegt. Das ist dieselbe Familie wie der in AGENTS.md §3 dokumentierte `allocations`-Befund („Ein deklarierter Datenbedarf, den niemand erfüllt"): lautlos, kein Fehler, kein Test rot. Der Ergebnisbericht der Fläche („X von Y zugeordnet") ist dadurch nachweislich falsch.

*Beleg:* `src/lib/analysis-data.ts:53-65 (`getCategoryContributions`: `if (allocs && allocs.length > 0) return allocs.map(...)`), src/services/transaction-service.ts:494-497 (Schreibt nur `{ category_id, auto_mapped }`), src/services/transaction-service.ts:544-560 (`getCategoryPreview` lädt keine Aufteilungen), src/services/transaction-allocation-service.ts:102/163 (persistierte Collection `transactionAllocations`)`

**`subcategory_id` wird beim Übernehmen nie angefasst und übersteuert das Ergebnis** *(korrektheit)*

Eine Buchung trägt zwei Kategoriefelder: `category_id` (Hauptkategorie) und `subcategory_id` (Blatt). Jede Auswertung, jeder Filter und das gelernte Modell lesen `subcategory_id ?? category_id`. `recategorizeTransactions` und `restoreCategorization` schreiben ausschließlich `category_id`; die manuelle Bearbeitung dagegen setzt über `resolveCategorySelection` das Paar (Elternteil, Blatt).

*Warum es schadet:* Bei jeder Buchung, die schon einmal von Hand einer Unterkategorie zugeordnet wurde, bleibt die alte `subcategory_id` stehen und schlägt die neu geschriebene `category_id` in jeder Zahl. Der Lauf meldet die Buchung als geändert, die Auswertung zeigt weiterhin die alte Kategorie. Zwei Schreibpfade erzeugen zwei unterschiedliche Formen derselben Tatsache.

*Beleg:* `src/services/transaction-service.ts:494-497, src/services/transaction-service.ts:510-521 (`restoreCategorization`, nur `category_id`/`auto_mapped`), src/lib/category-model.ts:150-152 (`zugewieseneKategorie` = `subcategory_id ?? category_id`), src/features/shared/domain/dashboard-filtering.ts:140/159, src/components/dashboard/transaction-details.ts:62-69 (`resolveCategorySelection` setzt das Paar)`

**Der Undo-Vorrat lebt nur im React-State und geht beim Dichtewechsel verloren** *(korrektheit)*

`undoSnapshot` (die Vorwerte aller geänderten Buchungen) steht in `useState` im ViewModel. Er wird nicht persistiert. `docs/architecture/darstellungsdichte.md` Regel 6/8 mountet je Dichte genau EINE Fassung und baut die andere beim Überschreiten der 768-px-Schwelle ab.

*Warum es schadet:* Der Auftraggeber verlangt ausdrücklich, dass eine Übernahme „danach zurückgenommen werden" kann. Nach dem Verlassen der Fläche, einem Reload, einem Drehen des Geräts oder dem Antippen von „Desktopseite" ist die Sammeländerung an potenziell tausenden Buchungen unwiderruflich — der Knopf „Rückgängig" bleibt sichtbar und antwortet dann mit `settings.nothingToUndo`. Regel 8 der ADR („Ein Dichtewechsel darf nie etwas verlieren") nennt als Vorbild ausdrücklich einen Entwurfs-Speicher; hier gibt es keinen.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:51 (`const [undoSnapshot, setUndoSnapshot] = useState<CategorizationSnapshotEntry[]>([])`), src/features/settings/application/use-settings-overview.ts:225-229, src/components/settings/CategoryPreview.tsx:120-127 (Knopf ohne Zustandsbindung)`

**Enkel-Kategorien werden beim Löschen still zu Hauptkategorien** *(korrektheit)*

`deleteLocalCategory` entfernt nur die Kategorie selbst und ihre DIREKTEN Kinder (`c.parent_id !== id`); `deleteCategory` meldet genau diese Menge als `deletedCategoryIds`. Eine dritte Ebene ist erreichbar, weil `CategoryTree` den „+"-Knopf („Unterkategorie hinzufügen") auf JEDER Zeile rendert, auch auf einer Unterkategorie. Beim nächsten Aufbau des Baums landet eine Kategorie mit unauffindbarem `parent_id` über `roots.push(cat)` auf oberster Ebene.

*Warum es schadet:* Eine gelöschte Kategorie hinterlässt sichtbare Kinder, die plötzlich als Hauptkategorien in Auswahllisten, Budget-Dialogen und im Sunburst-Innenring auftauchen — ohne Meldung, ohne Zählung im Löschergebnis. Die Nutzerin hat etwas gelöscht und bekommt stattdessen eine neue oberste Ebene.

*Beleg:* `src/services/local-settings-service.ts:333-338 (`categories.filter((c) => c.id !== id && c.parent_id !== id)`), src/services/category-service.ts:32-35 (`c.id === id || c.parent_id === id`), src/services/transaction-service.ts:409-412 (`if (parent) … else roots.push(cat)`), src/components/settings/CategoryTree.tsx:87-98 (Plus-Knopf innerhalb der rekursiven `renderCategoryTree`)`

**Löschen räumt Aufteilungen nicht auf — die vierte Referenz fehlt** *(korrektheit)*

`deleteCategory` bereinigt drei Referenzhalter: Budgets mit gelöschter Hauptkategorie, `subcategory_ids` in Budgets und Händlerregeln. Die vierte persistierte Referenz — `transactionAllocations` mit eigenen `category_id`/`subcategory_id` — bleibt unberührt. Beim Löschen einer BUCHUNG wird sie sehr wohl mitgelöscht (`deleteAllocationsForTransactions`), beim Löschen einer KATEGORIE nicht.

*Warum es schadet:* Der Anteil einer gesplitteten Buchung zeigt danach auf eine Kategorie, die es nicht mehr gibt, und fällt in jeder Auswertung nach „Unkategorisiert" — ohne dass das Löschergebnis (`CategoryDeletionResult`) davon etwas meldet. Die Begründung im Kopf von `category-service.ts` erklärt nur, warum BUCHUNGEN ihre verwaiste `category_id` bewusst behalten; für Aufteilungen steht dort nichts. Das ist keine getroffene Entscheidung, sondern eine übersehene Referenz.

*Beleg:* `src/services/category-service.ts:5-14 (`CategoryDeletionResult` kennt nur Budgets und Regeln), src/services/category-service.ts:39-71, src/lib/transaction-types.ts:95-96 (`TransactionAllocation.category_id`/`subcategory_id`), src/services/transaction-storage-service.ts:252-255 (Aufteilungen werden beim Buchungslöschen sehr wohl mitgeräumt)`

**`remapCategoryInLocalTransactions` — die einzige Umhänge-Funktion hat keinen Aufrufer** *(architektur)*

Die Funktion, die Buchungen von einer Kategorie auf eine andere umschreibt, existiert samt Kommentar („die gelöschte Kategorie hinterliesse Waisen", Audit 2026-09 F2) und ist getestet. Produktiv ruft sie niemand: die einzige Fundstelle außerhalb der Datei ist `transaction-service.ordering.test.ts`. `deleteCategory` benutzt sie nicht. Zusätzlich prüft sie nur `tx.category_id === oldCategoryId` und übergeht `subcategory_id` und Aufteilungen.

*Warum es schadet:* Damit gibt es KEINEN Weg, beim Löschen oder Zusammenlegen einer Kategorie zu sagen „nimm die Buchungen mit nach X" — die einzige Antwort der App ist, die Zuordnung verwaisen zu lassen. Das ist die Umkehrung des AGENTS.md-§3-Befundes „Eine Datengrundlage ohne Erzeuger ist keine": ein Aufräumer ohne Auslöser, alle Tests grün, weil sie die Rechnung prüfen und nicht den Weg zu ihr.

*Beleg:* `src/services/transaction-service.ts:365-383 (Definition), Suche `grep -rn remapCategoryInLocalTransactions src` findet nur src/services/transaction-service.ts:365 und src/services/__tests__/transaction-service.ordering.test.ts:10/97`

### Befunde — mittel

**Die Vorschauzahl ist bei 50 gekappt, die Fläche rechnet trotzdem mit ihr weiter** *(korrektheit)*

`getCategoryPreview(categoryId, limit = 50)` schneidet mit `affected.slice(0, limit)` ab; das ViewModel ruft ohne eigenes Limit auf, bekommt also höchstens 50 Zeilen. Die Darstellung zeigt zehn davon und schreibt darunter „{count} weitere" aus `affectedTransactions.length - 10` — höchstens „40 weitere".

*Warum es schadet:* Betrifft die Vorschau 3.000 Buchungen, sagt die Fläche „40 weitere". Der Nutzer entscheidet über eine Sammeländerung auf Grundlage einer um zwei Größenordnungen zu kleinen Zahl. Ein Ausschnitt sieht aus wie ein Bestand — dieselbe Falle, gegen die `pnpm check:transaction-limits` das numerische Limit an `getTransactions(` verbietet; hier steht das Literal in der Signatur einer Auswertungsfunktion und wird nicht erfasst.

*Beleg:* `src/services/transaction-service.ts:544 (`limit: number = 50`) und :559 (`return affected.slice(0, limit)`), src/features/settings/application/use-settings-overview.ts:186 (`await getCategoryPreview(selectedCategoryId)` — ohne Limit), src/components/settings/CategoryPreview.tsx:105-108 (`affectedTransactions.length - 10`)`

**Kein Zyklus-Schutz auf `Category.parent_id` — anders als bei den Anlässen** *(architektur)*

`updateInKategorien` schreibt `parent_id` ungeprüft. Für die parallele Hierarchie der Sonderkategorien existiert dagegen ein vollständiger Schutz (`wouldCreateCycle`, Selbst-Elternschaft und Unterordnung unter einen eigenen Nachfahren verboten). Die Leser der Kategorie-Kette fangen Zyklen zwar defensiv ab (`visited`-Set), aber `getHierarchicalCategories` tut das nicht: bei A↔B landet keine der beiden in `roots`.

*Warum es schadet:* Ein zyklisch verketteter Teilbaum verschwindet vollständig aus der Kategorieverwaltung, aus jeder Auswahlliste und aus dem Budget-Dialog — die Kategorien existieren weiter und tragen weiter Buchungen. Heute nur über Backup-Wiederherstellung oder ein künftiges Verschieben erreichbar, aber die Regel ist im Repo für die Nachbarhierarchie bereits geschrieben und hier nicht angewandt.

*Beleg:* `src/services/local-settings-service.ts:316-329 (`parent_id: category.parent_id || null`, keine Prüfung), src/features/special-categories/domain/hierarchy.ts:69-77 (`wouldCreateCycle` für `SpecialCategory`), src/services/transaction-service.ts:395-418 (`getHierarchicalCategories` ohne Zyklusabbruch), src/lib/analysis-data.ts:152-166 (Leser mit `visited`-Set)`

**Verschieben einer Kategorie ist im Datenpfad vorgesehen und in der Oberfläche unerreichbar** *(bedienbarkeit)*

`updateInKategorien` schreibt `parent_id` mit. Die Oberfläche gibt beim Bearbeiten aber immer den bestehenden Wert zurück (`selectedCategory ? selectedCategory.parent_id : newCategoryParentId`), und `CategoryForm` hat keine Elternauswahl — `parentId` wird dort nur als Hinweistext gerendert. Ein Elternteil lässt sich ausschließlich beim ANLEGEN über den „+"-Knopf einer Baumzeile festlegen.

*Warum es schadet:* „Intuitiv bearbeitbar" schließt das Umhängen ein — es ist der häufigste Wunsch nach dem ersten Import („diese Unterkategorie gehört unter Wohnen"). Heute ist die einzige Antwort: löschen und neu anlegen, und damit Buchungszuordnung, Budgets und Händlerregeln verlieren. Der Datenpfad kann es, die Fläche fragt nie danach.

*Beleg:* `src/components/settings/CategoryManager.tsx:50 (`parent_id: selectedCategory ? selectedCategory.parent_id : newCategoryParentId`), src/components/settings/CategoryForm.tsx:123 (`{parentId && (` — reiner Hinweis, kein Auswahlfeld; keine `onParentChange`-Prop in der Signatur ab :61), src/services/local-settings-service.ts:325`

**Budgets sehen nur eine Hierarchieebene, die Verwaltung erlaubt drei** *(korrektheit)*

`budgetCategoryIds` sammelt ohne ausgewählte Unterkategorien die Hauptkategorie plus alle Kategorien mit `cat.parent_id === budget.category_id` — genau eine Ebene. `CategoryTree` erlaubt das Anlegen einer Unterkategorie unter einer Unterkategorie.

*Warum es schadet:* Ausgaben in einer dritten Ebene zählen still nicht in das Budget ihrer Hauptkategorie. Das Budget zeigt einen zu niedrigen Verbrauch, die Ampel bleibt grün, und nichts weist darauf hin. Dieselbe Ebenen-Annahme trifft `deleteLocalCategory`; die eine Stelle, die Ebenen wirklich rekursiv auflöst, ist `resolveHierarchy`.

*Beleg:* `src/lib/budget-logic.ts:63-71 (`for (const cat of categories) if (cat.parent_id === budget.category_id) ids.add(cat.id)`), src/components/settings/CategoryTree.tsx:87-98, src/lib/analysis-data.ts:143-166 (`resolveHierarchy` läuft dagegen bis zur Wurzel)`

**`deleteCategory` ist ein unserialisiertes Lesen-Ändern-Zurückschreiben der Budgets — für den Wächter unsichtbar** *(architektur)*

`deleteCategory` liest mit `getBudgets()`, rechnet die bereinigte Liste aus und schreibt sie mit `replaceBudgets(keptBudgets)` komplett zurück. Zwischen Lesen und Schreiben liegen mehrere `await` (IndexedDB, AES-GCM). `pnpm check:store-serialization` läuft grün (nachgeprüft), weil er die innerste Funktion sucht, die Lese- UND Schreibverb EINER Familie enthält — hier heißen die Verben `getBudgets`/`replaceBudgets` und liegen eine Servicegrenze weiter, während die vom Wächter bekannten `readLocalFinanceList`/`writeLocalFinanceList` in `budget-service.ts` stehen.

*Warum es schadet:* Legt die Nutzerin während des Löschens ein Budget an (oder läuft der Budget-Sweep), schreibt `replaceBudgets` eine Fassung ohne dieses Budget zurück — lautlos, ohne Fehler, ohne Log. Genau der Fall aus AGENTS.md §2 zu `check:store-serialization`, nur über zwei Dateien verteilt, und damit außerhalb dessen, was der Wächter strukturell sehen kann. Die Regel gilt, der Wächter deckt sie hier nicht ab.

*Beleg:* `src/services/category-service.ts:40 (`const budgets = await getBudgets();`) bis :60 (`await replaceBudgets(keptBudgets);`), src/services/budget-service.ts:37-40 und :54-56, scripts/store-serialization-core.mjs:49-56 (Familie „Finanz-Collections" kennt nur `readLocalFinanceList`/`writeLocalFinanceList`)`

**Das Übernehmen schreibt je Buchung einzeln — ein Lock, ein Chunk-Lesen und eine Neuverschlüsselung pro Zeile** *(architektur)*

`recategorizeTransactions` ruft in der Schleife über alle Buchungen `transactionStorage.updateTransaction(tx.id, …)` einzeln auf. Jeder dieser Aufrufe nimmt `withKeyLock(TRANSACTION_STORE_LOCK_KEY)`, liest über `readAllTransactionChunks()` den Bestand, um das Quartal der ID zu finden, und schreibt den Chunk neu. Auf dem noch nicht migrierten v3-Pfad ist es je Buchung der GESAMTE Blob (`getLocalTransactions` → `setLocalTransactions`). Eine Stapel-Schreibfunktion gibt es nicht.

*Warum es schadet:* AGENTS.md §3 benennt AES-GCM plus IndexedDB-Roundtrip als teuerste Operation der App. Bei 2.000 geänderten Buchungen sind das 2.000 Sperren, 2.000 Chunk-Schreibvorgänge und 2.000 Verschlüsselungen — auf dem Telefon, hinter einem Knopf, der „Anwenden" heißt und keinen Fortschritt zeigt. Der Kommentar an `updateLocalTransactionChunked` rechtfertigt die Quartalssuche ausdrücklich mit dem EINZELfall („Liste anzeigen → eine Zeile bearbeiten"); der Sammellauf verletzt genau diese Annahme. Gemessen habe ich es nicht — die vorhandenen Perf-Tests decken den Kategorisierer ab, nicht die Schreibschleife.

*Beleg:* `src/services/transaction-service.ts:490-499 (Schleife mit `await transactionStorage.updateTransaction`), src/services/transaction-storage-service.ts:568-571 (`withKeyLock` + `readAllTransactionChunks` je Aufruf), src/services/transaction-storage-service.ts:458-478 (v3-Pfad: ganzer Blob je Buchung), src/services/transaction-storage-service.ts:500-511 (Kommentar begründet die Bauform mit dem Einzelfall)`

### Befunde — niedrig

**Zwei ID-Formen für dasselbe Ding — und der Regex-Fallback kennt nur eine** *(architektur)*

Standard-Kategorien tragen die stabile, sprechende ID `local-cat-<slug>` (aus der Taxonomie erzeugt, ausdrücklich stabil gehalten, siehe die Migrationen, die einzelne dieser IDs namentlich reparieren). Selbst angelegte Kategorien bekommen dagegen `crypto.randomUUID()` — ohne Präfix, ohne Sprechbarkeit, mit einem `local-cat-<random>`-Ersatzweg nur ohne `crypto`.

*Warum es schadet:* Die letzte Kaskadenstufe (`REGEX_FALLBACK_RULES`) schlägt ausschließlich über `local-cat-${slug}` nach. Eine selbst angelegte oder aus einer Standardkategorie geforkte Kategorie ist für sie strukturell unerreichbar — und das ist genau die Kategorie, die die Nutzerin für ihren Sonderfall angelegt hat. Zusätzlich unterscheidet `backfillAusgabenklasse` Cloud- von lokalen Kategorien am `local-cat-*`-Präfix, kennt also drei ID-Herkünfte mit zwei Formen.

*Beleg:* `src/data/merchant-keywords.ts:920/934 (`local-cat-${main.slug}` / `local-cat-${sub.slug}`), src/services/local-settings-service.ts:168-173 (`crypto.randomUUID()`), src/lib/categorization.ts:282-284 (`byId.get('local-cat-' + rule.categorySlug)`), src/lib/category-migrations.ts:84 und :98 (Präfix-Unterscheidung, Namens-Fallback für Cloud-IDs)`

**Verwaiste Zuordnungen bekommen je nach Fläche zwei verschiedene Namen** *(korrektheit)*

Für eine Buchung, deren `category_id` auf eine gelöschte Kategorie zeigt, liefert `resolveHierarchy` (Sunburst, Sankey, Einkommensströme) „Unkategorisiert"; `AnalysisModePanel` liefert für denselben Fall „Unbekannt" und trennt ihn damit von den echten unkategorisierten Buchungen. In der Buchungsliste ist der Waise gar nicht erkennbar — es fehlt nur das Icon.

*Warum es schadet:* Der Kopf von `category-service.ts` begründet das bewusste Zurücklassen verwaister `category_id` damit, dass „Analysen deterministisch auf Unkategorisiert zurückfallen". Das gilt nur für den Chart-Pfad. Eine Fläche zeigt einen zusätzlichen Eimer „Unbekannt", und es gibt keine Stelle in der App, die sagt, wie viele Buchungen auf eine gelöschte Kategorie zeigen. Niemand räumt auf, niemand meldet es — die Menge ist unsichtbar und wächst mit jedem Löschen.

*Beleg:* `src/lib/analysis-data.ts:143-150 (`if (!cat) return { mainName: uncategorizedName() … }`), src/components/dashboard/AnalysisModePanel.tsx:47 (`map.get(id) ?? "Unbekannt"` — zusätzlich hartcodiert deutsch), src/services/category-service.ts:24-26 (die Begründung), src/components/dashboard/TransactionDayList.tsx:219-220`

### Unsicher

Was ich NICHT laufen lassen habe: Ich habe die App nicht gestartet und keinen der Befunde zur Laufzeit reproduziert — alles ist aus dem Quelltext abgeleitet. Drei Punkte, an denen das zählt:

1. Befund 1 (Standard-Kategorie bearbeiten schlägt immer fehl) habe ich am Kontrollfluss belegt (`is_default` → `saveInKategorien` → Namens-Dublette gegen die eigene Vorlage). Ich habe ihn nicht im Browser ausgelöst und keinen Test dafür gefunden, der ihn bestätigt ODER widerlegt. Ein `[REGRESSION]`-Test wäre der erste Schritt einer Behebung.

2. Befund 16 (Schreibschleife): Ich behaupte die Bauform, nicht die Zahl. Die vorhandenen Perf-Tests (`category-model-performance.test.ts`, `categorizer.perf.test.ts`) messen den Kategorisierer, nicht die Schreibschleife. Wie viele Nutzer noch auf dem v3-Blob-Pfad (`hasLegacyV3Blob`) statt auf Quartals-Chunks liegen, weiss ich nicht — der Blob-Pfad ist der teure.

3. Die dritte Hierarchieebene ist über den „+\"-Knopf jeder Baumzeile erreichbar; ob Bestandsnutzer sie tatsächlich benutzen, kann ich aus dem Repo nicht sehen. Die Befunde 8, 9 und 14 hängen daran unterschiedlich stark: 8 (Aufteilungen) und 6/7 (Splits, `subcategory_id`) gelten auch bei zwei Ebenen, 9 und 14 brauchen die dritte.

Nicht geprüft, weil ausserhalb meines Gebiets, aber angrenzend: ob die 33 Kartenrahmen der Fläche und die elf offenen Abschnitte durch die hier genannten Datenpfade überhaupt gebraucht werden. Zwei der vier Kategorie-Dateien (`CategoryForm.tsx` mit 463 Zeilen, `EnhancedSettings.tsx` mit 314) habe ich nur nach Datenzugriffen durchsucht, nicht auf ihre Darstellung hin gelesen.

Ausserdem nicht verfolgt: `coach-types.ts:42` und `forecast-types.ts:92/167` halten ebenfalls Kategorie-IDs. Ob diese Datensätze persistiert oder je Lauf neu abgeleitet werden, habe ich nicht abschliessend geklärt — wenn persistiert, ist Befund 8 (fehlende Aufräumung beim Löschen) breiter als dort beschrieben.

---

## Das Übernehmen: Was mit bestehenden Buchungen geschieht, wenn eine Kategorie angelegt oder ihre Regeln geändert werden — Vorschau, Rückgängig, Reichweite, Serialisierung

### Datenfluss

Anlegen/Ändern einer Kategorie schreibt AUSSCHLIESSLICH die Kategorienliste — an den Buchungen ändert sich dabei nichts. Weg: CategoryForm → CategoryManager.handleCategoryFormSave → EnhancedSettings (onCategorySave) → use-settings-overview.saveCategoryMutation → transaction-service.saveCategory/updateCategory → local-settings-service.saveLocalCategory/updateLocalCategory (korrekt über withKeyLock serialisiert). Danach werden nur die Queries `hierarchicalCategories` und `category-suggestion` invalidiert; der Bestand bleibt, wie er ist, bis der Nutzer von sich aus eine Übernahme auslöst.

Die Übernahme selbst hat GENAU EINEN Kern und vier Auslöser: „Vorschlag anwenden" (CategoryManager), „Anwenden" (CategoryPreview), „Jetzt zuweisen" und „Neu kategorisieren" (BulkAssignment) rufen alle `settings.recategorize()` → `recategorizeTransactions()`. Dieser Lauf liest `getCategories()`, `getMerchantRules()` und `getAllTransactions()` (echter Gesamtbestand, kein Limit), baut das gelernte Modell EINMAL, geht dann über alle Buchungen: bestätigte werden übersprungen, für die übrigen entscheidet `categorizeConfident` (Kaskade merchant_rule → gelerntes Modell → Kategoriefilter → Modell unsicher → Regex-Fallback, Schwelle 0,7). Jede Änderung wird EINZELN über `transactionStorage.updateTransaction` geschrieben (je Schreibvorgang ein `withKeyLock` auf dem Buchungsspeicher) und ihr Vorzustand (category_id, auto_mapped) in ein `undo`-Array gelegt, das die Funktion am Ende zurückgibt.

Der Rückweg: `summary.undo` landet in einem `useState` des ViewModels; „Letzte Aktion rückgängig" schickt es an `restoreCategorization`, das die Vorwerte einzeln zurückschreibt. Kein Persistieren, kein Audit-Eintrag, keine Prüfung auf zwischenzeitliche Änderungen, nur eine Ebene tief.

Die Vorschau ist ein zweiter, unabhängiger Pfad: `loadPreview()` → `getCategoryPreview(selectedCategoryId)` liest ebenfalls den ganzen Bestand, filtert aber mit `categorize` (jede Konfidenz, bestätigte Buchungen eingeschlossen) auf „würde IN diese eine Kategorie wandern" und kappt bei 50. Vorschau und Übernahme teilen also weder Regel noch Reichweite noch Ergebnismenge — die Vorschau ist kein Plan der Aktion, sondern eine eigene Abfrage daneben.

Nebenwege, die denselben Bestand verändern: das Buchungsdetail (`transaction-service.updateTransaction`) setzt bei jeder Kategoriekorrektur `confirmed: true`, `auto_mapped: false` und legt zusätzlich eine Händlerregel an (`upsertMerchantRule`, sauber über `mutateLocalFinanceList` serialisiert und auditiert) — dieselbe Funktion benutzt der Coach-Posteingang beim Annehmen eines Vorschlags. Diese Regeln stehen auf Stufe 1 der Kaskade und bestimmen jeden späteren Übernahme-Lauf. Der Chat-Pfad (`use-kategorie-action.ts`) ist der einzige, der die Zusage aus AGENTS.md §3 einlöst: Schnappschuss aus der Vorschau, Bestätigen schreibt, Rückgängig nimmt Buchungen UND angelegte Regel zurück.

### Befunde — hoch

**Vorschau und Übernahme rechnen mit zwei verschiedenen Regeln — die Vorschau ist nicht der Plan der Aktion** *(korrektheit)*

`getCategoryPreview` sammelt Buchungen über `categorizer.categorize(t)` (JEDE Konfidenz, auch Regex-Fallback 0,55 und unsicheres Modell 0,60) und filtert `confirmed` NICHT heraus. `recategorizeTransactions` schreibt dagegen nur über `categorizeConfident` (>= MIN_SILENT_ASSIGN_CONFIDENCE = 0,7) und überspringt jede bestätigte Buchung. Die angezeigte Liste enthält also systematisch Buchungen, die die Aktion nie anfasst.

*Warum es schadet:* Die Vorschau ist die einzige Stelle, an der der Nutzer VORHER sieht, was passiert (Auftrag: „muss vorher sehen, was passiert"). Sie behauptet mehr, als die Aktion tut — der Nutzer bestätigt eine Menge und bekommt eine andere. Der bestehende Test `sollte unbestätigte Buchungen nicht auf 0,55-Raten umkategorisieren` beweist genau die Lücke, prüft die Vorschau aber nicht dagegen.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:553-556 (`categorizer.categorize(t)`, kein confirmed-Filter) vs. :477-483 (`if (tx.confirmed) continue`, `categorizeConfident`); Schwelle in src/lib/categorization.ts:302-305,347; Gegenbeweis im Bestand: src/services/__tests__/categorization-precision.test.ts:132-143`

**Die Vorschau ist ein 50er-Ausschnitt, sieht aber wie der Bestand aus** *(korrektheit)*

`getCategoryPreview(categoryId, limit = 50)` schneidet nach 50 Treffern ab (`affected.slice(0, limit)`). Die Fläche zeigt davon 10 Zeilen und darunter „... und {count} weitere" mit `affectedTransactions.length - 10` — also höchstens „und 40 weitere", egal ob 41 oder 4.100 Buchungen betroffen sind. Der Aufrufer übergibt nie ein Limit, die Zahl ist ein Vorgabewert im Service.

*Warum es schadet:* Exakt der Fall, für den `check:transaction-limits` existiert („Ein Ausschnitt sieht aus wie ein Bestand") — nur greift der Wächter hier strukturell nicht: Er meldet ausschliesslich ein Zahlenliteral als erstes Argument von `getTransactions(`. Der Nutzer entscheidet über eine Massenänderung auf Basis einer Zahl, die eine Kappungsgrenze ist und keine Menge.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:544,558; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryPreview.tsx:89,105-108; Text: src/i18n/translations/de.ts:1232; Wächter-Grenze: scripts/transaction-limits-core.mjs:74`

**Die Vorschau zeigt eine Kategorie, angewandt wird der GESAMTE Bestand — inklusive Kategorie-Entzug** *(korrektheit)*

Die Vorschau listet nur Buchungen, die IN die ausgewählte Kategorie wandern würden (`t.category_id !== categoryId && newCat === categoryId`). Der Knopf daneben ruft `recategorizeTransactions()` ohne Argument: Der Lauf geht über `getAllTransactions()` und schreibt für JEDE unbestätigte Buchung `category_id: newCat` — auch `null`. Eine früher automatisch zugeordnete Buchung, die heute keine 0,7 mehr erreicht, verliert ihre Kategorie ersatzlos; Buchungen wandern zwischen fremden Kategorien.

*Warum es schadet:* „Anwenden" unter einer Vorschau, die 12 Zeilen einer Kategorie zeigt, löst eine Änderung an tausenden Buchungen in allen Kategorien aus. Der gefährlichste Teil — das Entfernen bestehender Zuordnungen — kommt in der Vorschau gar nicht vor.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:553-556 gegen :462,474,489-497; Verdrahtung: src/components/settings/EnhancedSettings.tsx:139-146 (`onApply={settings.recategorize}`)`

**Regeln einer Standard-Kategorie lassen sich nicht ändern — oder sie forken lautlos** *(korrektheit)*

`updateLocalCategory` leitet jede Kategorie mit `is_default: true` an `saveInKategorien` um („Standard-Kategorie wird beim Bearbeiten zur Nutzer-Kopie"). Dort steht die Dublettenprüfung auf dem ANGEZEIGTEN Namen — die Ursprungskategorie liegt noch in der Liste. Nachgemessen (Wegwerf-Test gegen den echten Service, danach entfernt): Filter ergänzen ohne Umbenennen → `Eine Kategorie mit diesem Namen existiert bereits`, 110 Kategorien vorher wie nachher, Filter unverändert. Mit Umbenennen → 111 Kategorien: die neue Kopie trägt eine UUID, die alte `local-cat-gehalt` bleibt mit ihren alten Filtern aktiv.

*Warum es schadet:* Alle 110 ausgelieferten Kategorien sind `is_default: true` — also betrifft das den Normalfall „ich ändere die Stichwörter von ‚Lebensmittel‘". Entweder scheitert es mit der generischen Meldung „Fehler beim Speichern", oder es entstehen zwei konkurrierende Kategorien: Der Bestand hängt weiter an der alten ID, beide Filtermengen laufen in derselben Kaskade, und keine Übernahme kann das reparieren. Das schlägt den Kern des Auftrags („intuitiv bearbeitbar") vor jedem Übernehmen.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/local-settings-service.ts:293-303 (Weiche) und :264-266 (Dublettenprüfung); Seed mit `is_default: true` in src/data/merchant-keywords.ts:929,941; generische Fehlermeldung: src/features/settings/application/use-settings-overview.ts:100`

**„Anwenden" ist während des Laufs nicht gesperrt, und jeder Lauf überschreibt den Undo-Vorrat** *(korrektheit)*

`EnhancedSettings` gibt `isProcessing={settings.preview.isLoading}` an `CategoryPreview` — das ist der Ladezustand der VORSCHAU, nicht der der Neukategorisierung (`settings.bulk.isRunning`). Der Knopf „Anwenden" bleibt während des Schreibens klickbar; ebenso der Vorschlags-Knopf im CategoryManager (nur `disabled={suggestion.affectedCount === 0}`). Jeder erfolgreiche Lauf setzt `setUndoSnapshot(summary.undo)` — der Vorrat des vorigen Laufs ist damit weg.

*Warum es schadet:* Zweimal klicken heisst: zwei Läufe über denselben Bestand. Der zweite findet nichts mehr zu ändern, liefert `undo: []` und LÖSCHT damit den Rückweg des ersten. Der Nutzer drückt danach „Letzte Aktion rückgängig" und bekommt „Nichts zum Rückgängigmachen" — die Änderung an tausenden Buchungen ist endgültig.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/EnhancedSettings.tsx:145 (gegen :222, wo `bulk.isRunning` korrekt benutzt wird); src/components/settings/CategoryManager.tsx:74; src/features/settings/application/use-settings-overview.ts:138-149`

**Der Rückweg lebt nur im Komponentenzustand — Neuladen, Wegnavigieren, Tab schliessen löscht ihn** *(architektur)*

Der Undo-Schnappschuss steht in `useState<CategorizationSnapshotEntry[]>` im ViewModel von `/settings`. Er wird nirgends persistiert und nirgends protokolliert: `transaction-service.ts` schreibt für die Sammel-Neukategorisierung KEINEN Audit-Eintrag, während `merchant-rules-service` für eine EINZELNE Händlerregel einen Eintrag mit `reversible: true` und `reversal`-Ziel anlegt.

*Warum es schadet:* Die Frage des Auftraggebers lautet „wie lange". Die Antwort ist: bis zum nächsten Rendern einer anderen Route. Wer nach der Übernahme auf /transactions schaut, ob das Ergebnis stimmt, und zurückkommt, hat keinen Rückweg mehr — und es gibt auch keine Spur davon, dass der grösste Schreibvorgang der App stattgefunden hat. Die kleinste Änderung ist auditiert, die grösste nicht.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/settings/application/use-settings-overview.ts:51,143,162; Route: src/pages/SettingsPage.tsx:1,7; kein `safeAudit` in src/services/transaction-service.ts (Gegenstück: src/services/merchant-rules-service.ts:45-57)`

**Bricht der Lauf mitten drin ab, ist das bereits Geschriebene unwiederbringlich** *(korrektheit)*

`recategorizeTransactions` schreibt je Buchung einzeln und wirft beim ersten Fehlschlag (`if (!result.success) throw`). Der `undo`-Array existiert nur lokal in der Funktion und wird ausschliesslich im Erfolgsfall zurückgegeben; `onError` im ViewModel setzt lediglich `bulkStatus` zurück und zeigt einen Toast.

*Warum es schadet:* Nach einem Abbruch bei Buchung 800 von 3.000 sind 800 Buchungen geändert und der Rückweg für diese 800 ist im Fehlerpfad verloren gegangen. Der Nutzer sieht „Fehler bei der Neukategorisierung" und hat einen halb umgeschriebenen Bestand ohne jede Möglichkeit, ihn zurückzudrehen.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:471,489-499,502; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/settings/application/use-settings-overview.ts:151-154`

**Der Schreibvorgang ist je Buchung serialisiert, die ENTSCHEIDUNG aber auf einem Lesestand von vorher getroffen** *(architektur)*

Die Einzelschreibung ist sauber gesperrt (`withKeyLock(TRANSACTION_STORE_LOCK_KEY)` in `updateLocalTransaction`/`updateLocalTransactionChunked`), und `pnpm check:store-serialization` läuft grün (nachgeprüft). Der Lauf selbst hält jedoch keinen Lock: Er liest den Bestand EINMAL (`getAllTransactions()`), entscheidet über alle Buchungen und schreibt danach nacheinander. Zwischen Lesen und Schreiben liegen tausende `await`s.

*Warum es schadet:* Eine manuelle Korrektur, die währenddessen erfolgt (Buchungsdetail: setzt `confirmed: true` und legt eine Händlerregel an), wird vom laufenden Lauf überschrieben, weil dessen Entscheidung auf dem alten Stand `confirmed: false` beruht. Der Lock verhindert den zerrissenen Chunk, nicht die verlorene Entscheidung — dieselbe Klasse wie Issue #311, nur eine Ebene höher, und deshalb für den Wächter unsichtbar. Zusätzlich ist der Lauf mit N Einzelschreibungen N vollständige Lese-Ändern-Schreib-Zyklen auf dem Chunk-Speicher.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:462,474,494; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-storage-service.ts:458-478,568-596; Gegenprobe: `node scripts/check-store-serialization.mjs --all` meldet „Kein unserialisiertes Lesen-Ändern-Schreiben gefunden"`

### Befunde — mittel

**`restoreCategorization` verschluckt Fehlschläge und meldet trotzdem Erfolg — und überschreibt zwischenzeitliche Handarbeit** *(korrektheit)*

Die Wiederherstellung zählt nur die geglückten Schreibvorgänge (`if (result.success) restored += 1`) und meldet keinen Fehler. Das ViewModel zeigt „{count} Buchungen zurückgesetzt" und leert danach den Schnappschuss unbedingt (`setUndoSnapshot([])`). Geprüft wird ausserdem nicht, ob die Buchung seit dem Lauf von Hand geändert wurde.

*Warum es schadet:* Gehen 497 von 500 Rücksetzungen schief, meldet die Fläche „3 Buchungen zurückgesetzt" als Erfolg, entsorgt den Schnappschuss und der Rest bleibt für immer falsch kategorisiert. Umgekehrt walzt ein Undo eine manuelle Korrektur platt, die der Nutzer nach der Übernahme vorgenommen hat — er nimmt eine Massenaktion zurück und verliert dabei eigene Arbeit.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:510-520; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/settings/application/use-settings-overview.ts:157-171`

**`canUndo` wird berechnet, getestet — und von keiner Fläche gelesen** *(bedienbarkeit)*

Das ViewModel liefert `bulk.canUndo`, die Domäne deklariert es, zwei Tests prüfen es. `EnhancedSettings` reicht es an keine Komponente weiter: `CategoryPreview` bekommt nur `onUndo` und zeigt den Knopf „Letzte Aktion rückgängig" immer und immer aktiv; `BulkAssignment` — der zweite Ort, an dem dieselbe Übernahme ausgelöst wird — hat gar keinen Undo-Knopf.

*Warum es schadet:* Ein Undo-Knopf, der nichts zu tun hat, ist kein Angebot, sondern eine Falle: Er antwortet mit einer Fehlermeldung („Nichts zum Rückgängigmachen") statt gar nicht erst zu erscheinen. Und wer die Übernahme unten im Abschnitt „Automatisierung" auslöst, sieht überhaupt keinen Rückweg — er steht elf Bildschirmlängen weiter oben in einer anderen Karte.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/settings/application/use-settings-overview.ts:214; src/features/settings/domain/settings-overview.ts:79; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/EnhancedSettings.tsx:139-146,217-222; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryPreview.tsx:120-127`

**Der erklärende Text sagt das Gegenteil dessen, was der Code tut** *(korrektheit)*

Die einzige Stelle, die dem Nutzer erklärt, was mit den BESTEHENDEN Buchungen geschieht, ist die Vier-Punkte-Liste in `BulkAssignment`. Punkt 4 lautet: „Bereits kategorisierte Transaktionen werden überschrieben". Der Code tut genau das Gegenteil — bestätigte Zuordnungen werden nie angefasst (dokumentiert und per REGRESSION-Test abgesichert).

*Warum es schadet:* Der Nutzer traut sich entweder nicht (er glaubt, seine Handarbeit werde vernichtet) oder er rechnet damit, dass eine falsche bestätigte Zuordnung durch die Übernahme repariert wird — sie wird es nie. Beide Male ist die Erwartung durch die App selbst gesetzt.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/i18n/translations/de.ts:1216 gegen C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:475-481 und src/services/__tests__/categorization-precision.test.ts:98-115`

**Nach dem Speichern einer Regeländerung zeigt die Vorschau still den alten Stand** *(bedienbarkeit)*

`saveCategoryMutation.onSuccess` setzt `setSelectedCategoryId(null)`, räumt aber `previewTransactions` nicht auf. `CategoryPreview` behält sein `showPreview`-true und rendert die alte Trefferliste weiter — nur ohne Kategoriekopf, weil `preview.category` jetzt `null` ist.

*Warum es schadet:* Genau die Reihenfolge, die der Auftraggeber verlangt (Regel ändern → sehen, was passiert → übernehmen), führt zu einer Liste, die vor der Änderung berechnet wurde und nichts mehr kennzeichnet. Der Nutzer prüft die Wirkung seiner neuen Regel an einem Ergebnis, das sie nicht enthält. Zusätzlich ist die Kategorie überhaupt nur über den Bearbeiten-Stift auswählbar — nach dem Speichern ist die Auswahl weg und muss neu gesetzt werden.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/settings/application/use-settings-overview.ts:94-99,179-192; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryPreview.tsx:28,75; Auswahlweg: src/components/settings/EnhancedSettings.tsx:136 (`onCategoryEdit`)`

**Der Kategorie-Vorschlag nennt eine Zahl, die seine eigene Aktion nicht einlöst** *(korrektheit)*

`getTopCategorySuggestion` zählt je Kategorie mit `categorizer.categorize` (jede Konfidenz) und ohne `confirmed`-Ausschluss und liefert die grösste Menge als „{count} Buchungen für {category}". Der Knopf darunter ruft `settings.recategorize` — den globalen Lauf über alle Kategorien mit der 0,7-Schwelle und dem confirmed-Schutz.

*Warum es schadet:* Die Zahl beschreibt weder die Menge, die sich ändern wird, noch die Kategorie, auf die sich die Aktion beschränkt — sie beschränkt sich auf keine. Das ist dieselbe Klasse wie „Ein unprüfbares Versprechen wird zum Etikett" (AGENTS.md §3): Die genannte Zahl und die ausgelöste Menge sind nicht dieselbe Menge.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:561-589 (insb. :573-578); C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryManager.tsx:74; Verdrahtung src/components/settings/EnhancedSettings.tsx:137`

**Ein angenommener Coach-Vorschlag legt still eine Regel für den ganzen Bestand an** *(korrektheit)*

Der Posteingang übernimmt einen Vorschlag mit `updateTransaction([{ id, category_id }])`. Diese Funktion setzt nicht nur `confirmed: true`, sie legt zusätzlich über `upsertMerchantRule(normalizeMerchantName(payee), category_id)` eine Händlerregel an — Stufe 1 der Kaskade, die künftig jede Buchung dieses Händlers und jeden späteren Übernahme-Lauf bestimmt. Die Oberfläche sagt davon nichts und bietet kein Zurück.

*Warum es schadet:* Eine Ein-Klick-Entscheidung über EINE Buchung wird zur dauerhaften Regel über den ganzen Bestand. Genau dieser Weg — der Nutzer korrigiert einmal, und beim nächsten „Neu kategorisieren" verschieben sich hunderte Buchungen — ist für ihn nicht sichtbar und nicht rücknehmbar. Der Chat-Pfad (`use-kategorie-action.ts`) macht es vor: Er merkt sich die Regel-ID und löscht sie beim Rückgängig mit.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/hooks/useAutomationSuggestions.ts:82-96; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/transaction-service.ts:336-354; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/coach/presentation/shared/CategorySuggestionsInbox.tsx:70-77 (kein Undo); Gegenbild: src/features/money-questions/application/use-kategorie-action.ts:83-100`

**Vier Knöpfe, eine einzige Wirkung, über die ganze Fläche verstreut** *(bedienbarkeit)*

`settings.recategorize` hängt an vier Bedienelementen: „Vorschlag anwenden" (CategoryManager), „Anwenden" (CategoryPreview), „Jetzt zuweisen" und „Neu kategorisieren" (BulkAssignment, beide Props zeigen auf dieselbe Funktion). Zwei davon stehen im Abschnitt „Kategorien" ganz oben, zwei im Abschnitt „Automatisierung" — auf einer Fläche von 19 Bildschirmlängen.

*Warum es schadet:* Vier verschiedene Beschriftungen für denselben irreversiblen Vorgang lassen den Nutzer glauben, er wähle zwischen vier Reichweiten (dieser Vorschlag / diese Kategorie / neu zuweisen / alles neu). Er wählt nichts — es ist immer der ganze Bestand. Für den Umbau der Fläche heisst das: Übernehmen ist EIN Detailschritt, nicht vier Karten in zwei Abschnitten.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/EnhancedSettings.tsx:137,143,220,221; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/BulkAssignment.tsx:51-77`

**Die Vorschau rendert rohe Beträge — an der Zahl, auf die hin entschieden wird** *(darstellung)*

Jede Vorschauzeile zeigt `{transaction.amount}€` als Badge: die nackte JavaScript-Zahl, ohne `useMoneyFormat`, ohne `money.mask()`, mit Punkt als Dezimaltrenner und ohne feste Nachkommastellen.

*Warum es schadet:* „-12.5€" statt „−12,50 €" ist in einer Finanz-App kein Schönheitsfehler, sondern eine schlechter lesbare Zahl an genau der Stelle, an der der Nutzer eine Massenänderung beurteilen soll. Zugleich umgeht die Zeile den Sanften Modus vollständig — `check:money-format` sieht das nicht, weil der Wächter an `Intl`-Formatierern hängt und hier gar keiner benutzt wird.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryPreview.tsx:96-98`

**Löschen einer Kategorie: keine Rückfrage, kein Rückweg, Waisen im Bestand** *(korrektheit)*

Der Papierkorb im Kategoriebaum ruft `onDelete(category)` direkt — ohne Bestätigungsdialog. `deleteCategory` räumt Budgets und Händlerregeln mit, lässt aber die `category_id` der Buchungen bewusst als Waise stehen; begründet wird das mit dem „Ein-Blob-Store", den es seit den Quartals-Chunks so nicht mehr gibt. Einen Undo-Pfad gibt es nicht — auch keinen Audit-Eintrag wie bei den Händlerregeln.

*Warum es schadet:* Ein Fehlklick löscht eine Kategorie samt ihrer direkten Kinder und ihrer Budgets endgültig. Die betroffenen Buchungen zeigen danach auf eine ID, die es nicht mehr gibt, und fallen in Auswertungen still auf „Unkategorisiert" — sichtbar wird der Schaden erst in den Summen. Das ist die Kehrseite desselben Auftrags: Wer Kategorien intuitiv bearbeiten soll, muss ein Missgeschick zurücknehmen können.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryTree.tsx:111-124; C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/services/category-service.ts:16-37; Handhabung im ViewModel: src/features/settings/application/use-settings-overview.ts:103-131`

### Befunde — niedrig

**Die Vorschau ist Karte-in-Karte-in-Liste-mit-Karte-je-Zeile** *(darstellung)*

`CategoryPreview` baut vier Rahmenebenen übereinander: äussere `<Card>`, darin ein `rounded-2xl border` für die Kategorie, darin eine zweite `<Card>` für die Trefferliste, darin je Buchung ein eigenes `rounded-xl border`. Keine dieser Flächen ist als Ganzes klickbar.

*Warum es schadet:* Das ist die in `docs/mobil-2026-09/bildpruefung.md` benannte Vorschau und ein doppelter Verstoss: Regel 10 („ein wiederholter Eintrag bekommt keine Karte je Stück") in beiden Dichten, Regel 9 („keine Boxen") in der fokussierten. Der Preis ist messbar — vier Ränder tief verschachtelt, je 16 px, auf der ohnehin schlimmsten Fläche der App; und jeder Rahmen verspricht nach Prinzip 8 eine Aktion, die keiner einlöst.

*Beleg:* `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryPreview.tsx:31,41,76,90`

### Unsicher

1. Zwei gleichzeitige Läufe habe ich am Code belegt (der Anwenden-Knopf hängt am Vorschau-Ladezustand, der Vorschlags-Knopf an gar keinem), aber NICHT im Browser ausgelöst. Ob React-Query in der Praxis zwei Mutationen desselben Hooks wirklich nebenläufig durchlässt, habe ich nicht gemessen — die Folge (der zweite Lauf überschreibt den Undo-Vorrat des ersten) tritt allerdings schon bei zwei NACHEINANDER ausgeführten Läufen ein, und das ist unstrittig.
2. Die Kostenaussage zur Einzelschreibung („N vollständige Lese-Ändern-Schreib-Zyklen“) ist aus dem Code abgeleitet, nicht gemessen. `readAllTransactionChunks()` hat laut ADR-Kommentar einen warmen Cache; wie oft er beim Lauf über tausende Buchungen wirklich warm ist, sagt nur eine Messung (`*.perf.test.ts` steht bereit).
3. Den Befund zur Standard-Kategorie habe ich mit einem Wegwerf-Test gegen den echten Service nachgemessen (Ergebnis im Beleg zitiert) und den Test danach gelöscht — im Repo liegt kein Nachweis, der ihn festhält. Nicht geprüft habe ich, ob ein anderer Weg (Kategorie-Template, Backup-Restore) die Filter einer Standard-Kategorie doch änderbar macht.
4. Ob der Kategorie-Fork bei Bestandsnutzern bereits vorkommt (also doppelte Kategorien in echten Datenbeständen liegen), lässt sich aus dem Quelltext nicht sagen.
5. Nicht in mein Gebiet gefallen und deshalb nur gestreift: die Frage, ob der Undo-Pfad des Chats (`use-kategorie-action.ts`) `confirmed`/`auto_mapped` mit zurücksetzt — der Schnappschuss trägt nur `kategorieId`, und `updateTransaction` setzt bei jeder Kategorieberührung `confirmed: true`. Das sieht nach demselben Muster aus, ich habe es aber nicht zu Ende geprüft.

---

## Kategorien anlegen und bearbeiten — die Bedienung (/settings, Bereich „Kategorien")

### Datenfluss

SCHRITTE ZUM ANLEGEN (gemessen am Quelltext, nicht geschätzt).

Neue Hauptkategorie: (1) /settings öffnen. (2) Zum Abschnitt „Kategorien" scrollen — er steht zwar ganz oben, aber CategoryPreview liegt auf 360 px darunter, weil erst ab 1280 px zweispaltig gesetzt wird (EnhancedSettings.tsx:130). (3) Registerkarte „Erstellen" antippen (CategoryManager.tsx:62). (4) Namen tippen (CategoryForm.tsx:132-140). (5) „Erstellen" antippen (CategoryForm.tsx:451). Also ZWEI Klicks plus Eingabe. Optional davor: eine von 8 Farben (CategoryForm.tsx:145-159) und eines von 18 Symbolen (:164-180), je ein Klick auf ein 32-px-Ziel; Schlüsselwörter je zwei Klicks (Eingabe + Plus, :186-197); das Akkordeon „Erweiterte Eigenschaften (optional)" mit 18 weiteren Feldern (:225-448).

PFLICHT ist nichts. Der Erstellen-Knopf ist immer aktiv, kein Feld trägt required, und ein leerer Name wird in der Datenschicht stillschweigend zu „Kategorie" (local-settings-service.ts:259). Faktisch pflichtig ist genau ein Wert — der Name — und er ist als einziger nicht als solcher markiert. Farbe und Symbol sind vorbelegt, aber mit einer Konstanten, die an vier Stellen im Quelltext wiederholt steht (CategoryManager.tsx:34-35, :43-44, :51, :66 und local-settings-service.ts:272-273): jede neue Kategorie ist erst einmal petrol mit Einkaufswagen.

Unterkategorie: (1) im Baum die Elternzeile finden — im eigenständig scrollenden 448-px-Fenster (CategoryTree.tsx:135). (2) Plus antippen (:87-98). (3) Namen tippen. (4) „Erstellen". Ebenfalls zwei Klicks — aber es ist der EINZIGE Weg, eine Elternkategorie zu setzen, und er geht verloren, wenn vorher eine Kategorie zum Bearbeiten ausgewählt war (siehe Befund).

SCHRITTE ZUM BEARBEITEN. Name, Farbe, Symbol und Schlüsselwörter: Zeile im Baum antippen oder Stift-Knopf (CategoryTree.tsx:57 bzw. :99-110) → Sprung in die Registerkarte „Erstellen" → ändern → „Aktualisieren". Elternkategorie: gar nicht (CategoryManager.tsx:50). Bei einer Standard-Kategorie — und das sind alle 112 mitgelieferten — endet das Speichern entweder in einem Fehler oder in einem Duplikat (local-settings-service.ts:290-303).

WAS DIE APP SELBST WÜSSTE. Rhythmus, Fälligkeitstag und nächste Fälligkeit: contract-derivation.ts:249-254 rechnet den Zyklus aus den Buchungsabständen und prüft ihn über die Streuung gegen den Median; attributes.rhythmus ist dort nur Override. Schlüsselwörter: getTopCategorySuggestion (transaction-service.ts:561-589) und das gelernte Modell kennen bereits die Zahlungsempfänger, aus denen eine Regel entstehen würde — vorgeschlagen wird beim Anlegen nichts. Farbe und Symbol einer Unterkategorie: die Saat erbt beide von der Hauptkategorie (merchant-keywords.ts:938-939), das Formular nicht. Steuerrelevant: folgt aus einer gewählten Steuer-Rubrik. Essenziell: resolveEssenziell erbt bereits über die Elternkette (analysis-data.ts:198-213). Sortierung, Budget und Warnschwelle: müssten gar nicht abgefragt werden, weil sie niemand liest.

DATENFLUSS SPEICHERN. CategoryTree (Tap/Stift) → CategoryManager.handleEditCategoryClick (lokaler Zustand, useEffect-Reset auf [selectedCategory]) → CategoryForm (vollständig kontrolliert, eigener Zustand nur für die zwei Eingabepuffer) → onSave → CategoryManager.handleCategoryFormSave (baut das Partial<Category>, friert parent_id ein) → EnhancedSettings:134 → useSettingsOverview.saveCategory → saveCategoryMutation (id gesetzt → updateCategory, sonst saveCategory) → transaction-service.ts:422/426 → local-settings-service.ts:245/286, beide unter withKeyLock auf LOCAL_CATEGORIES_KEY → AES-GCM in IndexedDB. Rückweg: invalidateQueries(hierarchicalCategories, categorySuggestion) → getHierarchicalCategories → neue categories-Prop. Im selben onSuccess wird selectedCategoryId auf null gesetzt — dort reisst der Faden zur Vorschau.

DATENFLUSS ÜBERNEHMEN. Zwei getrennte Pfade, die die Oberfläche als einen darstellt. Vorschau: CategoryPreview.onPreview → loadPreview → getCategoryPreview(selectedCategoryId) → getAllTransactions + createCategorizer.categorize, gefiltert auf die eine Kategorie, gekappt bei 50 → previewTransactions. Anwenden: CategoryPreview.onApply → recategorize → recategorizeTransactions() ohne Argument → getAllTransactions + createCategorizer.categorizeConfident (Schwelle 0,7), alle Kategorien, bestätigte Buchungen übersprungen → schreibt je Buchung über transactionStorage.updateTransaction und liefert den undo-Schnappschuss zurück, der in React-State landet. Rücknahme: undoRecategorization → restoreCategorization(entries) → setzt category_id und auto_mapped je Buchung zurück. Die Vorschau ist also weder eine Ober- noch eine Untergrenze dessen, was der Knopf daneben tut.

### Befunde — hoch

**Standard-Kategorien lassen sich nicht bearbeiten — jede Änderung erzeugt ein Duplikat oder bricht ab** *(korrektheit)*

updateInKategorien leitet eine is_default-Kategorie an saveInKategorien um, das eine NEUE ID vergibt und `[...categories, next]` schreibt — die Ursprungskategorie bleibt in der Liste. Bleibt der Name gleich, schlägt die Dublettenprüfung an und der Speichervorgang bricht ab; wird umbenannt, stehen danach zwei Kategorien da, und sämtliche Buchungen hängen weiter an der alten. Alle 112 Saat-Kategorien tragen is_default: true, das ist der komplette Ausgangsbestand.

*Warum es schadet:* Der Auftraggeber verlangt intuitives Bearbeiten. Der Bearbeiten-Knopf steht an jeder Zeile des Baums (nur Löschen ist für Standardkategorien ausgeblendet, CategoryTree.tsx:111) — er verspricht also eine Änderung, die die Datenschicht gar nicht ausführen kann. Farbe oder Symbol einer Standardkategorie zu ändern ist ohne Umbenennung schlicht unmöglich; mit Umbenennung entsteht stiller Doppelbestand.

*Beleg:* `src/services/local-settings-service.ts:290-303 (`if (existing?.is_default) return saveInKategorien(categories, {...})`), :264-266 (Dublettenwurf), :268-283 (`id: generateLocalCategoryId()`, `writeLocalCategories([...categories, next])`); src/data/merchant-keywords.ts:929 und :941 (`is_default: true` für Haupt- und Unterkategorien, 112 slug-Einträge); src/components/settings/CategoryTree.tsx:99-110 (Bearbeiten-Knopf ohne is_default-Bedingung)`

**Vorschau und Anwenden rechnen verschieden — was gezeigt wird, ist nicht, was passiert** *(korrektheit)*

getCategoryPreview filtert mit `categorizer.categorize` (jede Konfidenz, auch der 0,55er Regex-Fallback), ohne den confirmed-Filter, und nur auf die EINE gewählte Kategorie. recategorizeTransactions nimmt `categorizeConfident` (Schwelle 0,7), überspringt jede bestätigte Buchung und läuft über ALLE Kategorien. Beide Wege hängen in CategoryPreview an zwei benachbarten Knöpfen.

*Warum es schadet:* Die Forderung lautet: der Nutzer muss vorher sehen, was passiert. Die Vorschau zeigt systematisch zu viel (unsichere Treffer, bestätigte Buchungen) und gleichzeitig zu wenig (nur die eine Kategorie, während der Klick den ganzen Bestand umschreibt). Beide Abweichungen laufen in entgegengesetzte Richtungen, die Liste ist damit weder Ober- noch Untergrenze des Tatsächlichen.

*Beleg:* `src/services/transaction-service.ts:553-556 (`categorizer.categorize(t)`, `t.category_id !== categoryId && newCat === categoryId`) gegen :474-499 (`if (tx.confirmed) continue`, `categorizer.categorizeConfident(tx)`, Schleife über alle Buchungen); src/lib/categorization.ts:301-305 und :347 (`MIN_SILENT_ASSIGN_CONFIDENCE = 0.7`); Verdrahtung src/components/settings/EnhancedSettings.tsx:142 (onPreview) gegen :143 (onApply)`

**Vier Knöpfe, vier verschiedene Versprechen, exakt eine Funktion** *(bedienbarkeit)*

„Regel anwenden", „Anwenden", „Jetzt zuweisen" und „Neu kategorisieren" rufen alle settings.recategorize auf, also denselben globalen Lauf. „Regel anwenden" steht dabei unter dem Satz „{count} Transaktionen könnten zur Kategorie "{category}" passen" und behauptet damit ausdrücklich eine Wirkung auf eine einzelne Kategorie.

*Warum es schadet:* Der Nutzer kann aus keinem der vier Knöpfe ablesen, was er auslöst — und das Ergebnis erscheint bei allen vieren in der Ergebnistafel von BulkAssignment, also in einem ganz anderen Abschnitt einer 19 Bildschirmlängen langen Seite. Zwei der Knöpfe (BulkAssignment) stehen sogar nebeneinander im selben Kasten und tun buchstäblich dasselbe.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:137 (onApplySuggestion), :143 (onApply), :220 (onBulkAssign), :221 (onRecategorize) — alle vier `settings.recategorize`; Beschriftungen src/i18n/translations/de.ts:3501 „Regel anwenden", :1229 „Anwenden", :1218 „Jetzt zuweisen", :1219 „Neu kategorisieren"; Ergebnisanzeige src/components/settings/BulkAssignment.tsx:79-99`

**Rückgängig ist immer anklickbar und überlebt keinen Seitenwechsel** *(korrektheit)*

Der Undo-Knopf in CategoryPreview trägt kein disabled. Das ViewModel berechnet `bulk.canUndo`, EnhancedSettings reicht es aber nicht an CategoryPreview durch. Der Schnappschuss selbst liegt in React-State (useState im Hook) und ist nach Reload, Navigation oder App-Neustart weg — dann antwortet der Knopf nur noch mit dem Fehlertoast „Nichts zum Rückgängigmachen".

*Warum es schadet:* Der Auftraggeber verlangt ausdrücklich, dass eine Übernahme zurücknehmbar ist. Ein Knopf, der immer aktiv aussieht und je nach unsichtbarem Zustand entweder tausende Buchungen zurücksetzt oder gar nichts tut, ist kein Rückweg, sondern ein Glücksspiel. Die Rücknahme überlebt genau so lange wie die Seite geöffnet bleibt — auf dem Telefon ist das die Lebensdauer eines Tab-Wechsels.

*Beleg:* `src/components/settings/CategoryPreview.tsx:120-127 (kein `disabled`, kein canUndo-Prop im Interface Zeile 10-17); src/features/settings/application/use-settings-overview.ts:51 (`useState<CategorizationSnapshotEntry[]>([])`), :214 (`canUndo: undoSnapshot.length > 0`), :224-230 (Fehlertoast bei leerem Schnappschuss); src/components/settings/EnhancedSettings.tsx:139-146 (canUndo wird nicht übergeben)`

**Nach dem Speichern verliert die Vorschau ihre Kategorie — genau an der Naht des geforderten Ablaufs** *(bedienbarkeit)*

saveCategoryMutation.onSuccess setzt selectedCategoryId auf null. Damit steht CategoryPreview unmittelbar nach „Erstellen"/„Aktualisieren" wieder ohne Kategorie da, der Kopfbereich verschwindet, und „Vorschau" antwortet mit „Bitte zuerst eine Kategorie auswählen".

*Warum es schadet:* Der verlangte Ablauf ist: ändern → sehen, was das bewirkt → übernehmen → zurücknehmen können. Genau der Übergang von Schritt 1 zu Schritt 2 wird von der App aktiv abgeräumt. Der Nutzer muss die eben gespeicherte Kategorie im Baum erneut suchen und antippen, um ihre Auswirkung zu sehen — und der Antipper öffnet dabei wieder das Formular (onEdit), nicht die Vorschau.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:94-99 (`setSelectedCategoryId(null)` im onSuccess), :179-183 (loadPreview bricht ohne selectedCategoryId ab); src/components/settings/CategoryPreview.tsx:40 (`{category && ...}`); src/components/settings/CategoryTree.tsx:57 (Tap auf die Zeile ruft onEdit) und src/components/settings/CategoryManager.tsx:52 (onEdit wechselt zur Registerkarte „Erstellen")`

**Die Elternkategorie lässt sich nach dem Anlegen nie wieder ändern** *(bedienbarkeit)*

handleCategoryFormSave sendet beim Bearbeiten immer `selectedCategory.parent_id` — der in Zeile 52 gesetzte newCategoryParentId wird nie gelesen und ausserdem vom useEffect in Zeile 41-48 sofort auf null zurückgesetzt (toter Zustand). CategoryForm besitzt kein Eltern-Feld; parentId ist eine reine Anzeige-Prop.

*Warum es schadet:* Eine falsch einsortierte Kategorie kann nur noch gelöscht und neu angelegt werden — und beim Löschen räumt der Dienst Budgets und Händlerregeln mit ab (use-settings-overview.ts:111-120). Die Hierarchie ist damit faktisch unveränderlich, obwohl sie über Vererbung von essenziell und ausgabenklasse jede Auswertung mitbestimmt.

*Beleg:* `src/components/settings/CategoryManager.tsx:50 (`parent_id: selectedCategory ? selectedCategory.parent_id : newCategoryParentId`), :52 (setzt newCategoryParentId, das nie gelesen wird), :41-48 (useEffect setzt es auf null); src/components/settings/CategoryForm.tsx:21 und :123-130 (parentId nur als Hinweiskasten, kein Bedienelement)`

**„Unterkategorie anlegen" fällt auf die oberste Ebene zurück, wenn vorher eine Kategorie bearbeitet wurde** *(korrektheit)*

onAddSubcategory setzt im selben Batch setSelectedCategory(null) und setNewCategoryParentId(parentId). War vorher eine Kategorie ausgewählt, ändert sich damit die useEffect-Abhängigkeit [selectedCategory], der Effekt läuft nach dem ersten Render und setzt newCategoryParentId auf null zurück. Der Hinweiskasten „Wird als Unterkategorie angelegt" blitzt einmal auf und verschwindet; die Kategorie wird auf oberster Ebene angelegt.

*Warum es schadet:* Reproduzierbarer stiller Datenfehler in genau dem Ablauf, den ein Nutzer natürlich wählt: erst eine Kategorie ansehen, dann darunter eine neue anlegen. Es gibt keine Fehlermeldung, und weil die Elternkategorie danach nicht mehr änderbar ist (vorheriger Befund), ist der Fehler nur durch Löschen und Neuanlegen zu beheben.

*Beleg:* `src/components/settings/CategoryManager.tsx:66 (onAddSubcategory-Handler), :41-48 (useEffect mit Abhängigkeit [selectedCategory], Zeile 47 `setNewCategoryParentId(null)`), :69 (parentId-Prop leitet sich daraus ab)`

**Elf der 22 Formularfelder haben in der ganzen App keinen Leser** *(architektur)*

sort_index, budget_monat, warnschwelle_prozent, faelligkeitstag, next_due_date, kuendigungsfrist_tage, vertragsende, zahlungsweg, fixkosten, sichtbar und archiviert kommen als Kategorie-Attribut ausser in CategoryForm.tsx und category-types.ts nirgends im Quelltext vor — nicht in src/, nicht in supabase/, api/, services/ oder mcp-poc/. Die Namensgleichheit mit gelesenen Feldern anderer Entitäten (ContractRecord.kuendigungsfrist_tage, Transaction.fixkosten) verdeckt das.

*Warum es schadet:* Die Hälfte des Formulars fragt Daten ab, die nichts bewirken. „Archiviert" archiviert nicht, „Budget" ist nicht das Budget des Budgetsystems, „Sichtbar" blendet nichts aus, „Sortierung" sortiert nichts. Das ist der Hauptgrund, warum das Anlegen einer Kategorie überfordernd wirkt — und AGENTS.md §3 („Eine Datengrundlage ohne Erzeuger ist keine", hier gespiegelt: ein Erzeuger ohne Verbraucher) benennt genau diese Bauform als Befund.

*Beleg:* `src/components/settings/CategoryForm.tsx:397-404 (sort_index), :376-382 (budget_monat), :385-394 (warnschwelle_prozent), :327-336 (faelligkeitstag), :339-345 (next_due_date), :348-356 (kuendigungsfrist_tage), :359-365 (vertragsende), :301-312 (zahlungsweg), :49 (fixkosten), :52 (sichtbar), :53 (archiviert). Gegenprobe: `grep -rn` über src/ ohne Tests/i18n liefert für sort_index, budget_monat, warnschwelle_prozent, faelligkeitstag und next_due_date genau null Treffer ausserhalb dieser Datei und src/lib/category-types.ts:21-48`

**Das eine Feld, das die App wirklich auswertet, fehlt im Formular: ausgabenklasse** *(korrektheit)*

attributes.ausgabenklasse ist laut Typ die „oberste Aggregationsebene" und hat 13 Lesestellen (Filter, Sunburst-Innenring, Dashboard-Filterung). Gesetzt wird sie ausschliesslich in den Saatdaten. CategoryForm bietet kein Bedienelement dafür. resolveAusgabenklasse erbt nur über parent_id nach oben — eine selbst angelegte HAUPTkategorie bleibt damit dauerhaft ohne Klasse.

*Warum es schadet:* Jede selbst angelegte Hauptkategorie fällt aus dem Ausgabenklasse-Filter und dem Innenring der Aufschlüsselung heraus, ohne dass irgendwo etwas darauf hinweist. Der Nutzer sieht seine eigene Kategorie in der Liste, aber die Auswertung übergeht sie — genau die stille Falschaussage, die AGENTS.md §3 verbietet.

*Beleg:* `src/lib/category-types.ts:14-19 und :31 (Kommentar „Vorgelagerte Ausgabenklasse … oberste Aggregationsebene"); src/data/merchant-keywords.ts:931 und :945 (einzige Schreibstellen); src/lib/analysis-data.ts:176-190 (resolveAusgabenklasse erbt nur über parent_id, sonst null); src/components/settings/CategoryForm.tsx (kein Vorkommen von `ausgabenklasse` in der ganzen Datei); src/components/dashboard/AusgabenklasseFilter.tsx:37`

**Dreistufige Kategorien lassen sich anlegen, aber danach keiner Buchung mehr zuordnen** *(korrektheit)*

CategoryTree bietet „+ Unterkategorie" auf JEDER Zeile, auch auf Unterkategorien, und getCategoryLevel läuft beliebig tief. CategoryTwoStepSelect kennt aber genau zwei Stufen: es setzt mainId auf den ROOT-Vorfahren und subId auf die Enkel-ID, listet in der Unterauswahl aber nur die direkten Kinder der Hauptkategorie. Die Enkelkategorie steht damit nicht in der Liste.

*Warum es schadet:* Die einzigen beiden Stellen, an denen ein Nutzer einer Buchung eine Kategorie zuweist (Detailfenster und Aufteilung), zeigen eine bereits gesetzte Enkelkategorie nicht an und verwerfen sie beim nächsten Antippen stillschweigend. Die Verwaltung erlaubt also eine Struktur, die der Rest der App nicht bedienen kann.

*Beleg:* `src/components/settings/CategoryTree.tsx:87-98 (Plus-Knopf ohne Tiefenbegrenzung) und :20-28 (getCategoryLevel läuft die ganze Kette); src/components/categories/CategoryTwoStepSelect.tsx:51-61 (getRootAncestorId), :96 (`childrenByParent.get(mainId)` = nur direkte Kinder), :103-105 (setzt subId auf die Enkel-ID), :142-149 (SelectItems nur aus `children`); Aufrufstellen src/components/dashboard/TransactionDetailsPanel.tsx:351, src/components/transactions/TransactionSplitPanel.tsx:243`

**Bestätigt: CategoryPreview ist Karte-in-Karte-in-Liste-mit-Karte-je-Zeile** *(darstellung)*

Vier Rahmenebenen in einer 130-Zeilen-Datei: äussere Card, darin ein Kartenkasten für die Kategorie, darin eine zweite Card um die Trefferliste, darin je Buchung noch ein gerahmter Kasten. Keine dieser Flächen ist als Ganzes klickbar. Mit dem repo-eigenen Wächterkern gezählt: CategoryPreview 7 Kartenrahmen, CategoryManager 4, CategoryForm 1, EnhancedSettings 2 — 14 allein für den Kategorienbereich.

*Warum es schadet:* Regel 10 verbietet beide Formen wörtlich: „Eine Liste bekommt keine Karte um sich" (Zeile 76) und „Ein wiederholter Eintrag bekommt keine Karte je Stück" (Zeile 90). §9 verlangt zusätzlich, dass Karten-Chrome eine Aktion verspricht — hier verspricht es viermal übereinander nichts. Auf 360 px kostet allein diese Schachtelung 8×16 px Rand je Buchungszeile.

*Beleg:* `src/components/settings/CategoryPreview.tsx:31 (`<Card>`), :41 (`rounded-2xl border border-border bg-card p-4`), :76 (`<Card className="border border-border bg-card">`), :87 (`<ScrollArea className="h-64">`), :90 (`rounded-xl border border-border bg-card p-3` je Buchung). Zählung nachgerechnet mit scripts/card-rule-core.mjs `zaehleKartenrahmen`: CategoryPreview.tsx 7, CategoryManager.tsx 4, CategoryForm.tsx 1, CategoryTree.tsx 0, EnhancedSettings.tsx 2`

**Farb- und Symbolwahl sind 32-px-Ziele — und der Tippziel-Wächter kann sie strukturell nicht sehen** *(darstellung)*

Die 8 Farb- und 18 Symbolknöpfe sind rohe `<button>` mit `w-8 h-8` und ohne min-h. §9 verlangt 44 px. `pnpm check:touch-targets` meldet trotzdem 0, weil touch-target-core.mjs die Attribute nur bis zum ersten `>` liest — und die Pfeilfunktion in `onClick={() => …}` steht eine Zeile VOR dem className und schneidet ihn ab.

*Warum es schadet:* 26 Bedienelemente mit 32-px-Trefferbereich in genau dem Formular, das laut Auftrag intuitiv sein soll — bei 4 px Abstand im Raster. Schlimmer ist die Wächterlücke: die Ratsche steht auf 0 und behauptet damit, es gebe keinen Rückfall mehr, während jede Fundstelle mit einer Inline-Pfeilfunktion unsichtbar bleibt. Das ist dieselbe Bauform, die AGENTS.md an check:money-format und check:type-scale bereits als Befund führt.

*Beleg:* `src/components/settings/CategoryForm.tsx:147-157 (Farbe, `w-8 h-8`, onClick in Zeile 150 vor className in Zeile 151) und :165-179 (Symbol, gleiche Bauform); scripts/touch-target-core.mjs:157 (`const ende = text.indexOf('>', treffer.index)`). Nachgewiesen: `findeKleineTippziele` auf CategoryForm.tsx liefert nur die beiden `<Button size="sm">`; derselbe Knopf ohne Pfeilfunktion wird mit 32 px gemeldet, mit Pfeilfunktion gar nicht`

**Kategorien lassen sich in der ganzen App an genau einer Stelle anlegen — nicht dort, wo der Bedarf entsteht** *(bedienbarkeit)*

Einziger Aufrufer von saveCategory ist EnhancedSettings.tsx:134. Die beiden Stellen, an denen ein Nutzer einer Buchung eine Kategorie zuweist, bieten nur die vorhandenen an — kein „neu anlegen", kein Freitext.

*Warum es schadet:* Der Moment, in dem jemand eine neue Kategorie braucht, ist der Moment, in dem eine Buchung in keine passt. Von dort führt kein Weg: erst /settings öffnen, dort 19 Bildschirmlängen scrollen, Registerkarte wechseln, anlegen, zurücknavigieren, Buchung wiederfinden. Das ist der grösste einzelne Grund, warum Kategorien-Anlegen nicht intuitiv ist.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:134 (einziger `onCategorySave`); src/components/dashboard/TransactionDetailsPanel.tsx:351 und src/components/transactions/TransactionSplitPanel.tsx:243 (nur CategoryTwoStepSelect, dessen Props-Interface in src/components/categories/CategoryTwoStepSelect.tsx:8-15 keinen Anlege-Rückruf kennt)`

### Befunde — mittel

**Die Fehlermeldung, die den Grund nennt, wird auf dem Weg zur Oberfläche verworfen** *(bedienbarkeit)*

Die Datenschicht wirft „Eine Kategorie mit diesem Namen existiert bereits". Der onError-Zweig der Mutation ignoriert den Fehler und zeigt pauschal „Fehler beim Speichern".

*Warum es schadet:* Der häufigste Fehlschlag beim Anlegen ist der Namenskonflikt — und er ist der einzige, den der Nutzer selbst beheben kann. Ihm stattdessen „Fehler beim Speichern" zu zeigen, macht aus einer Zwei-Sekunden-Korrektur eine Sackgasse. Verschärft wird das durch den vorherigen Befund: beim Bearbeiten einer Standardkategorie ist dieser Wurf der Regelfall, nicht der Ausnahmefall.

*Beleg:* `src/services/local-settings-service.ts:264-266 und :309-314 (`throw new Error(t("localSettingsService.categoryNameExists"))`, Text src/i18n/translations/de.ts:1167); src/features/settings/application/use-settings-overview.ts:100 (`onError: () => showError(t('settings.saveFailed', 'Fehler beim Speichern'))`)`

**Ein leerer Name wird stillschweigend zu „Kategorie" — der zweite Versuch scheitert dann unerklärt** *(bedienbarkeit)*

Weder CategoryForm noch die Mutation prüfen den Namen; der Erstellen-Knopf ist immer aktiv. Die Datenschicht ersetzt einen leeren Namen durch „Kategorie". Beim zweiten leeren Anlegeversuch greift dann die Dublettenprüfung — mit der pauschalen Meldung aus dem vorigen Befund.

*Warum es schadet:* Der einzige wirklich verpflichtende Wert des Formulars ist nirgends als Pflicht markiert und wird bei Verstoss stillschweigend erfunden. Der Nutzer bekommt eine Kategorie, die er nicht benannt hat, und beim Wiederholen einen Fehler ohne Grund.

*Beleg:* `src/components/settings/CategoryForm.tsx:132-140 (kein required, kein aria-required) und :450-453 (`onClick={onSave}` ohne Bedingung); src/components/settings/CategoryManager.tsx:50 (reicht formName ungeprüft durch); src/services/local-settings-service.ts:259 (`const name = category.name || t("localSettingsService.defaultCategoryName")`, Text src/i18n/translations/de.ts:1166 = 'Kategorie')`

**„… und {count} weitere" nennt eine Zahl, die nicht die Wahrheit sein kann** *(korrektheit)*

getCategoryPreview kappt bei 50 Treffern. Die Vorschau zeigt 10 davon und rechnet den Rest als `affectedTransactions.length - 10`. Bei 500 betroffenen Buchungen steht dort „… und 40 weitere".

*Warum es schadet:* Genau die Zahl, an der der Nutzer die Tragweite der Übernahme abschätzen soll, ist bei jedem grösseren Bestand um Grössenordnungen zu klein. AGENTS.md §3 verlangt: keine Zahl ohne Rückweg, und eine genannte Zahl muss dieselbe Menge meinen wie die verlinkte Liste. Das Limit ist ausserdem ein Zahlenliteral in der Signatur — dieselbe Bauform, die check:transaction-limits an anderer Stelle verbietet, weil ein Ausschnitt wie ein Bestand aussieht.

*Beleg:* `src/services/transaction-service.ts:544 (`limit: number = 50`) und :558 (`return affected.slice(0, limit)`); src/components/settings/CategoryPreview.tsx:89 (`.slice(0, 10)`) und :105-108 (`String(affectedTransactions.length - 10)`); Text src/i18n/translations/de.ts:1232`

**Zwei Bedienelemente für dieselbe Aussage, mit wortgleicher Beschriftung** *(bedienbarkeit)*

Die Checkbox `essenziell` und der Auswahlwert `prioritaet = 'essential'` tragen denselben i18n-Schlüssel als Beschriftung und werden nicht synchronisiert — sie können sich widersprechen. Dasselbe Muster bei `steuerrelevant` neben `default_tax_category_id`: eine gewählte Steuer-Rubrik impliziert Steuerrelevanz, setzt das Häkchen aber nicht.

*Warum es schadet:* Der Nutzer sieht in einem Formular zweimal das Wort „Essenziell" mit zwei verschiedenen Bedienformen und keinem Hinweis, welche zählt (es ist die Checkbox: resolveEssenziell liest nur `essenziell`). Und er kann eine Steuer-Rubrik hinterlegen, ohne dass die Kategorie steuerrelevant wird — die Rubrik ist dann folgenlos.

*Beleg:* `src/components/settings/CategoryForm.tsx:50 (`{ key: 'essenziell', labelKey: 'categoryForm.propertyEssential' }`) gegen :294 (`<SelectItem value="essential">{t('categoryForm.propertyEssential')}</SelectItem>`); :51 (steuerrelevant) gegen :254-261 (TaxCategorySelect ohne Kopplung); Leser src/lib/analysis-data.ts:198-213 (liest ausschliesslich `essenziell`)`

**Die Checkbox kann „erben" nicht ausdrücken und kappt die Vererbung beim ersten Antippen** *(korrektheit)*

resolveEssenziell kennt drei Zustände: true, false und undefined = von der Elternkategorie erben. CategoryForm rendert zwei (`Boolean(attributes[key])`). Eine neue Unterkategorie zeigt „nicht essenziell", ist effektiv aber essenziell, wenn die Elternkategorie es ist; einmal an- und wieder ausschalten schreibt ein explizites false und trennt die Vererbung dauerhaft.

*Warum es schadet:* Die Anzeige widerspricht der Auswertung, und der Nutzer kann den ursprünglichen Zustand nicht wiederherstellen — es gibt kein Bedienelement, das zu undefined zurückführt. Das trifft ausgerechnet das Attribut, das über die Essenziell-Sicht des ganzen Dashboards entscheidet.

*Beleg:* `src/components/settings/CategoryForm.tsx:110-113 (`isCheckboxChecked`, Sonderfall nur für `sichtbar`) und :242-246 (`onAttributesChange({ [field.key]: Boolean(value) })`); src/lib/analysis-data.ts:198-213 (`if (current.attributes?.essenziell !== undefined)` — undefined bedeutet erben)`

**Rhythmus und Fälligkeit werden abgefragt, obwohl die App sie bereits ableitet** *(architektur)*

computeContracts leitet den Zyklus aus den mittleren Tagesabständen der Buchungen ab (getCycleFromDays) und prüft ihn über die Streuung gegen den Median. attributes.rhythmus ist dort ein reiner Override und wirkt nur, wenn ist_vertrag gesetzt ist. Die drei benachbarten Vertragsfelder (Fälligkeitstag, nächste Fälligkeit, Kündigungsfrist) liest niemand.

*Warum es schadet:* AGENTS.md §3 „Berechne, was berechenbar ist" nennt die Vertragsableitung über Median, Streuung und Zyklus ausdrücklich als Ebene 2. Das Formular verlangt vom Nutzer trotzdem Handarbeit an einer Grösse, die deterministisch aus seinem Bestand folgt — und bietet ihm dabei nicht einmal den abgeleiteten Wert als Vorbelegung an.

*Beleg:* `src/lib/contract-derivation.ts:249-254 (Abstände, avgDays, `getCycleFromDays`), :256-261 (`attributes.rhythmus` nur als Override und nur bei `explicit`), :263-266 (Streuungstoleranz); src/components/settings/CategoryForm.tsx:273-286 (Rhythmus-Auswahl ohne Vorschlag), :327-356 (Fälligkeitstag, nächste Fälligkeit, Kündigungsfrist)`

**Das Formular sagt nie, unter welcher Kategorie es anlegt — und behauptet beim Bearbeiten das Falsche** *(bedienbarkeit)*

Der Hinweiskasten zeigt „Wird als Unterkategorie angelegt" / „Diese Kategorie wird einer bestehenden Hauptkategorie untergeordnet." — ohne den Namen der Elternkategorie. Beim Bearbeiten einer bestehenden Unterkategorie erscheint derselbe Zukunftssatz, während die Überschrift darüber „Kategorie bearbeiten" sagt. Die aktive Registerkarte heisst dabei „Erstellen".

*Warum es schadet:* Der Nutzer tippt in einem eigenständig scrollenden Baum auf ein Plus, springt in eine andere Registerkarte und erfährt dort nicht, worunter er anlegt. Beim Bearbeiten widersprechen sich Registerkarte („Erstellen"), Überschrift („Kategorie bearbeiten") und Hinweiskasten („wird angelegt") auf demselben Bildschirm.

*Beleg:* `src/components/settings/CategoryForm.tsx:123-130 (Kasten ohne Elternnamen), :118-120 (Überschrift unterscheidet Bearbeiten/Anlegen, der Kasten darunter nicht); Texte src/i18n/translations/de.ts:3017-3018; src/components/settings/CategoryManager.tsx:52 (`setActiveTab('create')` beim Bearbeiten), :62 (Registerkarte „Erstellen", de.ts:3495)`

**Auf dem Telefon stehen Formular und Auswirkung über tausend Pixel und drei Scrollebenen auseinander** *(darstellung)*

Der Kategorienbereich ist erst ab 1280 px zweispaltig. Auf 360 px steht CategoryPreview unter dem gesamten CategoryManager: Registerleiste, Suchfeld, Baum mit eigenem 448-px-Scrollfeld, Vorschlagskarte, danach das Formular oder die Vorschau. Innerhalb der Vorschau scrollt nochmals eine 256-px-ScrollArea.

*Warum es schadet:* Der Nutzer kann auf dem Telefon nie gleichzeitig sehen, was er ändert, und was das bewirkt — die Forderung „vorher sehen, was passiert" scheitert schon an der Anordnung. Dazu drei ineinander geschachtelte Scrollflächen auf einer Fläche, die insgesamt 19 Bildschirmlängen misst; Regel 9 verlangt einen Bildschirm und höchstens drei Aussagen.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:130 (`grid grid-cols-1 gap-6 xl:grid-cols-2`), :124-148 (Kategorienbereich vollständig offen, kein Detailschritt); src/components/settings/CategoryTree.tsx:135 (`max-h-[28rem] … overflow-y-auto`); src/components/settings/CategoryPreview.tsx:87 (`<ScrollArea className="h-64">`); einziges Akkordeon der Seite: EnhancedSettings.tsx:283-299 („Technischer Status")`

### Befunde — niedrig

**Debug-Auswurf und ein toter Zweig im Kategorie-Auswahlfeld** *(architektur)*

CategoryTwoStepSelect schreibt bei jedem Kategorienwechsel die vollständige Hierarchie in ein globales window-Feld und gibt console.warn aus. Der Kommentar darüber behauptet, es werde „im LocalStorage" gespeichert — es ist ein window-Global. Zusätzlich hat handleMainChange einen Ternär, dessen beide Zweige identisch sind.

*Warum es schadet:* Produktivcode einer local-first-App, der den kompletten Kategorienbaum des Nutzers samt IDs in ein von jedem Skript lesbares globales Feld legt, ohne dass irgendetwas ihn liest. Der falsche Kommentar schickt den nächsten Leser an die falsche Stelle; der tote Ternär täuscht eine Fallunterscheidung vor, die es nicht gibt.

*Beleg:* `src/components/categories/CategoryTwoStepSelect.tsx:69-94 (`(window as unknown as Record<string, unknown>).__DEBUG_CATEGORY_HIERARCHY__ = hierarchyInfo`, zwei console.warn), :114 (`onChange(kids.length === 0 ? nextMainId : nextMainId)`)`

### Unsicher

1) Ich habe das Verhalten beim Bearbeiten einer Standard-Kategorie statisch hergeleitet (local-settings-service.ts:290-303 ruft saveInKategorien mit derselben, noch vollständigen categories-Liste; die Dublettenprüfung in Zeile 264 sieht die Ursprungskategorie also mit). Es gibt dafür KEINEN Test im Repo — ich habe die Suite nicht laufen lassen und keinen Test geschrieben. Ein [REGRESSION]-Test wäre der nächste Schritt, um die Herleitung zu belegen statt zu behaupten.

2) Die Reihenfolge „Batch-Update, dann useEffect" beim Verlust der Elternkategorie (CategoryManager.tsx:66 gegen :41-48) folgt aus dem React-18-Batching und der Abhängigkeitsliste. Ich habe sie nicht im Browser nachgestellt. Sicher ist, dass Zeile 47 newCategoryParentId bedingungslos auf null setzt, sobald sich selectedCategory ändert; unsicher ist nur, ob es in jedem Fall ein sichtbares Aufblitzen gibt oder direkt den Endzustand.

3) Die Aussage „elf Felder ohne Leser" stützt sich auf Namenssuche über src/, supabase/, api/, services/, mcp-poc/ und e2e-tests/, ohne Tests und i18n-Bäume. Ein Zugriff über Destrukturierung mit Umbenennung oder über einen dynamischen Schlüssel würde mir entgehen. Für sort_index, budget_monat, warnschwelle_prozent, faelligkeitstag und next_due_date gibt es ausserhalb von CategoryForm.tsx und category-types.ts null Treffer überhaupt — da halte ich den Befund für sicher; bei fixkosten, sichtbar und archiviert ist die Namensgleichheit mit Feldern anderer Entitäten grösser, dort habe ich nur die Attribut-Zugriffsform (`attributes.x` / `attributes?.x`) gezählt.

4) Ob die 14 Kartenrahmen dieses Bereichs die globale Ratsche (card-rule-budget.json, max 149) tatsächlich reissen würden, habe ich nicht nachgerechnet — ich habe nur die Dateien einzeln durch den Wächterkern geschickt.

5) Die Aussage zu dreistufigen Kategorien in CategoryTwoStepSelect ist aus dem Code hergeleitet (subId wird auf die Enkel-ID gesetzt, die SelectItems kommen aber aus childrenByParent.get(rootId)). Ich habe nicht geprüft, ob der Bestand heute überhaupt dreistufige Kategorien enthält — die Saat ist zweistufig, die Struktur entsteht erst durch Nutzerhand über den Plus-Knopf.

---

## Was ein Umbau von /settings mitziehen muss: Tests, Ratschen, E2E-Schritte

### Datenfluss

Heute: SettingsPage.tsx (7 Zeilen) → EnhancedSettings.tsx → useSettingsOverview() (features/settings/application). Das ViewModel hält drei Abfragen (userSettings, hierarchicalCategories, categorySuggestion), fünf Mutationen und vier Stücke lokalen React-Zustand: previewTransactions, undoSnapshot, bulkStatus, bulkResults (Zeilen 50-54). EnhancedSettings reicht daraus Props an elf Abschnitte; zehn weitere Bausteine (BackupManager, HouseholdSettings, PrivacySyncAnalyticsSettings, AppearanceSettings, NavFeatureSettings, TaxReserveSettings, PerformanceDashboard, DangerZoneSettings, LocalEncryptionSettings, TelemetrySettings) holen ihre Daten weiterhin selbst — 29 der 204 view-data-Zugriffe der App.

Der Kategorie-Kreislauf ist der kritische Pfad und heute an zwei Stellen gebrochen. Lesen: getCategoryPreview(selectedCategoryId) → categorizer.categorize, ohne confirmed-Filter, gekappt bei 50, angezeigt 10. Schreiben: recategorizeTransactions() → categorizer.categorizeConfident, überspringt jede confirmed-Buchung, liefert die Vorwerte als undo-Liste zurück. Die beiden rechnen also über verschiedene Mengen — die Vorschau ist keine Vorschau der Tat. Zurück: restoreCategorization(undoSnapshot), erreichbar über genau einen Knopf im Abschnitt „Kategorien\", während drei der vier Auslöser der Tat woanders sitzen; der Vorrat lebt nur im Speicher der gemounteten Fläche.

Was ein Umbau mitzieht: 22 Testdateien mit rund 110 Fällen (13 unter src/components/settings/__tests__/, 5 BackupManager-Dateien, SettingsPage.error-state, 3 Slice-Dateien), dazu layout-overlap.sweep (rendert SettingsPage in beiden Viewports inklusive Portale) und tutorial-anchors-exist. Auf E2E-Seite zwei benannte Specs (local-encryption, backup-roundtrip) plus drei stille über ALL_ROUTES (all-screens-a11y, -performance, -shots) und die geteilte Fixture openViaNav. Sechs Ratschen bewegen sich: view-data 204 (29 aus dem Bereich), card-rule 149/2 (76 aus dem Bereich, davon 33 in den vier von der Bildprüfung genannten Dateien), slice-presentation 11/0 (jeder gemessene Zuschnitt hebt sie: +23, +7 oder +5), state-coverage (der Eintrag „leer entfällt\" trägt nicht mehr), query-errors (0 offen — jede nachgeladene Abfrage ist sofort blockierend) und i18n (ein Pfad in der Allowlist, der beim Umzug mitmuss).

Konkrete E2E-Schritte, die sich ändern müssen, wenn die Abschnitte hinter einem Verzeichnis liegen: (1) local-encryption 42-46 — nach openViaNav ein Schritt „Zeile Verschlüsselung öffnen\" per KLICK, nicht per goto, weil ein Reload den Tresor sperrt; der Status („noch nicht eingerichtet\"/„aktiv und entsperrt\") bleibt laut Zielbild eine der drei Hauptaussagen und kann vor dem Öffnen geprüft werden, das Einrichtungsformular nicht. (2) local-encryption 54-55 — der zweite openViaNav kehrt bei offenem Detailschritt zu früh zurück; Sperren liegt hinter demselben Schritt. (3) backup-roundtrip 48 — der .ui-card-Selektor muss auf Rolle/Überschrift umgestellt werden, weil Regel 9 das Chrome abschafft. (4) backup-roundtrip 52-54 — Backup-Passwort und Download hinter „Zeile Sicherung öffnen\". (5) backup-roundtrip 61-63 — die Gefahrenzone ist ein ANDERER Detailschritt; der Test muss den ersten schliessen und den zweiten öffnen, statt weiterzuklicken. (6) backup-roundtrip 80-82 — nach dem Reload denselben Öffnen-Schritt erneut, dann erst der Wiederherstellen-Dialog. (7) all-screens-a11y und all-screens-shots müssen die elf Detailschritte aufzählen, sonst prüft axe nach dem Umbau ein leeres Verzeichnis und die Bildprüfung meldet eine vorbildliche Fläche, deren Inhalt bloss ungesehen umgezogen ist.

### Befunde — hoch

**Vorschau und Übernahme rechnen mit verschiedenen Regeln — die Vorschau zeigt eine Obermenge dessen, was passiert** *(korrektheit)*

`getCategoryPreview` (src/services/transaction-service.ts:544-559) sammelt die betroffenen Buchungen mit `categorizer.categorize(t)` und fragt `t.confirmed` NIE ab. `recategorizeTransactions` (src/services/transaction-service.ts:474-497) überspringt jede bestätigte Buchung (`if (tx.confirmed) { … continue; }`, Zeile 477-481) und benutzt `categorizer.categorizeConfident(tx)` (Zeile 483), das laut src/lib/categorization.ts:302-305 nur ab `MIN_SILENT_ASSIGN_CONFIDENCE` überhaupt eine Kategorie liefert. Beide Wege hängen in EnhancedSettings.tsx an derselben Fläche: `onPreview` (Zeile 142) gegen `onApply` (Zeile 143).

*Warum es schadet:* Der Auftraggeber verlangt ausdrücklich: „der Nutzer muss vorher sehen, was passiert". Er sieht es nicht — er sieht eine andere Menge, berechnet mit einem anderen Prädikat. Die Vorschau nennt Buchungen, die der Klick nachweislich nicht anfasst (bestätigte, und solche unter der Confidence-Schwelle). Das ist kein Anzeigefehler, sondern eine falsche Zusage vor einer Schreiboperation. Ein Umbau, der die beiden nur in getrennte Detailschritte legt, zementiert den Widerspruch, statt ihn zu lösen — und danach sieht man ihn nicht einmal mehr nebeneinander.

*Beleg:* `src/services/transaction-service.ts:544-559 (categorize, kein confirmed-Filter) vs. src/services/transaction-service.ts:474-497 (categorizeConfident, confirmed übersprungen); src/lib/categorization.ts:302-305; src/components/settings/EnhancedSettings.tsx:139-146`

**Die Vorschau ist bei 50 gedeckelt, zeigt 10, und rechnet daraus eine Gesamtzahl aus** *(korrektheit)*

`getCategoryPreview(categoryId, limit = 50)` schneidet mit `affected.slice(0, limit)` ab (src/services/transaction-service.ts:544, 558). `CategoryPreview` rendert davon `affectedTransactions.slice(0, 10)` (src/components/settings/CategoryPreview.tsx:89) und schreibt darunter „+{count} weitere" aus `affectedTransactions.length - 10` (Zeile 105-108). Der angezeigte Rest kann also nie grösser als 40 sein, egal wie viele Buchungen betroffen sind. Der Kappungs-Wächter greift hier nicht: scripts/transaction-limits-core.mjs prüft ausschliesslich Literale als erstes Argument von `getTransactions(` — hier läuft die Kappung über `getAllTransactions()` plus `.slice()`.

*Warum es schadet:* Das ist genau der Befund, gegen den `check:transaction-limits` gebaut wurde („Ein Ausschnitt sieht aber aus wie ein Bestand"), an einer Stelle, die der Wächter per Konstruktion nicht sieht — und er steht ausgerechnet vor der einzigen Schreiboperation, die der Nutzer vorher beurteilen soll. Wer 300 betroffene Buchungen hat, liest „+40 weitere" und bestätigt.

*Beleg:* `src/services/transaction-service.ts:544 und :558; src/components/settings/CategoryPreview.tsx:89 und :105-108; scripts/transaction-limits-core.mjs (Prüfmuster nur `getTransactions(`)`

**Vier Knöpfe lösen dieselbe Schreiboperation aus, das einzige Zurück liegt in einem anderen Abschnitt und ist nie gesperrt** *(bedienbarkeit)*

`settings.recategorize` hängt viermal in der Fläche: `onApplySuggestion` (EnhancedSettings.tsx:137), `onApply` (Zeile 143), `onBulkAssign` (Zeile 220) und `onRecategorize` (Zeile 221). Die letzten beiden sind zwei Knöpfe in EINEM Baustein mit verschiedenen Beschriftungen und verschiedenen Sperrbedingungen (BulkAssignment.tsx:51-67 gegen :68-76). Das Zurücknehmen gibt es genau einmal — `onUndo` in CategoryPreview (EnhancedSettings.tsx:144), also im Abschnitt „Kategorien", während drei der vier Auslöser woanders sitzen. Der Zurück-Knopf ist nie `disabled` (CategoryPreview.tsx:120-127), obwohl das ViewModel `bulk.canUndo` bereitstellt (use-settings-overview.ts:213) — niemand liest es; ohne Vorrat gibt es nur einen Fehler-Toast (use-settings-overview.ts:225-228).

*Warum es schadet:* „Übernehmen" ist heute nicht eine Handlung mit einer Rücknahme, sondern vier Handlungen mit einer versteckten Rücknahme. Auf 19 Bildschirmlängen ist der Rückweg schon jetzt ausser Sicht; hinter einem Verzeichnis liegt er dann in einem anderen Detailschritt als die Tat. Ein Knopf, der immer klickbar aussieht und in der Hälfte der Fälle nur einen Fehler zeigt, ist genau das „tote Klickversprechen", das §9 verbietet — hier auf der gefährlichsten Aktion der Fläche.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:137, :143, :144, :220-221; src/components/settings/BulkAssignment.tsx:51-76; src/components/settings/CategoryPreview.tsx:120-127; src/features/settings/application/use-settings-overview.ts:213 und :225-228`

**Rücknahme-Vorrat und Kategorieformular leben im React-Zustand — ein Detailschritt als Sheet löscht beides beim Schliessen** *(architektur)*

`undoSnapshot`, `previewTransactions` und `bulkResults` sind `useState` im ViewModel (src/features/settings/application/use-settings-overview.ts:50-54). `CategoryManager` hält Suchtext, Register, ausgewählte Kategorie und den kompletten Formularinhalt lokal (src/components/settings/CategoryManager.tsx:28-37), `CategoryPreview` hält `showPreview` lokal (CategoryPreview.tsx:28). Der vorgesehene Baustein für den Detailschritt ist ein Radix-Sheet ohne `forceMount` (src/features/shared/presentation/DetailSchritt.tsx:37-46) — geschlossen wird der Inhalt ausgehängt. Geschlossen wird er unter anderem über die Zurücktaste, weil `useDetailParam` beim Öffnen einen Verlaufseintrag anlegt (src/features/shared/presentation/useDetailParam.ts:45).

*Warum es schadet:* Die Zurücktaste ist auf dem Telefon der häufigste Handgriff — das steht so in Regel 9b. Nach dem Umbau löscht sie ein halb ausgefülltes Kategorieformular, ohne zu fragen. Und wenn das ViewModel je Detailschritt gemountet wird statt einmal im Verzeichnis, ist nach dem Schliessen auch der Rücknahme-Vorrat weg: „danach zurücknehmen können" endet dann an der Zurücktaste. Wo das ViewModel hängt, ist damit keine Aufräumfrage, sondern die Bedingung für die Zusage des Auftraggebers — und sie muss im Umbau ausdrücklich entschieden werden.

*Beleg:* `src/features/settings/application/use-settings-overview.ts:50-54; src/components/settings/CategoryManager.tsx:28-37; src/components/settings/CategoryPreview.tsx:28; src/features/shared/presentation/DetailSchritt.tsx:37-46; src/features/shared/presentation/useDetailParam.ts:45`

**state-coverage-allowlist: „/settings leer entfällt" stimmt schon heute nicht und nach dem Umbau erst recht** *(architektur)*

Der Eintrag begründet den Verzicht mit „zeigen immer Bedienelemente, nie eine Liste von Nutzerdaten" (state-coverage-allowlist.json:25-29). Nachgeprüft: (a) CategoryTree rendert eine Liste von Nutzerdaten (EnhancedSettings.tsx:131 → CategoryManager.tsx:66); (b) CategoryPreview hat bereits einen ausformulierten Leerzustand (`settings.categoryPreview.noTransactionsMessage`, CategoryPreview.tsx:111-115); (c) BackupManager zeigt `backup.noData` = „Keine Daten verfügbar" (BackupManager.tsx:275-277, src/i18n/translations/de.ts:3675) — und zwar auch bei einem Lesefehler, weil `backupInfo` dann `undefined` ist und der FinanceErrorState (BackupManager.tsx:220) DANEBEN steht statt ANSTELLE. Das Zielbild der Bildprüfung macht „letzte Sicherung" zu einer der drei Aussagen der Fläche.

*Warum es schadet:* Leerzustand und Lesefehler gleichzeitig auf einer Fläche ist exakt die Verwechslung, für die WP-9.1 den Wächter gebaut hat — und ausgerechnet die Fläche, die diese Frage per Ausnahme nicht beantworten muss, zeigt sie. Nach dem Umbau ist „noch keine Sicherung" eine der drei Hauptaussagen; der Grund im Allowlist-Eintrag trägt dann nachweislich nicht mehr. Der Eintrag muss aus „entfällt" heraus und ein Test `[ZUSTAND /settings:leer]` entstehen — sonst wandert die Ausnahme unbemerkt von „ist wirklich keiner" nach „hat einen, prüft ihn nur nicht".

*Beleg:* `state-coverage-allowlist.json:25-29; src/components/BackupManager.tsx:220 und :275-277; src/i18n/translations/de.ts:3675; src/components/settings/CategoryPreview.tsx:111-115; src/components/settings/CategoryManager.tsx:66; scripts/state-coverage-core.mjs:41 (REQUIRED_STATES)`

**Der Fehlerzustand blendet die ganze Fläche aus — bei einem Verzeichnis sperrt das Backup, Verschlüsselung und Gefahrenzone mit weg** *(architektur)*

`if (settings.hasLoadError) return <FinanceErrorState …>` (EnhancedSettings.tsx:85-87). `hasLoadError` ist das ODER aus den zwei Bestandsabfragen `userSettings` und `hierarchicalCategories` (use-settings-overview.ts:203). Zwei Tests halten ausdrücklich fest, dass daneben NICHTS steht: `expect(screen.queryByText('Kategorien')).toBeNull()` und `expect(screen.queryByText('Einstellungen')).toBeNull()` (src/pages/__tests__/SettingsPage.error-state.test.tsx:42-43, de/en :52-53).

*Warum es schadet:* Heute ist der frühe `return` richtig: die Fläche IST im Wesentlichen die Kategorieverwaltung. Als Verzeichnis aus elf Zeilen ist er falsch — ein nicht lesbarer Kategoriebaum nimmt dem Nutzer dann auch Verschlüsselung, Backup-Wiederherstellung und Gefahrenzone, also genau die Bereiche, die er nach einem Speicherproblem braucht, und die von dieser Abfrage nichts wissen. Wer das repariert, macht diese zwei Tests rot. Das ist kein Kollateralschaden, sondern die Stelle, an der die Entscheidung neu getroffen und im selben Commit neu festgeschrieben werden muss: Fehler AN DER ZEILE „Kategorien", nicht vor dem Verzeichnis.

*Beleg:* `src/components/settings/EnhancedSettings.tsx:85-87; src/features/settings/application/use-settings-overview.ts:203; src/pages/__tests__/SettingsPage.error-state.test.tsx:42-43 und :52-53`

**slice-presentation-budget.json (11/0) blockiert jeden Zuschnitt des Umzugs — nachgemessen, nicht geschätzt** *(architektur)*

Ich habe `countLegacyImports` aus scripts/slice-presentation-core.mjs gegen den Bestand laufen lassen, mit umgeschriebenen Importpfaden: (a) nur EnhancedSettings.tsx nach `features/settings/presentation/` → 23 Importe in die Alt-Oberfläche, Ratsche 11 → 34; (b) das ganze `src/components/settings/` → 7, Ratsche 11 → 18; (c) zusätzlich BackupManager.tsx und PerformanceDashboard.tsx → 5, Ratsche 11 → 16. Der Rest in (c) sind `@/components/ThemeToggle` (AppearanceSettings), `@/components/tax/TaxCategorySelect` (CategoryForm), `@/components/onboarding/FeatureSelection` (NavFeatureSettings), `@/components/FeatureGate` und `@/components/premium/PremiumTeaser` (EnhancedSettings). Kein Zuschnitt erreicht ≤ 11.

*Warum es schadet:* Die Zahl darf nur sinken; ein Umbau, der sie hebt, gilt laut darstellungsdichte.md („Folgen für die Wächter") als falsch gebaut. Wichtiger noch: die Rechnung in src/features/settings/README.md:69-70 („12 → 32" bzw. „12 → 22") ist VOR WP 6.7 gemessen und stimmt heute nicht mehr — wer den Umbau danach plant, plant gegen veraltete Zahlen. Entweder ziehen die fünf Fremdbausteine mit (jeder eine eigene Entscheidung), oder der Umbau bleibt in `src/components/settings/` — und dann sieht der Boxen-Wächter ihn nicht (siehe nächster Befund).

*Beleg:* `slice-presentation-budget.json (max: 11, maxBausteine: 0); scripts/slice-presentation-core.mjs:172-199; src/features/settings/README.md:60-83 (veraltete Rechnung); gemessen über countLegacyImports gegen den heutigen Bestand`

**Der Boxen-Wächter für die fokussierte Dichte sieht die Einstellungen nur, wenn der Umbau in die Slice zieht** *(darstellung)*

`zaehleBoxenInFokussiert` prüft ausschliesslich Pfade nach `src/features/<slice>/presentation/mobile/` (scripts/card-rule-core.mjs:169). Solange die Einstellungen unter `src/components/settings/` liegen, ist `maxFokussiert` (card-rule-budget.json: 2) für sie blind — Regel 9 („keine Boxen") wäre auf der schlimmsten Fläche der App maschinell nicht durchgesetzt. Zieht der Umbau dagegen nach `features/settings/presentation/mobile/`, zählt dort jeder Rahmen mit, und die Ratsche steht auf 2 und darf nur sinken.

*Warum es schadet:* Das ist die Weichenstellung des ganzen Pakets, und sie ist nicht kosmetisch: Der eine Weg gibt dem Umbau einen Wächter, der andere lässt ihn ungeprüft. Die Ratsche macht den zweiten Weg zugleich teuer — die 33 Rahmen der vier Dateien müssen dann VOR dem Umzug weg, nicht danach.

*Beleg:* `scripts/card-rule-core.mjs:168-188 (Pfadfilter presentation/mobile/); card-rule-budget.json (maxFokussiert: 2, Ziel 0)`

### Befunde — mittel

**card-rule-budget.json (149/2): der Einstellungsbereich stellt 76 der 149 Rahmen — mehr als die Hälfte** *(darstellung)*

Gemessen mit `zaehleKartenrahmen` aus scripts/card-rule-core.mjs über den Einstellungsbereich: PerformanceDashboard.tsx 19, PrivacySyncAnalyticsSettings.tsx 14, BackupManager.tsx 14, LocalEncryptionSettings.tsx 8, CategoryPreview.tsx 7, CategoryManager.tsx 4, EnhancedSettings.tsx 2, BulkAssignment.tsx 2, AppearanceSettings.tsx 2, CategoryForm.tsx 1, HouseholdSettings.tsx 1, NavFeatureSettings.tsx 1, TaxReserveSettings.tsx 1 = 76. Die „33 Kartenrahmen in vier Dateien" der Bildprüfung sind exakt CategoryPreview 7 + LocalEncryptionSettings 8 + PrivacySyncAnalyticsSettings 14 + CategoryManager 4; die übrigen 43 hat die Bildprüfung nicht mitgezählt, weil BackupManager und PerformanceDashboard eigene Dateien ausserhalb von `components/settings/` sind. Der Repo-Stand ist genau 149 bei Ratsche 149 (Lauf von `check:card-rule`).

*Warum es schadet:* Die Ratsche steht auf ihrem Maximum — jede Änderung, die einen Rahmen hinzufügt, ist sofort rot. Umgekehrt ist das die Chance: kein anderer Umbau kann diese Zahl so weit senken. Wer nur die vier von der Bildprüfung genannten Dateien anfasst, lässt 43 Rahmen stehen, davon 19 im PerformanceDashboard, das hinter dem einzigen bestehenden Akkordeon liegt und damit als „schon gestaffelt" durchgeht.

*Beleg:* `card-rule-budget.json (max: 149, maxFokussiert: 2); `node scripts/check-card-rule.mjs` → 149/149; Zählung je Datei über zaehleKartenrahmen (scripts/card-rule-core.mjs:142-152)`

**view-data-budget.json (204): 29 Zugriffe im Einstellungsbereich, verteilt auf zehn Bausteine — ein blosses Verschieben senkt nichts** *(architektur)*

Gemessen mit `countDataAccess` aus scripts/view-data-core.mjs: BackupManager.tsx 6 (4 Abfragen + 2 Service-Importe), HouseholdSettings.tsx 6, PrivacySyncAnalyticsSettings.tsx 4, AppearanceSettings.tsx 3, NavFeatureSettings.tsx 3, TaxReserveSettings.tsx 3, PerformanceDashboard.tsx 1, DangerZoneSettings.tsx 1, LocalEncryptionSettings.tsx 1, TelemetrySettings.tsx 1 = 29 von 204. `EnhancedSettings.tsx` und `CategoryManager.tsx` selbst tragen 0 — die sind seit WP 6.5b sauber. src/features/settings/README.md:109-113 führt diese zehn bereits als offen.

*Warum es schadet:* Die Ratsche steht exakt auf ihrem Stand (Lauf: 204 — erlaubt 204) und die Datei sagt ausdrücklich, dass es keine begründete Teilmenge gibt: die Zahl SELBST ist die offene Schuld. Ein Umbau, der die zehn Bausteine nur in Detailschritte verschiebt, bewegt sie um keinen Punkt — jeder Detailschritt bliebe seine eigene Datenschicht, und das Versprechen aus §4 (eine Datenschicht, zwei Präsentationen) wäre für die Einstellungen weiterhin uneingelöst. Wenn der Umbau ohnehin jede dieser Dateien anfasst, ist das der letzte günstige Zeitpunkt, die Zugriffe ins ViewModel zu heben.

*Beleg:* `view-data-budget.json (max: 204); `node scripts/check-view-data.mjs` → 204/204; Zählung je Datei über countDataAccess (scripts/view-data-core.mjs:72); src/features/settings/README.md:109-113`

**query-error-allowlist.json hat 0 offenes Backlog — jede neu angelegte Abfrage ist sofort blockierend** *(architektur)*

Stand: 157 von 182 Aufrufen behandelt, 25 begründet ausgenommen, 0 im Backlog (Lauf von `check:query-errors`). Drei der 25 gehören zum Einstellungsbereich, alle als „Entschieden" markiert: src/features/settings/application/use-settings-overview.ts (1, der Kategorie-Vorschlag), src/components/settings/PrivacySyncAnalyticsSettings.tsx (1), src/components/settings/NavFeatureSettings.tsx (1).

*Warum es schadet:* Ein Verzeichnis mit elf Detailschritten lädt naheliegenderweise je Schritt nach — genau dafür ist die Bauform da. Jede dabei neu angelegte `useQuery` braucht im selben Commit eine eigene Aussage zum Fehlerfall; die Liste nimmt keine neuen Zahlen auf („Neue Stellen gehören in KEINE der beiden Formen"). Das ist kein Hindernis, sondern eine Vorgabe an den Entwurf: Wer nachlädt, entwirft den Fehlerfall des Detailschritts mit — und muss ihn vom Fehlerfall des Verzeichnisses unterscheiden (siehe der frühe `return`).

*Beleg:* `query-error-allowlist.json:40-47; `node scripts/check-query-errors.mjs` → 157/182, 25 ausgenommen, 0 offen`

**Sechs Führungsschritte zeigen auf /settings, drei über DOM-Anker — und ihr Wächter kann den Bruch nicht sehen** *(bedienbarkeit)*

src/lib/tutorial-steps.ts:274-275 (`backup`/`restore` mit den Ankern `backup-create`, `backup-restore`) und :278-281 (`areas`, `unlockAll`, `language`, `encryption` mit Anker `encryption-setup` und `interactive: true`). Die Anker sitzen in src/components/BackupManager.tsx:284 und :376 sowie src/components/settings/LocalEncryptionSettings.tsx:272. Der Wächter src/lib/__tests__/tutorial-anchors-exist.test.ts:51-66 gleicht nur ab, ob die Zeichenkette irgendwo im Quelltext vorkommt — ein Anker in einem geschlossenen Radix-Sheet bleibt für ihn vorhanden. `useAnchorRect` (src/components/tutorial/useAnchorRect.ts) verfolgt eine Bildschirmposition; ohne gemountetes Element gibt es keine.

*Warum es schadet:* Genau dieser Fehler ist schon einmal passiert und steht als `[REGRESSION]`-Kommentar direkt über der Zeile (tutorial-steps.ts:271-273: der Schritt zeigte auf /export, wo es die Sicherungsfunktion gar nicht gibt). Nach dem Umbau ist die Route wieder richtig und der Anker unsichtbar — und der Wächter bleibt grün. Der Umbau muss die Schritte mitziehen: entweder `openAnchor` auf die Verzeichniszeile setzen, die den Schritt öffnet, oder die Führung auf `?detail=` navigieren lassen.

*Beleg:* `src/lib/tutorial-steps.ts:271-281; src/components/BackupManager.tsx:284 und :376; src/components/settings/LocalEncryptionSettings.tsx:272; src/lib/__tests__/tutorial-anchors-exist.test.ts:51-66`

**E2E: der `.ui-card`-Selektor hängt an genau dem Karten-Chrome, das Regel 9 abschafft** *(korrektheit)*

backup-roundtrip.spec.ts:48 sucht `page.locator(".ui-card").filter({ hasText: "Aktueller Datenbestand" })`. Die Klasse `ui-card` kommt aus dem Primitiv (src/components/ui/card.tsx:6) und liegt fünfmal im BackupManager (Zeilen 212, 284, 376, 518, 584). Die beiden folgenden Zusicherungen (Zeile 49-50) hängen an diesem Locator.

*Warum es schadet:* Der Schritt ist ausdrücklich als Wächter gegen einen benannten [REGRESSION]-Fall gebaut (Spec-Kopf Zeile 22-27: „Aktueller Datenbestand" zeigte den Lesefehler statt der Zahlen). Entrahmt der Umbau die Fläche — und das verlangt Regel 9 —, findet der Locator nichts, der Test wird rot mit einer Meldung über einen fehlenden Selektor, und der eigentliche Wächter ist still verschwunden. Der Selektor muss auf die Aussage umgestellt werden (Rolle/Überschrift), nicht auf das Chrome.

*Beleg:* `e2e-tests/backup-roundtrip.spec.ts:48-50; src/components/ui/card.tsx:6; src/components/BackupManager.tsx:212, 284, 376, 518, 584`

**E2E: `openViaNav` kehrt bei offenem Detailschritt zu früh zurück — und ein `goto` auf `?detail=` sperrt den Tresor** *(korrektheit)*

`openViaNav` prüft `new RegExp(`${path}(\\?|$)`)` gegen die aktuelle Adresse und kehrt sofort zurück, wenn sie passt (e2e-tests/fixtures/finance-snapshot.ts:32-34). `/settings?detail=sicherung` erfüllt diese Regex. Betroffen sind local-encryption.spec.ts:54 (zweiter Aufruf, während die Adresse noch einen Detailschritt trägt) und backup-roundtrip.spec.ts:80. Zugleich verbietet der Fixture-Kopf (Zeile 20-30) ausdrücklich `page.goto()` bei aktiver Verschlüsselung: der Schlüssel liegt nur im Dokumentspeicher, ein Reload sperrt den Tresor.

*Warum es schadet:* Beides zusammen heisst: Detailschritte dürfen in diesen zwei Specs weder per Adresse angesprungen (Reload sperrt) noch über `openViaNav` verlassen werden (Frühausstieg). Der nächste Schritt sucht dann sein Bedienelement im falschen Sheet und meldet „nicht gefunden" statt der Sache. Die Fixture ist Teil des Umbaus, nicht sein Umfeld: es braucht ein `oeffneAbschnitt(page, name)`, das per Klick öffnet, und ein `openViaNav`, das den Detailparameter als Unterschied wertet.

*Beleg:* `e2e-tests/fixtures/finance-snapshot.ts:19-34 (Regex und Reload-Verbot); e2e-tests/local-encryption.spec.ts:42, :54; e2e-tests/backup-roundtrip.spec.ts:44, :80`

**a11y- und Bild-Erhebung besuchen nur die Wurzelroute — elf Detailschritte würden nie geprüft und nie fotografiert** *(korrektheit)*

all-screens-a11y.spec.ts:42-60 und all-screens-performance.spec.ts iterieren `ALL_ROUTES` mit `page.goto(route)`; all-screens-shots.spec.ts nimmt je Route zwei Aufnahmen. `ALL_ROUTES` (e2e-tests/fixtures/routes.ts:14-40) enthält `/settings` als eine Zeile (:38) und kennt keine Detailschritte. Dieselbe Liste ist zugleich die Routenquelle des Zustands-Wächters (scripts/state-coverage-core.mjs:44-49).

*Warum es schadet:* Nach dem Umbau steht auf `/settings` ein Verzeichnis aus elf Zeilen. Die Fläche fiele von 19,02 auf etwa eine Bildschirmlänge, axe fände nichts zu beanstanden, die Bildprüfung sähe eine vorbildliche Seite — und der gesamte Inhalt wäre schlicht unbeobachtet umgezogen. Das ist genau die Lücke, deretwegen die Routenliste überhaupt zentralisiert wurde („geprüft wurden drei Screens von zweiundzwanzig", routes.ts:5-7), nur eine Ebene tiefer. Die Specs müssen die Detailschritte aufzählen, oder die Liste muss sie führen; darstellungsdichte.md verlangt für die Routenliste ohnehin schon einen Lauf in beiden Dichten.

*Beleg:* `e2e-tests/fixtures/routes.ts:14-40 (Zeile 38 `/settings`); e2e-tests/all-screens-a11y.spec.ts:42-60; e2e-tests/all-screens-shots.spec.ts; e2e-tests/all-screens-performance.spec.ts:41-56; scripts/state-coverage-core.mjs:44-49`

### Befunde — niedrig

**settings-card-rule.test.tsx hält fest, dass eine Überschrift genau EINMAL vorkommt — ein Verzeichnis bringt sie zurück** *(darstellung)*

`expect(screen.getAllByText('Sprache')).toHaveLength(1)` (src/components/settings/__tests__/settings-card-rule.test.tsx:63-68), mit der Begründung: vorher stand „Sprache" zweimal, einmal im SectionHeader der Seite und einmal im CardTitle. Der Test rendert `LanguageSettings` isoliert.

*Warum es schadet:* Ein Verzeichnis aus elf Zeilen gibt jeder Zeile eine Beschriftung, und der geöffnete Detailschritt bekommt nach DetailSchritt.tsx:44 zwingend einen `SheetTitle`. Damit steht der Name wieder zweimal auf dem Bildschirm — Zeile und Sheet-Titel —, nur diesmal nicht gleichzeitig sichtbar. Der Test bleibt grün (er rendert den Baustein allein) und schützt die Aussage nicht mehr, die er schützen sollte. Wer die Doppelung diesmal vermeiden will, braucht die Prüfung eine Ebene höher, an der zusammengesetzten Fläche.

*Beleg:* `src/components/settings/__tests__/settings-card-rule.test.tsx:63-68; src/features/shared/presentation/DetailSchritt.tsx:43-45`

**i18n-allowlist.json führt CategoryForm.tsx mit dem alten Pfad — ein Umzug macht den Eintrag blind** *(architektur)*

`"src/components/settings/CategoryForm.tsx": 1` (i18n-allowlist.json:84), einer von 30 Einträgen im offenen Backlog; dazu 231 begründet ausgenommene (Lauf von `check:i18n --all`). Zusätzlich hängt `src/lib/category-migrations.ts` mit 3 an den Kategorien.

*Warum es schadet:* Zeigt ein Allowlist-Pfad nach einem Umzug ins Leere, wird er „nie rot und nie grün" — dieselbe Fehlerform, die scripts/card-rule-core.mjs:29-34 für seine eigene Ausnahmeliste ausdrücklich benennt. Die Folge hier ist doppelt: der alte Eintrag verschwindet still aus der Zählung, und die Stelle am neuen Ort erscheint als NEUER, blockierender Verstoss. Der Pfad muss im selben Commit mitgezogen werden.

*Beleg:* `i18n-allowlist.json:84; `node scripts/check-i18n.mjs --all` → 231 begründet, 30 offen; scripts/card-rule-core.mjs:29-34 (dieselbe Fehlerform benannt)`

### Unsicher

Vier Punkte, bei denen ich nicht abschliessend belegen kann:

1. „Zwei Textbausteine stehen wortgleich doppelt\" (bildpruefung.md, /settings). Ich habe die Stelle nicht gefunden. Ein Skript-Abgleich über de.ts ist mir an einem Regex-Fehler gescheitert, und ich habe ihn nicht wiederholt, weil er ausserhalb meines Gebiets liegt. Die Aussage bleibt unbestätigt — nicht widerlegt.

2. Ob das ViewModel nach dem Umbau einmal im Verzeichnis oder je Detailschritt gemountet wird, entscheidet der Entwurf, nicht der heutige Code. Meine Aussage zum verlorenen Rücknahme-Vorrat gilt nur für den zweiten Fall. Der Verlust des Kategorie-FORMULARS gilt dagegen in beiden Fällen, weil CategoryManager seinen Zustand selbst hält (Zeilen 28-37).

3. Die Zahl 29 für den view-data-Anteil des Einstellungsbereichs beruht auf meiner Dateiauswahl (alles unter components/settings/ plus BackupManager und PerformanceDashboard). Wer HouseholdSettings oder das PerformanceDashboard nicht zur Fläche zählt, kommt auf weniger. Die 204 gesamt und die Werte je Datei sind dagegen mit dem echten Wächter-Kern gemessen.

4. Ob `layout-overlap.sweep.test.tsx` einen geöffneten Detailschritt überhaupt sieht, habe ich nicht ausprobiert — er rendert SettingsPage im Ausgangszustand, und ein Sheet ist dann geschlossen. Die Prüfung deckt Portale ab (Kommentarkopf), aber nur die, die beim Rendern entstehen. Möglich, dass sie den Detailschritt nach dem Umbau gar nicht mehr erreicht; das wäre ein weiterer stiller Abdeckungsverlust, den ich nicht belegen kann.

---

## Widerlegt und verworfen

Damit niemand sie neu erfindet.

- Die Zeilenangaben stimmen, die Schlussfolgerung nicht.

Nachgeprüft:
- src/components/settings/EnhancedSettings.tsx:243-244 — Titel `settings.securityTitle`, Beschreibung `settings.securityDescription`; Text laut src/i18n/translations/de.ts:1314-1315 wörtlich wie behauptet ("… Hier kannst du eine Sicherungskopie erstellen oder wiederherstellen."). Kein Everyday-Overlay überschreibt das (`grep securityDescription src/i18n/overlays/` liefert nichts) — der Basistext greift.
- EnhancedSettings.tsx:246-255 — Abschnittsinhalt `LocalEncryptionSettings`, `PrivacySyncAnalyticsSettings`, `TelemetrySetti

- WIDERLEGT — der Wirkmechanismus kann an den genannten Stellen nicht auslösen.

Die Zeilenangaben stimmen, die Folgerung nicht:

1. Zutreffend ist nur die Beobachtung der Formen. `src/services/transaction-service.ts:494-497` schreibt im Sammellauf ausschliesslich `category_id`/`auto_mapped`, `restoreCategorization` (`src/services/transaction-service.ts:510-520`) ebenso; `src/lib/category-model.ts:150-152`, `src/features/shared/domain/dashboard-filtering.ts:140/150/159`, `src/lib/analysis-data.ts:60/64`, `src/lib/chart-data/sankey.ts:115/216` lesen tatsächlich `subcategory_id ?? category_id`; `r

- Die BESCHREIBUNG stimmt, die SCHADENSBEGRÜNDUNG nicht — und einer der beiden Belege sagt das Gegenteil des Codes.

**1. Was stimmt (unstrittig).**
- `src/data/merchant-keywords.ts:920` (`const mainId = ` + Backtick `local-cat-${main.slug}`) und `:934` (`id: local-cat-${sub.slug}`) erzeugen die Standard-IDs; der Kopfkommentar `:914` nennt sie ausdrücklich „Stabile IDs".
- `src/services/local-settings-service.ts:168-173` ist wörtlich wie zitiert: `crypto.randomUUID()` in `:170`, der `local-cat-<random>`-Ersatzweg in `:172`. Verwendet in `:269` (`id: generateLocalCategoryId()`).
- `src/lib/catego
