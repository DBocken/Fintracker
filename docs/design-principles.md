# Design-Prinzipien (Fintracker)

> Abgeleitet aus der Wettbewerbsanalyse, insbesondere von **Copilot Money** – der am besten
> gestalteten Finanz-App am Markt (Apple Design Award Finalist 2024). Wir übernehmen die
> **Prinzipien**, nicht das Visual: eigenes Farbsystem, eigene Icons, eigenes Layout
> (Trade Dress ist geschützt, Designprinzipien nicht).

---

## Die 7 Prinzipien

### 1. Geschwindigkeit ist ein Feature
Local-First heißt: Interaktionen fühlen sich **sofort** an, offline-fähig, kein Spinner-Warten.
Das ist unser struktureller Vorteil gegenüber Cloud-Apps – wir kommunizieren ihn aktiv.

### 2. Bewegung mit Bedeutung — **datengetriebener Aufbau ist die Baseline**
Jede Animation muss *intentional* sein, nicht dekorativ. **Baseline ist unsere eigene,
datengetriebene Implementierung** (SVG / Framer Motion / CSS / `requestAnimationFrame` / Recharts).
Kernregel: **visualisierte Daten poppen nicht auf, sie werden *aufgebaut*** (hochzählen, füllen,
wachsen, einzeichnen) – die Aufbau-Art hängt vom Visualisierungstyp ab. Animationen sind immer
**daten- und schwellwertbewusst** (Farb-/Statuswechsel an Schwellen, wie beim `BudgetTank`).
**Lottie ist NICHT die Baseline**, sondern eine Option für expressive Set-Pieces, die wir künftig
prüfen (Details unten).

### 3. Ruhe vor Fülle (Klarheit)
Jeder Screen hat **eine** klare Hauptaussage. Viel Weißraum, klare Typografie, datenreich aber
rauschfrei. **Werbefrei** als bewusster Gegenentwurf zu Finanzguru/Emma. „Rewards check-ins instead
of punishing with clutter."

### 4. Unsichtbare Intelligenz, sichtbare Erklärung
Automatik reduziert Arbeit (Auto-Kategorisierung, Vorschläge, Forecast). Aber im Gegensatz zu
Copilots Black-Box ist unsere Intelligenz **erklärbar**: Confidence + Gründe, editierbare Regeln.
Das ist ein bewusster Differenzierer.

### 5. Vertrauen zuerst
Onboarding ohne Risiko: **erst ausprobieren / manuell anlegen, dann Bank verbinden** (passt zu
Local-First/Anonym-Modus). Sensible Schritte erst, wenn der Nutzer Wert gesehen hat.

### 6. Ein konsistentes Token-System
Farbe, Icon, Typo, Radius, Spacing app-weit identisch über Tokens. Pro Kategorie ein stabiles
Farb-/Icon-Token (mit Monogramm-Fallback). Keine Insel-Lösungen pro Screen.

### 7. Zugänglichkeit ist nicht optional
`prefers-reduced-motion` wird überall respektiert – **auch bei Lottie** (pausieren/durch statisches
Poster ersetzen). Aussagekräftige `aria-label`, Tap-Ziele groß genug, Kontrast ausreichend.

---

## Animations-Baseline: datengetriebener Aufbau

**Grundregel: Visualisierte Daten werden aufgebaut, nicht aufgepoppt.** Sie animieren in ihren
Zielzustand statt sofort dazustehen – und reflektieren dabei immer **Daten und Schwellwerte**.

### Aufbau je Visualisierungstyp (Beispiele)
| Typ | Aufbau („nicht poppen") |
|---|---|
| **Zahlen / KPIs** | Hochzählen (`useAnimatedNumber`) statt Endwert sofort setzen |
| **Balken / Flächen / Linien** | Recharts-Aufbau-Animation **aktiv lassen** (kein `isAnimationActive={false}`); Linien zeichnen sich, Balken wachsen |
| **Tank / Gauge / Progress** | Füll-Animation von 0 → Zielwert (`BudgetTank`, rAF) |
| **Listen / Karten** | Gestaffeltes Einblenden (stagger), nicht alles auf einmal |

### Immer daten- & schwellwertbewusst
- Farbe/Status wechseln **an Schwellen** (z. B. `colorForFill`: blau → bernstein → rot je Füllstand;
  Budget-Ampel ok/warn/über). Die Animation transportiert den Schwellwert sichtbar mit.
- Werte sind exakt datengebunden – keine dekorativen Fake-Bewegungen.

### Reduced Motion
`prefers-reduced-motion` wird respektiert: Aufbau überspringen und **direkt** den Zielzustand zeigen
(zentral über `useReducedMotion`). „Direkt gesetzt" bei reduzierter Bewegung ist erlaubt – das ist
kein verbotenes „Poppen", sondern Barrierefreiheit.

### Lottie — Option für die Zukunft (NICHT Baseline)
Lottie kann später für **expressive Set-Pieces** sinnvoll sein, die datengetriebenes SVG schlecht
abbildet: Celebrations, Empty-/Onboarding-Illustrationen, Maskottchen. Es ist aber **kein Standard**
und nicht verpflichtend. Für *datengetriebene, theme-abhängige, vielfach instanziierte* Grafik (Tank,
Charts) bleibt unsere eigene Implementierung überlegen (exakter Füllstand, stufenlose Schwellen-Farbe,
CSS-Theme-Vererbung, geringes Gewicht). Vor einem Lottie-Einsatz: Renderer (`lottie-react` bzw.
`@lottiefiles/dotlottie-react`) hinzufügen und `prefers-reduced-motion` berücksichtigen.

### Automatische Prüfung (Baseline-Hook)
`.claude/settings.json` enthält einen PostToolUse-Hook
(`.claude/hooks/animation-baseline-check.mjs`): Nach jeder Bearbeitung einer UI-Datei
(`src/**/*.tsx|ts`) meldet er, wenn Daten **aufpoppen** (`isAnimationActive={false}`) oder ein Chart
ergänzt wird, der die Aufbau-Animation/Schwellwerte berücksichtigen sollte. Rein hinweisend – er
erzwingt die bewusste Entscheidung für den datengetriebenen Aufbau.

---

## Konkrete To-dos aus den Prinzipien (Backlog)
1. Aufbau-Animation überall sicherstellen: `isAnimationActive={false}` in `TransactionCharts.tsx` /
   `LiquidityReport.tsx` prüfen und – wo sinnvoll – auf aktiven Aufbau umstellen (Prinzip 2).
2. „Zu prüfen"-Inbox für unsichere Transaktionen (Swipe) **mit Erklärung** (Prinzip 4).
3. Fokussiertes Dashboard: „Dieser Monat"-Karten (Ausgegeben · Trend · Forecast), Prinzip 3.
4. Command-Palette (⌘K), mobile Haptics, einheitliches Token-System.
5. Lottie evaluieren (Zukunft): nur für expressive Set-Pieces (Celebration/Empty-State).
