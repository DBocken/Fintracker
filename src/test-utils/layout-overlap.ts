/**
 * Generischer Layout-Überlappungs-Wächter für jsdom-Tests.
 *
 * jsdom hat keine Layout-Engine (getBoundingClientRect liefert 0), daher wird
 * Überlappung aus der Tailwind-Klassen-Arithmetik des GERENDERTEN DOM
 * abgeleitet. Der Wächter ist bewusst konservativ: Unbekanntes (Texthöhen,
 * prozentuale Breiten, …) zählt als 0 — gemeldet werden nur Konstellationen,
 * die *sicher* überlappen bzw. überlaufen, keine Vermutungen.
 *
 * Zwei Verstoß-Klassen:
 *
 * 1. `vertical-collapse`: Ein Container mit fester Höhenklasse (z. B. `h-8`),
 *    dessen Inhalt laut eigenen festen Höhen + Gaps + Padding nachweislich
 *    höher ist — der Inhalt läuft ohne Overflow-Handling über nachfolgende
 *    Elemente (Screenshot-Bug „Buchung aufteilen").
 *
 * 2. `horizontal-overflow`: Eine nicht umbrechende Flex-Zeile, deren Kinder
 *    mit festen Breitenklassen (z. B. `w-44` + `w-48`) zusammen breiter sind
 *    als der Viewport — auf Mobilgeräten läuft die Zeile aus dem Container.
 *
 * Responsive Präfixe (`sm:` …) werden pro Viewport aufgelöst, sodass dieselbe
 * Prüfung für Mobile (360px) und Desktop (1280px) getrennt läuft.
 */

export const MOBILE_VIEWPORT = 360;
export const DESKTOP_VIEWPORT = 1280;

export interface LayoutViolation {
  type: 'vertical-collapse' | 'horizontal-overflow';
  viewportWidth: number;
  /** Menschlich lesbarer Element-Bezeichner (Tag + Klassen). */
  element: string;
  detail: string;
}

const BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const REM = 16;
const SPACING = 4; // Tailwind-Spacing-Skala: 1 Einheit = 0.25rem = 4px

interface ResolvedClass {
  name: string;
  bp: number;
  index: number;
}

/**
 * Löst die für den Viewport wirksamen Utility-Klassen auf (Basis + zutreffende
 * Breakpoint-Präfixe). Zustands-Präfixe (hover:, focus:, dark:, …) werden
 * ignoriert, da sie keinen statischen Layout-Zustand beschreiben.
 */
function resolvedClasses(el: Element, viewportWidth: number): ResolvedClass[] {
  const out: ResolvedClass[] = [];
  let index = 0;
  for (const cls of Array.from(el.classList)) {
    index += 1;
    const colon = cls.indexOf(':');
    if (colon === -1) {
      out.push({ name: cls, bp: 0, index });
      continue;
    }
    // Mehrfach-Präfixe (sm:hover:…) enthalten Zustands-Präfixe → ignorieren.
    const prefix = cls.slice(0, colon);
    const rest = cls.slice(colon + 1);
    if (rest.includes(':')) continue;
    const bp = BREAKPOINTS[prefix];
    if (bp === undefined) continue;
    if (viewportWidth >= bp) out.push({ name: rest, bp, index });
  }
  return out;
}

/**
 * Gewinner-Klasse für eine Eigenschaft: größter zutreffender Breakpoint
 * gewinnt (Media-Query-Reihenfolge), bei Gleichstand die spätere Klasse.
 */
function resolveWinner(classes: ResolvedClass[], matches: (name: string) => boolean): string | null {
  let winner: ResolvedClass | null = null;
  for (const c of classes) {
    if (!matches(c.name)) continue;
    if (!winner || c.bp > winner.bp || (c.bp === winner.bp && c.index > winner.index)) winner = c;
  }
  return winner?.name ?? null;
}

/** `h-8` → 32, `h-[50px]` → 50, `h-[3rem]` → 48; sonst null. */
function sizePx(name: string, prefix: string): number | null {
  const scale = name.match(new RegExp(`^${prefix}-(\\d+(?:\\.\\d+)?)$`));
  if (scale) return parseFloat(scale[1]) * SPACING;
  if (name === `${prefix}-px`) return 1;
  const arbitraryPx = name.match(new RegExp(`^${prefix}-\\[(\\d+(?:\\.\\d+)?)px\\]$`));
  if (arbitraryPx) return parseFloat(arbitraryPx[1]);
  const arbitraryRem = name.match(new RegExp(`^${prefix}-\\[(\\d+(?:\\.\\d+)?)rem\\]$`));
  if (arbitraryRem) return parseFloat(arbitraryRem[1]) * REM;
  return null;
}

/** Feste Höhe/Breite des Elements am Viewport — null, wenn nicht fixiert (h-full, h-auto, …). */
function fixedSize(classes: ResolvedClass[], prefix: 'h' | 'w' | 'min-w' | 'min-h'): number | null {
  const winner = resolveWinner(classes, (n) => n === `size-px` || n.startsWith(`${prefix}-`) || /^size-(\d|\[)/.test(n));
  if (!winner) return null;
  const fromSize = winner.startsWith('size-') && (prefix === 'h' || prefix === 'w')
    ? sizePx(winner, 'size')
    : null;
  return fromSize ?? sizePx(winner, prefix);
}

type Display = 'flex' | 'grid' | 'hidden' | 'block' | 'inline' | 'other';

function display(classes: ResolvedClass[]): Display {
  const winner = resolveWinner(classes, (n) =>
    ['flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'block', 'inline-block', 'inline', 'contents', 'table'].includes(n),
  );
  if (!winner) return 'other';
  if (winner === 'hidden') return 'hidden';
  if (winner === 'flex' || winner === 'inline-flex') return 'flex';
  if (winner === 'grid' || winner === 'inline-grid') return 'grid';
  if (winner === 'inline') return 'inline';
  return 'block';
}

function isColumn(classes: ResolvedClass[]): boolean {
  const winner = resolveWinner(classes, (n) => n.startsWith('flex-row') || n.startsWith('flex-col'));
  return winner?.startsWith('flex-col') ?? false;
}

function wraps(classes: ResolvedClass[]): boolean {
  const winner = resolveWinner(classes, (n) => n === 'flex-wrap' || n === 'flex-nowrap' || n === 'flex-wrap-reverse');
  return winner === 'flex-wrap' || winner === 'flex-wrap-reverse';
}

function isOutOfFlow(classes: ResolvedClass[]): boolean {
  const winner = resolveWinner(classes, (n) => ['absolute', 'fixed', 'sticky', 'static', 'relative'].includes(n));
  return winner === 'absolute' || winner === 'fixed';
}

function overflowHandled(classes: ResolvedClass[], axis: 'x' | 'y'): boolean {
  return classes.some(
    (c) =>
      /^overflow-(hidden|auto|scroll|clip)$/.test(c.name) ||
      new RegExp(`^overflow-${axis}-(hidden|auto|scroll|clip)$`).test(c.name),
  );
}

/** Gap in px auf der Achse (gap-*, gap-x/y-*, space-x/y-*); 0 wenn keiner. */
function gapPx(classes: ResolvedClass[], axis: 'x' | 'y'): number {
  const axisWinner = resolveWinner(classes, (n) => n.startsWith(`gap-${axis}-`) || n.startsWith(`space-${axis}-`));
  if (axisWinner) {
    return sizePx(axisWinner, axisWinner.startsWith('gap') ? `gap-${axis}` : `space-${axis}`) ?? 0;
  }
  const winner = resolveWinner(classes, (n) => /^gap-(\d|px|\[)/.test(n));
  return winner ? (sizePx(winner, 'gap') ?? 0) : 0;
}

/** Padding-Summe beider Seiten einer Achse in px. */
function paddingPx(classes: ResolvedClass[], axis: 'x' | 'y'): number {
  const sides: Array<[string, string[]]> = axis === 'y' ? [['pt', ['py', 'p']], ['pb', ['py', 'p']]] : [['pl', ['px', 'p']], ['pr', ['px', 'p']]];
  let total = 0;
  for (const [side, fallbacks] of sides) {
    const winner = resolveWinner(classes, (n) =>
      [side, ...fallbacks].some((p) => new RegExp(`^${p}-(\\d|px|\\[)`).test(n)),
    );
    if (!winner) continue;
    const prefix = [side, ...fallbacks].find((p) => winner.startsWith(`${p}-`));
    if (prefix) total += sizePx(winner, prefix) ?? 0;
  }
  return total;
}

function describe(el: Element): string {
  const cls = el.getAttribute('class');
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}>`;
}

/** Auch per HTML-Attribut oder Inline-Style ausgeblendete Elemente erkennen (z. B. Radix). */
function isHiddenElement(el: Element, classes: ResolvedClass[]): boolean {
  if (display(classes) === 'hidden') return true;
  if (el instanceof HTMLElement && (el.hidden || el.style.display === 'none')) return true;
  return false;
}

function visibleFlowChildren(el: Element, viewportWidth: number): Element[] {
  return Array.from(el.children).filter((child) => {
    const classes = resolvedClasses(child, viewportWidth);
    return !isHiddenElement(child, classes) && !isOutOfFlow(classes);
  });
}

/** Standardmäßig block-artige Tags — stapeln sich in Nicht-Flex-Containern vertikal. */
const BLOCK_TAGS = new Set([
  'DIV', 'P', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'MAIN',
  'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'FORM', 'FIELDSET',
  'TABLE', 'HR', 'PRE', 'BLOCKQUOTE', 'DL', 'DT', 'DD',
]);

function isBlockish(el: Element, viewportWidth: number): boolean {
  const disp = display(resolvedClasses(el, viewportWidth));
  if (disp === 'flex' || disp === 'grid' || disp === 'block') return true;
  if (disp === 'inline') return false;
  return BLOCK_TAGS.has(el.tagName);
}

const MAX_DEPTH = 40;

/**
 * Konservative Mindesthöhe eines Elements in px: eigene feste Höhe, sonst aus
 * Kindern (Spalten-Stapel: Summe + Gaps + Padding; Zeile/Grid: Maximum).
 * Unbekanntes → 0.
 */
export function estimateMinHeight(el: Element, viewportWidth: number, depth = 0): number {
  if (depth > MAX_DEPTH) return 0;
  const classes = resolvedClasses(el, viewportWidth);
  if (isHiddenElement(el, classes)) return 0;
  const own = fixedSize(classes, 'h');
  const minH = fixedSize(classes, 'min-h');
  if (own !== null) return Math.max(own, minH ?? 0);
  const content = estimateContentMinHeight(el, viewportWidth, depth);
  return Math.max(content, minH ?? 0);
}

/** Mindesthöhe des Inhalts eines Containers (ohne dessen eigene feste Höhe). */
function estimateContentMinHeight(el: Element, viewportWidth: number, depth = 0): number {
  const classes = resolvedClasses(el, viewportWidth);
  const disp = display(classes);
  const children = visibleFlowChildren(el, viewportWidth);
  if (children.length === 0) return 0;
  const pad = paddingPx(classes, 'y');
  const isRow = disp === 'flex' && !isColumn(classes);
  if (isRow || disp === 'grid') {
    // Zeile bzw. Grid (Spaltenzahl unbekannt): konservativ nur das Maximum.
    const heights = children.map((c) => estimateMinHeight(c, viewportWidth, depth + 1));
    return Math.max(...heights) + pad;
  }
  if (disp === 'flex') {
    // flex-col: alle Kinder sind Flex-Items und stapeln sich.
    const heights = children.map((c) => estimateMinHeight(c, viewportWidth, depth + 1));
    const gaps = gapPx(classes, 'y') * (children.length - 1);
    return heights.reduce((a, b) => a + b, 0) + gaps + pad;
  }
  // Block-Fluss: nur block-artige Kinder stapeln sich sicher; Inline-Kinder
  // (span, svg, input, …) können sich eine Zeile teilen → konservativ nur
  // deren Maximum ansetzen.
  const blockish = children.filter((c) => isBlockish(c, viewportWidth));
  const inline = children.filter((c) => !isBlockish(c, viewportWidth));
  const blockSum = blockish
    .map((c) => estimateMinHeight(c, viewportWidth, depth + 1))
    .reduce((a, b) => a + b, 0);
  const inlineMax = inline.length
    ? Math.max(...inline.map((c) => estimateMinHeight(c, viewportWidth, depth + 1)))
    : 0;
  const gaps = gapPx(classes, 'y') * Math.max(0, blockish.length - 1);
  return blockSum + inlineMax + gaps + pad;
}

const TOLERANCE = 1;

function checkVerticalCollapse(el: Element, viewportWidth: number): LayoutViolation | null {
  const classes = resolvedClasses(el, viewportWidth);
  const own = fixedSize(classes, 'h');
  if (own === null) return null;
  if (overflowHandled(classes, 'y')) return null;
  const content = estimateContentMinHeight(el, viewportWidth);
  if (content <= own + TOLERANCE) return null;
  return {
    type: 'vertical-collapse',
    viewportWidth,
    element: describe(el),
    detail:
      `Feste Höhe ${own}px, aber Inhalt ist nachweislich ≥ ${content}px hoch — ` +
      `der Inhalt überlappt nachfolgende Elemente (kein overflow-Handling).`,
  };
}

function checkHorizontalOverflow(el: Element, viewportWidth: number): LayoutViolation | null {
  const classes = resolvedClasses(el, viewportWidth);
  if (display(classes) !== 'flex' || isColumn(classes) || wraps(classes)) return null;
  if (overflowHandled(classes, 'x')) return null;
  const children = visibleFlowChildren(el, viewportWidth);
  if (children.length === 0) return null;
  const widths = children.map((child) => {
    const cc = resolvedClasses(child, viewportWidth);
    return Math.max(fixedSize(cc, 'w') ?? 0, fixedSize(cc, 'min-w') ?? 0);
  });
  const total =
    widths.reduce((a, b) => a + b, 0) +
    gapPx(classes, 'x') * (children.length - 1) +
    paddingPx(classes, 'x');
  if (total <= viewportWidth) return null;
  return {
    type: 'horizontal-overflow',
    viewportWidth,
    element: describe(el),
    detail:
      `Nicht umbrechende Flex-Zeile: feste Kind-Breiten + Gaps ergeben ${total}px ` +
      `bei nur ${viewportWidth}px Viewport — die Zeile läuft horizontal über.`,
  };
}

/**
 * Durchsucht den gerenderten Baum nach sicheren Layout-Überlappungen für den
 * gegebenen Viewport. Am Viewport ausgeblendete Teilbäume werden übersprungen.
 */
export function findLayoutOverlapViolations(root: Element, viewportWidth: number): LayoutViolation[] {
  const violations: LayoutViolation[] = [];
  const walk = (el: Element) => {
    const classes = resolvedClasses(el, viewportWidth);
    if (isHiddenElement(el, classes)) return;
    const vertical = checkVerticalCollapse(el, viewportWidth);
    if (vertical) violations.push(vertical);
    const horizontal = checkHorizontalOverflow(el, viewportWidth);
    if (horizontal) violations.push(horizontal);
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(root);
  return violations;
}

/**
 * Test-Helfer: prüft einen gerenderten Container auf beiden Standard-Viewports
 * (Mobile 360px, Desktop 1280px) und schlägt mit lesbarer Liste fehl.
 */
export function expectNoLayoutOverlap(
  root: Element,
  viewports: number[] = [MOBILE_VIEWPORT, DESKTOP_VIEWPORT],
): void {
  const all = viewports.flatMap((vw) => findLayoutOverlapViolations(root, vw));
  if (all.length > 0) {
    const lines = all.map((v) => `- [${v.viewportWidth}px] ${v.type}: ${v.detail}\n  ${v.element}`);
    throw new Error(`Layout-Überlappung(en) gefunden:\n${lines.join('\n')}`);
  }
}
