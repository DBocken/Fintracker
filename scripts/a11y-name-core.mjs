/**
 * Kern des Bedienbarkeits-Wächters: „Jedes Bedienelement hat einen Namen."
 *
 * **Warum statisch und nicht nur über axe.** Der axe-Durchlauf über alle
 * Screens (`e2e-tests/all-screens-a11y.spec.ts`) sieht nur, was gerade auf dem
 * Bildschirm steht. Er fand acht namenlose Auswahlfelder — im Bestand waren es
 * 48 in 26 Dateien. Die übrigen 40 stecken in Dialogen, Sheets und
 * Bereichen, die ein Durchlauf ohne Klickpfad nie öffnet. Ein Wächter, der die
 * Quelle liest, sieht sie alle.
 *
 * **Warum ein Auswahlfeld ohne `aria-label` auch dann ein Befund ist, wenn es
 * gerade Text zeigt.** Der Trigger von Radix leitet seinen Namen aus dem
 * INHALT ab — also aus dem aktuell gewählten Wert. Angesagt wird dann
 * „Deutsch, Auswahlfeld": der Wert, aber nicht, wofür er steht. Und solange
 * nichts gewählt ist, ist der Name leer. Der Name eines Bedienelements darf
 * nicht davon abhängen, was gerade darin steht.
 *
 * Geprüft werden zwei Klassen, beide aus dem axe-Befund `button-name`:
 *   1. `<SelectTrigger>` ohne `aria-label`/`aria-labelledby`
 *   2. Schaltflächen, deren einziger Inhalt ein Icon ist (`<Button><Pencil …/></Button>`)
 */

/** Attribute, die einem Element einen Namen geben. `title` zählt bewusst mit —
 *  axe erkennt es an, auch wenn es die schwächere Variante ist. */
const NAMING_ATTRS = /\b(aria-label|aria-labelledby|title)\s*=/;

/** Bezeichner aus `lucide-react` sind durchgehend PascalCase-Einzelwörter. */
const ICON_ONLY_CHILD = /^\s*<[A-Z][A-Za-z0-9]*\b[^>]*\/>\s*$/;

/**
 * Findet das Ende eines JSX-Öffnungs-Tags ab `start` (Index von `<`).
 * Klammert `{…}`-Ausdrücke und Zeichenketten aus, damit ein `>` in
 * `className={a > b ? …}` das Tag nicht vorzeitig beendet.
 */
function findTagEnd(content, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

/** Alle Vorkommen eines Komponenten-Tags mit ihren Attributen. */
export function findTags(content, tagName) {
  const out = [];
  const opener = new RegExp(`<${tagName}(?=[\\s/>])`, 'g');
  let match;
  while ((match = opener.exec(content)) !== null) {
    const end = findTagEnd(content, match.index);
    if (end === -1) continue;
    const raw = content.slice(match.index, end + 1);
    out.push({
      line: lineOf(content, match.index),
      attrs: raw.slice(`<${tagName}`.length, raw.endsWith('/>') ? -2 : -1),
      selfClosing: raw.endsWith('/>'),
      start: match.index,
      end,
    });
  }
  return out;
}

/** Inhalt zwischen Öffnungs- und passendem Schluss-Tag (null bei selbstschliessend). */
function childrenOf(content, tag, tagName) {
  if (tag.selfClosing) return null;
  const close = content.indexOf(`</${tagName}>`, tag.end);
  if (close === -1) return null;
  // Verschachtelte gleichnamige Tags: dann ist der erste Schluss-Tag nicht
  // unser Ende — solche Faelle melden wir nicht (lieber still als falsch).
  const nested = content.slice(tag.end, close).includes(`<${tagName}`);
  if (nested) return null;
  return content.slice(tag.end + 1, close);
}

export function analyzeAccessibleNames(filePath, content) {
  if (filePath.includes('__tests__') || filePath.includes('/ui/')) {
    return { violations: [] };
  }

  const violations = [];

  for (const tag of findTags(content, 'SelectTrigger')) {
    if (!NAMING_ATTRS.test(tag.attrs)) {
      violations.push({ line: tag.line, kind: 'select-trigger' });
    }
  }

  for (const tag of findTags(content, 'Button')) {
    if (NAMING_ATTRS.test(tag.attrs)) continue;
    if (/\basChild\b/.test(tag.attrs)) continue; // Name traegt dann das Kind
    const children = childrenOf(content, tag, 'Button');
    if (children !== null && ICON_ONLY_CHILD.test(children)) {
      violations.push({ line: tag.line, kind: 'icon-button' });
    }
  }

  return { violations };
}
