/**
 * Kernlogik der Slice-Presentation-Ratsche (AGENTS.md §3, ARCH-3, WP 2.3).
 *
 * Zählt Importe aus `src/features/<slice>/presentation/` nach `src/components/`
 * oder `src/pages/` — genau der Fund aus ARCH-3: Der Referenz-Slice
 * `dashboard` leckt in Alt-`components` (`DashboardDesktopView.tsx` importiert
 * `TransactionCharts.tsx`, 564 Zeilen), und `layers-core.mjs` hatte dafür
 * keine Regel.
 *
 * Ausgenommen sind seit WP 6.2 die shadcn-Primitive unter `src/components/ui/`
 * — Begründung bei `istDesignSystemPrimitiv()` weiter unten. Derselbe Bestand
 * ergibt damit 18 statt der in WP 2.3 gemessenen 24; die sechs Differenz sind
 * ausschliesslich `ui/`-Importe (`ui/card`, 4× `ui/button`, `ui/sheet`).
 *
 * **Warum eine Ratsche und keine harte `RULES`-Regel in `layers-core.mjs`.**
 * `plan.md` (WP 2.3) nahm „zwei begründete Allowlist-Einträge" an; nachgezählt
 * sind es 24 Importe in 10 Dateien über alle vier Slices mit `presentation/`
 * (siehe `docs/qualitaet-2026-08/nachpruefung.md` 0.6). Eine harte Regel wäre
 * damit am ersten Tag rot und bräuchte 24 Einzel-Ausnahmen in
 * `layer-allowlist.json` — genau das Muster, das dort vermieden werden soll
 * (`layer-allowlist.json` ist heute leer und soll es bleiben). Eine Zahl, die
 * nur sinken darf, macht denselben Befund sichtbar, ohne den Wächter am
 * ersten Tag abzuschalten (dieselbe Begründung wie bei `view-data-core.mjs`:
 * „ein Wächter, der ab morgen jeden Commit blockiert, wird abgeschaltet statt
 * befolgt").
 *
 * **Warum eine EIGENE Zahl und keine Erweiterung von `check:view-data`.**
 * `view-data-budget.json` zählt Datenzugriffe (`useQuery`/Service-Importe) IN
 * der Darstellungsschicht — eine andere Fachfrage als hier: Importiert eine
 * Slice-Presentation die ALTE UI-Komponenten-Schicht? Beide Zahlen dürfen sich
 * unabhängig bewegen (ein Slice kann seine Datenzugriffe weiter senken, ohne
 * dass sich seine UI-Kopplung ändert, und umgekehrt) — eine gemeinsame Summe
 * würde eine Verschlechterung in der einen Richtung durch Fortschritt in der
 * anderen verdecken. WP 6.2/6.3 senken gezielt DIESE Zahl (Migration von
 * `TransactionCharts`/`TradingDashboard` in die jeweilige Slice-Presentation)
 * — ein eigener Beleg, der in einer verrechneten Summe verschwände.
 *
 * Import-Erkennung wiederverwendet aus `layers-core.mjs` (`IMPORT_RE`,
 * `stripComments`, `resolveTarget`) — eine Zähl-Regel, nicht zwei, die
 * auseinanderlaufen könnten.
 */

import { IMPORT_RE, stripComments, resolveTarget, isTestFile } from './layers-core.mjs';
import { istInfrastruktur } from './view-data-core.mjs';

/** Nur die Presentation-Schicht der Feature-Slices wird gezählt. */
export function istSlicePresentation(relPath) {
  return /^src\/features\/[^/]+\/presentation\//.test(relPath);
}

/**
 * `src/components/ui/` ist das shadcn-Primitiven-Verzeichnis, nicht die
 * Alt-Oberfläche — und deshalb von der Zählung ausgenommen (WP 6.2).
 *
 * **Warum die Ausnahme erst jetzt kommt.** Der Ausgangswert 24 wurde in WP 2.3
 * am Bestand gemessen; die sechs `ui/`-Importe darin waren Beifang, keine
 * Entscheidung. Sichtbar wurde der Unterschied erst, als WP 6.2 die erste
 * Komponente WIRKLICH in eine Slice geschoben hat: `TransactionCharts` löst
 * zwei gezählte Importe auf (`DashboardDesktopView`, `DashboardMobileStory`)
 * und bringt als Slice-Datei drei eigene mit — `@/components/ui/card`,
 * `@/components/ui/switch`, `@/components/common/ChartFigure`. Unterm Strich
 * STIEG die Zahl von 24 auf 25: die Ratsche hätte ausgerechnet die Migration
 * verurteilt, für die sie gebaut wurde.
 *
 * Die Ursache ist die Fachfrage dahinter, nicht die Arithmetik. Gezählt werden
 * soll, was eine zweite Präsentation (Android, anderer Shell) zwingen würde,
 * die ALTE Oberfläche mitzuschleppen. Auf `src/components/ui/` trifft das
 * nicht zu: AGENTS.md §7 schreibt shadcn/`@/components/ui` als AUSSCHLIESSLICHE
 * UI-Quelle vor — eine zweite Präsentation benutzt dieselben Primitive, es gibt
 * gar keine Alternative. Eine Zahl, die sie mitzählt, kann nie 0 erreichen und
 * bestraft jede Migration mit ihrem eigenen Kartenrahmen.
 *
 * `src/components/common/` bleibt GEZÄHLT — seit WP 6.3 aber in einer eigenen
 * Spalte, siehe `istBaustein()` direkt darunter.
 */
function istDesignSystemPrimitiv(target) {
  return /^src\/components\/ui\//.test(target);
}

/**
 * Ein Context-Provider ist Infrastruktur, nicht die Alt-Oberfläche — und
 * deshalb von der Zählung ausgenommen.
 *
 * **Warum die Ausnahme jetzt kommt.** Dieselbe Lehre wie bei
 * `istDesignSystemPrimitiv()` (WP 6.2), ein Verzeichnis weiter: Sichtbar wurde
 * der Fall erst, als die Coach-Migration `HealthScoreCard` und
 * `FinancialLandscape` WIRKLICH in Slices geschoben hat. Beide lesen den
 * Sanften Modus über `useGentleMode` aus `@/components/providers/
 * GentleModeProvider` — und beide wurden dafür gezählt, obwohl der Umzug
 * zwei echte Feature-UI-Importe aufgelöst hat. Unterm Strich wäre die Zahl
 * gestiegen: die Ratsche hätte wieder genau die Migration verurteilt, für die
 * sie gebaut wurde.
 *
 * Die Fachfrage entscheidet, nicht die Arithmetik. Gezählt wird, was eine
 * zweite Präsentation zwingen würde, die ALTE Oberfläche mitzuschleppen. Auf
 * einen Provider trifft das nicht zu: Er hängt einmal im `AppShell`, jede
 * Präsentation liest denselben Context, und es gibt keine zweite Fassung
 * davon. `check:layers` nimmt denselben Zugriff seit WP 2.3 ausdrücklich aus
 * (`useAuth` aus `AuthProvider`, `useGentleMode` aus `GentleModeProvider`),
 * `check:view-data` ebenso — und zwar über GENAU dieses Prädikat. Ein
 * drittes, eigenes Kriterium hier hiesse, denselben Begriff dreimal zu
 * pflegen; deshalb wird `istInfrastruktur()` importiert statt nachgebaut.
 */
function istProviderInfrastruktur(target) {
  return istInfrastruktur(target);
}

/**
 * `src/components/common/` sind die app-eigenen Bausteine — eigene Spalte,
 * nicht ausgenommen (WP 6.3).
 *
 * **Was WP 6.3 gemessen hat.** Die Migration von `TradingDashboard` in
 * `features/trading/presentation/` (ARCH-5/KOMP-1) hätte die EINE Zahl von 17
 * auf 48 getrieben. Aufgeschlüsselt: 12 davon sind Importe nach fremder
 * Feature-UI (unverändert gegenüber vorher), 36 sind `components/common/`. Die
 * Trading-Fläche benutzt die Bausteine nämlich genau so, wie AGENTS.md es
 * vorschreibt — `InfoGroup`/`InfoStatStrip` und `InteractiveCard` nach §9,
 * `DecimalInput` nach §8 (dort sogar per `check:decimal-inputs` erzwungen),
 * `EmptyState`/`FinanceErrorState` für Leer- und Fehlerzustand nach §9.1.
 *
 * Damit stand dieselbe Fehlerform wie in WP 6.2 (`ui/`) noch einmal da, nur ein
 * Verzeichnis weiter und diesmal nicht bloss verzerrend, sondern blockierend:
 * Eine Zahl, die eine Migration 31-fach bestraft, weil die migrierte Fläche die
 * vorgeschriebenen Bausteine benutzt, misst nicht mehr den Befund, sondern
 * verhindert seine Behebung.
 *
 * **Warum trotzdem keine Ausnahme wie bei `ui/`.** Der Unterschied zu den
 * shadcn-Primitiven ist echt: `src/components/ui/` ist ein Fremdbaukasten und
 * bleibt, wo er ist; `src/components/common/` liegt nur deshalb unter
 * `components/`, weil es `src/features/shared/presentation/` noch nicht gibt.
 * Das ist ein offener Befund und gehört gezählt — aber als eigene Frage mit
 * eigener Antwort (ein Umzug für die ganze App), nicht vermischt mit „diese
 * Slice hängt an einem noch nicht migrierten Feature-Screen" (ein Umzug je
 * Screen).
 *
 * Genau dieselbe Begründung steht schon im Kopf dieser Datei dafür, dass
 * `check:view-data` und `check:slice-presentation` zwei Zahlen sind und nicht
 * eine: „eine gemeinsame Summe würde eine Verschlechterung in der einen
 * Richtung durch Fortschritt in der anderen verdecken." Hier war es umgekehrt —
 * die Summe hätte Fortschritt in der einen Richtung als Verschlechterung
 * ausgewiesen. Beide Zahlen dürfen nur sinken; `bausteine` erreicht 0, sobald
 * `components/common/` nach `features/shared/presentation/` zieht.
 *
 * **Stand seit WP 6.7: `bausteine` ist 0.** Der Umzug ist gemacht,
 * `src/components/common/` existiert nicht mehr. Die Spalte bleibt trotzdem
 * stehen — nicht als Buchhaltung über einen erledigten Befund, sondern als
 * Wächter gegen den Rückfall: Wer einen neuen app-eigenen Baustein wieder
 * unter `src/components/common/` ablegt und ihn aus einer Slice benutzt, wird
 * rot. Das ist der einzige Weg, wie die Frage „Alt-Oberfläche oder gemeinsamer
 * Baustein?" ihre Antwort über den Pfad behält.
 */
function istBaustein(target) {
  return /^src\/components\/common\//.test(target);
}

/**
 * Zählt Importe einer Slice-Presentation-Datei in die Alt-Oberfläche, getrennt
 * nach den zwei Fachfragen dahinter.
 *
 * - `imports`/`specs`: Importe nach **fremder Feature-UI** (`src/components/<feature>/`,
 *   `src/pages/`) — der ARCH-3-Befund. Behebung: den betroffenen Screen migrieren.
 * - `bausteine`/`bausteinSpecs`: Importe nach `src/components/common/` — die
 *   app-eigenen Bausteine. Behebung: `components/common/` → `features/shared/presentation/`.
 *
 * Nicht gezählt werden die shadcn-Primitive unter `src/components/ui/`
 * (siehe `istDesignSystemPrimitiv`).
 *
 * @param relPath repo-relativer Pfad
 * @param source  Dateiinhalt
 * @returns `{ imports, specs, bausteine, bausteinSpecs }` — die rohen Spezifizierer für die Fehlermeldung
 */
export function countLegacyImports(relPath, source) {
  if (!istSlicePresentation(relPath) || isTestFile(relPath)) {
    return { imports: 0, specs: [], bausteine: 0, bausteinSpecs: [] };
  }

  const specs = [];
  const bausteinSpecs = [];
  for (const match of stripComments(source).matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    const target = resolveTarget(spec, relPath);
    if (!target) continue;
    if (istDesignSystemPrimitiv(target)) continue;
    if (istProviderInfrastruktur(target)) continue;
    if (istBaustein(target)) {
      bausteinSpecs.push(spec);
      continue;
    }
    if (/^src\/(components|pages)\//.test(target)) specs.push(spec);
  }

  return {
    imports: specs.length,
    specs,
    bausteine: bausteinSpecs.length,
    bausteinSpecs,
  };
}
