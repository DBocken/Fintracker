# FinTracker AAA+ — Entscheidungsprotokoll

> Verlangt von [Implementierungsplan §16](../implementation-plan.md#16-startpaket-für-die-ausführung).
> Neueste Einträge oben. Jeder Eintrag nennt **Entscheidung, Alternative und
> Grund der Absage** — ein Protokoll ohne verworfene Alternativen ist keine
> Entscheidung, sondern eine Notiz.

---

## 2026-08-05 — E-9: Kaskade wird als Eigenschaft geprüft, nicht als Zeitpunkt

**Kontext:** Der WP-E1-Test rechnete mit festen Staffelindizes (`furniture` =
Index 4, Start bei t=1200) und war rot: der beobachtete Wert passte zu Index 3.

**Entscheidung:** Der Test prüft jetzt die Kaskaden-*Eigenschaft* — eine
Millisekunde vor dem Start des letzten Baukörpers ist der **relative**
Fortschritt (Höhe/Zielhöhe) über die gesamte Kaskade streng fallend.

**Alternative:** Den erwarteten Index korrigieren. Abgelehnt, weil welcher
Baukörper welchen Index bekommt davon abhängt, welche Boxen überhaupt einen
Höhen-Tween erhalten — die nächste Layout-Änderung hätte den Test erneut
rot gemacht, ohne dass ein Fehler vorläge.

**Relativ statt absolut,** weil die Beträge stark streuen (Miete 980 € vs.
Möbel 45 €) und die Reihenfolge sonst von der Betragsgröße überlagert wäre.

---

## 2026-08-05 — E-8: Zwei Schreibweisen für dieselbe Easing-Kurve

**Kontext:** WP-6.7 lieferte `useChartAnimation` mit `animationDuration` und
`animationEasing` — benutzt wurde in einer einzigen Datei nur `animate`. Der
Grund ist technisch: Recharts typisiert `animationEasing` als Template-Literal
`cubic-bezier(${number},${number},${number},${number})` — **ohne** Leerzeichen.
`MOTION_EASINGS.build` trägt die CSS-übliche Schreibweise **mit** Leerzeichen.
Wer den Wert durchreichen wollte, bekam einen Typfehler und ließ es.

**Entscheidung:** `MOTION_EASINGS_CHART` neben `MOTION_EASINGS`, plus ein
`[REGRESSION]`-Test, der beide Fassungen synchron hält.

**Alternative 1:** `MOTION_EASINGS` selbst leerzeichenfrei machen (eine
Wahrheit statt zwei). Abgelehnt, weil `index.css` die Werte spiegelt und eine
§8-Konfliktdatei ist — die Änderung hätte den Wirkungsradius ohne Not
vergrößert.

**Alternative 2:** An der Aufrufstelle casten. Abgelehnt: ein Cast je Chart
verteilt das Problem auf elf Dateien, statt es einmal zu lösen.

**Preis:** Zwei Konstanten, die synchron bleiben müssen. Genau deshalb der
Wächter-Test — ohne ihn wäre das eine driftende Doppelwahrheit.

---

## 2026-08-05 — E-7: Die globale Atmosphäre lädt nichts nach

**Kontext:** `AtmosphereLayer` hing in `AppShell` an einem fest verdrahteten
`{ temperature: 'neutral', intensity: 0, pulse: 'steady' }`. Die Ableitung war
korrekt und getestet, wurde aber nur von der Stadtseite genutzt.

**Entscheidung:** `useGlobalAtmosphere` liest die vorhandenen Query-Caches mit
(`enabled: false`) und stößt **selbst keine Query an**.

**Alternative:** Eigene Query in der Shell. Abgelehnt: die Shell rendert auf
**jeder** Route, auch auf Einstellungen und CSV-Import. Das hätte je
Routenwechsel einen Lesevorgang über bis zu 5000 Buchungen bedeutet — für einen
Hintergrund mit maximal 8 % Deckkraft. Performance ist laut §11 nicht
kompensierbar, §4 verbietet doppelte Queries ausdrücklich.

**Preis, ausdrücklich benannt:** Beim Kaltstart auf einer datenlosen Seite
bleibt die Atmosphäre neutral, bis einmal Daten geladen wurden. Eine fehlende
Tönung ist folgenlos, eine Query je Routenwechsel nicht.

**Nebenentscheidung:** Fehlender Budget-Cache zählt als *unbekannt*, nicht als
„nachweislich keine Überschreitung". Die Stadtseite verdrahtet dort
`budgetOvercount: 0` fest und behauptet damit mehr, als sie weiß — bewusst
nicht übernommen.

---

## 2026-08-05 — E-6: KpiCard verliert den Schatten, nicht der Test seine Schärfe

**Kontext:** WP-3.5 (Material Tokens) gab `KpiCard`
`shadow-[var(--shadow-ambient)]`. Der `[REGRESSION]`-Test der De-Carding-Arbeit
war seither rot.

**Entscheidung:** Schatten entfernt.

**Alternative:** Den Test lockern, weil „ambient shadow" als Material und nicht
als Karten-Chrome gemeint war. Abgelehnt — drei Quellen sagen dasselbe:
AGENTS.md §9 („reines Readout ohne Follow-up … kein Rahmen/Schatten"), der
Kommentar direkt über der Komponente („daher KEIN Rahmen/Schatten"), und der
Test. Der Schatten war der Ausreißer, nicht die Regel. Soll das Materialsystem
Readouts Tiefe geben, ist das eine Designentscheidung, die zuerst in
`docs/design-principles.md` gehört.

---

## 2026-08-05 — E-5: Wächter reparieren statt Tests streichen

**Kontext:** Vier Prüfungen liefen ins Leere, drei davon **grün**:

| Prüfung | Warum blind |
|---|---|
| `locale-parity` Duplikat-Wächter | `translations.ts` hat CRLF; Split an `'\n'` ließ jede Zeile auf `\r` enden, die auf `\{$` verankerte Regex griff nie → **null** Locale-Blöcke gefunden |
| `FinanceEmptyState` Varianten | lokaler `t`-Mock gab rohe Keys zurück; `no-budgets` bestand nur, weil der *Key-String* „Budget" enthält |
| `BudgetTank` layoutId (3×) | Selektor `[data-framer-name]` — ein Attribut des Figma-Plugins, nicht von framer-motion |
| 4 Playwright-Specs | von Vitests Standard-`include` eingesammelt, brachen beim Import ab |

**Entscheidung:** Alle repariert, jeweils **mit Gegenprobe** (ein Test, der
fehlschlägt, wenn das geprüfte Verhalten ganz fehlt).

**Grund:** Ein Test, der nichts prüft, ist schlechter als kein Test — er
erzeugt Vertrauen, das er nicht deckt. Dass `locale-parity` überhaupt auffiel,
verdankt sich seiner eigenen Korpus-Zusicherung (`expect(localeStarts.length)
.toBe(4)`). Ohne die wäre er still grün geblieben.

**Folgeregel:** Jede Prüfung, die über einen Korpus läuft, braucht eine
Zusicherung über dessen Größe. Siehe E-4.

---

## 2026-08-05 — E-4: Korpus-Zusicherung wird Pflicht im Agenten-Graphen

**Kontext:** Der erste echte Lauf des Graph-Orchestrators bekam `args` als
JSON-String statt als Objekt. `groups` war undefined, `parallel([])` lieferte
sofort eine leere Liste, **kein Builder startete** — und der Graph lief bis zum
Maschinen-Gate durch, das eine leere Dateiliste prüfte und grün meldete.

**Entscheidung:** Leerer Auftrag bricht ab. `args` wird in beiden
Transportformaten angenommen.

**Verallgemeinerung:** Das Evidenz-Gate des Graphen schützt gegen Befunde
**ohne** Beleg. Es schützt nicht gegen den umgekehrten Fall — eine Prüfung, die
nichts findet, weil sie nichts sieht. Dagegen hilft nur die Zusicherung „ich
habe N Dinge geprüft, und N > 0". Dieselbe Fehlerklasse wie E-5, einmal im
Testcode und einmal im Orchestrator.

---

## 2026-08-05 — E-3: Graph statt fester Gauntlet-Ketten

**Entscheidung:** Die fünf festen Critic-Ketten aus §10 werden durch einen
gerichteten Graphen mit einem Router ersetzt, der je Artefakt Prüfer **und**
Modellstufe wählt. Entwurf: [`agent-graph.md`](../agent-graph.md).

**Alternative:** Den Gauntlet Loop unverändert übernehmen, wie seine
Referenz-Implementierung es ausdrücklich verlangt („Do not invent … stop
rules"). Abgelehnt aus einem Grund: der Loop endet **absichtlich** nie („The
human is the brake"). Für ein Demo-Spiel mit einem Menschen davor richtig, für
einen unbeaufsichtigten Lauf über 30+ Arbeitspakete unbrauchbar — eine
Endlosschleife auf einem WP heißt, die Folgephase startet nie.

Übernommen werden die drei tragenden Ideen: getrennter Critic-Kontext, echte
Referenz, Rückschleife statt Freigabe. Ersetzt wird nur die Topologie.

**Router-Sicherheitseigenschaft:** deterministischer Boden (Trigger-Matrix
Dateiglob → Pflichtprüfer), modellgetriebene Decke. Das Modell darf ergänzen,
nie streichen — sonst routet ein auf Effizienz optimierendes Modell am teuren
Prüfer vorbei und meldet Erfolg.

---

## 2026-08-05 — E-2: OSV-Advisories schließen statt befristet ignorieren

**Entscheidung:** Alle 13 gemeldeten Advisories über angehobene
`pnpm.overrides` geschlossen (Wurzel und `mcp-poc/`), Obergrenzen wie von §10.7
gefordert beibehalten.

**Alternative:** Einträge in `osv-scanner.toml` mit `ignoreUntil`. Abgelehnt,
weil für jedes Advisory ein kompatibler Patch existiert — §10.7 lässt das
Ignorieren nur zu, wenn keiner verfügbar ist.

---

## 2026-08-05 — E-1: Lockfile reparieren, nicht CI umgehen

**Kontext:** Beide CI-Jobs brachen nach ~10 Sekunden am
`pnpm install --frozen-lockfile` ab: `package.json` deklariert
`pnpm.overrides`, das Lockfile kannte sie nicht. Das traf jeden PR und `main`.

**Entscheidung:** Lockfile mit exakt der in CI gepinnten pnpm-Version 10.12.4
neu erzeugt. Keine Paketversion ändert sich — der Diff enthält keine einzige
geänderte `resolution:`-Zeile.

**Fehlentscheidung davor, dokumentiert:** Ich hatte denselben Diff zunächst als
Versionsrauschen **verworfen**. Er war die Reparatur. Aufgefallen ist es erst,
als CI denselben Fehler zeigte.

**Nicht entschieden, aber empfohlen:** `package.json` hat kein
`packageManager`-Feld; die in AGENTS.md §2 geforderte pnpm-Version steht nur in
Prosa und im Workflow. Ein Pin würde diese Klasse von Lockfile-Drift maschinell
verhindern — gehört getrennt geprüft, weil `pnpm/action-setup` bei gleichzeitig
gesetztem `version:`-Input eigenes Verhalten hat.
