# Wächter-Skripte als Durchsetzungsstrategie

Status: verbindliche Konvention (ADR). **Entschieden am 2026-07-12** mit dem
Commit „fix: i18n- und Teststruktur-Durchsetzung agentenunabhängig reparieren"
(`a74f615`), der die ersten beiden Prüfungen aus den Claude-Code-Hooks in
eigenständige Node-Skripte gehoben hat. Ausgebaut in mehreren Wellen bis
2026-08-08 (Karten-Regel, Parität, Query-Fehler, a11y-Namen, Zustandsabdeckung,
Bündelgröße, Schichten, Ratschen, Dezimalfelder, Geld-Parsing).
**Nachgetragen als ADR am 2026-08-09** im Rahmen des Qualitätsprogramms 10/10,
Arbeitspaket 7.5 (Befund GOV-4 in `docs/qualitaet-2026-08/audit.md`).

Geltende Kurzform: `AGENTS.md` §2 (was jeder Wächter prüft) und §12
(automatische Durchsetzung).

## Kontext

Dieses Repo hat viele Regeln, und die meisten wurden aus einem Schaden geboren.
Ihnen ist eine Eigenschaft gemeinsam, die alles andere bestimmt: **ein Verstoß
war unsichtbar.** Kein Test wurde rot, kein Compiler hat gemeckert, kein Review
konnte es zuverlässig sehen.

Die Fallen-Tabelle in `AGENTS.md` §6 zählt acht solcher Fälle allein für i18n
auf — ein `t()` im Initializer einer Modul-`const` (Sprachwechsel wirkt nie
wieder), ein doppelter Namespace (gültiges JavaScript, der spätere gewinnt), ein
vertippter Key (rendert den rohen Punkt-String). Dazu kommen die Befunde aus
späteren Audits: `parseFloat` für einen getippten Geldbetrag (GOV-1, real in
`AskYourMoney.tsx`), 30 umgedrehte Schichtimporte in 14 `lib`-Dateien (ARCH),
und `/debts`, das nach einem Lesefehler „Noch keine Schulden" behauptete —
obwohl es Tests gab, sie grün waren, und die Zeilenabdeckung bei 71 % lag.

Der erste Durchsetzungsversuch waren Claude-Code-Hooks. Der hat eine Lücke, die
keine Verschärfung schließt: er wirkt nur, wenn Claude Code das arbeitende
Werkzeug ist. Andere Agenten (Codex, Copilot) und Menschen umgehen ihn
strukturell.

## Entscheidung

**Jede maschinell fassbare Regel bekommt ein eigenes Node-Skript in `scripts/`,
das agentenunabhängig in Pre-Commit und CI läuft.**

Heute sind das **14** `check:*`-Skripte plus `security:secrets`. Die Bauform ist
für alle gleich:

- **Erkennung getrennt vom Einstieg.** Die Logik liegt in einem `*-core.mjs`
  (`i18n-core.mjs`, `layers-core.mjs`, `view-data-core.mjs`, …) und ist damit
  ohne git testbar; sechs dieser Kerne haben eigene Tests unter
  `scripts/__tests__/`. Der `check-*.mjs`-Einstieg macht nur Dateiauswahl und
  Ausgabe.
- **Zwei Modi, wo ein Diff-Modus sinnvoll ist.** `--staged`/`--range` melden nur
  geänderte Zeilen, `--all` den ganzen Baum — weil der Diff-Modus Altbestand
  strukturell **nie** sehen kann. Der Pre-Commit-Hook läuft deshalb beides.
- **Wiederverwendung statt zweiter Wahrheit.** `check:slice-presentation` löst
  Importe über `resolveTarget()` aus `layers-core.mjs` auf, damit beide Wächter
  bei Alias- und Relativpfaden dasselbe sehen.

Drei Durchsetzungsgrade, bewusst unterschiedlich scharf:

| Grad | Wann | Beispiele |
|---|---|---|
| **Harte Regel ohne Ausnahmeliste** | Der Verstoß macht etwas schlicht unbenutzbar | `check:a11y-names` (ein namenloses Bedienelement ist mit Screenreader nicht bedienbar) |
| **Harte Regel mit begründeter Ausnahmeliste** | Die Regel gilt, aber die Maschine kann den Einzelfall nicht entscheiden | `check:i18n`, `check:query-errors`, `check:money-parsing`, `check:decimal-inputs`, `check:state-coverage`, `check:platform-parity`, `check:layers` |
| **Ratsche mit Budgetdatei** | Der Bestand ist zu groß für ein Verbot, die Richtung ist trotzdem verbindlich | `check:view-data` (heute 220), `check:slice-presentation` (12 / 0), `check:bundle-size` |

**Die Zahl/Objekt-Semantik der Ausnahmelisten ist der Kern der Strategie.** Ein
Eintrag hat genau zwei zulässige Formen, und sie bedeuten Gegensätzliches:

- **eine blosse Zahl** = offenes Backlog. Sie bedeutet *nicht* „in Ordnung",
  sondern „bekannt und noch nicht behoben", und sie **darf nur sinken**.
- **ein Objekt `{ count, reason }`** = entschieden. Dort ist der Befund die Sache
  selbst (deutsches Suchvokabular gegen Kontoauszugstext, ein ganzzahliges Feld
  mit `type="number"`, ein Vorschlag, der nichts behauptet, wenn er ausbleibt).
  Ohne tragfähigen `reason` wird die Objektform abgewiesen.

`check:state-coverage` benutzt dieselbe Zweiteilung mit anderen Wörtern
(`offen` / `entfaellt`). Neue Fundstellen gehören in **keine** der beiden
Formen — dann ist der Code zu ändern, nicht die Liste.

Ergänzend, nicht ersetzend: Claude Code bekommt weiterhin Live-Hinweise über
`.claude/hooks/` (blockierend nur die Teststruktur; Animations-Baseline und
Karten-Klickbarkeit advisory).

## Verworfene Alternativen

**Nur Claude-Code-Hooks.** Verworfen am 2026-07-12, weil sie an das Werkzeug
gebunden sind: `CLAUDE.md` hält ausdrücklich fest, dass es für i18n „keinen
Claude-Code-Hook mehr" gibt. Der Hook-Mechanismus bleibt nur für das, was
*live beim Schreiben* nützt.

**ESLint-Regeln statt eigener Skripte.** *Rekonstruiert* — eine schriftliche
Abwägung existiert nicht. Der Grund lässt sich aber an den Wächtern selbst
ablesen: Mindestens fünf der vierzehn Fragen sind auf Dateiebene gar nicht
entscheidbar. Die Zustandsabdeckung wird über Tags in Testtiteln **je Route**
gezählt, die Plattform-Parität sucht ein Gegenstück in einer **Nachbardatei**,
und die drei Ratschen brauchen eine persistierte Zahl im Repo — ein Ort, den ein
Lint-Prozess je Datei nicht hat. Dazu kommt die Diff-/Bestandstrennung
(`--staged` gegen `--all`), die ESLint nicht kennt.

**Eine harte Regel statt einer Ratsche bei ARCH-3.** `plan.md` erwartete für
WP 2.3 „zwei begründete Allowlist-Einträge"; nachgezählt waren es **24 Importe
in 10 Dateien**. Eine harte Regel wäre am ersten Tag rot gewesen und hätte 24
Einzelausnahmen gebraucht — dokumentiert in
`docs/qualitaet-2026-08/nachpruefung.md` 0.6 und 2.b.

**Eine gemeinsame Zahl für `view-data` und `slice-presentation`.** Verworfen in
WP 2.3: die beiden messen verschiedene Fachfragen, und in eine Summe geworfen
könnte ein Fortschritt in der einen Richtung eine Verschlechterung in der
anderen verdecken. „Eine Ratsche, deren Bewegung mehrdeutig ist, belegt nichts"
(`nachpruefung.md` 2.b).

## Preis

1. **Laufzeit bei jedem Commit.** Gemessen am 2026-08-09 auf der
   Entwicklungsmaschine dieses Repos: die 13 Wächter des Pre-Commit-Umfangs
   (alle außer `check:bundle-size`, der einen Build braucht und deshalb nur in
   CI läuft) brauchen zusammen **9,8 s**. Der Hook läuft `check:i18n` zusätzlich
   im `--staged`-Modus, liegt also etwas darüber. `nachpruefung.md` 2.b nannte
   im August ~15 s — die Größenordnung ist stabil, die Richtung nicht.
2. **Der Grenznutzen sinkt, die Zahl selbst wird irgendwann das Problem.** Das
   steht als Warnung schon in `nachpruefung.md` 2.b und gilt weiter: Ein
   fünfzehnter Wächter kostet jeden Commit Zeit und jeden Leser Aufmerksamkeit.
   Die Rechtfertigung ist bisher jedes Mal dieselbe gewesen — an dieser Lücke ist
   nachweislich schon etwas durchgerutscht.
3. **Elf Buchhaltungsdateien im Repo-Wurzelverzeichnis.** Acht Ausnahmelisten
   (`i18n-`, `query-error-`, `state-coverage-`, `decimal-input-`,
   `money-parsing-`, `layer-`, `platform-parity-`, `card-rule-allowlist.json`)
   und drei Budgets (`view-data-`, `slice-presentation-`,
   `bundle-size-budget.json`). Stand heute: `layer-` und `card-rule-` sind leer
   (und sollen es bleiben), `state-coverage` führt sechs Routen, alle als
   „entfaellt" begründet, `query-errors` 25 entschiedene Stellen in 18 Dateien,
   `money-parsing` 4 in 3 Dateien, `i18n` 54 entschiedene in 12 Dateien.
4. **Eine geschärfte Erkennung treibt die offenen Zahlen nach oben, ohne dass
   der Code schlechter wird.** WP 6.8 hat `check:i18n` um vier Formen erweitert
   und dabei „46 Fundstellen, die immer da waren" sichtbar gemacht. Die offene
   i18n-Schuld steht heute bei **35 in 23 Dateien**; der Audit vom 2026-08-08
   zählte über *alle* Listen zusammen 17 (GOV-5). Wer die Zahlen als Zeitreihe
   liest, muss also wissen, wann der Wächter geschärft wurde — „darf nur sinken"
   gilt gegen den Code, nicht gegen eine schärfere Brille.
5. **Ein Wächter ist eine zweite Implementierung der Regel — und kann falsch
   liegen.** `check:slice-presentation` zählte anfangs die shadcn-Primitive
   unter `src/components/ui/` mit; die erste echte Migration hätte die Zahl von
   24 auf 25 getrieben, und die Ratsche hätte genau die Arbeit verurteilt, für
   die sie gebaut war (`AGENTS.md` §2, WP 6.2). Ein Wächter braucht darum eigene
   Tests — von den 13 `*-core.mjs`-Modulen haben **sechs** welche
   (`scripts/__tests__/`), sieben nicht.
6. **Der lokale Zaun ist umgehbar.** `git commit --no-verify` überspringt alles,
   und der Hook steigt zusätzlich still aus, wenn `pnpm` nicht im PATH liegt
   (GUI-Git-Clients). Das ist bewusst so und wird als Entscheidung geführt: CI
   ist der verbindliche Zaun (GOV-6, dokumentiert in WP 7.6).
7. **Die wichtigste Regel dieses Repos ist von alldem nicht erfasst.** „Absicht
   vor Auftrag" (`AGENTS.md`, vor §1) kann kein Skript prüfen. Ein dichtes
   Wächternetz verführt zu dem Schluss, grün heiße fertig — es heißt nur, dass
   nichts von dem passiert ist, was schon einmal passiert ist.
