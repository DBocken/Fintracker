# Feature-Slice: Finanzstadt (`finance-city`)

## Zweck

Die Finanzstadt ist eine **3D-Ausgabenstadt als reine Projektion** bestehender
Finanzdaten — keine neue Datenquelle, kein neuer Speicher. Sie stellt
Ausgaben-Unterkategorien und laufende Verträge (Streaming-Abos etc.) als
Gebäude in einer WebGL-Stadt dar; Gebäudehöhe ~ monatlicher Betrag,
räumliches Cluster ~ Distrikt (Hauptkategorie-Gruppe). Grundlage bleiben
dieselben aggregierten Daten wie im restlichen Dashboard
(`buildSunburstTree`, `computeContracts`) — die Stadt ist eine zusätzliche
**Visualisierung**, kein Parallel-Datenmodell (Plattform-Prinzip, AGENTS.md
§4: gleiche Daten, gleiche Berechnungen).

> **Hinweis zur Spec-Quelle:** Für dieses Work Package (WP-C0) existierte
> keine eigenständige, separat abgelegte Spezifikationsdatei im Repo. Die
> unten dokumentierten Kamera-Regeln und Akzeptanzkriterien sind der
> WP-C0-Arbeitsstand, abgeleitet aus den in der Aufgabenstellung explizit
> genannten Vorgaben (Distrikte, Beispieldaten, Mobile-Constraints). Sie
> gelten als verbindliche Baseline für WP-C1–WP-C4, bis eine abweichende
> Spec sie ersetzt.

## Die 3 Ebenen

1. **Stadt-Ebene** (Root, Breadcrumb `city.breadcrumbCity` = "Stadt"):
   Vogelperspektive auf alle vier Distrikte gleichzeitig.
2. **Distrikt-Ebene**: `housing` (Wohnen), `living` (Lebenshaltung),
   `leisure` (Freizeit), `mobility` (Mobilität) — je ein räumlich getrenntes
   Gebäude-Cluster mit eigener Basisfarbe.
3. **Gebäude-Ebene**: einzelne Unterkategorie oder Streaming-Vertrag als
   Gebäude; Höhe proportional zum monatlichen Betrag (Integer-Cent).

## Kamera-Regeln (1–7)

1. Kamera startet immer in einer festen Vogelperspektive über der gesamten
   Stadt (Auto-Frame) — alle vier Distrikte vollständig im Bild, kein
   manuelles Einnorden nötig.
2. Rotation ist auf einen Halbraum begrenzt (Polarwinkel z. B. 15°–80°):
   kein Blick von unten durch den Boden, keine reine Top-Down-Draufsicht, die
   Gebäudehöhen (= Beträge) unlesbar macht.
3. Zoom (Dolly) ist nach min/max begrenzt: nie näher als eine Gebäudehöhe
   (Clipping vermeiden), nie weiter als die volle Stadtansicht plus
   Randabstand.
4. Kein Roll — die Kamera-Oben-Achse bleibt immer Welt-oben, Nutzer verliert
   nie die Orientierung.
5. Klick/Tap auf Distrikt oder Gebäude fährt die Kamera gedämpft (Easing) auf
   den neuen Fokuspunkt — nie ein harter Schnitt/Sprung.
6. Damping/Inertia auf Rotation und Pan, mit Stopp bei Inaktivität (kein
   endloses Nachschwingen); vollständig deaktiviert bei
   `prefers-reduced-motion`.
7. Kamera-State (Position, Ziel, Zoom) ist rein aus dem aktuellen
   Drill-down-Level abgeleitet, nicht Teil des dauerhaften App-State —
   Verlassen und Zurückkehren zur Stadt setzt immer auf die zum Level
   passende Standardposition zurück.

## Akzeptanzkriterien (Checkliste)

- [ ] Die drei Ebenen (Stadt/Distrikt/Gebäude) sind über Klick/Tap
      erreichbar; Breadcrumb zeigt den aktuellen Pfad (Root =
      `city.breadcrumbCity`).
- [ ] Jedes Gebäude repräsentiert genau eine Unterkategorie oder einen
      Streaming-Vertrag; Höhe ist proportional zum monatlichen Betrag
      (Integer-Cent, `toMinor`, AGENTS.md §8 — nie Float-Vergleich).
- [ ] Distrikt-Cluster sind räumlich getrennt und farblich konsistent mit
      den definierten Distrikt-Farben.
- [ ] Kamera respektiert alle 7 Kamera-Regeln oben.
- [ ] Canvas füllt die verfügbare Fläche ohne Seiten-Scroll (100dvh-basiert),
      auf Mobil und Desktop.
- [ ] `touch-action: none` auf dem Canvas-Element verhindert
      Browser-Gesten-Konflikte (Pull-to-Refresh, Seiten-Scroll) beim
      Rotieren/Zoomen.
- [ ] Rendering läuft Render-on-Demand (kein Dauer-Loop bei Stillstand) —
      schont Akku auf Mobilgeräten.
- [ ] `devicePixelRatio` ist gedeckelt (DPR-Cap, z. B. max. 2) — begrenzt
      Renderlast auf High-DPI-Mobilgeräten.
- [ ] Beschriftungen (Distrikt-/Gebäudenamen, Beträge) sind HTML-Overlays,
      keine 3D-Sprites — bleiben scharf, lokalisierbar (`t()`) und per
      Screenreader erreichbar.
- [ ] Eine vollständig nicht-visuelle Alternative (Listenansicht) ist über
      einen Toggle erreichbar (`city.a11yListToggle`) — 3D ist nie der
      einzige Zugriffsweg auf die Daten.
- [ ] `prefers-reduced-motion` deaktiviert Kamera-Damping/Auto-Fahrten;
      Sprung statt Animation.
- [ ] Die Stadt bleibt innerhalb der App-Navigation (Sidebar/BottomNav
      erreichbar) — kein isolierter Vollbild-Modus ohne Ausstieg.
- [ ] three.js-Code ist ausschließlich innerhalb
      `src/features/finance-city/presentation/` (WebGL-Lifecycle außerhalb
      des React-Render-Zyklus, sauberes `dispose()` beim Unmount) — kein
      Memory-Leak über Seitenwechsel (AGENTS.md §7).
- [x] Android-Hardware-Back navigiert beim Drill-down zuerst eine Ebene
      zurück (Distrikt→Stadt, Gebäude→Distrikt); erst auf oberster Ebene
      verlässt sie die Seite (Capacitor, WP-D2:
      `application/use-city-back-navigation.ts`).

## Architektur

| Schicht | Inhalt | Verantwortung |
|---|---|---|
| `domain/` | (WP-C1) `city-model.ts`, Höhen-/Layout-Mathe | Reine Deskriptoren + Berechnungen. VERBOTEN: React, three.js, Browser-APIs. Übernimmt `CityDistrictData`/`CityContractData` aus `data/city-demo-data.ts`. |
| `data/` | `city-demo-data.ts` (dieses WP) | Fixture für den ersten Prototyp; später Adapter, der `buildSunburstTree`/`computeContracts` auf dieselben Typen abbildet statt eigener Aggregation. |
| `application/` | (WP-C2) Navigation/Drill-down-State | UI-neutrale Ebenen-Navigation (Stadt→Distrikt→Gebäude), Breadcrumb-Stack. VERBOTEN: three.js-Importe — reiner State/Reducer, damit er ohne WebGL-Kontext testbar ist. |
| `presentation/` | (WP-C3) Canvas, Renderer, Kamera | three.js-Lifecycle **außerhalb** des React-Render-Zyklus (Szene/Renderer/Kamera in einem Effekt aufgebaut, nicht als deklarativer Scenegraph); React besitzt nur Container-Div + Resize-/Visibility-Observer. HTML-Label-Overlays statt Sprites. |

## Mobile-Entscheidungen

- **`h-[100dvh]`-Basis statt `100vh`**: dynamische Viewporthöhe, damit
  ein-/ausblendende mobile Browser-UI (Adressleiste) nicht zu
  Sprüngen/Scrollbalken führt — gleiches Pattern wie `AppShell.tsx`
  (Sidebar-Höhe) bereits nutzt.
- **`touch-action: none`** auf dem Canvas: verhindert, dass ein
  Rotations-Drag gleichzeitig als Seiten-Scroll/Pull-to-Refresh interpretiert
  wird.
- **Render-on-Demand**: WebGL rendert nur bei Interaktion/Kamera-Bewegung neu,
  nicht in einer `requestAnimationFrame`-Dauerschleife — wichtig für
  Akkulaufzeit, da diese Seite (Explorations-Charakter) potenziell lange
  offen bleibt.
- **DPR-Cap**: `devicePixelRatio` auf Mobilgeräten (oft 3) ungedeckelt zu
  nutzen vervielfacht die Pixelzahl gegenüber Desktop-DPR (meist 1); ein Cap
  (z. B. `Math.min(window.devicePixelRatio, 2)`) hält die
  Fragment-Shader-Last im Rahmen.
- **HTML-Labels statt Sprites**: Distrikt-/Gebäude-Beschriftungen und Beträge
  als DOM-Overlays (aus 3D-Weltkoordinaten in Screen-Space projiziert) statt
  Textur-Sprites in der Szene — bleiben i18n-fähig (`t()`), scharf bei jedem
  DPR, und für Screenreader erreichbar (Sprites sind für AT unsichtbar).

## AppShell-Entscheidung (WP-C0)

`src/components/layout/AppShell.tsx` umschließt jede Route mit einem
scrollenden, gepolsterten `<main>`/Inner-Div (Header 3.5rem, Inner-Padding
2×1.5rem, auf Mobil zusätzlich `pb-[calc(5rem+env(safe-area-inset-bottom))]`
für die BottomNav). Entscheidung: Die Stadt läuft **innerhalb** dieser
App-Navigation (Sidebar/BottomNav bleiben erreichbar = „dauerhaft erreichbare
Navigation"), AppShell selbst wird **nicht** verändert. `CityPage.tsx`
kompensiert das erzwungene Padding/den Scroll-Container selbst über einen
`relative`-Wrapper mit expliziter, aus dem AppShell-Chrome abgeleiteter
dvh-Höhe plus `absolute inset-0` für die Canvas-Fläche — keine negativen
Margins (fragil bei künftigen AppShell-Änderungen), kein Eingriff in
AppShell. Details im Code-Kommentar von `src/pages/CityPage.tsx`.

## Visual-Polish (WP-E1): Himmel, Boden & Tiefe

Ziel: Die Stadt soll ein *Ort* wirken statt farbiger Boxen auf grauer Platte
vor leerem Hintergrund — zurückhaltend ("Ruhe vor Fülle"), **strikt
Render-on-Demand** (keine Ambient-Animation, **keine Schatten-Maps**,
DPR-Cap unverändert). Alle Texturen sind prozedurale Canvas-Texturen
(≤ 256 px), einmalig erzeugt und gecacht; alle Konstanten liegen zentral in
`presentation/city-scene.ts` bzw. `domain/city-layout.ts` (ein-Pass-Tuning).

- **Himmel**: vertikale 1×256-Gradient-`CanvasTexture` je Theme als
  `scene.background` (Palette `skyTop`/`skyHorizon` in `THEME_PALETTES`).
  Fog-Farbe = **Horizontton** (`setFog`/`setTheme`), damit der Stadtrand in
  den Himmel übergeht. `setTheme` tauscht nur Textur-Referenzen + Fog — kein
  Material-Registry-Rebuild.
- **Boden**: Straßen-Raster-Textur (je Theme: dark = asphalt-betonter,
  light = neutraler) als `map` NUR auf dem `ground`-Material; die Textur-Art
  steht im Registry-Schlüssel (`color|opacity|bucket|texture`), damit sie nie
  mit gleichfarbigen Balken geteilt wird. `material.color` multipliziert
  weiterhin die Domain-Farbe (1:1-Farbmapping bleibt). Repeat folgt der
  Bodengröße (`GROUND_TILE_WORLD_SIZE` = 3) — gleiche Straßen-Dichte auf
  jeder Ebene. Grundstücke tragen seit WP-E1 `edges: true` (Domain) und
  bekommen ihre Farbkante über den bestehenden Kanten-Pfad.
- **Kontaktschatten** (fake Grounding, kein Shadow-Pass): EINE geteilte
  Radial-Gradient-Textur + EINE geteilte `PlaneGeometry(1,1)`; eine Ebene pro
  Grundstück (× `CONTACT_SHADOW_PLOT_SCALE` = 1.15) und pro Balken-/
  Etagen-Stapel-Fuß (Footprint + `CONTACT_SHADOW_BAR_MARGIN` = 0.25; nur Fuß
  auf Bodenhöhe — ein Schatten je Stapel, nicht je Etage; Caps/Hüllen
  werfen keinen). `depthWrite: false`, Render-Order 0.5 (zwischen plot 0 und
  bar 1), y-Staffelung 0.058/0.072 gegen Z-Fighting. Lebenszyklus = der der
  Box (`applyLayout`-Diff, `dispose()`).
- **Fassade**: EINE geteilte Graustufen-Textur (vertikaler AO-Gradient,
  `FACADE_AO_MAX_ALPHA` = 0.3, streckungs-tolerant + zartes Fenster-Raster,
  `FACADE_WINDOW_ALPHA` = 0.07) als `map` auf allen `solid`-Materialien —
  Albedo-only, Distrikt-Tint bleibt `material.color`. Bewusst **keine**
  Emissive-"Nachtfenster" in v1 (würde Material-Updates bei Theme-Wechsel
  erzwingen).
- **Setback-Caps** (Domain-Geometrie): Balken über `CAP_HEIGHT_THRESHOLD_RATIO`
  (0.6) der Stadt-Höchsthöhe bekommen einen Aufsatz (`CAP_FOOTPRINT_RATIO`
  0.55, `CAP_HEIGHT_RATIO` 0.08, `adjustHexLightness(color, -8)`), id
  `<barId>:cap`, nicht pickbar. Caps wachsen im Höhen-Tween (Fuß =
  Balken-Oberkante) und werden weder von `computeFocusBounds` noch von den
  Stadt-Kamera-Bounds gerahmt (Kamera-Framing unverändert,
  REGRESSION-Tests).
- **Aufbau-Kaskade**: Höhen-Tweens starten gestaffelt (`BUILD_STAGGER_MS` =
  50 ms je Baukörper in Layout-Reihenfolge; Zusatzzeit < 1 s) — läuft im
  bestehenden Tween-Loop, keine neue Animation; bei
  `prefers-reduced-motion` unverändert Sofort-Verhalten.
- **Licht**: Key-Light warm (`dirColor` je Theme), Rim-Light bleibt kühl —
  bessere Modellierung der Box-Flächen ohne Mehrkosten.

## Qualitätsstufen (WP-5.6)

Die Stadt lief bis WP-5.6 auf jedem Gerät mit demselben Effektumfang; die
einzige Anpassung war die FPS-getriebene DPR-Kaskade in `CityCanvas`. Die
greift aber erst, **nachdem** der Nutzer das Ruckeln gesehen hat — auf einem
schwachen Telefon war der erste Eindruck damit systematisch der schlechteste.

`domain/city-quality.ts` leitet die Stufe deshalb **vor dem ersten Frame** aus
dem Geräteprofil ab (`deriveCityQuality`). Rein und browserfrei nach der
Architekturtabelle oben: `CityCanvas.readDeviceProfile()` liest
`window`/`navigator`, die Domain bekommt nur das fertige Profil — genau deshalb
ist die Ableitung ohne DOM testbar.

| Stufe | Wann | DPR | Kontaktschatten | Fassadentextur | Gegenlicht | Kanten | Aufbau-Kaskade |
|---|---|---|---|---|---|---|---|
| `high` | Desktop | ≤ 2 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `balanced` | Telefon (`pointer: coarse` + < 768 px) | ≤ 1.5 | ✅ | ✅ | — | ✅ | ✅ |
| `lean` | ≤ 4 Kerne, ≤ 2 GB, oder `saveData` | 1 | — | — | — | — | — |

Drei Eigenschaften sind verbindlich und testgesichert:

- **Monotonie.** Was auf einer sparsameren Stufe aus ist, ist auf jeder noch
  sparsameren ebenfalls aus. Sonst wäre „eine Stufe runter" keine verlässliche
  Entlastung (`city-quality.test.ts`).
- **Gleiche Daten.** Sparen kostet Effekte, nie Baukörper — jede
  Unterkategorie bleibt auf jeder Stufe ein Gebäude
  (`[REGRESSION]` in `city-scene-quality.test.ts`).
- **Deckel statt Vorschlag.** `setSize` kappt einen zu hohen DPR selbst; die
  FPS-Kaskade darf weiter nach unten nachjustieren, nach oben nicht.

Die Stufe wird **einmal beim Mount** ausgewertet. Ein Wechsel zur Laufzeit
hieße, Materialien und Texturen auszutauschen, während Höhen-Tweens laufen
(Invariante 2 im Kopf von `city-scene.ts`) — die reaktive Nachsteuerung bleibt
deshalb allein bei der DPR-Kaskade, die ohne Szenen-Umbau auskommt.

Die Straßentextur des Bodens bleibt auf **allen** Stufen: eine Textur auf einem
Material, kein Overdraw — und ohne sie steht die Stadt auf einer leeren grauen
Platte statt an einem Ort (WP-E1-Ziel).

## Leere und Fehlerzustände (WP-5.7)

Drei Wege, auf denen die 3D-Fläche nichts zeigt — sie sind **nicht** dasselbe
und werden deshalb getrennt behandelt:

| Fall | Erkannt an | Verhalten |
|---|---|---|
| **Keine Daten** | `useCityModel().isEmpty` | `EmptyState` je Tab; Canvas wird gar nicht erst gemountet (spart den WebGL-Kontext) — bestand schon vor WP-5.7 |
| **Kein WebGL** | `createCityScene` wirft → `onUnavailable('unsupported')` | Erklärung + Weg zur Listenansicht. **Kein** Neuaufbau-Knopf: fehlt WebGL ganz, wäre er ein Versprechen, das das Gerät nicht halten kann |
| **Kontextverlust** | `webglcontextlost` → `onUnavailable('context-lost')` | Erklärung + Neuaufbau-Knopf + Weg zur Liste; Render-Loop pausiert |

Der Kontextverlust war vor WP-5.7 **gar nicht** behandelt. Auf Mobilgeräten ist
er Alltag (Speicherdruck, App länger im Hintergrund, GPU-Reset): der Canvas
fror auf dem letzten Frame ein und zeigte unbegrenzt weiter **veraltete
Zahlen** — schlimmer als ein sichtbarer Fehler, weil nichts darauf hindeutete.

Drei Details, die leicht falsch gemacht werden:

- `event.preventDefault()` im `webglcontextlost`-Handler ist **Pflicht**. Ohne
  ihn gibt der Browser den Kontext endgültig auf und feuert nie ein
  `webglcontextrestored` — die Fläche bliebe auch nach einem Neuaufbau tot.
- Bei `webglcontextrestored` wird die Szene **nicht** neu gebaut. Der
  Szenengraph lebt im JS-Heap, three.js lädt Geometrien und Texturen beim
  nächsten `render()` von selbst wieder hoch; ein Neuaufbau würde nur die
  Kameraposition des Nutzers verwerfen.
- Der Neuaufbau-Knopf remountet den Canvas über einen Schlüssel
  (`canvasGeneration`), nicht über einen Szenen-Reset: einen frischen
  WebGL-Kontext bekommt man nur mit einem neuen `<canvas>`-Element.

`CityCanvas` **meldet** nur; was der Nutzer sieht, entscheidet `CityPage` —
nur sie kennt die Listenansicht als vollwertige Alternative auf dieselben
Daten. Genau das ist der Grund, warum die Listenansicht kein Zugeständnis an
die Barrierefreiheit allein ist, sondern der Rückfallweg für jeden Grafikausfall.

## Zielfortschritt: Wachstum UND Farbe (WP-5.3)

Der Balken eines Bauprojekts wuchs schon vorher datengetrieben — eine Änderung
des Ist-Werts läuft als Höhen-Tween über den `applyLayout`-Diff, das Gebäude
*wächst* also, statt aufzupoppen (`docs/design-principles.md`, Prinzip 2).

Die zweite Hälfte derselben Aussage fehlte: die **Farbe** kam aus dem
Sortier-Index (`GOAL_IN_PROGRESS_PALETTE[i]`). Ein Ziel bei 5 % und eines bei
95 % sahen unterschiedlich aus — aber der Unterschied bedeutete nur „steht
weiter oben in der Liste". Ein ganzer Wahrnehmungskanal lag auf einer
Zufallsgröße, während der Fortschritt allein an der Füllhöhe hing.

`domain/city-goal-progress.ts` ordnet den Fortschritts-Bruch jetzt einer Stufe
zu, und die Stufe bestimmt die Farbe:

| Stufe | ab | Farbe |
|---|---|---|
| `started` | 0 % | Blau |
| `underway` | 33 % | Cyan |
| `nearly` | 75 % | Violett |
| `achieved` | 100 % (oder persistiert erreicht) | Gold |

Zwei Ziele in derselben Stufe teilen sich bewusst eine Farbe: sie sagt
**„wie weit"**, nicht „welches" — dafür gibt es Position und Label.

**Hysterese** (`GOAL_STAGE_HYSTERESIS` = 0.04): Ein Ziel bei 74,9 %, das mit
jeder Buchung die 75-%-Marke streift, würde sonst bei jedem Datenrefresh die
Farbe wechseln — genau das Flackern, das Prinzip 2 mit „schwellwertbewusst"
ausschließt. Sie wirkt **nur gegen das Zurückfallen**: wer die nächste Stufe
erreicht, sieht es sofort. Eine Glättung, die den Moment verzögert, auf den
das ganze Feature hinarbeitet, wäre der falsche Kompromiss.

Den Vorzustand hält `use-city-model.ts` in einem Ref — der Adapter bleibt rein.
Ein persistiert erreichtes Ziel wird nie zurückgestuft (Trophäe, kein Rückbau)
— dieselbe Zusicherung, die der Balken schon gibt.

## Flusslinien für wiederkehrende Zahlungen (WP-5.1)

Die Stadt zeigte, **wohin** das Geld geht (Gebäudehöhe je Unterkategorie), aber
nicht, welcher Teil davon jeden Monat ohne weiteres Zutun abfließt. Genau der
ist der interessante: Fixkosten kann man kündigen, einmalige Ausgaben nur
bereuen.

**Woher die Wiederkehr kommt.** Das Modell wusste sie nicht — WP-E2 hatte
`computeContracts` bewusst aus der Etagen-Ableitung entfernt, weil es Händler
mit zu wenigen Buchungen überspringt und dadurch ganze Etagen verschwanden.
Diese Entscheidung wird **nicht** zurückgenommen. Stattdessen leitet
`domain/city-recurrence.ts` die Wiederkehr aus den Buchungsdaten ab, die ohnehin
schon durch die Etagen-Aggregation laufen: **in mindestens drei verschiedenen
Kalendermonaten gebucht**. Keine zusätzliche Query, keine Rücknahme.

Drei ist die kleinste Zahl, die einen Rhythmus von einem Zufall trennt — bei
zwei Monaten in Folge ist ein Kauf mit Nachbestellung genauso wahrscheinlich wie
ein Abo. Höher anzusetzen würde vierteljährliche Zahlungen (Versicherungen!) aus
kurzen Datenfenstern verschwinden lassen, und genau die sind Fixkosten.

Bewusst **nicht** dasselbe wie ein „Vertrag" im Sinne von
`contract-derivation.ts`: dort geht es um eine nutzerbestätigte Entscheidung
samt Zyklus und Preisänderung. Hier reicht die schwächere Aussage „das kommt
regelmäßig wieder", weil die Linie nur eine Betonung ist und keine Zahl
behauptet, die anderswo anders lautet.

**Die Linie** verbindet die Mitte der Platte mit dem Fuß des Gebäudes. Die Mitte
steht für das Konto — kein erfundener Ort, `layout.center` ist derselbe Punkt,
um den die Kamera die Stadt rahmt. Deckkraft nach Anteil am sichtbaren
Gesamtbetrag; höchstens `MAX_FLOW_LINES` (6), sonst wird aus der Betonung ein
Netz, in dem man nur noch sieht, *dass* es viele gibt.

**Ohne Bewegung — und das ist die eigentliche Entscheidung.** „Fluss" legt eine
fließende Animation nahe. Die liefe endlos und widerspräche der
Render-on-Demand-Vorgabe (siehe oben: der Loop steht bei Stillstand still); sie
kostete auf einem Telefon dauerhaft Akku, ohne eine einzige zusätzliche Zahl zu
zeigen. Die Linien bauen sich mit der Stadt auf und stehen dann — die Aussage
steckt in Vorhandensein und Stärke.

Nur auf **Stadt-Ebene**: beim Eintauchen beantworten die Etagen dieselbe Frage
genauer, dort würden die Linien nur die Baukörper verstellen. Auf der Stufe
`lean` entfallen sie (`quality.flowLines`).

## Fensteraktivität als Datenkanal (WP-5.4)

Das Fenster-Raster der Fassade (WP-E1) war reine Dekoration: **eine** geteilte
Textur auf allen Baukörpern, überall gleich viele Fenster. Ein Gebäude sah
belebt aus, weil es ein Gebäude ist — nicht, weil dort etwas passiert.

Damit lag ein Kanal brach, der etwas zeigen kann, das die **Höhe grundsätzlich
nicht kann**: ob ein Betrag aus einer großen Zahlung besteht oder aus vielen
kleinen. Miete und Restaurantbesuche können denselben Monatsbetrag haben und
sind völlig verschiedene Dinge — das eine ist ein Dauerauftrag, das andere sind
dreißig Entscheidungen.

Maß ist die Buchungs-**Frequenz** (`domain/city-activity.ts`), nicht die
Buchungszahl: absolute Zahlen hingen am geladenen Datenfenster (wer zwei Jahre
importiert, hätte überall „viel Aktivität").

| Stufe | Buchungen/Monat | Beispiel | Fenster |
|---|---|---|---|
| `quiet` | < 1 | Miete, Jahresbeitrag | jede 3. Zelle, blasser |
| `steady` | 1–4 | Großeinkauf, Tanken | jede Zelle (Stand vor WP-5.4) |
| `busy` | > 4 | Bäcker, Mittagessen | jede Zelle, deutlicher |

Zwei Dinge, die die Umsetzung tragen:

- **Bezug ist das gesamte Datenfenster**, nicht die Monate *dieses* Gebäudes.
  Sonst käme ein Gebäude mit einer einzigen Buchung in einem einzigen Monat auf
  „1 Buchung / 1 Monat" und damit auf dieselbe Stufe wie ein echtes monatliches
  Abo (`[REGRESSION]` in `city-activity.test.ts`).
- **Eine Textur je Stufe, nicht je Gebäude.** Die Aktivität gehört in den
  Material-Registry-Schlüssel (`color|opacity|bucket|texture`), sonst teilten
  sich ein ruhiges und ein belebtes Gebäude derselben Farbe eine Instanz. Der
  dispose-Test prüft die Texturzahl deshalb hart auf 8 — sie ist die
  Obergrenze, ab der aus „je Stufe" ein „je Gebäude" geworden wäre.

Drei Stufen bewusst grob: auf einer Fassade aus Kameradistanz sind drei
unterscheidbar, fünf nicht. Wer die genaue Zahl braucht, taucht in die Etagen.

## Legende der visuellen Sprache (WP-5.8)

Die Stadt kodiert inzwischen fünf Dinge gleichzeitig: Höhe (Betrag bzw.
Fortschritt), Distriktfarbe (Bereich bzw. Ziel-Stufe), Hülle (Soll bzw.
Kopffreiheit), Flusslinien (Wiederkehr, WP-5.1) und Fassaden-Fenster
(Aktivität, WP-5.4). Nichts davon erklärt sich von selbst — und ein Kanal, den
niemand liest, ist kein Kanal, sondern Dekoration mit Extraschritten.

`domain/city-legend.ts` + `presentation/CityLegend.tsx` liefern deshalb eine
Legende, erreichbar über den Fragezeichen-Knopf in der Kopfzeile.

**Der Kern ist eine Auswahl, keine Liste.** Erklärt wird nur, was gerade
tatsächlich zu sehen ist. Eine feste Aufzählung wäre in drei von vier Tabs
falsch: im Ziele-Tab bedeutet Höhe Fortschritt und nicht Euro, dort trägt die
Farbe die Fortschritts-Stufe statt des Bereichs, Flusslinien gibt es nur auf
Stadt-Ebene (und nicht auf der Sparstufe), Etagen erst ab der Distrikt-Ebene.
Eine Erklärung für etwas, das nicht auf dem Schirm ist, ist schlimmer als
keine — sie schickt den Blick auf die Suche.

**Was das ausdrücklich NICHT ist: ein Tutorial.**
`docs/tutorial-progressive-disclosure.md` hält dafür bereits eine Architektur
fest — eigene Freischaltungs-Achse (`unlocked_features`, getrennt von
`enabled_nav_features`), `data-tour-id`-Anker, und die dort festgelegte
Reihenfolge „**zuerst die Achse, danach das Overlay**". Die Legende nimmt davon
nichts vorweg: sie ist eine in sich geschlossene Erklärfläche, auf die eine
spätere Führung über `data-tour-id="city-legend"` zeigen kann, statt sie zu
ersetzen. Der Erst-Besuch-Hinweis (`city.tapHint`) bleibt der einzige
ungefragte Wortbeitrag der Seite.

Die Schlüssel stehen in `LEGEND_KEYS` **ausgeschrieben** statt per Template
zusammengesetzt: ein `city.legend.${item}Title` wäre für
`src/i18n/__tests__/call-site-keys.test.ts` unsichtbar, und ein Tippfehler
landete als roher Punkt-String auf dem Bildschirm (AGENTS.md §6).

## Zeitachse (WP-5.2)

Die Stadt zeigte immer denselben Ausschnitt — alle geladenen Buchungen auf
einmal. „Wie sah der letzte Monat aus" und „was kommt auf mich zu" waren beide
nicht beantwortbar.

Die Monatsleiste (nur im **Ausgaben-Tab**) schaltet schrittweise durch:

| Bereich | Quelle | Auswahl |
|---|---|---|
| Vergangenheit | echte Buchungen, auf den Monat gefiltert | nur Monate, in denen es Daten gibt |
| Laufender Monat | echte Buchungen | immer vorhanden |
| Zukunft | **Prognose des bestehenden Forecasts** | immer die nächsten 3 |

**Die Stadt prognostiziert nichts.** Sie liest `['forecast-input']` — denselben
Query-Key wie `useForecast`, also geteilter Cache und kein Duplikat — und lässt
`@/lib/forecast-category-projection#projectCategorySpend` daraus die erwarteten
Beträge je Kategorie bilden. Die Query ist nur im Prognosemonat aktiviert; der
Normalfall lädt keinen Byte mehr als vorher. Eine zweite Prognose neben dem
Cashflow-Forecast, die diesem widersprechen könnte, gibt es nicht.

Vier Entscheidungen tragen das:

- **Stabile Distriktfarben.** Die Farbe kam aus dem *Index nach Betrag*. Beim
  Monatswechsel ändern sich die Beträge — die Stadt hätte bei jedem Schritt
  umgefärbt und wäre nicht mehr als dieselbe erkennbar. `buildCityModelFromData`
  nimmt jetzt eine feste Farbe je Distrikt-ID (`districtColorMap` des
  Gesamtmodells).
- **Prognose ist sichtbar Prognose.** Durchscheinende Baukörper mit Kante —
  dieselbe Bildsprache, die die Stadt schon für „noch nicht erreicht" nutzt
  (Ziel-Hülle). Die Deckkraft wird nur *gesenkt*, nie angehoben. Dazu ein
  „Prognose"-Chip an der Monatsanzeige und ein eigener Legenden-Eintrag.
- **Kein Mischmonat.** Vordatierte Buchungen begründen keinen
  Vergangenheitsmonat. Ein Monat mit Ist- *und* Prognosewerten wäre nicht
  erklärbar — man könnte nicht sagen, welche Zahl woher kommt.
- **Keine erfundene Genauigkeit.** Ein Prognosemonat hat keine Etagen, keine
  Fassaden-Aktivität und keine Flusslinien: die Prognose kennt Kategorien, keine
  Händler und keine Buchungsfrequenz.

Nur im Ausgaben-Tab, weil nur dort eine Prognose je Kategorie existiert — ein
Monatsregler, der in drei von vier Tabs nichts tut, wäre schlimmer als keiner.
Ohne Auswahl bleibt der Vorgabe-Ausschnitt (alle Buchungen) wie vor WP-5.2; die
Seite startet nicht in einem Zustand, den niemand gewählt hat.

## Folgeschritte

- **Echte Daten**: Adapter, der `buildSunburstTree` (`src/lib/analysis-data.ts`)
  und `computeContracts` (`src/lib/contract-derivation.ts`) auf
  `CityDistrictData`/`CityContractData` abbildet, statt der Fixture in
  `data/city-demo-data.ts`. Typen wandern dabei nach `domain/city-model.ts`.
- **Canvas-Lifecycle** (WP-C3): three.js-Renderer/Kamera/Szene,
  Render-on-Demand-Loop, DPR-Cap, HTML-Label-Overlays.
- **Navigation/Drill-down-State** (WP-C2): Application-Hook ohne
  three.js-Importe.
