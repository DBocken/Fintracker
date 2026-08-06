# FinTracker AAA+ — Offene Punkte

> Stand: 2026-08-06, nach dem Durchgang „Phase 6/7 + Gate + Infrastruktur".
> Ergänzt das [Fortschrittsprotokoll](progress.md) um die Gegenrichtung: dort
> steht, was erledigt ist, hier, was noch aussteht. Erledigtes wird von hier
> **entfernt** und im Protokoll vermerkt — diese Datei bleibt kurz genug, um
> sie ganz zu lesen.

---

## 1. Sofort nach dem Merge (Pflicht, nicht automatisiert)

| Punkt | Warum |
|---|---|
| **`supabase functions deploy refresh-balances`** ausführen | AGENTS.md §11: Edge Functions deployen **nicht** automatisch (kein CI-Schritt). Der frühere Merge enthält F-SEC-3 (Tageslimit gegen Selbst-Zurücksetzen). Bis zum Deployment läuft in Produktion die **alte, angreifbare** Fassung. Begleitendes GitHub-Issue ist angelegt. |
| **Migration `20260806120000_harden_balance_refresh_limits.sql` einspielen** | Gehört zu F-SEC-3: entzieht dem Nutzer die Schreibrechte auf `balance_refresh_limits` und legt `consume_balance_refresh()` an. Ohne sie schlägt die neue Edge Function fehl — Reihenfolge: **erst Migration, dann Function**. |

Beide Punkte konnten im Container nicht erledigt werden: kein Produktionszugang,
und ein Deployment ist ohnehin nichts, was ein unbeaufsichtigter Lauf auslösen
sollte.

## 2. Phase 6 — Datenvisualisierung (2 von 10 offen)

| WP | Titel | Prio |
|---|---|---|
| WP-6.3 | Sankey: Fluss-Animation & Textur | P2 |
| WP-6.4 | Vermögen: Volumen-Visualisierung | P2 |

Erledigt: WP-6.1, WP-6.2, WP-6.5, WP-6.6, WP-6.7, WP-6.8, WP-6.9, WP-6.10.

**Anschlussfähig:** Beide können `useMotionQuality()` (WP-7.7) für die
Degradation und `<ChartFigure>` (WP-6.10) für die nicht-visuelle Entsprechung
übernehmen — der Wächter `chart-standardization.test.ts` verlangt Letzteres
ohnehin, sobald ein neuer Recharts-`<Tooltip>` dazukommt.

**Zu WP-6.3 vorab geklärt:** Eine Fluss-Animation im Sankey braucht
CSS-Keyframes (`stroke-dashoffset`). AGENTS.md §7 erlaubt nur
Tailwind-Utilities — der Keyframe gehört also nach `index.css` neben
`skeleton-shimmer`, nicht als Inline-Style in die Komponente. Und `index.css`
steht in Plan §8 auf der Liste der Dateien, die nie parallel angefasst werden
dürfen.

## 3. Phase 7 — Motion (1 von 8 offen)

| WP | Titel | Prio |
|---|---|---|
| WP-7.5 | Motion: Signature Moment — Jahresrückblick | P2 |

Erledigt: WP-7.1, WP-7.2, WP-7.3, WP-7.4, WP-7.6, WP-7.7, WP-7.8.

**Anschlussfähig:** `src/components/income/wrapped/WrappedSlides.tsx` und
`src/lib/income-wrapped.ts` existieren bereits — WP-7.5 ist eher eine
Überarbeitung als ein Neubau. `SignatureMoment` (WP-6.5) und die Haptik aus
WP-7.8 sind die Bausteine.

## 4. Phasen 8–11 (noch unberührt)

- **Phase 8 — Feature-Screen-Migration**, pro Screen ein WP. Dashboard und
  Transaktionen sind faktisch bereits auf der AAA+-Produktsprache; die übrigen
  Screens (Coach, Budgets, Konten, Schulden, Meilensteine, Vermögen, Einkommen,
  Verträge, Einstellungen …) stehen aus. Beim Migrieren jeweils mitziehen: die
  Karten-Regel (AGENTS.md §9) und die Chart-Achsen-Hygiene.
  - **Vorzusehen:** Der Opt-in-Schalter für Telemetrie gehört in den
    Einstellungen-Screen (Entscheidung F-1 im `decision-log`).
  - **Offen aus der Hierarchie-Neubewertung:** Die Kennzahlenzeile des
    Dashboards stellt vier gleichgewichtige Größen nebeneinander. Welche die
    zweitwichtigste ist, sagt die Gestaltung nicht.
- **Phase 9 — Zustandsabdeckung:** vollständige State-Matrix je Screen (leer,
  ladend, fehlerhaft, gefiltert-leer, offline, Sanfter Modus).
- **Phase 10 — Qualitätssicherung:** Visual Regression, Performance und
  Accessibility vollständig durchsprechen (bisher nur für den Vertical Slice).
- **Phase 11 — Rollout:** Feature Flags, Telemetrie, Feedback, Rollback.
  Die Telemetrie-Grundsatzentscheidung ist gefallen — siehe `decision-log` F-1.

## 5. Infrastruktur & Messung

- **Visual-Baselines nur auf einer Plattform.** Verbindlich ist der
  Playwright-eigene Browser auf Linux (`decision-log` F-2). Wer lokal auf einer
  anderen Plattform oder mit einem vorinstallierten Chromium läuft, erzeugt
  abweichende Snapshots — diese sind lokal und gehören **nicht** ins
  Repository.
- **Warm-Navigation Dashboard → Stadt** misst in Containern ohne GPU über dem
  1000-ms-Budget, weil WebGL dort in Software rendert. `E2E_SOFTWARE_WEBGL=1`
  macht daraus eine Test-Info statt eines Fehlschlags; die gemessene Zahl steht
  weiterhin im Bericht. **Auf echter Hardware ist das nie nachgemessen worden** —
  erst danach ist entscheidbar, ob hier ein Befund liegt.
- **Motion-Review ist ein Erhebungslauf, kein Test.**
  `e2e-tests/motion-review.spec.ts` zeichnet auf und prüft nichts; er läuft
  bewusst nicht in CI mit. Wer ihn wiederholt, wertet die Frames selbst aus.

## 6. Aus dem Protokoll übernommen (weiterhin offen)

- **`e2e-tests/` hat keine Fixtures für Fehler- und Leerzustände.** Der Slice
  fährt nur den Erfolgsweg. Gehört zu Phase 9.
- **Der Demo-Einstieg landet auf `/coach`, nicht auf `/dashboard`.** Das ist
  produktseitig konsistent und sauber dokumentiert. Falls die Landung auf dem
  Dashboard doch gewünscht ist, gehört sie über den Router gelöst — nicht über
  `history`.

## 7. Kein Fehler, bewusst nicht behoben

**Befund U-1 („zwei Navigationsebenen im Inhalt", Mobil)** ist ein **Artefakt
der Aufnahmemethode**: Die Bottom-Nav ist `fixed inset-x-0 bottom-0` und liegt
im Full-Page-Screenshot mitten im Dokumentfluss, im echten Viewport dagegen als
Leiste über dem Inhalt. Zu „reparieren" gäbe es hier nichts — festgehalten,
damit der Befund nicht in einer späteren Runde erneut als offen gilt.

**Der Demodaten-Banner ist keine der Hinweisebenen aus Befund A-2.**
Datenherkunft ist Integritätsanzeige, keine aufschiebbare Meta-Kommunikation.
