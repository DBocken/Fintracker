# Zwei Schichtungen nebeneinander: klassische Schichten und Feature-Slices

Status: verbindliche Konvention (ADR). **Entschieden am 2026-07-12** mit dem
Migrationsleitfaden `docs/architecture/feature-structure.md` (Commit `2c687a5`)
und der ersten Slice `src/features/dashboard/` (Application-Layer am selben
Tag). Die klassische Schichtung ist älter als die Historie dieses Repos
(2026-07-05) und steht seit jeher in `docs/coding-guide.md` §2.
**Nachgetragen als ADR am 2026-08-09** im Rahmen des Qualitätsprogramms 10/10,
Arbeitspaket 7.5 (Befund GOV-4 in `docs/qualitaet-2026-08/audit.md`).

Geltende Kurzform: `AGENTS.md` §3. Kochrezept und Entscheidungsbaum:
`docs/architecture/feature-structure.md`.

## Kontext

Die App war klassisch geschichtet: `lib` (pure Logik) → `services` (I/O) →
`hooks` (React) → `components` (UI) → `pages` (Routen). Diese Ordnung beantwortet
die Frage *„wie technisch ist ein Modul?"* — und nur die. Sie sagt nichts
darüber, **wozu** ein Modul gehört, und sie hat keinen Ort für das, was
`AGENTS.md` §4 verlangt:

> JEDES Feature muss in beiden Varianten existieren (Feature-Parität). Gleiche
> Daten, gleiche Berechnungen, gleiches ViewModel — progressive Verzweigung,
> keine doppelten Queries.

„Gleiches ViewModel" braucht eine Datei, in der ein ViewModel wohnt. In der
klassischen Ordnung gibt es die nicht: Ein ViewModel ist kein Hook (es enthält
Fachlogik), keine reine Bibliothek (es lädt Daten) und keine Komponente. In der
Praxis landete es deshalb **in** der Desktop-Komponente — und die Mobil-Ansicht
baute dieselbe Rechnung ein zweites Mal, mit einer zweiten Query.

Der Umbau der gesamten Oberfläche in einem Zug stand nicht zur Debatte: Unter
`src/components/` und `src/pages/` liegen heute noch 194 bzw. 26 Dateien
(ohne Tests).

## Entscheidung

**Beide Ordnungen gelten gleichzeitig und dauerhaft nebeneinander.**

- **Klassische Schichten** für alles, was quer zu Features liegt: pure Domänen-
  und Berechnungslogik (`src/lib/`, 151 Dateien), I/O (`src/services/`, 87),
  React-Anbindung (`src/hooks/`, 37).
- **Feature-Slices** `src/features/<name>/{domain,data,application,presentation}`
  für in sich geschlossene Features mit Desktop- **und** Mobil-Präsentation.
  Referenz: `src/features/dashboard/`.
- **Die beiden sind ineinander verzahnt, nicht getrennt.** Slice-`domain` liegt
  auf der Höhe von `lib`: ein Service darf sie benutzen, umgekehrt nicht. Eine
  Slice benutzt weiter die bestehenden Services statt sie zu duplizieren
  (`feature-structure.md`, Zeile `data/`).
- **Fachlogik, die ≥ 2 Slices brauchen, wandert nach `src/features/shared/`** —
  nicht in eine dritte Ordnung.
- **Migriert wird Fläche für Fläche, nicht auf einmal.** Der Zwischenzustand ist
  ausdrücklich zulässig und wird gezählt statt verboten (siehe „Preis").

Die Richtung beider Ordnungen ist maschinell erzwungen (`pnpm check:layers`),
inklusive zweier Regeln, die es nur wegen des Parallelbetriebs gibt:
`feature-application-ohne-ui` (ein ViewModel darf die Oberfläche nicht einmal
für einen Typ importieren) und `hooks-ohne-components`.

## Verworfene Alternativen

**Nur klassische Schichten behalten.** Verworfen, weil §4 damit nicht einlösbar
ist: ohne einen Ort für das ViewModel gibt es keine Stelle, an der Desktop und
Mobil garantiert dieselbe Rechnung sehen. Genau dieser Schaden war messbar —
`src/features/dashboard/README.md` hält die behobenen Doppel-Query-Verstöße der
ersten Migration fest.

**Vollständig auf Feature-Slices umstellen (Big Bang).** Verworfen wegen der
Menge (220 Dateien allein in `components`/`pages`) und weil jede migrierte
Fläche laut Kochrezept eine eigene `[REGRESSION]`-Absicherung braucht: das
Verhalten wird exakt konserviert, bewusste Abweichungen werden einzeln begründet
(`feature-structure.md`, Schritt 3). Ein Zug-um-Zug-Umbau dieser Größe wäre
genau der 100-Zeilen-Sammelcommit, den `AGENTS.md` §11 untersagt.

**Ein Übergangs-Barrel beim Baustein-Umzug.** Bei WP 6.7 stand die Wahl, die 25
gemeinsamen Bausteine unter dem alten Pfad `src/components/common/` als
Re-Export stehenzulassen. Verworfen zugunsten der Vollumstellung aller 194
Importstellen: ein Re-Export hätte weiter unter der Alt-Oberfläche gelegen und
die Ratsche dauerhaft bei 36 festgehalten (dokumentiert in `AGENTS.md` §2,
`check:slice-presentation`).

## Preis

1. **Zwei Ordnungen heißt: die Ablagefrage ist nicht mehr trivial.** Für „wohin
   gehört dieser Typ?" braucht `AGENTS.md` §3 eine eigene Tabelle mit sieben
   Zeilen. Ohne den Parallelbetrieb gäbe es sie nicht — und ohne sie entstehen
   genau die 30 umgedrehten Abhängigkeiten in 14 `lib`-Dateien, die
   `check:layers` bei seiner Einführung gefunden hat.
2. **Der Wächter muss beide Ordnungen kennen.** `check:layers` erzwingt zwei
   Richtungsketten statt einer, plus zwei Sonderregeln (siehe oben) plus eine
   Ausnahme für Context-Provider-Lesezugriffe.
3. **Der Zwischenzustand kostet dauerhafte Buchhaltung.** Zwei Ratschen zählen
   ihn: `view-data-budget.json` (Datenzugriffe in der Darstellung, Ausgangswert
   282, heute **220**) und `slice-presentation-budget.json` (Kopplung einer
   Slice an die Alt-Oberfläche, heute **12** fremde Feature-UI, **0**
   Bausteine). Beide Dateien, beide Wächter, beide Pre-Commit- und CI-Schritte
   existieren ausschließlich, weil zwei Ordnungen nebeneinander laufen.
4. **Der Zwischenzustand ist der Normalzustand, nicht die Ausnahme.** Unter
   `src/features/` liegen heute 12 Verzeichnisse, aber nur **fünf** haben alle
   vier Schichten (`accounts`, `dashboard`, `finance-city`, `special-categories`,
   `transactions`). `debts` und `settings` haben keine `presentation/`, `trading`
   kein `data/`, und `contract-records`, `household-settlement` und
   `replacement-planning` bestehen nur aus `domain/`. Einem Feature ist von außen
   nicht anzusehen, welcher Ordnung es folgt — man muss nachsehen.
5. **Ein halber Slice-Ordner täuscht Vollständigkeit vor.** Das Programm 10/10
   führt das als eigenes Erfolgskriterium („kein `features/`-Ordner täuscht
   Vollständigkeit vor", `plan.md`, Kriterium 5) — es ist der Preis, den
   Punkt 4 in der Wahrnehmung erzeugt.
