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

/**
 * Kommentare ausblenden. Dieselbe Lehre wie bei `check:platform-parity`: Ein
 * erklärender Satz, der die verbotene Bauform ZITIERT, ist kein Befund — sonst
 * erzieht der Wächter zum Schweigen statt zum Dokumentieren.
 */
function ohneKommentare(quelle) {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

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

/**
 * Zählt **Kartenrahmen** — unabhängig davon, ob die Datei irgendwo ein
 * Klick-Signal trägt.
 *
 * **Warum das neben `analyzeCardRule` steht.** Jene Prüfung fragt je DATEI:
 * Karten-Chrome vorhanden und nirgends eine Interaktion? Eine Karte voller
 * anklickbarer ZEILEN erfüllt das immer — und genau die ist die tote
 * Schachtel, die Prinzip 8 verbietet („niemals nur ein verschachtelter Button
 * in einer ansonsten toten Karte"). Gemessen auf der Übersicht: `<Card>`
 * umschliesst „Letzte Buchungen", angeklickt werden die Zeilen darin, und der
 * Wächter schwieg.
 *
 * Ob eine Karte „als Ganzes" klickbar ist, bleibt statisch unentscheidbar —
 * daran hat sich nichts geändert. Entscheidbar ist die **Menge**: Wie viele
 * Kartenrahmen stehen überhaupt im Baum. Gemessen waren es 80 in 55 Dateien
 * gegen 25 `InteractiveCard`. Diese Zahl darf nur sinken; jede Fläche, die
 * ihre Liste entrahmt oder auf `InteractiveCard`/`InfoGroup` umstellt, senkt
 * sie.
 *
 * `InteractiveCard` zählt NICHT mit: Sie IST die Bauform, die das
 * Klickversprechen einlöst.
 */
export function zaehleKartenrahmen(relativePath, content) {
  if (!/src\/.+\.tsx$/.test(relativePath)) return 0;
  if (/\.(test|spec)\.tsx?$/.test(relativePath) || /__tests__/.test(relativePath)) return 0;
  if (DEFINITION_FILES.test(relativePath)) return 0;

  const text = ohneKommentare(content);
  let n = 0;
  for (const _ of text.matchAll(/<Card(?=[\s/>])/g)) n += 1;
  for (const _ of text.matchAll(/className="[^"]*\bbg-card\b[^"]*"/g)) n += 1;
  return n;
}

/**
 * Boxen in einer **fokussierten** Präsentation — dort verbietet ADR Regel 9
 * sie ganz („keine Boxen"; gegliedert wird über Weissraum, Typografie und
 * höchstens eine Haarlinie).
 *
 * Strenger als `zaehleKartenrahmen`: Hier zählt auch der Rahmen ohne
 * `bg-card`, weil auf einem Telefon schon er die Schachtelung erzeugt, die es
 * nicht gibt. **Bedienelemente sind ausgenommen** — ein Knopf mit Rundung und
 * Rahmen ist ein Knopf, keine Box; ihn mitzuzählen hiesse, jede Registerleiste
 * zum Befund zu machen und den Wächter damit unbrauchbar.
 *
 * Eine Haarlinie (`border-t`, `border-b`) ist ausdrücklich erlaubt und wird
 * nicht erfasst: Sie trennt, sie umschliesst nicht.
 */
export function zaehleBoxenInFokussiert(relativePath, content) {
  if (!/src\/features\/[^/]+\/presentation\/mobile\/.+\.tsx$/.test(relativePath)) return 0;
  if (/__tests__/.test(relativePath)) return 0;

  const text = ohneKommentare(content);
  let n = 0;
  for (const treffer of text.matchAll(/<(div|section|article|li|Card)(?=[\s/>])[^>]*>/g)) {
    const tag = treffer[0];
    if (tag.startsWith('<Card')) {
      n += 1;
      continue;
    }
    const klassen = tag.match(/className="([^"]*)"/);
    if (!klassen) continue;
    const k = klassen[1];
    const gerundet = /\brounded-(?:lg|xl|2xl|3xl|full)\b/.test(k);
    const umschliesst = /(?<!-)\bborder\b(?!-[tblrxy]\b)/.test(k) || /\bshadow(?:-|\b)/.test(k) || /\bbg-card\b/.test(k);
    if (gerundet && umschliesst) n += 1;
  }
  return n;
}
