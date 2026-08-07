import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * WP-10.2 — Lesbarkeit der Farbtokens, geprüft an der Quelle.
 *
 * **Warum nicht allein über axe.** Der Durchlauf über alle Screens
 * (`e2e-tests/all-screens-a11y.spec.ts`) läuft im HELLEN Thema und sieht nur,
 * was gerade auf dem Bildschirm steht. Beides zusammen hatte ein Loch: Weiß auf
 * `--positive` lag im Dunkel-Thema bei 2.46:1 — unlesbar, aber von keinem
 * Durchlauf je betreten. Dieser Test rechnet die Paare direkt aus `index.css`
 * aus und deckt damit beide Themen ab, unabhängig davon, welcher Screen sie
 * gerade zeigt.
 *
 * Schwelle 4.5:1 (WCAG AA, normaler Text). Die App setzt viele dieser Tokens in
 * `text-xs`/`text-[11px]` ein — die Ausnahme für große Schrift (3:1) greift
 * dort gerade NICHT.
 */

const AA_NORMAL = 4.5;

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
const SKINS_CSS = readFileSync(resolve(__dirname, '../../skins/skins.css'), 'utf8');

/** Inhalt des Blocks, der bei `start` beginnt — klammerzählend, nicht regexbasiert. */
function blockAt(css: string, start: number): string {
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, i);
    }
  }
  return '';
}

function parseTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*([0-9.]+ [0-9.]+% [0-9.]+%)\s*;/g)) {
    out[match[1]] = match[2];
  }
  return out;
}

/** Liest die `--token: H S% L%`-Deklarationen eines Selektor-Blocks. */
function tokensOf(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `Selektor ${selector} nicht gefunden`).toBeGreaterThan(-1);
  return parseTokens(blockAt(CSS, start));
}

function hslToRgb(value: string): [number, number, number] {
  const [hRaw, sRaw, lRaw] = value.split(' ');
  const h = parseFloat(hRaw);
  const s = parseFloat(sRaw) / 100;
  const l = parseFloat(lRaw) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(hslToRgb(foreground));
  const b = relativeLuminance(hslToRgb(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Jedes Paar, das die App tatsächlich so kombiniert. Der Kommentar nennt, wo —
 * damit ein Eintrag beim Umbau nicht zur Karteileiche wird.
 */
const PAIRS: [fg: string, bg: string][] = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['card-foreground', 'card'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'card'], // `text-destructive` in Alerts auf Karten
  ['warning', 'card'], // Kennzahlen mit Warn-Ton (InfoGroup, Steuer-Karten)
  ['positive', 'card'],
  ['positive-foreground', 'positive'], // eingefaerbte Schaltflaechen/Badges
  ['warning-foreground', 'warning'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-muted', 'sidebar'],
  ['sidebar-muted', 'sidebar-accent'], // Untertitel im AKTIVEN Navigationseintrag
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['premium-foreground', 'premium'],
  ['brand-foreground', 'brand'],
];

describe.each([
  ['helles Thema', ':root {'],
  ['dunkles Thema', '.dark {'],
])('Farbkontraste — %s', (_name, selector) => {
  const tokens = tokensOf(selector);

  it.each(PAIRS)('sollte --%s auf --%s mindestens 4.5:1 erreichen', (fg, bg) => {
    expect(tokens[fg], `--${fg} fehlt`).toBeDefined();
    expect(tokens[bg], `--${bg} fehlt`).toBeDefined();
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

/**
 * Die wählbaren Skins (`src/skins/skins.css`) bringen JE EINEN eigenen
 * vollständigen Tokensatz mit — neun Skins mal hell/dunkel. Sie waren nie
 * geprüft: Der axe-Durchlauf sieht immer nur das gerade eingestellte Thema, und
 * der Test oben las ausschließlich `index.css`.
 *
 * Was dabei lag: `--destructive` auf `--card` bei **1.93:1** in einem dunklen
 * Skin. Das ist die Farbe, in der Fehlermeldungen stehen — praktisch unsichtbar
 * für alle, die diesen Skin gewählt hatten.
 *
 * Ein Skin deklariert nur seine Abweichungen; alles andere fällt auf
 * `:root`/`.dark` zurück. Genau so wird hier zusammengesetzt.
 */
// Dieselben Paare wie oben: Ein Skin, der `--positive` umfärbt, aber
// `--positive-foreground` erbt, reisst das Paar genauso auf wie ein
// unstimmiges Basisthema. Ein verkürztes Set hier hatte 53 Verstösse
// uebersehen — darunter `--warning` auf `--card` bei 1.65:1.
const SKIN_PAIRS = PAIRS;

const SKINS = [...SKINS_CSS.matchAll(/^(\.dark)?(\.theme-[a-z-]+) \{$/gm)].map((match) => ({
  name: match[0].slice(0, -2).trim(),
  dark: Boolean(match[1]),
  tokens: parseTokens(blockAt(SKINS_CSS, match.index)),
}));

describe('Farbkontraste — waehlbare Skins', () => {
  it('sollte ueberhaupt Skins finden', () => {
    // Sicherung gegen den stillen Totalausfall: Wenn die Namenskonvention der
    // Selektoren sich aendert, findet die Suche nichts und ALLE Faelle unten
    // waeren leer — der Test waere gruen, ohne etwas zu pruefen.
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
  });

  const baseLight = tokensOf(':root {');
  const baseDark = { ...baseLight, ...tokensOf('.dark {') };

  it.each(SKINS.map((skin) => [skin.name, skin] as const))(
    '%s sollte durchgehend mindestens 4.5:1 erreichen',
    (_name, skin) => {
      const tokens = { ...(skin.dark ? baseDark : baseLight), ...skin.tokens };
      const failures = SKIN_PAIRS.filter(([fg, bg]) => tokens[fg] && tokens[bg])
        .map(([fg, bg]) => [fg, bg, contrastRatio(tokens[fg], tokens[bg])] as const)
        .filter(([, , ratio]) => ratio < AA_NORMAL)
        .map(([fg, bg, ratio]) => `--${fg} auf --${bg}: ${ratio.toFixed(2)}`);

      expect(failures).toEqual([]);
    },
  );
});

describe('[REGRESSION] Befunde aus dem axe-Durchlauf (WP-10.2)', () => {
  it('sollte den Untertitel im aktiven Navigationseintrag lesbar halten', () => {
    // War 3.60:1 (hell) bzw. 3.82:1 (dunkel) — axe meldete es auf acht Screens,
    // weil `SideNav` auf allen liegt.
    for (const selector of [':root {', '.dark {']) {
      const t = tokensOf(selector);
      expect(contrastRatio(t['sidebar-muted'], t['sidebar-accent'])).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('sollte fuer eingefaerbte Flaechen einen eigenen Vordergrund fuehren', () => {
    // Der eigentliche Fehler war nicht der Farbwert, sondern das fehlende
    // Token: ohne `--positive-foreground` griffen die Aufrufstellen zu
    // `text-white` — im Dunkel-Thema 2.46:1.
    for (const selector of [':root {', '.dark {']) {
      const t = tokensOf(selector);
      expect(t['positive-foreground'], `--positive-foreground fehlt in ${selector}`).toBeDefined();
      expect(t['warning-foreground'], `--warning-foreground fehlt in ${selector}`).toBeDefined();
    }
  });
});

describe('contrastRatio', () => {
  it('sollte Schwarz auf Weiss mit 21:1 bewerten', () => {
    expect(contrastRatio('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 1);
  });

  it('sollte gleiche Farben mit 1:1 bewerten', () => {
    expect(contrastRatio('174 65% 21%', '174 65% 21%')).toBeCloseTo(1, 5);
  });
});
