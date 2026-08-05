# FinTracker AAA+ — Fortschrittsprotokoll

> Format gemäß Implementierungsplan §16: WP-ID, Status, Datum, Gate-Ergebnis.
> Neueste Einträge oben.

---

## 2026-08-05 — Korrektur des Protokolls + Sichtbarkeits-Paket

**Anlass:** Beobachtung des Auftraggebers, außerhalb der Finanzstadt sei kein
Unterschied spürbar. Vollständiger Befund:
[`audits/2026-08-05-ist-zustand-ausserhalb-der-stadt.md`](audits/2026-08-05-ist-zustand-ausserhalb-der-stadt.md).

### Korrektur früherer Einträge

Die Einträge unten führen Pakete als ✅, deren Tests zum Zeitpunkt der
Eintragung **rot** waren. Auf `main` fielen 8 Tests in 10 Dateien durch —
überwiegend AAA+-eigene:

| WP | Eintrag war | tatsächlich |
|---|---|---|
| WP-3.3 Enhanced Empty State | ✅ | 3 Tests rot; Varianten repoweit ungenutzt |
| WP-3.4 Enhanced Loading State | ✅ | Shimmer-Variante nirgends verwendet |
| WP-3.5 Material Token System | ✅ | verursachte eine Regression gegen AGENTS.md §9 (`KpiCard`) |
| WP-4.4 Shared-Element-Transition | ✅ | Test prüfte einen Selektor, den es nicht gibt |
| WP-6.5 Signature Moment | ✅ | 1 Test rot |
| WP-6.7 Chart-Animation | ✅ | Hook importiert, aber nur `animate` benutzt |

**Regel daraus:** Ein Paket, dessen Test rot ist oder dessen Ergebnis nirgends
verdrahtet wurde, ist nicht abgeschlossen. ✅ setzt einen grünen Lauf voraus.

### Erledigt

| WP | Titel | Nachweis |
|---|---|---|
| — | CI-Reparatur (Lockfile, 13 OSV-Advisories) | `evidence/2026-08-05-nachweise.md` |
| — | 8 rote Tests behoben, jeweils mit Gegenprobe | ebd. |
| WP-3.1 | Atmosphäre **global** verdrahtet (`useGlobalAtmosphere`) | 13 neue Tests, davon 1 `[PERF]` |
| WP-3.3/3.4 | Varianten auf der Buchungsseite angewandt | `TransactionsPage.aaa.test.tsx` |
| WP-6.7 | 25 Recharts-Serien in 11 Dateien migriert | Graph-Lauf, Gate bestanden |
| — | Ablageorte `audits/`, `decisions/`, `evidence/`, `critic-reports/` | §16 erfüllt |

Testsuite: **3843 grün, 0 rot** (vorher 3816 mit 8 rot).

### WP-4.6 Rest — Gate **eskaliert**, nicht bestanden

[`critic-reports/wp-4.6-art-ux-motion.md`](critic-reports/wp-4.6-art-ux-motion.md)

Visuelle Hierarchie **2/5**, unter dem Mindestwert der Kategorie (3, §11).
Grund: derselbe Betrag erscheint drei- bis viermal auf dem Dashboard, der Hero
aus WP-4.1 konkurriert mit einer identischen Zahl direkt darunter.

**Offene Entscheidung für den Auftraggeber:** Welche Zahl ist die Hauptaussage
des Dashboards — Saldo im Zeitraum oder Kontostand? Eine muss zurücktreten.
Das ist keine Umsetzungsfrage.

### Weiterhin offen

- Motion-Bewertung: aus statischen Baselines nicht möglich.
- Visual-Regression-Baselines neu setzen — die vorhandenen entstanden unter
  `intensity: 0` und kennen die datengetriebene Atmosphäre nicht.
- Phase 5 (City), Phase 6 (Rest DataViz), Phase 7 (Motion), Phase 8–11.
- Leerzustände für Budgets/Ziele: die Varianten `no-budgets`/`no-goals` haben
  kein Zuhause, weil beide Seiten gar keinen Leerzustand haben.

---

## 2026-07 — WP-4.6 Vertical Slice Integration Test + Gate

**Status:** Test-Suite erstellt, alle 4 automatisierten Dimensionen grün.
**Gate: BESTANDEN** — mit Ausnahme der manuellen Critic-Reviews
(Art Director / UX / Motion), die nicht automatisierbar sind und als offener
Restpunkt unten stehen.

### Ausgeführte Nachweise (`e2e-tests/`)

| Gate-Kriterium (Plan §5/§7) | Ergebnis | Nachweis |
|---|---|---|
| E2E: Onboarding → Dashboard → Stadt → Budget → Detail → Zurück | ✅ grün | `vertical-slice.spec.ts` |
| Accessibility: 0 Critical axe-core Violations | ✅ grün (nach 2 App-Fixes, siehe unten) | `vertical-slice-a11y.spec.ts` |
| Performance: LCP < 2.5 s Desktop / < 4 s Mobile, CLS | ✅ grün gegen Dev-Budgets (LCP < 4 s, CLS < 0.1, warme Interaktion < 1 s); Prod-Messung (2.5 s) gehört in CI mit Build-Preview | `vertical-slice-performance.spec.ts` |
| Visual Regression: < 5 % Pixelabweichung, 3 Viewports (375/768/1440) | ✅ grün — Vergleichslauf gegen alle 9 Baselines bestanden, Renderdeterministik bestätigt (eingefrorene Zeit, reduced-motion, WebGL-Canvas maskiert) | `vertical-slice-visual.spec.ts` |
| Art Director ≥ 3/5, UX Critic ≥ 3/5, Motion Director ≥ 3/5 | ⏳ manuelle Reviews, nicht automatisierbar | — |

### Durch das Gate gefundene und behobene Mängel

1. **`dashboard.cityLink` fehlte in allen Sprachbäumen** (WP-4.5) — der
   Stadt-Link renderte den rohen Key-String. Key in `de/en/ru/tlh` ergänzt.
   (`call-site-keys.test.ts` deckt das als generischer [REGRESSION]-Wächter ab.)
2. **axe critical `button-name`:** Drei Radix-Switches auf dem Dashboard ohne
   zugänglichen Namen (AdvancedBalanceChart, TransactionCharts, SankeyChart) —
   `aria-label` mit dem vorhandenen i18n-Key des Nachbartextes ergänzt.
3. **axe critical `aria-valid-attr-value`:** Stadt-Tabs erzeugten
   `aria-controls` auf nie gerenderte Panels (es gibt bewusst kein
   TabsContent — die Tabs schalten das Datenmodell einer Canvas-Fläche).
   `aria-controls` am Trigger explizit entfernt.

### Verifizierte Ist-Abweichung (kein Fehler, aber dokumentiert)

Der Demo-Einstieg („Demo ansehen") landet faktisch auf `/coach`, nicht auf
`/dashboard` — `Login.tsx` setzt die Ziel-URL per `history.replaceState`,
doch der langlebige `BrowserRouter` wird beim Branch-Wechsel von React
wiederverwendet und übernimmt sie nicht. Landen auf der Startseite `/coach`
ist produktseitig konsistent; der Code-Kommentar in `Login.tsx`
(„direkt auf dem gefüllten Dashboard landen") beschreibt das Verhalten
jedoch falsch. Empfehlung: Kommentar korrigieren oder Navigation über den
Router statt `replaceState` ausführen — außerhalb des Slice-Gates.

### Test-Infrastruktur

- `@playwright/test` + `@axe-core/playwright` als devDependencies (erste
  E2E-Specs des Repos überhaupt — `e2e-tests/` war leer).
- Fixture `e2e-tests/fixtures/vertical-slice.ts`: Demo-Seeding durchs reale
  UI, Onboarding-Dialog-Beendigung, Zeit einfrieren für Pixel-Vergleiche.
- Neue npm-Abhängigkeiten außerhalb der Test-Toolchain: keine.

---

## 2026-07 — Phase 2/3/4 + vorgezogene Phase-5/6/7-Pakete (Vorgänger-Sessions)

**Status:** Abgeschlossen, TypeScript-fehlerfrei (0 Fehler global), i18n-Parität
erhalten, keine bestehenden Tests gelöscht/abgeschwächt.

| WP | Titel | Status |
|---|---|---|
| WP-2.1 | Motion Token System | ✅ |
| WP-2.2 | Skin-Konsolidierung (ACTIVE_SKINS, keine Breaking Changes) | ✅ |
| WP-2.3 | Typografie-Hierarchie (Hero 56/36 px via `.hero-value`) | ✅ |
| WP-2.4 | Atmosphere State Hook (`deriveAtmosphere`) | ✅ |
| WP-3.1 | AtmosphereLayer in AppShell | ✅ |
| WP-3.2 | Shared Element Transition Infrastructure | ✅ |
| WP-3.3 | Enhanced Empty State (FinanceEmptyState-Variante) | ✅ |
| WP-3.4 | Enhanced Loading State (Skeleton `shimmer`) | ✅ |
| WP-3.5 | Material Token System (Tokens + Integration in ds-section, ds-summary-card, InteractiveCard, KpiCard) | ✅ |
| WP-4.1 | Dashboard Hero Hierarchy (StatHero) | ✅ |
| WP-4.2 | Budget Tank Mikroreaktionen (`data-shake`/`data-breathe`) | ✅ |
| WP-4.3 | City Atmosphere Weather (`setAtmospherePreset`) | ✅ |
| WP-4.4 | Budget Detail Shared-Element-Transition (`budget-tank-<id>`) | ✅ |
| WP-4.5 | Dashboard → City Transition (`dashboard-city-link`) | ✅ |
| WP-5.5 | City Signature Moment (Erstaufbau) | ✅ |
| WP-6.5 | Signature Moment Komponente | ✅ |
| WP-6.7 | Chart Animation (`useChartAnimation`, TransactionCharts migriert) | ✅ |
| WP-7.1 | Navigationsbewegung (Motion-Tokens in SideNav/BottomNav) | ✅ |
| WP-7.2 | Erfolgs-/Warnbewegungen (`--motion-easing-confirm`) | ✅ |
| WP-7.6 | Motion-Abbruch (cancelFlight, fromRef, FM-Interrupt) | ✅ (verifiziert, bereits vorhanden) |

### Offen (nächste Programm-Schritte)

- WP-4.6 Rest: manuelle Critic-Reviews (Art Director/UX/Motion ≥ 3/5 — nicht
  automatisierbar, Orchestrator-Entscheid).
- Phase 5: WP-5.1–5.4, 5.6–5.8 (City-Erweiterungen).
- Phase 6: WP-6.1–6.4, 6.6, 6.8–6.10 (DataViz).
- Phase 7: WP-7.3–7.5, 7.7–7.8 (Motion).
- Phase 8–11: Feature Migration, State Coverage, QA, Rollout.
- Bekannte Gleichklasse außerhalb des Slice: weitere Radix-Switches ohne
  `aria-label` (z. B. ContractsDashboard, TimelineChart, IncomeBreakdownCard)
  — bei Migration der jeweiligen Screens mitziehen.
