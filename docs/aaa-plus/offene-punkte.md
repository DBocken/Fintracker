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

## 3. Phase 8 — Feature-Screen-Migration

**Abweichung vom Plan, bewusst:** Der Plan sah „pro Screen ein WP" vor. Die
Kriterien, die eine solche Migration ausmachen — Karten-Regel, Achsen-Hygiene,
Ladechoreografie, barrierefreie Chart-Entsprechung — sind stattdessen
**repo-weit** durchgesetzt statt Screen für Screen abgehakt: `pnpm check:card-rule`,
`chart-standardization.test.ts` und die Wächter aus Phase 6/7 gelten für jede
Datei, auch für die, die es noch nicht gibt. Eine Screen-Liste wäre nach dem
nächsten neuen Screen wieder unvollständig; ein Wächter ist es nie. Für die
Parität ist der prüfbare Teil seit WP-8.5 ebenfalls ein Wächter
(`pnpm check:platform-parity`); allein die Hierarchie bleibt Sache des
Selbst-Reviews, weil „welche Zahl ist die zweitwichtigste" keine Aussage über
Code ist.

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

**WP-8.2 — Ladezustände auf die Choreografie aus WP-7.3 gezogen.** Fünf
Komponenten hatten einen frühen `return` mit Spinner oder pulsierendem Text:
`DisposableTankCard`, `UpcomingChargesList`, `AccountCards`, `AccountManager`
und (bereits in WP-7.3) `AdvancedBalanceChart`. Damit gilt dort jetzt: kein
Skeleton unter 150 ms — das wäre ein Blinzeln —, und ein gezeigtes bleibt
mindestens 300 ms stehen. Die Platzhalter haben die Form des späteren Inhalts
statt eines kreisenden Symbols: Ein Spinner sagt „es passiert etwas", ein
Skelett sagt „hier kommt eine Liste".

**WP-8.3 — Hierarchie und Parität durchgesehen.** Die Kennzahlenzeile des
Dashboards ist abgestuft (Zeitraum-Saldo > Einnahmen/Ausgaben > Anzahl), der
Hero bleibt darüber. Die Paritäts-Durchsicht ergab **einen** Befund: Der Export
der Geldfluss-Visualisierung existierte auf schmalen Breiten gar nicht
(`hidden sm:flex` ohne Gegenstück) — jetzt auf Mobil hinter einem Auslöser.
Alle übrigen Breakpoint-Weichen sind paarig; Aufstellung im
[Fortschrittsprotokoll](progress.md).

`PortfolioManager` ist damit ebenfalls auf `LoadingSwap` gezogen.

**WP-8.4 — Restmigration.** Ein Sweep gegen die eigene Behauptung förderte vier
Befunde zutage: die letzten beiden inhaltsersetzenden Spinner (Trading,
Backup), ein `#000`-Rückfall in `ReviewTable` (schwarz auf schwarz im
Dunkelmodus) und `bg-amber-600` statt `bg-warning`. Die
Sprachausgabe-Entsprechung für Skelette sitzt jetzt in `LoadingSwap` selbst
statt in den Aufrufstellen.

**WP-8.5 — die Restpunkte sauber geschlossen.** Beim genauen Hinsehen waren
zwei der drei „offenen" Punkte **keine Mängel**; die Tabelle hatte sie
überzeichnet. Das ist hier korrigiert statt stehen gelassen:

| Punkt | Ergebnis |
|---|---|
| **Parität ohne Wächter** | **behoben.** `pnpm check:platform-parity` setzt den prüfbaren Teil von §4 durch: Eine Fläche mit `hidden <bp>:*` ohne Gegenstück ist kein Dichte-Unterschied, sondern ein fehlendes Feature. Läuft in Pre-Commit und CI |
| **Spinner in Verarbeitungs-Dialogen** | **kein Mangel.** Alle drei zeigen längst sichtbaren Text, der Forderungs-Import zusätzlich einen Fortschrittsbalken. Die Skeleton-Regel passt hier nicht, weil die Form des Ergebnisses vor der Auswertung unbekannt ist |
| **`EtoroScopeGate`** | **fast kein Mangel.** Es hatte bereits `role="status"` und einen Fehlerzustand mit Wiederholung. Eine echte Lücke gab es doch: Der Ladetext stand nur im `aria-label`, sehende Nutzer sahen ein nacktes Symbol. Jetzt sichtbar |

### Was in Phase 8 offen bleibt

| Punkt | Warum offen |
|---|---|
| **Telemetrie-Schalter** in den Einstellungen | Gehört zu Phase 11 (`decision-log` F-1); der Schalter ohne Empfänger wäre ein totes Versprechen |
| **Tutorial-Einladung verschiebt die ganze Seite** | Gemessen, siehe unten — gehört zu Phase 10, weil die tragfähigen Wege Gestaltungsentscheidungen sind |

### Gemessen, nicht behoben: CLS der Tutorial-Einladung

Der Performance-Lauf schlug in dieser Runde erstmals fehl (CLS `/dashboard`
0,1002 gegen ein Budget von 0,1). Die Aufschlüsselung der
`layout-shift`-Einträge zeigte zwei nachträglich eingeschobene Streifen von je
41 px:

| Quelle | Anteil | Stand |
|---|---|---|
| `DemoDataBanner` zwischen Kopfzeile und `main` | 0,023 | **behoben** (WP-8.3): `isDemoDataActive()` liest synchron aus dem localStorage, `useQuery` lieferte im ersten Render trotzdem `undefined`. `initialData` schließt die Lücke — geraten wird nichts |
| `TutorialInvitation` **über** der gesamten Hülle | **0,073** | offen |
| Rest (Chart-Aufbau) | 0,004 | unkritisch |

Nach der Korrektur liegt `/dashboard` bei **0,077**. Die Einladung bleibt damit
der mit Abstand größte Einzelposten des Budgets — sie schiebt die Seite
inklusive Kopfzeile und Navigation nach unten.

Warum hier nicht mitbehoben: Ihre Sichtbarkeit hängt an `getUserSettings` und
der Kapitel-Bereitschaft, beides aus IndexedDB und damit **echt** asynchron.
Ein synchroner Merker dafür wäre eine zweite Quelle der Wahrheit; ist er
veraltet, blitzt die Einladung auf und verschwindet wieder — das ist schlechter
als die heutige Verschiebung. Die tragfähigen Wege sind, den Platz zu
reservieren oder die Einladung unterhalb der Kopfzeile zu platzieren; beides
ist eine Gestaltungsentscheidung und gehört in Phase 10.

## 4. Phasen 9–11 (unberührt)

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
