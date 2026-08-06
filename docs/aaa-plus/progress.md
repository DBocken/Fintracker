# FinTracker AAA+ — Fortschrittsprotokoll

> Format gemäß Implementierungsplan §16: WP-ID, Status, Datum, Gate-Ergebnis.
> Neueste Einträge oben.
>
> Die Gegenrichtung — was noch **aussteht** — steht gesammelt in
> [`offene-punkte.md`](offene-punkte.md).

---

## 2026-08-06 — Phase 8: Grundlage, Altfaelle, Ladezustaende, Hierarchie/Paritaet

**Status:** Phase 8 ist in dem Umfang abgeschlossen, den ein unbeaufsichtigter
Lauf verantworten kann. Was bleibt, ist benannt (siehe
[`offene-punkte.md`](offene-punkte.md)) und nicht stillschweigend uebersprungen.

| WP | Kern der Aenderung |
|---|---|
| **WP-8.0** | Die Karten-Regel (AGENTS.md §9) ist maschinell pruefbar. Vorher gab es dazu **nur** einen advisory Claude-Hook: CI sah nie einen Verstoss, Agenten ohne `.claude/`-Hooks auch nicht. `pnpm check:card-rule` prueft jetzt repo-weit, in Pre-Commit und CI. Bewusst die **schwaechere** Aussage („Karten-Chrome ohne jedes Interaktions-Signal"), denn eine Regel mit Fehlalarmen wird abgeschaltet |
| **WP-8.1** | Alle acht Altfaelle behoben, `card-rule-allowlist.json` ist **leer**. Jeder neue Verstoss bricht ab jetzt den Build. Mitbehoben: `HeatmapCalendar` trug feste Graustufen statt Design-Tokens (im Hellmodus ein dunkelgrauer Block) und zeigte `cursor-pointer` ohne klickbar zu sein |
| **WP-8.2** | Fuenf Ladezustaende auf die Choreografie aus WP-7.3 gezogen. Kein Skeleton unter 150 ms (das waere ein Blinzeln), ein gezeigtes bleibt mindestens 300 ms. Platzhalter in der Form des spaeteren Inhalts: ein Spinner sagt „es passiert etwas", ein Skelett sagt „hier kommt eine Liste" |
| **WP-8.3** | Die beiden nicht maschinell pruefbaren Restpunkte, je Screen durchgesehen — siehe unten |

### WP-8.3 im Einzelnen

**Hierarchie (Befund aus der Gate-Neubewertung).** Die Kennzahlenzeile des
Dashboards stellte vier Groessen in derselben Schriftgroesse und demselben
Gewicht nebeneinander — eine Aufzaehlung, keine Aussage. Jetzt abgestuft nach
der Frage, die der Nutzer als naechste stellt: Zeitraum-Saldo (`text-2xl`,
„wie lief dieser Zeitraum") ueber Einnahmen/Ausgaben (`text-base`) ueber der
Anzahl (`text-sm`, gedaempft). Der Hero bleibt darueber — die Abstufung darf
keine zweite Hauptaussage erzeugen (Befund A-1). Der Test vergleicht dafuer
nicht Klassennamen, sondern den in `src/index.css` deklarierten Wert von
`--font-size-hero-mobile` gegen `text-2xl`; ein reiner Namensvergleich wuerde
nicht rot, wenn jemand die Variable absenkt.

**Paritaet (AGENTS.md §4), je Breakpoint-Weiche durchgesehen.** Ein Befund:
Die Export-Reihe der Geldfluss-Visualisierung trug `hidden sm:flex` **ohne
Gegenstueck** — auf dem Telefon fehlte der Export damit ganz. Das ist kein
Dichte-Unterschied, sondern ein fehlendes Feature. Desktop zeigt die drei Wege
weiterhin offen, Mobil buendelt sie hinter einem Ausloeser (progressive
Offenlegung, ein Ziel statt drei in einer Zeile, die schon den Regler traegt).

Alle uebrigen Weichen sind paarig und im Quelltext als solche begruendet:
Seitennavigation ↔ `MobileNav`/`BottomNav`, Suchleiste ↔ Suchknopf,
Theme-Umschalter ↔ Einstellungen/Darstellung, Tabelle ↔ Kartenliste
(Transaktionen, Vertraege), Desktop-View ↔ Mobile-Story (Dashboard,
Sonderkategorien), Illustration ↔ kompakte Illustration (Coach),
Zuordnung inline ↔ Detail-Sheet (Schulden).

**Ausserdem migriert:** der Ladezustand des `PortfolioManager` (Trading), der
in WP-8.2 noch bewusst offen geblieben war.

### WP-8.4 — Restmigration, gefunden durch Nachprüfen der eigenen Behauptung

Die Aussage „die Migrationskriterien sind repo-weit durchgesetzt" wurde nicht
geglaubt, sondern geprüft: ein Sweep über feste Farbwerte, Zeigefinger ohne
Ziel, willkürliche Bewegungsdauern und inhaltsersetzende Spinner. Vier
Befunde, alle behoben; drei Verdachtsfälle lösten sich als Fehlalarm auf
(`cursor-pointer` stand jedes Mal auf einem `<label>` — das IST klickbar).

| Befund | Was daran falsch war |
|---|---|
| `TradingDashboard`, zwei Stellen | Als einziger Screen noch inhaltsersetzende Spinner — einer für den ganzen Screen, einer für die Positionsliste |
| `BackupManager` | Dito für die Kennzahlen-Übersicht |
| `ReviewTable` | `#000` als Rückfall, wenn eine Kategorie keine Farbe hat: schwarze Schrift auf schwarzem Grund im Dunkelmodus. Jetzt bleibt der Badge ohne Farbe bei seinen Token-Vorgaben |
| `CloudMcpSyncCard`, zwei Stellen | `bg-amber-600` aus der Roh-Palette statt `bg-warning` — die Fläche wechselt mit dem Thema nicht mit |

**Die Sprachausgabe-Entsprechung sitzt jetzt in `LoadingSwap` selbst.** Vorher
hatte sie genau ein Ladezustand, weil ich beim Bauen daran gedacht hatte — die
vier aus WP-8.2 nicht. Ein Skelett ist rein visuell; ohne Textentsprechung
sieht eine Sprachausgabe leere Kästen und schweigt. In der Aufrufstelle ist das
eine Frage der Aufmerksamkeit, im Baustein eine Eigenschaft. Neuer Schlüssel
`common.loading` in allen vier Sprachbäumen.

Dabei fiel auf, dass `LoadingSwap.test.tsx` mit dem rohen `render` arbeitete
statt mit den zentralen Helfern (AGENTS.md §5). Das ist mitgezogen — und der
Zustandswechsel läuft dort jetzt über **Zustand** statt über `rerender`:
`rerender` ersetzt den ganzen Baum und wirft den Provider weg, und es ist
ohnehin der unechte Hergang. In der App bleibt der Baum stehen, nur das Flag
kippt.

### Ein Befund, den erst die Messung sichtbar gemacht hat

Die Hierarchie-Aenderung liess den Performance-Lauf kippen: CLS `/dashboard`
0,1002 gegen ein Budget von 0,1 — vorher 0,096. Die vier zusaetzlichen Pixel
Zeilenhoehe waren also nicht die Ursache, sondern der letzte Tropfen.

Statt das Budget zu lockern (es haette dann nichts mehr gemessen) wurden die
`layout-shift`-Eintraege aufgeschluesselt. Ergebnis: zwei nachtraeglich
eingeschobene Streifen von je 41 px. Der `DemoDataBanner` war einer davon —
und das ohne Grund: `isDemoDataActive()` liest **synchron** aus dem
localStorage, `useQuery` lieferte im ersten Render trotzdem `undefined`. Mit
`initialData` steht der Banner sofort. Die Rangfolge kostet ausserdem jetzt
keine Blockhoehe mehr (`leading-7` haelt die Zeilenhoehe der frueheren
`text-lg`-Zeile).

`/dashboard` liegt damit bei **0,077**. Der groessere Posten — die
Tutorial-Einladung ueber der gesamten Huelle, 0,073 — ist gemessen, benannt
und bewusst offen; Begruendung in [`offene-punkte.md`](offene-punkte.md).

**Nachweis:** 433 Test-Dateien / 4247 Tests gruen, E2E 4/4 (zwei
Dashboard-Baselines neu erzeugt, die Aenderung ist beabsichtigt), `tsc` und
`lint` fehlerfrei, alle fuenf Waechter gruen.

**Grenze, bewusst so:** Paritaet ist eine Aussage ueber Bedeutung, nicht ueber
Code — es gibt dafuer keinen Waechter und kann keinen geben. Was pruefbar war,
ist geprueft: jede `hidden <bp>:*`- und `<bp>:hidden`-Weiche im Quelltext
einzeln gegen ihr Gegenstueck.

---

## 2026-08-06 (Nachtrag) — Phase 6 und 7 vollstaendig

**Status:** Die drei verbliebenen Arbeitspakete sind umgesetzt. Phase 6
(10 WPs) und Phase 7 (8 WPs) sind damit **vollstaendig**.

| WP | Kern der Aenderung |
|---|---|
| **WP-6.3** | Sankey: Die Fluss-Textur liegt UEBER dem Band, nicht darin. Ein `stroke-dasharray` auf dem Band selbst wuerde den Strom zerschneiden — das saehe nach Unterbrechung aus, nicht nach Fluss. Verschiebung exakt eine Musterlaenge, sonst springt die Schleife; `linear`, weil ein Strom nicht beschleunigt. Auf der sparsamsten Bewegungsstufe entfaellt sie: eine endlose Animation hat keinen Moment, in dem sie fertig waere |
| **WP-6.4** | Vermoegen als Volumen. Der bisherige 2,5-px-Balken zeigte Anteile korrekt, aber keine Groessenordnung — 2.000 EUR und 200.000 EUR sahen identisch aus. Jetzt Kreise, deren **Flaeche** proportional zum Betrag ist (Radius ueber die Wurzel; linear skaliert saehe der doppelte Betrag viermal so gross aus) |
| **WP-7.5** | Jahresrueckblick laeuft auf einen Signature Moment zu statt auf eine Share-Karte mit Ueberschrift. Dieselbe Choreografie und Haptik wie alle anderen Erfolgsmomente, statt einer zweiten Fassung. Feste Uebergangsdauern durch Tokens ersetzt |

**Nachweis:** 430 Test-Dateien / 4223 Tests gruen, `pnpm lint` und
`pnpm exec tsc --noEmit` fehlerfrei, alle i18n- und Struktur-Waechter gruen.

---

## 2026-08-06 — Phase 6/7 zu grossen Teilen abgearbeitet, WP-4.6-Gate bestanden

**Status:** Elf Arbeitspakete aus Phase 6 und 7 sind umgesetzt, das
WP-4.6-Gate ist **bestanden** (Addendum in
[`critic-reports/wp-4.6-art-ux-motion.md`](critic-reports/wp-4.6-art-ux-motion.md)),
die E2E-Suite laeuft in CI. Drei Arbeitspakete stehen noch aus und sind in
[`offene-punkte.md`](offene-punkte.md) benannt.

### Umgesetzt

| WP | Kern der Aenderung |
|---|---|
| **WP-7.7** | Bewegungsstufe **vor** dem ersten Frame aus dem Geraeteprofil. Die Einstufung „stark / Telefon / schwach" wandert aus der Finanzstadt nach `lib/device-profile.ts` und wird geteilt — kein zweites Degradations-System, das auseinanderdriften koennte |
| **WP-6.8** | Zwoelf Charts trugen je eine eigene Abschrift von `contentStyle` und den Achsen-Attributen; sie waren bereits auseinandergelaufen. Jetzt Props-Fabriken (Recharts erkennt Kinder am Komponententyp — ein Wrapper waere unsichtbar). `niceTicks()` (D-1) gilt jetzt auf **allen** Achsen |
| **WP-6.10** | `<ChartFigure>`: ein Satz zur Aussage, SVG fuer Hilfstechnik ausgeblendet, Werte als aufklappbare Tabelle. Zwei Charts hatten eine Liste als Alternative — die war aber `md:hidden`, auf Desktop war der Donut also der einzige Zugriffsweg |
| **WP-6.1** | Prognose: drei verschachtelte Konfidenzflaechen statt einer harten Kante. Eine harte Kante liest sich als Zusage, obwohl P10 heisst, dass jeder zehnte Durchlauf tiefer faellt. Aus echten Quantilen (sieben statt drei), nicht aus Interpolation |
| **WP-6.2** | Prognose duennt zum Horizont hin aus. Als Maske, nicht als zweite Farbe — sonst verrechnete sie sich mit der Deckkraft der drei Ebenen |
| **WP-6.6** | Transaktionsliste sortiert sich beim Filtern sichtbar um. Drei Lagen, in denen NICHT animiert wird, als Rangfolge modelliert — darunter die Virtualisierung ab 150 Eintraegen, eine echte Grenze |
| **WP-6.9** | Kennzahlen zaehlen beim Zeitraumwechsel vom alten auf den neuen Wert. `animateOnMount: false` — das WP heisst „zwischen Zeitraeumen", nicht „beim Aufbau" |
| **WP-7.3** | Ladezustaende: kein Skeleton unter 150 ms (das waere ein Blinzeln), ein gezeigtes bleibt mindestens 300 ms |
| **WP-7.4** | Signature Moment „Schuldenfrei" mit Gedaechtnis: „Summe ist null" traefe auch auf jeden zu, der nie Schulden erfasst hat |
| **WP-7.8** | Haptik ueber `navigator.vibrate` statt einer neuen Abhaengigkeit; schweigt bei reduzierter Bewegung und auf Geraeten ohne Vibration |
| **Infra** | E2E-Job in CI (funktional, a11y, Visual, Performance), Browser-Cache, Prod-Budget **LCP < 2,5 s erstmals gemessen und eingehalten**; Radix-`DialogTitle`-Warnung behoben |

### Nebenbei behoben (nicht beauftragt, aber im Weg)

- **`CHART_SERIES_LABELS`** in `LiquidityReport` war eine hartkodierte
  Modul-Konstante mit UI-Text; ebenso der Satz unter dem Prognose-Chart.
  Beides Verstoesse gegen AGENTS.md §6, jetzt uebersetzt in allen vier
  Baeumen mit `everyday`-Overlay.
- **Gradient-IDs aus `Date.now()`** — neue ID bei jedem Render, alte `<defs>`
  bleiben stehen, Kollision bei zwei Charts in derselben Millisekunde.
- **`ease: [0.22, 1, 0.36, 1]`** stand an fuenf Stellen von Hand abgeschrieben
  — genau die Drift, gegen die das Token-System angetreten ist.
- **`vitest.setup.ts` pinnt `hardwareConcurrency`**: sonst haenge jede
  Zusicherung auf eine Animationsdauer an der Kernanzahl des Runners.

### Waechter statt Einmal-Aufraeumung

`chart-standardization.test.ts` prueft die Quelle: kein eigenhaendiges
`contentStyle`, jeder Tooltip ueber die Fabrik, jeder Chart mit
nicht-visueller Entsprechung, keine Zeitstempel als SVG-ID. Ohne diesen
Waechter waere die Aufraeumung in drei Monaten wieder zerfallen — genau so
sind die bisherigen Abweichungen entstanden.

### Zwei Befunde, die Tests aufgedeckt haben

- Die aeussere Konfidenzflaeche rechnete `p90 - p05` statt `p95 - p05`; der
  Kommentar sagte P05–P95, der Code nicht.
- Der erste CI-Lauf der E2E-Suite meldete zwei Snapshots rot, ohne
  Code-Aenderung. Ursache war die **Browser-Version** (lokal Chromium 141, CI
  151), nicht die Plattform — siehe `decisions/decision-log.md` F-2.

### Nachweise

- Volle Suite gruen; `pnpm lint`, `pnpm exec tsc --noEmit`, `check:i18n`,
  `check:i18n-module-consts`, `check:test-structure` fehlerfrei.
- E2E lokal 4/4 gruen gegen erneuerte Baselines, im Folgelauf stabil
  bestaetigt; a11y 0 Critical.
- Performance gegen den **Produktions-Build** gruen — das Gate-Budget
  LCP < 2,5 s ist damit erstmals belegt und nicht mehr nur behauptet.
- Motion-Review als Videoaufzeichnung, ausgewertet als 4-fps-Frames.

---

## 2026-08-06 — Critic-Befunde behoben, Offene-Punkte-Liste angelegt

**Status:** Die vier inhaltlichen Befunde des WP-4.6-Critic-Reviews sind
behoben; ein Befund war ein Artefakt der Aufnahmemethode. Die Bewertung
selbst (Hierarchie-Neubewertung, Motion-Review) steht noch aus und ist
zusammen mit allem anderen Offenen in [`offene-punkte.md`](offene-punkte.md)
festgehalten.

| Befund | Schwere | Umsetzung |
|---|---|---|
| **D-1** — Achsenbeschriftungen nicht gerundet | Minor | `niceTicks()` in `src/lib/chart-axis.ts` wählt eine runde Schrittweite (1/2/5 × 10^n) nahe an `span / 4` und legt Anfang und Ende auf Vielfache davon. Recharts interpolierte bisher aus der Domain und erzeugte 895/1795/2695 €. Im Kontostand-Verlauf über **alle drei** geplotteten Serien gerechnet, damit keine aus der Achse fällt. 6 Lib-Tests, davon einer `[REGRESSION]` mit den Werten aus dem Review |
| **A-3** — „Zur Finanzstadt" ist ein leerer Kartenstreifen | Minor | Die Karte trägt jetzt eine Vorschau: Stimmungsfarbe (dieselben Akzente wie die Atmosphäre-Schicht, `ATMOSPHERE_ACCENTS`) und die Viertel-Kennzahl aus dem **Sunburst-Außenring** — derselben Quelle, aus der die Stadt ihre Distrikte baut. Ohne Ausgaben steht dort eine Entstehen-Zeile statt „0 Viertel" |
| **A-2** — drei Hinweisebenen vor dem Inhalt | Major (Mobil) | Höchstens eine **echte** Hinweisebene gleichzeitig: `TutorialHost` umschließt die App als Präsenz-Provider (`useTutorialPresence`), der nachrangige Coach-Streifen wartet, bis Einladung oder Führung beendet ist. Der Wegklick-Zustand wanderte dafür aus der Einladung in den Host |
| **A-1** — dieselbe Zahl drei- bis viermal | Major | Bereits behoben (Eintrag „Divergenz aufgelöst") |

**Der Demodaten-Banner ist bewusst keine dieser Ebenen.** Datenherkunft ist
Integritätsanzeige, keine aufschiebbare Meta-Kommunikation: Wer Beispieldaten
sieht, muss das jederzeit wissen — auch während einer Führung.

### Befund U-1 ist ein Artefakt, kein Fehler

„Zwei Navigationsebenen im Inhalt" (Mobil) entstand durch die
**Full-Page-Screenshots** des Reviews: Die Bottom-Nav ist
`fixed inset-x-0 bottom-0` und erscheint dort mitten im Dokumentfluss, im
echten Viewport dagegen als Leiste über dem Inhalt. Es stehen also nie drei
Orientierungsangebote übereinander. Festgehalten, damit der Befund nicht in
einer späteren Runde erneut als offen gilt — und als Warnung: aus
Full-Page-Screenshots lassen sich Aussagen über `fixed`-Elemente nicht
ableiten.

### Nachweise

- Volle Suite grün (409 Test-Dateien), `pnpm lint` und `pnpm exec tsc
  --noEmit` fehlerfrei, `pnpm test:security` und `pnpm security:secrets` grün.
- E2E (Linux): funktionaler Slice, Accessibility (0 Critical) und Visual
  Regression grün — Baselines nach dem Hero- und Karten-Umbau neu erzeugt und
  im Folgelauf als stabil bestätigt.
- **Performance weiterhin der bekannte Container-Effekt:** LCP und CLS grün,
  die Warm-Navigation Dashboard → Stadt misst **1460 ms** gegen das
  1000-ms-Dev-Budget (vorher 1657 ms). In diesem Container rendert WebGL in
  Software; das Budget bleibt unverändert und ist auf echter Hardware
  nachzumessen.

---

## 2026-08-06 — Divergenz aufgelöst: #279-Bestand übernommen, A-1 entschieden

**Status:** Beide offenen Auftraggeber-Entscheidungen sind gefallen und
umgesetzt. WP-6.7 ist damit **vollständig** (alle 25 Recharts-Serien),
Befund A-1 ist behoben, Phase 6 ist entsperrt.

**Entscheidung 1 — PR #279:** Übernahme der einzigartigen Commits per
Cherry-Pick auf die Fortsetzungslinie (PR #281), danach Schließung von #279.
Abweichung zur ursprünglichen Empfehlung („nach dem Merge"): die Übernahme
erfolgte **vor** dem Merge direkt auf den PR-Branch — ein Merge statt zwei,
F-SEC-3 kommt mit demselben Zug live.

**Entscheidung 2 — Dashboard-Hauptaussage (Befund A-1):** Der **aktuelle
Kontostand** ist die Hero-Aussage; der Zeitraum-Saldo wandert in die
Kennzahlenzeile. Deckungsgleich mit dem übernommenen Fix (`Dashboard.tsx`,
`TransactionStats.tsx`, `dashboard.heroCurrentBalanceLabel` in de/en/ru/tlh).

### Übernommen (12 Commits + 1 Einzel-Hunk)

Agenten-Graph (Skript + Leer-Auftrag-Fix + Doku), Ablageorte
`audits/`/`decisions/`/`evidence/`, Critic-Review WP-4.6, Motion-Easing-
Grundlage, WP-6.7 (25 Recharts-Serien), globale Atmosphäre aus echten
Finanzdaten, Shimmer-Ladezustände, Kontostand-Hero (A-1), Transaktionen-Screen
(AAA+-Produktsprache), Sankey-Export-Fix. Aus `4ba0099` nur die
Komponentenkorrektur (SignatureMoment: Untertitel-Transition an `reduce`
gekoppelt) — die Testfixes des Commits existieren hier in eigener Fassung.

### Bewusst nicht übernommen

`5930797` (Lockfile-Overrides), `a894fb7` (OSV), `e3be3d5` (KpiCard-Schatten),
`ae85e28`/`4ba0099` (Testfixes), `3c3…` (Protokoll-Korrektur der #279-Linie) —
alle auf dieser Linie bereits in anderer, teils weitergehender Fassung behoben.

### Konflikte der Übernahme (2, beide erklärbar)

- `useAtmosphereState.ts`: beide Linien hatten denselben Memoization-Fix mit
  je eigenem Kommentar — HEAD-Fassung behalten.
- `translations.ts`: Ganzdatei-Konflikt durch **CRLF auf der #279-Seite**
  (diese Linie hatte auf LF normalisiert — exakt die im CI-Reparatur-Eintrag
  dokumentierte Falle). LF-Fassung behalten, den einen neuen Key
  (`heroCurrentBalanceLabel`) von Hand in alle vier Bäume eingefügt; `tsc`,
  Locale-Parität, Call-Site-Keys und Overlay-Coverage danach grün.

### Konsequenzen

- **WP-4.6-Gate-Rest:** A-1 (der 2/5-Blocker der Kategorie Visuelle
  Hierarchie) ist behoben; die Neubewertung der Hierarchie und die übrigen
  manuellen Reviews (Motion braucht Bewegtbild) bleiben offen.
- **Visual-Baselines:** Der Hero-Umbau ändert das Dashboard sichtbar — die
  drei `dashboard-*`-Linux-Baselines wurden neu erzeugt (Stadt/Budgets
  unverändert). Die eingecheckten **win32-Baselines sind für `dashboard-*`
  veraltet** und beim nächsten win32-Lauf mit `--update-snapshots` zu erneuern.
- **E2E-Slice-Spec nachgezogen:** `vertical-slice.spec.ts` prüfte das alte
  Hero-Label „Saldo in diesem Zeitraum" — auf #279 konnte das nie auffallen,
  weil dort kein Runner existierte. Jetzt: „Aktueller Kontostand"
  (`exact: true`, der Text kommt als Substring auch im Chart-Untertitel vor).
- **#279** ist nach dem Push geschlossen; die Branch-Historie bleibt erhalten.

Gate-Nachweis dieser Übernahme: volle Suite **409 Dateien / 4031 Tests grün**
(kein Bestandstest gebrochen), `pnpm lint`, `pnpm exec tsc --noEmit`,
`pnpm test:security` und `pnpm security:secrets` grün; E2E-Lauf mit
erneuerten Linux-Baselines grün (Funktional/a11y/Visual; Perf wie im Eintrag
unten: Warm-Navigation im Software-WebGL-Container über Budget).

---

## 2026-08-06 — Protokollierte Restpunkte geschlossen (E2E-Runner, Switch-Namen, Login-Demo)

**Status:** die drei offenen Restpunkte außerhalb des WP-Katalogs sind
geschlossen; `pnpm test:e2e` ist erstmals ausführbar.

| Restpunkt (Herkunft) | Umsetzung |
|---|---|
| `e2e-tests/` ohne Runner-Konfiguration und npm-Skript (CI-Reparatur, 2026-08-05) | `playwright.config.ts` + `pnpm test:e2e`. Bewusst **ohne** benannte `projects` — die eingecheckten Baselines heißen `<name>-<platform>.png`, ein Projektname änderte jeden Dateinamen. `workers: 1`, weil sich alle Specs einen Dev-Server teilen und die Perf-Spec LCP/CLS misst. Vorinstallierte Browser via `PLAYWRIGHT_CHROMIUM_EXECUTABLE` (optionaler Env-Override, kein Umgebungspfad im Repo) |
| „Bekannte Gleichklasse": Radix-Switches ohne zugänglichen Namen (WP-4.6-Gate) | Sweep über alle 15 `<Switch>`-Aufrufstellen: die drei protokollierten (ContractsDashboard, TimelineChart, IncomeBreakdownCard) **plus zwei unprotokollierte** — AccountFormDialog (Budget-Pool: Label stand daneben, war aber nicht via `htmlFor`/`id` verknüpft) und ProfileDialogContent (Sanfter Modus). 10 bilinguale `[REGRESSION]`-Tests über `getByRole('switch', { name })`, vor dem Fix rot |
| Login.tsx: Kommentar versprach /dashboard-Landung (verifizierte Ist-Abweichung, WP-4.6-Gate) | Das wirkungslose `history.replaceState('/dashboard')` ist entfernt (der langlebige App-Router übernimmt es nicht; es erzeugte nur einen kurzen URL/Inhalt-Widerspruch), der Kommentar beschreibt jetzt die echte Landung auf `/coach`. 3 Tests, davon 2 `[REGRESSION]` bilingual |

### E2E-Verifikationslauf (Linux-Container, `pnpm test:e2e`)

- **Funktional** (`vertical-slice.spec.ts`): grün.
- **Accessibility**: grün — 0 Critical Violations, inklusive der fünf neu
  benannten Switches.
- **Visual Regression**: Erstlauf schreibt erwartungsgemäß die 9
  Linux-Baselines (jetzt eingecheckt, gleiche Mechanik wie win32); der
  Vergleichslauf danach ist grün — Renderdeterministik bestätigt.
- **Performance**: LCP < 4 s und CLS < 0.1 grün auf Dashboard und Stadt.
  Die Warm-Navigation Dashboard → Stadt misst **1657 ms** gegen das
  1000-ms-Dev-Budget: in diesem Container rendert WebGL in Software
  (SwiftShader). Das Budget bleibt unverändert — es beschreibt eine echte
  Dev-Maschine; auf ihr ist der Wert erneut zu messen, nicht hier zu lockern.

### Zwei Arbeitslinien laufen auseinander — Entscheidung des Auftraggebers

PR #279 (`claude/agent-selection-graphs-hczfxc`, 18 Commits) und PR #280
(`claude/aktuelle-fehler-docs-p9l7h0`, 22 Commits) zweigen vom selben
main-Stand ab; dieser Branch setzt die #280-Linie fort. #279 enthält Arbeit,
die auf dieser Linie **fehlt**:

- WP-6.7 vollständig (alle 25 Recharts-Serien auf Motion-Tokens — hier ist
  nur TransactionCharts migriert),
- Transaktionen-Screen auf AAA+-Produktsprache,
- Shimmer-Ladezustände flächendeckend,
- Kontostand als Dashboard-Hauptaussage (Befund A-1 behoben),
- Sankey: doppelte Export-Schaltflächen entfernt (mit `[REGRESSION]`-Test),
- Agenten-Graph (Workflow-Skript + Doku) und die Ablageorte
  `audits/`/`decisions/`/`evidence/`,
- **Critic-Review WP-4.6** (`critic-reports/wp-4.6-art-ux-motion.md`):
  eskaliert das Gate — Visuelle Hierarchie 2/5 wegen Befund A-1 — im
  Widerspruch zum „BESTANDEN"-Eintrag dieser Linie (2026-07, unten).

Die Überschneidungen (Lockfile-Sync, KpiCard-Schatten, blinde Tests) wurden
auf beiden Linien **unterschiedlich** behoben; ein Merge beider PRs
konfligiert. ~~Empfehlung: die #280-Linie (bzw. deren Fortsetzungs-PR) mergen,
danach die einzigartigen #279-Commits gezielt cherry-picken und #279
schließen.~~ **Entschieden und umgesetzt** — der Auftraggeber hat der
Cherry-Pick-Übernahme zugestimmt; Details im Eintrag „Divergenz aufgelöst"
(2026-08-06, oben). Phase 6 ist damit entsperrt.

---

## 2026-08-06 — Phase 5 (Finanzstadt): abgeschlossen

**Status:** alle sieben offenen WPs erledigt (5.1, 5.2, 5.3, 5.4, 5.6, 5.7,
5.8). Volle Suite grün: 400 Dateien / 3990 Tests.

WP-5.2 (Zeitachse) ist nach der Entscheidung des Auftraggebers in der zweiten
Lesart umgesetzt — **mit** Zukunft, aber ohne eigene Prognose: die Stadt liest
`['forecast-input']` (derselbe Query-Key wie `useForecast`, geteilter Cache)
und lässt `projectCategorySpend` daraus die erwarteten Beträge je Kategorie
bilden.

Dabei kam ein Befund heraus, der über die Stadt hinausgeht: **`buildRecurringFlows`
und `buildVariableExpenseBaselines` verschlüsselten die Kategorie über den
ANZEIGENAMEN**, obwohl die stabile ID in beiden Fällen direkt danebenstand und
verworfen wurde (AGENTS.md §6, dokumentierte Falle). Beide tragen sie jetzt mit
— additiv, Summen und Monte-Carlo-Verhalten unverändert. Tragen zwei
Kategorien denselben Namen, bleibt die ID bewusst leer, statt eine der beiden
zu behaupten.

Zweiter Fallstrick, mitbehoben: die **Distriktfarbe kam aus dem Index nach
Betrag** — beim Monatswechsel hätte die Stadt bei jedem Schritt umgefärbt und
wäre nicht mehr als dieselbe erkennbar gewesen.

Phase 5 hat in `tdd-specs.md` **keine** Spezifikationen — die decken WP-2.1 bis
WP-4.3 ab. Für die hier umgesetzten WPs lagen nur Titel und Priorität aus dem
Katalog in `implementation-plan.md` vor; die Akzeptanzkriterien sind je WP im
Slice-README (`src/features/finance-city/README.md`) dokumentiert.

| WP | Prio | Kern der Umsetzung |
|---|---|---|
| WP-5.6 | P1 | Qualitätsstufen (`high`/`balanced`/`lean`) aus dem Geräteprofil, **vor** dem ersten Frame. Die FPS-Kaskade greift erst nach sichtbarem Ruckeln — auf schwachen Telefonen war der erste Eindruck systematisch der schlechteste. |
| WP-5.7 | P1 | Grafikausfall benennen. Der **Kontextverlust** war gar nicht behandelt: der Canvas fror auf dem letzten Frame ein und zeigte weiter veraltete Zahlen. |
| WP-5.3 | P2 | Fortschritt auch an der Farbe ablesbar. Die kam vorher aus dem **Sortier-Index** und sagte über den Fortschritt nichts. |
| WP-5.1 | P2 | Wiederkehrende Zahlungen als Flusslinien; Wiederkehr aus vorhandenen Buchungsdaten abgeleitet statt über eine zurückgeholte Query. |
| WP-5.4 | P3 | Fassaden-Fenster datengetrieben statt dekorativ — zeigt, was die Höhe nicht kann: eine große Zahlung vs. viele kleine. |
| WP-5.8 | P2 | Legende der visuellen Sprache. Erklärt **nur, was gerade zu sehen ist**. |

### Ein durchgehendes Muster

Vier der sechs Befunde waren nicht „Feature fehlt", sondern **Kanal ohne
Aussage**: Die Zielfarbe kam aus dem Sortier-Index, die Fassaden-Fenster waren
überall gleich, die Qualitätsstufe existierte nur reaktiv, und die visuelle
Sprache war nirgends erklärt. Jedes für sich sah fertig aus.

### Bewusste Abweichungen

- **Flusslinien fließen nicht.** Eine Animation liefe endlos und widerspräche
  der Render-on-Demand-Vorgabe (Akku) — ohne eine einzige zusätzliche Zahl zu
  zeigen.
- **WP-5.8 ist kein Tutorial.** `docs/tutorial-progressive-disclosure.md` legt
  die Reihenfolge „zuerst die Freischaltungs-Achse, danach das Overlay" fest.
  Die Legende nimmt davon nichts vorweg; eine spätere Führung kann über
  `data-tour-id="city-legend"` darauf zeigen.
- **WP-5.1 holt `computeContracts` nicht zurück.** WP-E2 hatte es bewusst
  entfernt; die Wiederkehr wird stattdessen aus den Daten abgeleitet, die
  ohnehin durch die Etagen-Aggregation laufen.

### WP-5.2 (Zeitachse) — umgesetzt

Monatsleiste nur im Ausgaben-Tab (nur dort gibt es eine Prognose je Kategorie;
ein Regler, der in drei von vier Tabs nichts tut, wäre schlimmer als keiner).
Vergangenheit nur, wo Daten existieren; Zukunft immer die nächsten drei Monate.

Vier Zusicherungen, je eigen getestet:

- **Stabile Distriktfarben** über alle Monate.
- **Prognose ist sichtbar Prognose**: durchscheinend mit Kante, „Prognose"-Chip,
  eigener Legenden-Eintrag. Deckkraft wird nur gesenkt, nie angehoben.
- **Kein Mischmonat**: vordatierte Buchungen begründen keinen
  Vergangenheitsmonat — sonst wäre nicht sagbar, welche Zahl woher kommt.
- **Keine erfundene Genauigkeit**: Prognosemonate haben keine Etagen, keine
  Fassaden-Aktivität und keine Flusslinien.

Ohne Auswahl bleibt der Vorgabe-Ausschnitt (alle Buchungen) wie vor WP-5.2 —
die Seite startet nicht in einem Zustand, den niemand gewählt hat.

---

## 2026-08-06 — F-SEC-3: Das Tageslimit begrenzte den, der es zurücksetzen konnte

**Status:** behoben. Migration `20260806120000_harden_balance_refresh_limits.sql`,
Edge Function `refresh-balances`, Wächter
`src/security/balance-refresh-rate-limit.security.test.ts` (14 Zusicherungen,
vor dem Fix 11 rot).

`balance_refresh_limits` begrenzt Abrufe gegen die **externe** GoCardless-Quote
auf einen pro Tag. Die ursprüngliche Migration gab dem Nutzer auf seine eigene
Zeile `FOR INSERT`, `FOR UPDATE` **und** `FOR ALL`: ein `UPDATE … SET
daily_count = 0` mit dem anon-Key — der public by design ist — stellte das
Kontingent beliebig oft wieder her. Das Limit war vorhanden, aber wirkungslos.

Zwei unabhängige Lücken, beide geschlossen:

| # | Lücke | Behoben durch |
|---|---|---|
| 1 | Nutzer konnte den Zähler selbst schreiben | Schreib-Policies entfernt (`SELECT` bleibt), zusätzlich `REVOKE INSERT, UPDATE, DELETE`; geschrieben wird nur noch über `public.consume_balance_refresh()` — SECURITY DEFINER, **ohne Parameter**, Nutzer aus `auth.uid()`, Limit aus `public.balance_refresh_daily_limit()` |
| 2 | Prüfen (SELECT) und Hochzählen (UPDATE) waren zwei Statements mit dem externen Abruf dazwischen — bei Limit 1/Tag passierten zwei gleichzeitige Anfragen beide die Prüfung (TOCTOU) | Ein `INSERT … ON CONFLICT DO UPDATE … WHERE` (nimmt die Zeilensperre), ausgeführt **vor** dem Abruf statt danach |

**Abweichung vom Audit-Vorschlag.** Der Audit empfahl einen
`service_role`-Client in der Edge Function. Das verlegt die Schwachstelle nur:
`refresh-balances` ist nutzergetrieben, und der Key umgeht RLS für *alle*
Tabellen — nicht nur für diese eine Spalte. Die SECURITY-DEFINER-Funktion kann
genau eine Operation und lässt die Allowlist in
`src/security/edge-functions-service-role.security.test.ts` (nur
`delete-account`) unangetastet.

`MAX_DAILY_REFRESHES` ist aus der Edge Function verschwunden. Die Höhe des
Limits steht jetzt nur noch in der Datenbank, die es durchsetzt; eine zweite
Zahl im Client wäre genau die stille Drift, die den Wächter vorher blind
gemacht hat.

**Nicht automatisiert prüfbar:** `supabase/functions/**` wird weder von `tsc`
(`tsconfig.json` → `include: ["src", …]`) noch von ESLint (`ignores:
['supabase/**']`) erfasst, und Deno steht in dieser Umgebung nicht bereit. Der
Wächter-Test prüft die Datei deshalb statisch als Text — Deployment und
Laufzeitverhalten bleiben manuell zu verifizieren.

---

## 2026-08-05 — CI-Reparatur: Suite und Installationsschritt wieder grün

**Status:** `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm exec tsc
--noEmit` und `pnpm test` (385 Dateien / 3823 Tests) laufen wieder durch. Kein
Test wurde deaktiviert, übersprungen oder abgeschwächt.

Der Programmstand war nicht nur rot, sondern an mehreren Stellen **blind**:
Zusicherungen, die nie greifen konnten, sahen wie Abdeckung aus.

| Befund | Wirkung | Behoben durch |
|---|---|---|
| `pnpm-lock.yaml` ohne die neun `pnpm.overrides` aus `package.json` | `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` — der **erste** CI-Schritt brach ab, alle folgenden Gates liefen nie | Lockfile synchronisiert |
| Playwright-Specs aus WP-4.6 lagen im Vitest-Glob | 4 Suiten scheiterten schon beim Einsammeln („did not expect `test.describe()`") | `e2e-tests/**` aus dem Vitest-Glob |
| `translations.ts` mit CRLF im Baum | Der `$`-verankerte Wächter gegen doppelte Namespaces fand **null** Locales statt vier und lief blind durch | Zeilenenden im Test normalisiert + `.gitattributes` (`eol=lf`) |
| `[data-framer-name]` in drei BudgetTank-Tests | framer-motion setzt das Attribut nicht: Positiv-Test unmöglich, beide Negativ-Tests vakuum-grün | Prüfung auf die gerenderte Struktur |
| Lokaler `useI18n`-Mock in `FinanceEmptyState.test.tsx` | Lieferte Schlüssel statt Texte; „visuell dominante primäre Aktion" prüfte zudem `buttons[0]`, obwohl die primäre Aktion als `<a>` rendert, und suchte „outline" in einer Basisklasse, die `focus-visible:outline-none` enthält | `renderWithProviders`, zweisprachig (AGENTS.md §6) |
| „statisch bei reduced-motion" prüfte das Fehlen eines `style`-Attributs | Framer Motion schreibt auch im Ruhezustand eines | Prüfung des Zustands + Gegenprobe mit Bewegung |
| WP-E1-Kaskadentest nahm Modell- statt Layout-Reihenfolge an | Balken sind nach Höhe absteigend sortiert; geprüft wurde die falsche Kachel | Reihenfolge aus dem Layout abgeleitet |
| `KpiCard` trug seit WP-3.5 `shadow-[var(--shadow-ambient)]` | Widerspruch zu Prinzip 8 und zum eigenen Doc-Kommentar der Komponente | Schatten entfernt |

**Offen aus diesem Lauf:** ~~`e2e-tests/` enthält Specs, Fixtures und
Visual-Baselines, aber keine `playwright.config.ts` und kein npm-Skript~~ —
**geschlossen** (Runner-Konfiguration + `pnpm test:e2e`, siehe Eintrag vom
2026-08-06). CI-Verdrahtung weiterhin bewusst offen.

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
  automatisierbar, Orchestrator-Entscheid). Achtung: Auf PR #279 liegt ein
  Modell-Critic-Review (`docs/aaa-plus/critic-reports/wp-4.6-art-ux-motion.md`),
  das das Gate **eskaliert** (Visuelle Hierarchie 2/5, Befund A-1) — siehe
  Divergenz-Abschnitt im Eintrag vom 2026-08-06.
- Phase 5: **abgeschlossen** (alle sieben WPs, siehe Eintrag vom 2026-08-06).
- Phase 6: WP-6.1–6.4, 6.6, 6.8–6.10 (DataViz).
- Phase 7: WP-7.3–7.5, 7.7–7.8 (Motion).
- Phase 8–11: Feature Migration, State Coverage, QA, Rollout.
- ~~Bekannte Gleichklasse außerhalb des Slice: weitere Radix-Switches ohne
  `aria-label`~~ — **geschlossen** (alle 15 Aufrufstellen geprüft, fünf nackte
  benannt, siehe Eintrag vom 2026-08-06).
