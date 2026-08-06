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

## 2. Phase 6 und Phase 7 — vollständig

Alle 18 Arbeitspakete sind umgesetzt (WP-6.1 bis WP-6.10, WP-7.1 bis WP-7.8).
Details im [Fortschrittsprotokoll](progress.md).

Was daraus als Baustein für Phase 8 bereitsteht:

| Baustein | Wofür |
|---|---|
| `useMotionQuality()` (WP-7.7) | Bewegungsstufe des Geräts — jede neue Animation holt ihre Dauer hierüber, nicht direkt aus `MOTION_DURATIONS` |
| `<ChartFigure>` (WP-6.10) | Nicht-visuelle Entsprechung. Der Wächter `chart-standardization.test.ts` verlangt sie, sobald ein neuer Recharts-`<Tooltip>` dazukommt |
| `chartTooltipProps()` / `valueAxisProps()` (WP-6.8) | Einheitliche Tooltips und runde Achsen |
| `<LoadingSwap>` (WP-7.3) | Skeleton-Choreografie: kein Blinzeln, keine zu kurze Anzeige |
| `<SignatureMoment>` (WP-6.5) | Erfolgsmomente inkl. Haptik — nicht je Screen neu bauen |
| `volumeSegments()` (WP-6.4) | Flächenproportionale Größendarstellung |

## 3. Phase 8 — Feature-Screen-Migration (in Arbeit)

**WP-8.0 — Karten-Regel maschinell prüfbar.** Bis dahin gab es dazu nur einen
advisory Claude-Hook; CI sah nie einen Verstoß. `pnpm check:card-rule` prüft
jetzt repo-weit, in Pre-Commit und CI.

**WP-8.1 — alle acht Altfälle behoben, die Ausnahmeliste ist leer.** Damit
gilt die Karten-Regel ohne Ausnahme: Jeder neue Verstoß bricht den Build
sofort. `card-rule-allowlist.json` bleibt als Mechanik bestehen, hat aber
keine Einträge mehr — ein Eintrag dort ist ab jetzt eine bewusste, zu
begründende Entscheidung und kein Altbestand.

Betroffen waren: die vier Einstellungs-Bausteine (Sprache, Sprachstil,
Aufbewahrung, Auto-Kategorisierung), `AccountCards`, `WaterfallPanel`,
`HeatmapCalendar` und `AdaptiveSpendingToggle`.

Zwei weitere Mängel kamen dabei ans Licht und sind mitbehoben:
`HeatmapCalendar` trug feste Graustufen (`from-gray-800 to-gray-900`) statt
Design-Tokens — im Hellmodus ein dunkelgrauer Block auf heller Seite — und
seine Zellen zeigten `cursor-pointer`, ohne klickbar zu sein. Ein Zeigefinger,
der nichts auslöst, ist dieselbe Art falsches Versprechen wie ein toter
Karten-Rahmen.

**Grenze der Prüfung, bewusst so:** Ob eine Karte „als Ganzes" klickbar ist,
entscheidet sich im Layout und nicht im Text; statisch entscheidbar ist nur die
schwächere Aussage „hier steht Karten-Chrome und es gibt überhaupt kein
Interaktions-Signal". Eine Prüfung, die mehr behauptet, als sie wissen kann,
erzeugt Fehlalarme — und eine Regel mit Fehlalarmen wird abgeschaltet.

### Was in Phase 8 noch offen ist

Die maschinell prüfbaren Punkte sind grün. Was bleibt, ist **nicht**
automatisiert prüfbar und gehört pro Screen durchgesehen:

| Punkt | Warum kein Wächter |
|---|---|
| **Mobile/Desktop-Parität** (AGENTS.md §4) | „Gleiche Features, andere Dichte" ist eine Aussage über Bedeutung, nicht über Code |
| **`<LoadingSwap>`-Übernahme je Screen** | Ein früher `return` mit Spinner ist syntaktisch nicht von einem legitimen Frühausstieg zu unterscheiden |
| **Hierarchie je Screen** | Offen aus der Gate-Neubewertung: die Kennzahlenzeile des Dashboards stellt vier gleichgewichtige Größen nebeneinander; welche die zweitwichtigste ist, sagt die Gestaltung nicht |
| **Telemetrie-Schalter** | Gehört in den Einstellungen-Screen, sobald Phase 11 gebaut wird (`decision-log` F-1) |

## 4. Phasen 8–11 (überwiegend unberührt)

- **Phase 8 — Feature-Screen-Migration**, pro Screen ein WP. WP-8.0
  (Grundlage) ist erledigt, siehe oben. Dashboard und
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
