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

### 2. Bewegung mit Bedeutung — **Lottie ist die Baseline**
Jede Animation muss *intentional* sein, nicht dekorativ. **Lottie ist unsere Standard-Technik für
expressive Animationen** (Details unten). Animationen führen den Blick, bestätigen Aktionen und
machen Daten lebendig – sie lenken nie ab.

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

## Animations-Baseline: Lottie

**Lottie ist die Standard-Technik für expressive Animationen.** Verbindlich für:
- Celebrations / Erfolg (z. B. Ziel erreicht, Budget gehalten)
- Leere Zustände & Onboarding-Illustrationen
- Lade-/Fortschritts- und Übergangs-Illustrationen
- Maskottchen-/Coach-Momente, „Micro-Delight"

### Wo Lottie NICHT die richtige Wahl ist (dokumentierte Ausnahmen)
Für diese Fälle bleiben **Framer Motion / CSS / SVG** korrekt – Lottie wäre hier schlechter:
- **Micro-Interactions**: Hover/Press/Focus, Buttons, Ripples
- **Layout-/List-Transitions**: Ein-/Ausblenden, Reorder, Shared-Layout
- **Datengetriebene Animationen**: Zahl-Tweens, Charts, der physikalische Budget-Tank
  (`BudgetTank.tsx` füllt exakt datenabhängig – das kann ein statisches Lottie nicht)

Wird eine dieser Techniken bewusst genutzt, **kurz begründen** (Code-Kommentar oder PR-Notiz).

### Technische Leitplanken
- **Renderer (Empfehlung):** `@lottiefiles/dotlottie-react` (kleiner, performanter) – *noch nicht
  installiert*; vor erstem Einsatz hinzufügen. Alternativ `lottie-react`.
- **Format:** `.lottie`/dotLottie bevorzugen (kompakter als rohes JSON); Assets unter
  `src/assets/lottie/`.
- **Performance:** lazy-laden, nicht im kritischen Render-Pfad; Größe der Animationsdateien im Blick.
- **Reduced Motion:** zentral über `useReducedMotion` pausieren / Poster zeigen.

### Automatische Prüfung (Baseline-Hook)
`.claude/settings.json` enthält einen PostToolUse-Hook
(`.claude/hooks/lottie-baseline-check.mjs`): Nach jeder Bearbeitung einer UI-Datei (`src/**/*.tsx|ts|css`)
erinnert er, wenn echte Animationsmuster (framer-motion, requestAnimationFrame, @keyframes,
CSS `animation:`) **ohne** Lottie auftauchen. Tailwind-`transition`-Utilities lösen bewusst **nichts**
aus. Der Hinweis blockiert nichts – er erzwingt die bewusste Entscheidung gegen die Baseline.

---

## Konkrete To-dos aus den Prinzipien (Backlog)
1. Lottie-Renderer einbinden + erste Migration (Celebration/Empty-State/Onboarding).
2. „Zu prüfen"-Inbox für unsichere Transaktionen (Swipe) **mit Erklärung** (Prinzip 4).
3. Fokussiertes Dashboard: „Dieser Monat"-Karten (Ausgegeben · Trend · Forecast), Prinzip 3.
4. Command-Palette (⌘K), mobile Haptics, einheitliches Token-System.
