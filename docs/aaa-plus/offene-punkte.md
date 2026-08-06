# FinTracker AAA+ — Offene Punkte

> Stand: 2026-08-06, nach dem Merge der Fortsetzungslinie (PR #281).
> Ergänzt das [Fortschrittsprotokoll](progress.md) um die Gegenrichtung: dort
> steht, was erledigt ist, hier, was noch aussteht. Erledigtes wird von hier
> **entfernt** und im Protokoll vermerkt — diese Datei bleibt kurz genug, um
> sie ganz zu lesen.

---

## 1. Sofort nach dem Merge (Pflicht, nicht automatisiert)

| Punkt | Warum |
|---|---|
| **`supabase functions deploy refresh-balances`** ausführen | AGENTS.md §11: Edge Functions deployen **nicht** automatisch (kein CI-Schritt). Der Merge enthält F-SEC-3 (Tageslimit gegen Selbst-Zurücksetzen). Bis zum Deployment läuft in Produktion die **alte, angreifbare** Fassung. Begleitendes GitHub-Issue ist angelegt. |
| **Migration `20260806120000_harden_balance_refresh_limits.sql` einspielen** | Gehört zu F-SEC-3: entzieht dem Nutzer die Schreibrechte auf `balance_refresh_limits` und legt `consume_balance_refresh()` an. Ohne sie schlägt die neue Edge Function fehl — Reihenfolge: **erst Migration, dann Function**. |
| **win32-Visual-Baselines erneuern** (`pnpm test:e2e --update-snapshots` auf einem Windows-Rechner) | Die `dashboard-*`-Baselines für win32 zeigen noch den Zustand vor Hero-Umbau (A-1) und Stadt-Karte (A-3). Die Linux-Baselines sind aktuell; win32 würde beim nächsten Lauf dort fälschlich rot. |

## 2. WP-4.6-Gate: der Rest

Die vier inhaltlichen Critic-Befunde sind behoben (A-1, A-2, A-3, D-1 — siehe
Protokoll). Offen bleibt die **Bewertung selbst**:

- **Neubewertung „Visuelle Hierarchie".** Sie stand auf 2/5 und war damit der
  Gate-Blocker; Ursache (A-1) ist beseitigt, aber es gibt noch kein frisches
  Urteil gegen die neuen Screenshots. Nötig: Ansehen der aktuellen
  Linux-Baselines (1440/375) und ein Addendum zu
  `critic-reports/wp-4.6-art-ux-motion.md`.
- **Motion-Review.** Aus statischen PNGs grundsätzlich nicht beurteilbar
  (Timing, Abbruchbarkeit, Objektkontinuität). Nötig: ein Lauf mit
  Videoaufzeichnung — ein vorbereitetes Skript fährt den Slice mit echter Zeit
  ab; ausgewertet werden Frames um die Übergänge (Coach→Dashboard,
  Dashboard→Stadt, Budget-Detail auf/zu).
- **Grenze, die bestehen bleibt:** Beide Urteile sind Modellurteile gegen die
  im Plan beschriebenen Referenzen. „Inkonsistent" und „redundant" sind so
  zuverlässig erkennbar, „schön" und „fühlt sich gut an" nicht. Ein
  menschliches Geschmacksurteil ersetzt das nicht.

### Kein Fehler, bewusst nicht behoben

**Befund U-1 („zwei Navigationsebenen im Inhalt", Mobil)** ist ein **Artefakt
der Aufnahmemethode**: Die Bottom-Nav ist `fixed inset-x-0 bottom-0` und
liegt im Full-Page-Screenshot mitten im Dokumentfluss, im echten Viewport
dagegen als Leiste über dem Inhalt. Es stehen also nicht drei
Orientierungsangebote übereinander. Zu „reparieren" gäbe es hier nichts —
festgehalten, damit der Befund nicht in einer späteren Runde erneut als
offen gilt.

## 3. Phase 6 — Datenvisualisierung (8 von 10 offen)

| WP | Titel | Prio |
|---|---|---|
| WP-6.1 | Prognose: Diffuse Konfidenzwolken | **P1** |
| WP-6.6 | Transaktionen: Live-Reorganisation bei Filter | **P1** |
| WP-6.10 | Charts: Barrierefreie Alternativen | **P1** |
| WP-6.2 | Prognose: Horizont-Perspektive | P2 |
| WP-6.3 | Sankey: Fluss-Animation & Textur | P2 |
| WP-6.4 | Vermögen: Volumen-Visualisierung | P2 |
| WP-6.8 | Charts: Tooltip-Standardisierung | P2 |
| WP-6.9 | Charts: Animation zwischen Zeiträumen | P2 |

Erledigt: WP-6.5 (Signature Moment „Ziel erreicht"), WP-6.7 (alle 25
Recharts-Serien auf Motion-Tokens).

**Anschlussfähig:** `niceTicks()` aus `src/lib/chart-axis.ts` (Befund D-1) ist
bisher nur im Kontostand-Verlauf verdrahtet. WP-6.8 ist der natürliche Ort,
das auf die übrigen Achsen zu ziehen.

## 4. Phase 7 — Motion (5 von 8 offen)

| WP | Titel | Prio |
|---|---|---|
| WP-7.7 | Motion: Performance-Grenzen & Degradation | **P1** |
| WP-7.3 | Motion: Ladeverhalten (Liquid Loading) | P2 |
| WP-7.4 | Motion: Signature Moment — Schuldenfrei | P2 |
| WP-7.5 | Motion: Signature Moment — Jahresrückblick | P2 |
| WP-7.8 | Motion: Haptisches Feedback (Mobil) | P3 |

Erledigt: WP-7.1, WP-7.2, WP-7.6.

**Anschlussfähig:** WP-7.7 kann die Qualitätsstufen der Finanzstadt (WP-5.6,
Geräteprofil **vor** dem ersten Frame statt reaktiver FPS-Kaskade) als Muster
übernehmen, statt eine zweite Degradations-Logik zu bauen.

## 5. Phasen 8–11 (noch unberührt)

- **Phase 8 — Feature-Screen-Migration**, pro Screen ein WP. Dashboard und
  Transaktionen sind faktisch bereits auf der AAA+-Produktsprache; die übrigen
  Screens (Coach, Budgets, Konten, Schulden, Meilensteine, Vermögen, Einkommen,
  Verträge, Einstellungen …) stehen aus. Beim Migrieren jeweils mitziehen: die
  Karten-Regel (AGENTS.md §9) und die Chart-Achsen-Hygiene.
- **Phase 9 — Zustandsabdeckung:** vollständige State-Matrix je Screen (leer,
  ladend, fehlerhaft, gefiltert-leer, offline, Sanfter Modus).
- **Phase 10 — Qualitätssicherung:** Visual Regression, Performance und
  Accessibility vollständig durchsprechen (bisher nur für den Vertical Slice).
- **Phase 11 — Rollout:** Feature Flags, Telemetrie, Feedback, Rollback.

## 6. Infrastruktur & Messung

- **E2E-Suite in CI verdrahten.** `playwright.config.ts` und `pnpm test:e2e`
  existieren und laufen lokal; ein CI-Job fehlt. Dabei zu klären: Browser-Cache
  im Runner, Plattform der Visual-Baselines (aktuell win32 **und** linux
  eingecheckt) und ein Build-Preview-Job für die **Produktions**-Budgets.
- **Performance-Budgets auf echter Hardware nachmessen.** Der Dev-Lauf ist
  grün für LCP und CLS; die Warm-Navigation Dashboard → Stadt misst im
  Container **1460 ms** gegen ein 1000-ms-Budget. Dort rendert WebGL in
  Software (SwiftShader) — das Budget beschreibt eine echte Dev-Maschine und
  wurde bewusst **nicht** gelockert. Erst nach der Messung auf echter Hardware
  ist entscheidbar, ob hier ein Befund liegt.
- **Prod-Budget LCP < 2,5 s** (Plan §5/§7) ist bisher nirgends gemessen —
  gehört in den CI-Job mit Build-Preview, nicht in den Dev-Lauf.
- **Radix-`DialogTitle`-Warnung** im Demo-Onboarding (Konsole während des
  E2E-Laufs): ein `DialogContent` ohne `DialogTitle`. Gleiche
  Barrierefreiheits-Familie wie die Switch-Befunde, klein, ohne eigenes WP —
  beim nächsten Anfassen des Onboardings mitnehmen.

## 7. Aus dem Protokoll übernommen (weiterhin offen)

- **`e2e-tests/` hat keine Fixtures für Fehler- und Leerzustände.** Der Slice
  fährt nur den Erfolgsweg. Gehört zu Phase 9.
- **Der Demo-Einstieg landet auf `/coach`, nicht auf `/dashboard`.** Das ist
  produktseitig konsistent und inzwischen sauber dokumentiert (der tote
  `replaceState` ist entfernt). Falls die Landung auf dem Dashboard doch
  gewünscht ist, gehört sie über den Router gelöst — nicht über `history`.
