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

## Folgeschritte

- **Echte Daten**: Adapter, der `buildSunburstTree` (`src/lib/analysis-data.ts`)
  und `computeContracts` (`src/lib/contract-derivation.ts`) auf
  `CityDistrictData`/`CityContractData` abbildet, statt der Fixture in
  `data/city-demo-data.ts`. Typen wandern dabei nach `domain/city-model.ts`.
- **Canvas-Lifecycle** (WP-C3): three.js-Renderer/Kamera/Szene,
  Render-on-Demand-Loop, DPR-Cap, HTML-Label-Overlays.
- **Navigation/Drill-down-State** (WP-C2): Application-Hook ohne
  three.js-Importe.
