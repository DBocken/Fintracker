# TDD-Spezifikationen — Erste Arbeitspakete

> Diese Datei enthält die vollständigen Test-Driven-Development-Spezifikationen
> für die ersten implementierungsrelevanten Arbeitspakete. Jede Spezifikation
> wird vom **Test Architect** vor der Implementierung erstellt und vom **Builder**
> als verbindliche Vorgabe verwendet.

---

## Inhaltsverzeichnis

1. [WP-2.1: Motion Token System](#wp-21-motion-token-system)
2. [WP-2.2: Skin-Konsolidierung](#wp-22-skin-konsolidierung)
3. [WP-2.3: Typografie-Hierarchie-System](#wp-23-typografie-hierarchie-system)
4. [WP-2.4: Atmosphere State Hook](#wp-24-atmosphere-state-hook)
5. [WP-3.1: Atmosphere Layer Component](#wp-31-atmosphere-layer-component)
6. [WP-3.2: Shared Element Transition Infrastructure](#wp-32-shared-element-transition-infrastructure)
7. [WP-3.3: Enhanced Empty State System](#wp-33-enhanced-empty-state-system)
8. [WP-4.1: Dashboard Hero Hierarchy](#wp-41-dashboard-hero-hierarchy)
9. [WP-4.2: Budget Tank Mikroreaktionen](#wp-42-budget-tank-mikroreaktionen)
10. [WP-4.3: City-Atmosphäre: Wetter-Logik](#wp-43-city-atmosphäre-wetter-logik)

---

<a id="wp-21-motion-token-system"></a>
## WP-2.1: Motion Token System

### Verifizierter Ist-Zustand

- `src/hooks/useAnimatedNumber.ts`: verwendet `easeOutCubic` hartcodiert.
- `src/components/budgets/BudgetTank.tsx`: `FILL_ANIM_MS = 1300` hartcodiert.
- `src/features/finance-city/domain/camera-math.ts`: exportiert `easeInOutCubic`.
- `src/features/finance-city/presentation/city-scene.ts`: importiert `easeInOutCubic`,
  verwendet `BAR_GROWTH_DURATION_MS = 500`, `OPACITY_FADE_DURATION_MS = 400`,
  `BUILD_STAGGER_MS = 50` als lokale Konstanten.
- `src/index.css`: globale `@media (prefers-reduced-motion: reduce)` setzt alle
  `animation-duration` und `transition-duration` auf `0.001ms`.
- Keine zentrale Motion-Token-Quelle existiert. Easing-Kurven und Dauern sind
  über mindestens 5 Dateien verstreut.
- Framer Motion wird direkt mit Inline-`transition`-Props verwendet (z.B.
  `tapHintMotion` in `CityPage.tsx`).

### Erwartetes Verhalten

#### EV-1: Motion-Easing-Token existieren als benannte Exporte

- **Anforderung:** Ein Modul `src/lib/motion-tokens.ts` exportiert ein
  `MOTION_EASINGS`-Objekt mit exakt 5 Kurven.
- **Eingaben:** Import des Moduls.
- **Erwartetes Ergebnis:**
  ```typescript
  MOTION_EASINGS = {
    precision: string,  // cubic-bezier(0.22, 1, 0.36, 1)
    build: string,      // cubic-bezier(0.33, 1, 0.68, 1)
    spatial: string,    // cubic-bezier(0.65, 0, 0.35, 1)
    confirm: string,    // cubic-bezier(0.34, 1.56, 0.64, 1)
    warn: string,       // cubic-bezier(0.87, 0, 0.13, 1)
  }
  ```
- Jeder Wert ist ein gültiger CSS `cubic-bezier()`-String.
- **Testebene:** Unit.
- **Datenzustand:** Statisch (keine Finanzdaten).

#### EV-2: Motion-Duration-Token existieren als benannte Exporte

- **Anforderung:** Dasselbe Modul exportiert `MOTION_DURATIONS` mit 4 Stufen.
- **Erwartetes Ergebnis:**
  ```typescript
  MOTION_DURATIONS = {
    fast: 150,      // ms — Hover, Press, Mikrointeraktionen
    default: 300,   // ms — Standard-Übergänge, Tab-Wechsel
    slow: 600,      // ms — Räumliche Bewegung, Kamera
    signature: 1200 // ms — Signature Moments (Ziel erreicht, etc.)
  }
  ```
- **Testebene:** Unit.

#### EV-3: Reduced-Motion-Auflösung

- **Anforderung:** Eine Funktion `resolveDuration(duration: number, reduced: boolean)`
  liefert bei `reduced === true` den Wert `0` (nicht `0.001` — die CSS-Media-Query
  fängt den Rest ab).
- **Testebene:** Unit.

#### EV-4: CSS-Custom-Properties werden gesetzt

- **Anforderung:** Das Modul exportiert eine Funktion `injectMotionCSSVars()` die
  `--motion-easing-*` und `--motion-duration-*` als CSS-Variablen auf `:root`
  setzt. Alternativ werden die Werte direkt in `index.css @layer base` geschrieben.
- **Erwartetes Ergebnis:** Nach Modul-Import oder CSS-Laden existieren:
  `--motion-easing-precision`, `--motion-easing-build`, `--motion-easing-spatial`,
  `--motion-easing-confirm`, `--motion-easing-warn`, `--motion-duration-fast`,
  `--motion-duration-default`, `--motion-duration-slow`, `--motion-duration-signature`.
- **Testebene:** Component (via `getComputedStyle`).

#### EV-5: Bestehende Komponenten funktionieren weiterhin

- **Anforderung:** `useAnimatedNumber` verwendet `MOTION_DURATIONS.default`
  (oder einen explizit übergebenen Wert) statt hartcodiertem `1300`.
- **Erwartetes Ergebnis:** Der Hook verhält sich identisch — gleiche Tween-Mechanik,
  gleiche Reduced-Motion-Behandlung.
- **Testebene:** Unit + Component (bestehende Tests müssen weiterhin bestehen).

### Verbotenes Verhalten

#### VB-1: Motion-Token dürfen nicht Theme-abhängig sein
- **Verboten:** Easing-Kurven oder Dauern, die sich je nach aktivem Skin ändern.
- **Grund:** Bewegung ist eine universelle Produktsprache, kein Stilelement.
- **Prüfung:** Unit-Test mit verschiedenen Skin-Klassen auf `<html>`.

#### VB-2: Non-Signature-Dauern dürfen 600ms nicht überschreiten
- **Verboten:** `fast`, `default`, `slow` mit Werten > 600ms.
- **Grund:** Prinzip 1 (Geschwindigkeit ist ein Feature). Keine alltägliche
  Animation darf den Nutzer länger als 600ms aufhalten.
- **Prüfung:** Unit-Test mit Assertions auf die Token-Werte.

#### VB-3: Keine neuen Runtime-Abhängigkeiten
- **Verboten:** Import von `gsap`, `motion-one` oder anderen Animationsbibliotheken.
- **Grund:** AGENTS.md §7 — Animationen via Framer Motion / CSS / rAF.
- **Prüfung:** `package.json`-Diff-Check.

#### VB-4: Keine Blockierung bei fehlenden CSS-Variablen
- **Verboten:** Runtime-Fehler, wenn `getComputedStyle` die Variablen nicht
  findet (z.B. in jsdom ohne CSS-Layer).
- **Grund:** Tests und SSR dürfen nicht crashen.
- **Prüfung:** Component-Test in jsdom.

### Red-Nachweis

#### RED-1: Token-Existenz
- **Test:** `import { MOTION_EASINGS, MOTION_DURATIONS } from '@/lib/motion-tokens'`
- **Erwarteter Fehler:** Module not found — Datei existiert noch nicht.
- **Datei:** `src/lib/__tests__/motion-tokens.test.ts`

#### RED-2: Reduced-Motion-Auflösung
- **Test:** `resolveDuration(300, true)` muss `0` liefern.
- **Erwarteter Fehler:** Funktion existiert nicht.
- **Datei:** `src/lib/__tests__/motion-tokens.test.ts`

#### RED-3: useAnimatedNumber verwendet Token
- **Test:** Prüft, dass `useAnimatedNumber` bei `durationMs` nicht übergeben
  den Default `MOTION_DURATIONS.default` (300) statt 1300 verwendet.
- **Erwarteter Fehler:** Hook verwendet noch den hartcodierten Default 1300.
- **Datei:** `src/hooks/__tests__/useAnimatedNumber.test.tsx` (Erweiterung).

### Testdaten

- TD-STATIC: Keine Finanzdaten — reine Token-Validierung.
- TD-REDUCED: `useReducedMotion()` mock → `true`.

### Regression Scope

- `src/hooks/__tests__/useAnimatedNumber.test.tsx` — bestehende Tests müssen
  bestehen (Default-Dauer ändert sich von 1300 auf 300, was schneller ist aber
  dasselbe Verhalten produziert; bestehende Tests mit `durationMs: 1300` müssen
  explizit weiterhin funktionieren).
- `src/components/budgets/__tests__/BudgetTank.test.tsx` — Tank-Animation muss
  weiterhin funktionieren.
- `src/features/finance-city/presentation/__tests__/city-scene.test.ts` —
  Kamera-/Aufbau-Animationen müssen weiterhin die korrekten Werte verwenden.
- `src/pages/__tests__/CityPage.test.tsx` — tapHintMotion muss weiterhin funktionieren.

### Manuelle Prüfpunkte

- MP-1: Visuelle Prüfung, dass die `confirm`-Kurve (overshoot) bei
  CelebrationBurt angenehm und nicht übertrieben wirkt — Art Director.

### Nachweise

- [ ] `src/lib/motion-tokens.ts` existiert mit allen Exporten.
- [ ] `src/lib/__tests__/motion-tokens.test.ts` besteht.
- [ ] Red-Output dokumentiert (alle Tests schlugen vor Implementierung fehl).
- [ ] `useAnimatedNumber` referenziert Token, keinen Magic Number.
- [ ] City-szene referenziert Token für Dauern (Easing bleibt easeInOutCubic dort).
- [ ] Regression Suite vollständig durchlaufen.
- [ ] Keine neuen npm-Abhängigkeiten.

---

<a id="wp-22-skin-konsolidierung"></a>
## WP-2.2: Skin-Konsolidierung

### Verifizierter Ist-Zustand

- `src/skins/skins.ts`: 9 Skins definiert (`ruhe`, `legacy`, `clean`, `neon`,
  `imperium`, `sakura`, `iron-man`, `cyberpunk`, `liquid-holo`).
- `src/skins/skins.css`: Vollständige CSS-Variablen-Überschreibungen je Skin,
  inkl. `body`-Background-Gradients für Neon/Imperium/Sakura/Iron-Man/Cyberpunk/Liquid-Holo.
- `src/skins/skins-components.css`: Karten-Spezial-Styling (CRT-Scanlines,
  Irisation, Arc-Reactor-Glow, etc.) für 6 der 9 Skins.
- `src/components/providers/SkinProvider.tsx`: Lädt/peichert Skin-Auswahl.
- `src/components/settings/AppearanceSettings.tsx`: UI zur Skin-Auswahl.
- `normalizeSkinId()` in `skins.ts`: Fallback auf `ruhe`.
- Bestehende Tests: `src/skins/__tests__/skins.test.ts`.

### Designentscheidung (vom Orchestrator freizugeben)

**Empfehlung:** Reduktion auf 3 Skins:
1. **Ruhe** (kanonische Identität, Light + Dark)
2. **Legacy** (konservative Alternative für Nutzer, die neutrale Graustufen bevorzugen)
3. **Night** (neue eigenständige Nacht-Identität — nicht einfach Dark-Mode-Invertierung,
   sondern eine eigene Lichtlogik mit tieferen Schwarztönen, kühlerem Akzent und
   dezenter eigener Atmosphäre)

Die übrigen 6 Skins (clean, neon, imperium, sakura, iron-man, cyberpunk, liquid-holo)
werden als `INACTIVE_SKINS` markiert — Definitionen bleiben im Code (kein Breaking
Change für Nutzer, die sie gespeichert haben), sind aber in der Auswahl-UI nicht
sichtbar und werden auf `ruhe` normalisiert.

### Erwartetes Verhaltung

#### EV-1: Aktive Skin-Liste ist reduziert

- **Anforderung:** Ein neues Export `ACTIVE_SKINS: SkinDef[]` enthält nur noch
  die 3 aktiven Skins.
- **Testebene:** Unit.
- **Datei:** `src/skins/__tests__/skins.test.ts` (Erweiterung).

#### EV-2: Inaktive Skins werden normalisiert

- **Anforderung:** `normalizeSkinId('cyberpunk')` liefert weiterhin `'cyberpunk'`
  (kein Breaking Change für gespeicherte Präferenzen), ABER
  `getActiveSkinId('cyberpunk')` liefert `'ruhe'` (die UI zeigt nur aktive Skins).
- **Testebene:** Unit.

#### EV-3: AppearanceSettings zeigt nur aktive Skins

- **Anforderung:** Die Auswahl-UI rendert nur die 3 aktiven Skins.
- **Testebene:** Component.
- **Datei:** `src/components/settings/__tests__/` (neu oder Erweiterung).

#### EV-4: Bestehende Skin-CSS bleibt funktional

- **Anforderung:** Ein Nutzer mit gespeichertem Skin `imperium` sieht weiterhin
  das Imperium-Theme (kein visuelles Brechen), auch wenn er es nicht mehr
  auswählen kann.
- **Testebene:** Component (Skin-Klasse auf `<html>` wird gesetzt).

#### EV-5: Neue `Night`-Identität hat eigene Dark-Logik

- **Anforderung:** Der `night`-Skin definiert eigene `--background`, `--card`,
  `--sidebar` Werte, die **tiefer** sind als der Standard-Dark-Mode und einen
  eigenen Akzent tragen (z.B. kühleres Petrol/Indigo statt Standard-Teal).
- **Testebene:** Unit (CSS-Variablen-Existenz) + Component (visuelle Prüfung).
- **Designentscheidung:** Die exakten HSL-Werte werden vom Art Director
  festgelegt, nicht vom Test Architect.

### Verbotenes Verhalten

#### VB-1: Kein Breaking Change für bestehende Nutzer
- **Verboten:** Löschen von Skin-Definitionen aus `skins.ts` oder `skins.css`.
- **Grund:** Ein Nutzer, der `sakura` gespeichert hat, darf kein weißes
  Standard-Theme sehen ohne Vorwarnung.
- **Prüfung:** Unit-Test: `getSkin('sakura')` liefert weiterhin die Definition.

#### VB-2: Keine automatische Theme-Wiederherstellung ohne Zustimmung
- **Verboten:** Beim nächsten Öffnen wird der inaktive Skin automatisch
  auf `ruhe` zurückgesetzt, ohne dass der Nutzer informiert wird.
- **Grund:** User Agency — der Nutzer muss verstehen, was passiert ist.
- **Prüfung:** Component-Test: Beim Laden mit inaktivem Skin wird ein
  Hinweis angezeigt (einmalig, dismissing).
- **Hinweis:** Die Hinweis-UI ist ein separater Bestandteil dieses WP.

#### VB-3: Keine visuelle Regression für aktive Skins
- **Verboten:** Veränderung der `ruhe` oder `legacy` CSS-Variablen.
- **Prüfung:** Visual Regression für Standard-Screens in `ruhe`.

### Red-Nachweis

#### RED-1: ACTIVE_SKINS existiert nicht
- **Test:** `import { ACTIVE_SKINS } from '@/skins/skins'` → Module not found.
- **Datei:** `src/skins/__tests__/skins.test.ts`

#### RED-2: getActiveSkinId existiert nicht
- **Test:** `getActiveSkinId('cyberpunk')` → Funktion not defined.

#### RED-3: Night-Skin existiert nicht
- **Test:** `SKINS.find(s => s.id === 'night')` → `undefined`.

### Regression Scope

- `src/skins/__tests__/skins.test.ts` — vollständig.
- `src/components/settings/AppearanceSettings.tsx` und Tests.
- `src/components/providers/__tests__/SkinProvider.test.tsx`.
- Visual Regression: alle Standard-Screens im `ruhe`-Skin müssen unverändert aussehen.
- E2E: Onboarding → Skin-Auswahl → korrekte Anwendung.

### Manuelle Prüfpunkte

- MP-1: Der `night`-Skin fühlt sich wie eine eigenständige Identität an, nicht wie
  ein dunklerer `ruhe`-Dark-Mode — Art Director.
- MP-2: Der Hinweis für Nutzer mit inaktivem Skin ist klar, nicht alarmierend und
  erklärt die nächste Aktion — UX Critic.

---

<a id="wp-23-typografie-hierarchie-system"></a>
## WP-2.3: Typografie-Hierarchie-System

### Verifizierter Ist-Zustand

- `src/index.css`: `--font-sans: 'Inter Variable'`, `--font-display: 'Space Grotesk Variable'`.
- Global: `font-variant-numeric: tabular-nums` auf `body`.
- `tailwind.config.js`: `fontFamily.sans = "var(--font-sans)"`, `fontFamily.display = "var(--font-display)"`.
- `src/features/shared/presentation/StatHero.tsx`: `text-3xl` (30px) für Hero-Werte, `text-xs` für Labels.
- `src/components/kpi/KpiCard.tsx`: unbekannte Größe — zu prüfen.
- Variable Fonts installiert: `@fontsource-variable/inter`, `space-grotesk`, `quicksand`, `orbitron`.
- Keine zentrale Typografie-Skala als Token existiert. Größen sind Tailwind-Utilities
  verstreut (`text-3xl`, `text-lg`, `text-sm`, etc.).

### Erwartetes Verhalten

#### EV-1: Typografie-Token als CSS-Variablen

- **Anforderung:** `index.css @layer base :root` definiert:
  ```
  --font-size-hero: 3.5rem;     /* 56px — Helden-KPI, Desktop */
  --font-size-hero-mobile: 2.25rem; /* 36px — Helden-KPI, Mobile */
  --font-size-display: 1.875rem; /* 30px — Seitentitel */
  --font-size-headline: 1.25rem; /* 20px — Abschnittsüberschrift */
  --font-size-body: 0.9375rem;  /* 15px — Standard-Text */
  --font-size-caption: 0.75rem; /* 12px — Beschriftung, minimal */
  --font-weight-display: 700;
  --font-weight-value: 700;
  --font-weight-label: 500;
  --font-weight-body: 400;
  ```
- **Testebene:** Unit (CSS-Variable existiert via String-Check im CSS).

#### EV-2: StatHero verwendet Hero-Typografie

- **Anforderung:** `StatHero` rendert den `value` mit
  `font-size: var(--font-size-hero)` auf Desktop,
  `font-size: var(--font-size-hero-mobile)` auf Mobile.
- **Erwartetes Ergebnis:** Die Hero-Zahl ist deutlich größer als alle anderen
  Elemente auf dem Screen (Mindestens 1.75x größer als die nächstgrößere Schrift).
- **Testebene:** Component (computed style check).

#### EV-3: tabular-nums bleibt global

- **Anforderung:** `body` hat weiterhin `font-variant-numeric: tabular-nums`.
- **Testebene:** Component.

#### EV-4: Display-Font nur für Headings

- **Anforderung:** `h1, h2, h3` verwenden `--font-display`. Alle anderen
  Textelemente verwenden `--font-sans`.
- **Erwartetes Ergebnis:** Keine Veränderung zum Ist-Zustand (bereits korrekt),
  aber explizit durch Token gesichert.
- **Testebene:** Component.

### Verbotenes Verhalten

#### VB-1: Keine Textgröße unter 12px
- **Verboten:** Jedes sichtbare Textelement mit `font-size < 12px`.
- **Ausnahme:** `aria-label`, `sr-only` — nicht sichtbar.
- **Prüfung:** Component-Tests mit `getComputedStyle` für Schlüsselkomponenten.

#### VB-2: Keine hardcodierten Pixelgrößen in neuem Code
- **Verboten:** `style={{ fontSize: '32px' }}` oder `className="text-[32px]"` in
  neuen oder geänderten Komponenten.
- **Erlaubt:** Bestehende Inline-Styles dürfen bleiben, bis die Komponente
  ohnehin überarbeitet wird.
- **Prüfung:** ESLint-Regel oder Code-Review.

#### VB-3: Keine Nicht-Variablen-Font-Instanzen
- **Verboten:** Import von `@fontsource/inter` (statisch) statt
  `@fontsource-variable/inter`.
- **Prüfung:** `package.json`-Diff und Import-Check.

### Red-Nachweis

#### RED-1: Typografie-Token nicht in CSS
- **Test:** Prüft, dass `getComputedStyle(document.documentElement)`
  `--font-size-hero` zurückgibt.
- **Erwarteter Fehler:** Variable nicht definiert → leerer String oder `undefined`.

#### RED-2: StatHero verwendet nicht die Hero-Größe
- **Test:** Rendert `StatHero` und prüft `computedStyle.fontSsize` des
  `value`-Elements.
- **Erwarteter Fehler:** Größe ist `30px` (text-3xl), nicht `56px`.

### Regression Scope

- Alle Komponenten, die `StatHero` verwenden — visuelle Regression.
- `src/features/shared/presentation/__tests__/` — bestehende Tests.
- Alle Screens mit KPIs — Desktop und Mobile Screenshots.

### Manuelle Prüfpunkte

- MP-1: Die Hero-Zahl auf dem Dashboard dominiert visuell — Art Director.
- MP-2: Auf Mobile (375px) ist die Hero-Zahl groß, aber nicht überlaufend — UX Critic.

---

<a id="wp-24-atmosphere-state-hook"></a>
## WP-2.4: Atmosphere State Hook

### Verifizierter Ist-Zustand

- Keine zentrale Atmosphäre-Logik existiert.
- `src/lib/status-bucket.ts`: 5-stufige Status-Logik für Health Scores.
- `src/services/financial-health-service.ts`: berechnet `FinancialHealth` mit
  `score` und `subScores`.
- `src/hooks/useForecast.ts`: Prognose-Daten verfügbar.
- `src/lib/analysis-data.ts`: `sumIncome`, `sumExpenses` für Aggregation.

### Erwartetes Verhalten

#### EV-1: useAtmosphereState existiert und liefert einen Atmosphäre-Zustand

- **Anforderung:** Ein Hook `useAtmosphereState()` in
  `src/hooks/useAtmosphereState.ts` liefert:
  ```typescript
  type AtmosphereState = {
    temperature: 'warm' | 'cool' | 'neutral';
    intensity: number; // 0.0 bis 1.0
    pulse: 'steady' | 'alert' | 'celebrate';
  }
  ```
- **Testebene:** Unit (Hook mit mock-Query-Daten).

#### EV-2: Temperatur-Ableitung aus Finanzdaten

- **Anforderung:** Die Temperatur wird aus verfügbaren Finanzkennzahlen abgeleitet:
  - `warm`: positiver monatlicher Saldo ODER Health Score > 70 ODER alle Budgets
    im grünen Bereich.
  - `cool`: negativer monatlicher Saldo ODER Health Score < 40 ODER ≥1 Budget
    überschritten.
  - `neutral`: Saldo nahe 0 ODER Health Score 40–70 ODER unvollständige Daten.
- **Testebene:** Unit mit konkreten Datenzuständen.

#### EV-3: Intensity-Ableitung

- **Anforderung:** `intensity` korreliert mit der Stärke der Abweichung:
  - 0.0 bei neutral, unvollständigen Daten oder leer.
  - 0.3–0.5 bei leichter Abweichung (kleiner positiver/negativer Saldo).
  - 0.7–1.0 bei starker Abweichung (großer Saldo, kritischer Health Score).
- **Testebene:** Unit.

#### EV-4: Leere Daten → neutral, intensity 0

- **Anforderung:** Bei keinen Transaktionen oder nicht geladenen Daten:
  `{ temperature: 'neutral', intensity: 0, pulse: 'steady' }`.
- **Testebene:** Unit.

#### EV-5: Reduced Motion deaktiviert `pulse`

- **Anforderung:** Bei `prefers-reduced-motion: reduce` ist `pulse` immer
  `'steady'`, unabhängig vom Finanzzustand.
- **Testebene:** Unit (mit mock `useReducedMotion`).

### Verbotenes Verhalten

#### VB-1: Atmosphäre darf keine Finanzberechnung verändern
- **Verboten:** Der Hook darf `sumIncome`, `sumExpenses` oder andere
  Berechnungsfunktionen nicht verändern oder neu implementieren.
- **Prüfung:** Import-Check — Hook importiert aus `@/lib/analysis-data`, nicht
  eigene Implementation.

#### VB-2: Atmosphäre darf keine Netzwerkanfragen auslösen
- **Verboten:** Direkte `fetch`-, `supabase`- oder IndexedDB-Aufrufe im Hook.
- **Grund:** Hook liest nur bereits geladene Query-Daten (TanStack Query).
- **Prüfung:** Unit-Test ohne Mock-Server — Hook crasht nicht, liefert neutral.

#### VB-3: Atmosphäre darf nicht alarmistisch sein
- **Verboten:** `pulse: 'alert'` bei moderat Risiko (z.B. 1 Budget an der
  Warnschwelle).
- **Grund:** Atmosphäre ist subtil, nicht alarmierend. `alert` nur bei
  akutem Risiko (Budget überschritten UND negativer Saldo).
- **Prüfung:** Unit-Test mit moderaten Daten → `pulse` ist `steady`.

### Red-Nachweis

#### RED-1: Hook existiert nicht
- **Test:** `import { useAtmosphereState } from '@/hooks/useAtmosphereState'`
- **Erwarteter Fehler:** Module not found.

#### RED-2: Temperatur-Ableitung fehlerhaft
- **Test:** Mock-Daten mit positivem Saldo → `temperature` muss `'warm'` sein.
- **Erwarteter Fehler:** Hook existiert nicht oder liefert undefined.

### Testdaten

- TD-POSITIVE: Einnahmen 3000€, Ausgaben 2200€, alle Budgets ok → warm, 0.5
- TD-NEGATIVE: Einnahmen 2500€, Ausgaben 3100€, 1 Budget überzogen → cool, 0.8, alert
- TD-NEUTRAL: Einnahmen 2500€, Ausgaben 2500€ → neutral, 0.0
- TD-EMPTY: Keine Transaktionen → neutral, 0.0
- TD-INCOMPLETE: Nur 3 Tage Daten → neutral, 0.0
- TD-EXTREME: Einnahmen 50000€, Ausgaben 2000€ → warm, 1.0, celebrate

### Regression Scope

- Keine bestehenden Komponenten betroffen (neuer Hook, noch nirgends verwendet).
- `src/hooks/__tests__/` — keine bestehenden Tests berührt.

### Manuelle Prüfpunkte

- MP-1: Die Atmosphäre-Zustände fühlen sich "richtig" an — nicht zu aggressiv,
  nicht zu subtil — Art Director + UX Critic gemeinsam.

---

<a id="wp-31-atmosphere-layer-component"></a>
## WP-3.1: Atmosphere Layer Component

### Verifizierter Ist-Zustand

- WP-2.4 muss abgeschlossen sein (`useAtmosphereState` existiert).
- `src/components/layout/AppShell.tsx`: umschließt jede Route mit
  `<div className="min-h-screen overflow-x-clip bg-background text-foreground">`.
- Keine atmosphärische Hintergrundschicht existiert.
- `src/skins/skins.css`: einige Skins haben `body`-Background-Gradients
  (Neon, Imperium, etc.) — diese sind Skin-spezifisch, nicht datengetrieben.

### Erwartetes Verhalten

#### EV-1: AtmosphereLayer rendert CSS-basierte Hintergrundeffekte

- **Anforderung:** Eine Komponente `AtmosphereLayer` rendert ein `position: fixed`,
  `pointer-events: none`, `z-index: -1` (oder `0` mit entsprechendem
  Content-Stacking) Div mit CSS-Gradients, deren Farben/Opazität vom
  `AtmosphereState` gesteuert werden.
- **Testebene:** Component.

#### EV-2: Temperatur steuert Farbton

- **Anforderung:**
  - `warm`: dezenter warmer Gradient (Amber/Petrol-Mix, Opazität ≤ 0.08).
  - `cool`: dezenter kühler Gradient (Blaugrün/Indigo, Opazität ≤ 0.08).
  - `neutral`: transparent oder extrem dezenter neutraler Gradient.
- **Testebene:** Component (CSS-Variable/Style-Attribut prüfbar).

#### EV-3: Intensity steuert Opazität

- **Anforderung:** Die Opazität der Gradient-Layer ist proportional zu `intensity`,
  mit einem Maximum von 0.08 (subtil, nicht dominant).
- **Testebene:** Component.

#### EV-4: Reduced Motion deaktiviert Animation

- **Anforderung:** Bei `prefers-reduced-motion: reduce` ist die Hintergrundschicht
  statisch (keine CSS-Animation, keine Transition bei Zustandswechsel).
- **Testebene:** Component.

#### EV-5: AtmosphereLayer ist in AppShell eingebettet

- **Anforderung:** `AppShell` rendert `<AtmosphereLayer />` als erstes Kind
  innerhalb des Root-Divs.
- **Testebene:** Component.

### Verbotenes Verhalten

#### VB-1: AtmosphereLayer darf keine Interaktionen blockieren
- **Verboten:** `pointer-events` != `none`.
- **Prüfung:** Component-Test — Click-Event durch die Layer hindurch.

#### VB-2: AtmosphereLayer darf Inhaltskontrast nicht reduzieren
- **Verboten:** Opazität > 0.1 für sichtbare Gradient-Layer über dem Content.
- **Grund:** Text muss lesbar bleiben (Prinzip 13).
- **Prüfung:** Component-Test mit `getComputedStyle`.

#### VB-3: Kein Canvas/WebGL in AtmosphereLayer
- **Verboten:** `<canvas>` oder WebGL-Kontext in der Layer.
- **Grund:** Performance — Atmosphäre muss auf jedem Gerät laufen.
- **Prüfung:** Component-Test — keine Canvas-Elemente.

#### VB-4: Keine Blockierung bei leeren Daten
- **Verboten:** AtmosphereLayer crasht oder zeigt Fehler bei `intensity: 0`.
- **Prüfung:** Component-Test mit leeren Daten.

### Red-Nachweis

#### RED-1: Komponente existiert nicht
- **Test:** `render(<AtmosphereLayer state={testState} />)` → Komponente nicht gefunden.

#### RED-2: AppShell enthält AtmosphereLayer nicht
- **Test:** `renderWithProviders(<AppShell />)` → kein `[data-testid="atmosphere-layer"]`.

### Regression Scope

- `src/components/layout/AppShell.tsx` und alle Layout-Tests.
- `src/__tests__/layout-overlap.sweep.test.tsx` — Layout-Overlap-Tests.
- Visual Regression: alle Screens — der Hintergrund ändert sich subtil.
- E2E: Navigation zwischen Screens, Hintergrund bleibt stabil.

### Manuelle Prüfpunkte

- MP-1: Der atmosphärische Hintergrund ist wahrnehmbar, aber nicht ablenkend —
  bei der ersten Öffnung UND beim 100. Mal — UX Critic.
- MP-2: Der Farbton bei `cool` (Risiko) fühlt sich "ernst" an, nicht "bedrohlich" —
  Art Director.
- MP-3: Auf einem schwachen Mobilgerät gibt es keine spürbare Performance-
  Beeinträchtigung — Performance Critic.

---

<a id="wp-32-shared-element-transition-infrastructure"></a>
## WP-3.2: Shared Element Transition Infrastructure

### Verifizierter Ist-Zustand

- Framer Motion (`framer-motion` ^12.42.2) ist installiert und unterstützt
  `layoutId` für Shared-Element-Transitions.
- `src/features/shared/presentation/InteractiveCard.tsx`: klickbare Karte, bereits mit
  Framer Motion `motion` importiert in `__tests__`.
- `src/components/dashboard/Dashboard.tsx`: verwendet `InteractiveCard` und
  direkte `Link`-Navigation.
- `src/pages/BudgetsPage.tsx`, `BudgetDetailDialog.tsx`: Budget-Detail öffnet
  als Dialog, nicht als Shared-Element-Transition.
- React Router v7 (`react-router-dom` ^7.18.1) ist aktiv.

### Erwartetes Verhalten

#### EV-1: useSharedElementTransition Hook existiert

- **Anforderung:** Ein Hook in `src/hooks/useSharedElementTransition.ts`:
  ```typescript
  function useSharedElementTransition<T extends string>(
    sourceId: T
  ): {
    layoutId: string;
    isActive: boolean;
  }
  ```
  Liefert eine stabile `layoutId` für Framer Motion, die Source und Ziel
  verbindet.
- **Testebene:** Unit.

#### EV-2: Transition ist unterbrechbar

- **Anforderung:** Wenn der Nutzer während der Transition navigiert (Back-Button,
  anderer Link), bricht die Transition ab, ohne einen inkonsistenten Zustand zu
  hinterlassen.
- **Testebene:** Component.

#### EV-3: Reduced Motion: direkter Sprung statt Transition

- **Anforderung:** Bei `prefers-reduced-motion: reduce` wird die `layoutId`
  nicht gesetzt (oder die Transition-Dauer ist 0), Inhalt erscheint sofort.
- **Testebene:** Component.

#### EV-4: Transition blockiert keine Interaktion

- **Anforderung:** Während die Transition läuft, ist die Zielseiste bereits
  interaktiv (alle Elemente antappbar/klickbar) sobald sie im DOM ist.
- **Testebene:** Component (Render + Click während Transition).

### Verbotenes Verhalten

#### VB-1: Transition darf keine Finanzdaten verändern
- **Verboten:** Die Transition manipuliert Query-Cache, State oder Datenmodelle.
- **Prüfung:** Unit-Test — Hook ist pure (keine Side Effects außer `layoutId`).

#### VB-2: Transition darf nicht zu langsam sein
- **Verboten:** Transition-Dauer > 400ms (MOTION_DURATIONS.slow).
- **Prüfung:** Unit (Hook verwendet MOTION_DURATIONS.slow).

#### VB-3: Kein Flackern bei Quick-Navigation
- **Verboten:** Bei schnellem Tap → Back → Tap erscheint die Transition
  visuell flackernd (doppeltes Einblenden).
- **Prüfung:** Component-Test mit schnellem Mount/Unmount.

### Red-Nachweis

#### RED-1: Hook existiert nicht
- **Test:** Import → Module not found.

#### RED-2: InteractiveCard nutzt keine layoutId
- **Test:** Component-Test — `InteractiveCard` rendert kein Element mit
  `data-layoutid` oder Framer Motion `layoutId`-Prop.

### Regression Scope

- `src/features/shared/presentation/InteractiveCard.tsx` und Tests.
- `src/features/shared/presentation/__tests__/InteractiveCard.test.tsx`.
- Alle Komponenten, die `InteractiveCard` verwenden.
- E2E: Dashboard → Budget-Detail und zurück.

---

<a id="wp-33-enhanced-empty-state-system"></a>
## WP-3.3: Enhanced Empty State System

### Verifizierter Ist-Zustand

- `src/features/shared/presentation/EmptyState.tsx`: generische Empty-State-Komponente
  mit Icon, Titel, Beschreibung.
- `src/features/shared/presentation/FinanceEmptyState.tsx`: finanzieller Empty-State
  mit nächsten Aktionen.
- `src/index.css`: `@keyframes float-breathe` für Empty-State-Icon.
- Keine deterministischen visuellen Tests für Empty States.

### Erwartetes Verhalten

#### EV-1: FinanceEmptyState hat eine gestaltete visuelle Hintergrundschicht

- **Anforderung:** `FinanceEmptyState` rendert einen dezenten, themen-gerechten
  Hintergrund (Gradient, nicht flach), der den leeren Raum als "Einladung"
  kommuniziert.
- **Testebene:** Component (Existenz des Hintergrund-Elements).

#### EV-2: Primäre Aktion ist visuell dominant

- **Anforderung:** Die erste/primäre Aktion (z.B. "CSV importieren") ist
  visuell größer und auffälliger als sekundäre Aktionen.
- **Testebene:** Component (computed style — Button-Größen-Vergleich).

#### EV-3: Empty State bei Reduced Motion ist statisch

- **Anforderung:** Das Icon "atmet" nicht (keine `float-breathe`-Animation)
  bei `prefers-reduced-motion: reduce`.
- **Testebene:** Component.

#### EV-4: Empty State ist spezifisch pro Kontext

- **Anforderung:** `FinanceEmptyState` akzeptiert eine `variant`-Prop
  (`'no-data' | 'no-transactions' | 'no-budgets' | 'no-goals'`), die den Text
  und die vorgeschlagene Aktion kontextspezifisch anpasst.
- **Testebene:** Component (verschiedene Varianten rendern verschiedenen Text).

### Verbotenes Verhalten

#### VB-1: Kein generischer "Keine Daten"-Text
- **Verboten:** Empty State zeigt nur "Keine Daten vorhanden" ohne Kontext
  oder Handlungsanweisung.
- **Prüfung:** Component-Test — alle Varianten haben min. 1 Aktion.

#### VB-2: Empty State darf nicht als Fehler wirken
- **Verboten:** Rote/destruktive Farben, Fehlersymbole, alarmierende Sprache.
- **Prüfung:** Component-Test — keine `destructive`-Klassen.

### Red-Nachweis

#### RED-1: variant-Prop existiert nicht
- **Test:** `<FinanceEmptyState variant="no-budgets" />` → TypeScript-Fehler
  oder Prop wird ignoriert.

### Regression Scope

- `src/features/shared/presentation/__tests__/EmptyState.test.tsx`.
- Alle Seiten, die `FinanceEmptyState` verwenden.
- `src/components/dashboard/Dashboard.tsx` (verwendet `FinanceEmptyState`).

---

<a id="wp-41-dashboard-hero-hierarchy"></a>
## WP-4.1: Dashboard Hero Hierarchy

### Verifizierter Ist-Zustand

- `src/components/dashboard/Dashboard.tsx`: verwendet `KpiSection`,
  `InteractiveCard` (Coach-Preview), `TransactionFilters`, `DashboardDesktopView`
  oder `DashboardMobileStory`.
- `src/features/shared/presentation/StatHero.tsx`: Hero-Komponente, `text-3xl` (wird in
  WP-2.3 auf `var(--font-size-hero)` geändert).
- `src/components/kpi/KpiSection.tsx`, `KpiGrid.tsx`, `KpiCard.tsx`: KPI-Raster.
- `src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx` und
  `mobile/DashboardMobileStory.tsx`: Plattform-spezifische Views.
- `src/features/dashboard/application/use-finance-overview.ts`: ViewModel.

### Erwartetes Verhalten

#### EV-1: Dashboard hat genau ein visuelles Hero-Element

- **Anforderung:** Der obere Bereich des Dashboards zeigt genau EINE dominante
  Kennzahl (z.B. verfügbarer Saldo) in Hero-Größe (`var(--font-size-hero)`),
  die 60-70% der visuellen Aufmerksamkeit beansprucht.
- **Testebene:** Component (computed style + DOM-Struktur).

#### EV-2: Alle anderen Elemente sind visuell untergeordnet

- **Anforderung:** Kein anderes Element auf dem Dashboard-Screen hat eine
  Schriftgröße ≥ 50% der Hero-Größe.
- **Testebene:** Component.

#### EV-3: Hero-Element zeigt die primäre Finanzinformation

- **Anforderung:** Das Hero-Element zeigt den verfügbaren Saldo des aktuellen
  Zeitraums (bereits vorhanden durch `use-finance-overview`).
- **Testebene:** Component (Inhalt-Check).

#### EV-4: Sekundäre Informationen sind gestaffelt

- **Anforderung:** Unter dem Hero-Element sind sekundäre Kennzahlen
  (Einnahmen, Ausgaben, Budget-Status) in deutlich kleinerer Größe
  (`var(--font-size-headline)` oder kleiner) angeordnet.
- **Testebene:** Component.

### Verbotenes Verhalten

#### VB-1: Keine zwei gleich großen Hero-Elemente
- **Verboten:** Zwei oder mehr Elemente in `var(--font-size-hero)`.
- **Prüfung:** Component-Test — genau 1 Element mit Hero-Größe.

#### VB-2: Keine Informationsreduktion
- **Verboten:** Entfernen von KPIs oder Charts, die bereits vorhanden sind.
- **Prüfung:** Component-Test — alle bestehenden KPIs sind noch vorhanden
  (ggf. in kleinerer Größe oder hinter "Mehr anzeigen").

#### VB-3: Keine Mobile-Einschränkung
- **Verboten:** Auf Mobile fehlt das Hero-Element oder ist unverhältnismäßig klein.
- **Prüfung:** Component-Test mit Mobile-Viewport (375px).

### Red-Nachweis

#### RED-1: Kein Hero-Element in Hero-Größe
- **Test:** Dashboard rendern, prüfen dass genau 1 Element
  `fontSize >= 48px` hat.
- **Erwarteter Fehler:** Alle Elemente sind ≤ 30px.

### Regression Scope

- `src/components/dashboard/__tests__/` — vollständig.
- `src/features/dashboard/` — alle Tests.
- `src/components/kpi/__tests__/` — (existiert nicht — KPI-Verhalten wird an
  den Aufrufstellen getestet, ein eigenes Testverzeichnis wurde nie angelegt).
- Visual Regression: Desktop + Mobile Dashboard.
- E2E: Dashboard-Navigation, Filter, Zeitraumwechsel.

---

<a id="wp-42-budget-tank-mikroreaktionen"></a>
## WP-4.2: Budget Tank Mikroreaktionen

### Verifizierter Ist-Zustand

- `src/components/budgets/BudgetTank.tsx`: SVG-Tank mit Wellen, Farbverlauf,
  Schwellen-bewusster Farbe (`colorForFill`).
- `FILL_ANIM_MS = 1300`, `animate`-Prop steuert Aufbau-Animation.
- `src/lib/color-mix.ts`: `smoothstep`, `lerpRgb`, `rgbStr` für Farbinterpolation.
- `src/components/budgets/__tests__/BudgetTank.test.tsx`: bestehende Tests.
- `src/components/budgets/__tests__/colorForFill.test.ts`: Farb-Schwellen-Tests.

### Erwartetes Verhalten

#### EV-1: Shake-Reaktion bei Budgetüberschreitung

- **Anforderung:** Wenn `health` von einem Zustand ≠ `'over'` auf `'over'`
  wechselt (Live-Update, nicht Initial-Mount), führt der Tank einen einmaligen
  horizontalen Shake aus (`translateX` ±2px, 100ms, `MOTION_EASINGS.warn`).
- **Testebene:** Component (Transform-Check nach State-Change).

#### EV-2: Shake bei Initial-Mount unterbleibt

- **Anforderung:** Wenn der Tank mit `health: 'over'` initial gemountet wird,
  erfolgt kein Shake — nur die rote Füllung.
- **Testebene:** Component.

#### EV-3: Reduced Motion deaktiviert Shake

- **Anforderung:** Bei `prefers-reduced-motion: reduce` ist kein Shake sichtbar.
- **Testebene:** Component.

#### EV-4: "Atmen"-Reaktion bei Budget-Rettung

- **Anforderung:** Wenn `health` von `'over'` auf einen Zustand ≠ `'over'`
  wechselt, pulsiert die Flüssigkeitsoberfläche einmal (Wellenamplitude
  erhöht sich für 600ms, dann zurück zum Normalwert).
- **Testebene:** Component.

### Verbotenes Verhalten

#### VB-1: Shake darf nicht wiederholt werden
- **Verboten:** Shake bei jedem Re-Render, nicht nur beim State-Change.
- **Prüfung:** Component-Test — Re-Render ohne Health-Change → kein Shake.

#### VB-2: Shake darf nicht den Layout-Fluss beeinflussen
- **Verboten:** `transform` auf dem Container-Element (nur auf einer inneren
  Gruppe), sodass umliegende Elemente springen.
- **Prüfung:** Component-Test — Layout-Overflow-Check.

#### VB-3: Farb-Berechnung darf nicht verändert werden
- **Verboten:** `colorForFill` oder `HEALTH_GRADIENT` Werte ändern.
- **Prüfung:** `colorForFill.test.ts` muss unverändert bestehen.

### Red-Nachweis

#### RED-1: Shake existiert nicht
- **Test:** Tank mit `health: 'warn'` rendern, dann auf `'over'` updaten →
  kein `transform`-Wechsel auf dem SVG-Inneren.

#### RED-2: "Atmen" existiert nicht
- **Test:** Tank mit `health: 'over'` rendern, dann auf `'ok'` updaten →
  keine temporäre Wellenamplituden-Erhöhung.

### Regression Scope

- `src/components/budgets/__tests__/BudgetTank.test.tsx` — vollständig.
- `src/components/budgets/__tests__/colorForFill.test.ts` — vollständig.
- Visual Regression: Budget-Seite Desktop + Mobile.
- `src/components/budgets/__tests__/BudgetTile.test.tsx`.

---

<a id="wp-43-city-atmosphäre-wetter-logik"></a>
## WP-4.3: City-Atmosphäre: Wetter-Logik

### Verifizierter Ist-Zustand

- `src/features/finance-city/presentation/city-scene.ts`: `THEME_PALETTES` mit
  `skyTop`, `skyHorizon`, Licht-Farben je Light/Dark.
- `setTheme()` tauscht Himmel-Textur, Boden-Textur, Fog, Licht.
- `setFog()` setzt Fog-Farbe auf `horizonColor`.
- Keine datengetriebene Atmosphäre-Variation existiert.
- `src/features/finance-city/presentation/city-camera-controller.ts`: Kamera-Controller.
- `src/features/finance-city/domain/city-layout.ts`: Layout-Berechnung.

### Erwartetes Verhalten

#### EV-1: City-Atmosphäre reagiert auf Finanzzustand

- **Anforderung:** Die Stadt-Szene akzeptiert einen `atmospherePreset`-Wert
  (`'stable' | 'neutral' | 'risk'`), der die Himmelfarbe und Lichtintensität
  subtil verschiebt:
  - `stable`: minimal wärmere/ hellere Variante des Theme-Defaults.
  - `neutral`: unverändert (Theme-Default).
  - `risk`: minimal kühlere/düsterere Variante.
- Die Verschiebung ist subtil: Δ HSL ≤ 5 Grad Hue, ≤ 5% Lightness, ≤ 5% Saturation.
- **Testebene:** Unit (`THEME_PALETTES` mit verschobenen Werten) +
  Component (Szene übernimmt Preset).

#### EV-2: Atmosphäre-Wechsel ist animiert (nicht hart)

- **Anforderung:** Ein Wechsel des `atmospherePreset` animiert Himmel/Fog/Licht
  über einen Übergang von `MOTION_DURATIONS.slow` (600ms), nicht als harter Cut.
- **Ausnahme:** `prefers-reduced-motion` → sofortiger Wechsel.
- **Testebene:** Component.

#### EV-3: Render-on-Demand bleibt erhalten

- **Anforderung:** Die Atmosphäre-Animation läuft im bestehenden Render-Loop
  (`tick`), startet keinen zweiten rAF/Timer.
- **Prüfung:** Component-Test — keine doppelte `requestAnimationFrame`.

#### EV-4: Atmosphäre-Preset aus AtmosphereState abgeleitet

- **Anforderung:** `CityPage` (oder `CityCanvas`) leitet den Preset aus
  `useAtmosphereState().temperature` ab:
  - `'warm'` → `'stable'`
  - `'neutral'` → `'neutral'`
  - `'cool'` → `'risk'`
- **Testebene:** Component.

### Verbotenes Verhalten

#### VB-1: Atmosphäre darf nicht alarmistisch sein
- **Verboten:** `risk`-Preset erzeugt roten Himmel, Sturm-Effekte oder
  offensichtlich negative Visualität.
- **Prüfung:** Unit-Test — `risk`-Palette liegt innerhalb von ±5 HSL des Defaults.

#### VB-2: Atmosphäre darf keine Geometrie verändern
- **Verboten:** Gebäude-Höhen, Positionen oder Layouts ändern sich mit dem Preset.
- **Prüfung:** Component-Test — `applyLayout` mit verschiedenen Presets liefert
  identische `LayoutBox`-Werte.

#### VB-3: Atmosphäre darf nicht die Frame Rate beeinträchtigen
- **Verboten:** Mehr als 2 zusätzliche Material-Updates pro Preset-Wechsel.
- **Prüfung:** Component-Test — Zählung der `material.needsUpdate`-Aufrufe.

### Red-Nachweis

#### RED-1: atmospherePreset wird nicht akzeptiert
- **Test:** `cityScene.setAtmospherePreset('risk')` → Methode existiert nicht.

#### RED-2: Keine Animation beim Preset-Wechsel
- **Test:** Preset wechseln, sofortiger Farbwechsel → kein Tween.

### Regression Scope

- `src/features/finance-city/presentation/__tests__/city-scene.test.ts` — vollständig.
- `src/features/finance-city/domain/__tests__/` — Layout-Tests müssen unverändert bestehen.
- `src/pages/__tests__/CityPage.test.tsx`.
- `src/features/finance-city/presentation/__tests__/CityCanvas.test.tsx`.

### Manuelle Prüfpunkte

- MP-1: Der Unterschied zwischen `stable`, `neutral` und `risk` ist wahrnehmbar,
  aber extrem subtil — bei flüchtigem Blick nicht bewusst auffallend — Art Director.
- MP-2: Die Stadt wirkt bei `risk` nicht "kaputt" oder "bedrohlich" — sie wirkt
  nur leicht anders — UX Critic + Art Director gemeinsam.
