/**
 * Karten-Regel — Kernlogik (AGENTS.md §9).
 *
 * > Fläche mit Karten-Chrome (Rahmen + Hintergrund + Schatten) muss als Ganzes
 * > klickbar sein. Kein toter Karten-Rahmen um nur einen verschachtelten
 * > Button. Reines Readout ohne Follow-up gehört ohne Karte dargestellt.
 *
 * Bis WP-8.0 gab es dazu nur einen **advisory** Claude-Hook: CI sah nie einen
 * Verstoß, und Agenten ohne `.claude/`-Hooks (Codex, Copilot) auch nicht. Diese
 * Datei ist die gemeinsame Quelle für beide Wege — `scripts/check-card-rule.mjs`
 * prüft repo-weit, der Hook meldet beim Bearbeiten. Dieselbe Abhängigkeits-
 * richtung wie bei `test-structure-core.mjs`: `scripts/` ist die Quelle.
 *
 * **Was diese Prüfung leisten kann und was nicht.** Ob eine Karte „als Ganzes"
 * klickbar ist, entscheidet sich im Layout und nicht im Text — das ist statisch
 * nicht entscheidbar. Prüfbar ist die schwächere, aber harte Aussage: *Hier
 * steht Karten-Chrome, und in der Datei gibt es überhaupt kein
 * Interaktions-Signal und keinen karten-losen Readout-Baustein.* Das ist der
 * Fall, den man beim Lesen sofort erkennt und beim Schreiben übersieht.
 *
 * Alles Weitere bleibt Sache des Reviews. Eine Prüfung, die mehr behauptet, als
 * sie wissen kann, erzeugt Fehlalarme — und eine Regel mit Fehlalarmen wird
 * abgeschaltet.
 */

/**
 * Dateien, die die Bausteine DEFINIEREN statt sie zu benutzen.
 *
 * Die app-eigenen Bausteine liegen seit WP 6.7 unter
 * `src/features/shared/presentation/` (vorher `src/components/common/`) — die
 * Ausnahme ist mitgezogen. Ein Pfad, der auf ein nicht mehr existierendes
 * Verzeichnis zeigt, wird nie rot und nie grün: Er ist still erblindet, und
 * zwar in die falsche Richtung — die Definitionsdatei selbst wäre ab dem Umzug
 * ein Regelverstoß gewesen.
 */
const DEFINITION_FILES =
  /src\/(components\/ui\/card|features\/shared\/presentation\/(InteractiveCard|InfoGroup|ChartFigure|LoadingSwap))\.tsx$/;

/** Erkennt Karten-Chrome: Komponente, Design-System-Klasse oder Ad-hoc-Box. */
export function hasCardChrome(content) {
  const usesCardComponent = /<Card(\s|>|\/)/.test(content) || /<CardContent(\s|>)/.test(content);
  const usesDsSection = /\bds-section\b|\bds-summary-card\b/.test(content);
  const adHocCard =
    /className="[^"]*\brounded-(?:lg|xl|2xl)\b[^"]*\bborder\b[^"]*\bbg-card\b[^"]*"/.test(content) ||
    /className="[^"]*\bbg-card\b[^"]*\bborder\b[^"]*\bshadow/.test(content);
  return usesCardComponent || usesDsSection || adHocCard;
}

/** Irgendein Signal, dass die Fläche etwas tut. */
export function hasInteractivity(content) {
  return (
    /\bInteractiveCard\b/.test(content) ||
    /\bonClick=/.test(content) ||
    /<Link\b/.test(content) ||
    /\bto=|\bhref=/.test(content) ||
    /\bSheetTrigger\b|\bDialogTrigger\b|\bPopoverTrigger\b|\bAccordionTrigger\b/.test(content) ||
    /role="button"/.test(content) ||
    /\buseNavigate\b/.test(content)
  );
}

/** Karten-lose Readout-Variante genutzt? */
export function usesReadoutBlocks(content) {
  return /\bInfoGroup\b|\bInfoStatStrip\b/.test(content);
}

/**
 * Container, für die die Regel nicht gilt.
 *
 * Ein Dialog, ein Formular oder ein Chart-Rahmen ist keine Karte im Sinne der
 * Regel: Er verspricht kein Weiterkommen durch Antippen, sondern begrenzt einen
 * Inhalt, der schon da ist. Das ist keine Hintertür, sondern die Grenze der
 * Regel selbst — sie richtet sich gegen tote Klickversprechen, nicht gegen
 * Rahmen an sich.
 */
export function isExemptContainer(content) {
  return (
    /<DialogContent\b|<SheetContent\b|<AlertDialogContent\b|<DrawerContent\b/.test(content) ||
    /<form\b|<FormField\b/.test(content) ||
    /<ResponsiveContainer\b/.test(content)
  );
}

/**
 * Prüft eine einzelne Datei.
 *
 * @returns {{ violates: boolean, reason: string | null }}
 */
export function analyzeCardRule(relativePath, content) {
  if (!/src\/.+\.tsx$/.test(relativePath)) return { violates: false, reason: null };
  if (/\.(test|spec)\.tsx?$/.test(relativePath) || /__tests__/.test(relativePath)) {
    return { violates: false, reason: null };
  }
  if (DEFINITION_FILES.test(relativePath)) return { violates: false, reason: null };

  if (!hasCardChrome(content)) return { violates: false, reason: null };
  if (isExemptContainer(content)) return { violates: false, reason: null };
  if (hasInteractivity(content) || usesReadoutBlocks(content)) {
    return { violates: false, reason: null };
  }

  return {
    violates: true,
    reason:
      'Karten-Chrome ohne Klick-Aktion und ohne karten-losen Readout-Baustein. ' +
      'Entweder <InteractiveCard to|href|onClick …> (die GANZE Fläche klickbar) ' +
      'oder <InfoGroup>/<InfoStatStrip> (kein Rahmen, kein Schatten).',
  };
}
