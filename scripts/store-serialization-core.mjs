/**
 * Kernlogik des Serialisierungs-Wächters (Issue #311).
 *
 * ## Wogegen er steht
 *
 * Jeder lokale Schreibpfad hat dieselbe Form: Liste lesen, Element einfügen,
 * Liste zurückschreiben. Zwischen Lesen und Schreiben liegt ein echtes `await`
 * (IndexedDB, AES-GCM). Zwei gleichzeitige Aufrufe lesen deshalb denselben
 * Stand, und der zweite Schreibvorgang schreibt eine Fassung, die das Element
 * des ersten nicht enthält — lautlos, ohne Fehler, ohne Log.
 *
 * Der Fehler ist **unsichtbar**: kein Test wird rot, der Compiler schweigt, und
 * ein verlorener Datensatz hinterlässt keine Lücke, nach der jemand suchen
 * würde. #293 hat ihn an einer Einstellung bemerkt; nachgemessen stand dieselbe
 * Sequenz in 13 Services. Genau dafür ist ein Wächter da: nicht für den Fall,
 * den jemand gefunden hat, sondern für den vierzehnten.
 *
 * ## Was er prüft
 *
 * Eine Funktion, die in **einem** Rumpf sowohl eine bekannte Lese- als auch
 * eine bekannte Schreibfunktion derselben Familie aufruft, muss den Ablauf
 * serialisieren — erkennbar an `withKeyLock` (oder an `mutateLocalFinanceList`,
 * das genau das gekapselt tut).
 *
 * ## Was er bewusst NICHT meldet
 *
 * - **Reines Lesen** (`getX`) und **reines Schreiben** (`replaceX`): Wer eine
 *   ganze Liste ersetzt, hat keinen Zwischenzustand zu schützen. Ein Lock dort
 *   stellte nur Lesevorgänge hinter lange Schreibvorgänge.
 * - **Zwei getrennte Funktionen** einer Datei, von denen eine liest und eine
 *   andere schreibt — dazwischen liegt kein gemeinsamer Zwischenzustand.
 *
 * ## Ohne Ausnahmeliste
 *
 * Anders als die zählenden Ratschen (`check:view-data`) hat dieser Wächter
 * keine Allowlist — dieselbe Entscheidung wie bei `check:a11y-names`. Ein
 * begründeter Einzelfall wäre hier „an dieser Stelle darf gelegentlich eine
 * Buchung verloren gehen"; das ist kein Grund, das ist ein Fehler.
 */

import ts from 'typescript';

/**
 * Lese-/Schreibpaare, die gemeinsam einen Zwischenzustand bilden.
 *
 * Getrennt nach Familie, damit ein Lesen der Kategorien und ein Schreiben der
 * Finanzliste nicht als Paar gilt — die beiden teilen keinen Speicherschlüssel.
 */
export const FAMILIEN = [
  {
    name: 'Finanz-Collections',
    lesen: ['readLocalFinanceList'],
    schreiben: ['writeLocalFinanceList'],
    hinweis: 'mutateLocalFinanceList(key, (items) => …) benutzen — liest, ändert und schreibt in einem Lock.',
  },
  {
    name: 'Kategorien',
    lesen: ['readLocalCategoriesRaw'],
    schreiben: ['writeLocalCategories'],
    hinweis: 'Den gesamten Ablauf in withKeyLock(LOCAL_CATEGORIES_KEY, …) legen.',
  },
  {
    name: 'Nutzereinstellungen',
    lesen: ['getLocalUserSettings', 'leseLokaleEinstellungenOhneLock'],
    schreiben: ['schreibeLokaleEinstellungen'],
    hinweis: 'Den gesamten Ablauf in withKeyLock(LOCAL_SETTINGS_KEY, …) legen.',
  },
  {
    name: 'Buchungs-Chunk-Index',
    lesen: ['readIndex'],
    schreiben: ['writeIndex'],
    hinweis: 'mutiereIndex((index) => …) benutzen — der Index ist der Schlüssel, den alle Quartale teilen.',
  },
  {
    // Die teuerste Familie: Hier geht eine BUCHUNG verloren, nicht eine
    // Einstellung. Bis zum Audit 2026-09 war nur der Index gesperrt — die
    // Chunks selbst, in denen die Buchungen liegen, waren es nie.
    //
    // `readLegacyV3Transactions` steht bewusst in den Leseverben, obwohl es
    // aus dem alten Blob liest: Der Migrationslauf schreibt daraus GANZE
    // Quartale und ist damit der dritte Schreiber dieser Familie. Ohne das
    // Verb bliebe ausgerechnet der Pfad unsichtbar, der am meisten auf
    // einmal überschreibt.
    name: 'Buchungs-Chunks',
    lesen: ['readTransactionChunk', 'readAllTransactionChunks', 'readLegacyV3Transactions'],
    schreiben: ['writeTransactionChunk'],
    hinweis:
      'Gesamten Ablauf in withKeyLock(TRANSACTION_STORE_LOCK_KEY, …) legen — inkl. Dubletten- und Quartalssuche.',
  },
  {
    name: 'Buchungs-Blob (v3)',
    lesen: ['getLocalTransactions'],
    schreiben: ['setLocalTransactions'],
    hinweis: 'Gesamten Ablauf in withKeyLock(TRANSACTION_STORE_LOCK_KEY, …) legen — derselbe Schlüssel wie die Chunks.',
  },
];

/** Aufrufe, die belegen, dass der Ablauf serialisiert ist. */
const SERIALISIERER = ['withKeyLock', 'mutateLocalFinanceList'];

/** Nur die I/O-Schicht kann diesen Fehler überhaupt haben. */
export function istSpeicherschicht(relPath) {
  if (!/\.tsx?$/.test(relPath)) return false;
  if (relPath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(relPath)) return false;
  return /^src\/services\//.test(relPath) || /^src\/features\/[^/]+\/data\//.test(relPath);
}

function istFunktionsknoten(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function funktionsName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  // `const foo = async () => …` trägt den Namen an der Deklaration.
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return '(anonym)';
}

/** Namen aller aufgerufenen Funktionen im Teilbaum, inklusive `a.b()`. */
function aufrufeIm(node) {
  const namen = new Set();
  const besuche = (n) => {
    if (ts.isCallExpression(n)) {
      const ziel = n.expression;
      if (ts.isIdentifier(ziel)) namen.add(ziel.text);
      else if (ts.isPropertyAccessExpression(ziel)) namen.add(ziel.name.text);
    }
    ts.forEachChild(n, besuche);
  };
  ts.forEachChild(node, besuche);
  return namen;
}

/**
 * Findet Funktionen, die lesen und schreiben, ohne zu serialisieren.
 *
 * Gemeldet wird die **innerste** passende Funktion: Liegt der Verstoß in einer
 * verschachtelten Funktion, ist die äußere nur ihr Träger und würde die
 * Fundstelle doppelt melden.
 */
export function findeUnserialisierteSchreibpfade(quelltext, relPath = 'datei.ts') {
  const sourceFile = ts.createSourceFile(relPath, quelltext, ts.ScriptTarget.Latest, true);
  const funde = [];

  /**
   * `imLock` wird beim Abstieg vererbt: Der Rumpf, den `withKeyLock(key, …)`
   * als Argument bekommt, ist serialisiert — er sieht den Aufruf aber nicht im
   * eigenen Teilbaum, weil der eine Ebene über ihm steht.
   */
  const pruefe = (node, imLock) => {
    const jetztImLock =
      imLock ||
      (ts.isCallExpression(node) &&
        ((ts.isIdentifier(node.expression) && SERIALISIERER.includes(node.expression.text)) ||
          (ts.isPropertyAccessExpression(node.expression) &&
            SERIALISIERER.includes(node.expression.name.text))));

    if (!jetztImLock && istFunktionsknoten(node)) {
      const aufrufe = aufrufeIm(node);
      const serialisiert = SERIALISIERER.some((s) => aufrufe.has(s));

      if (!serialisiert) {
        for (const familie of FAMILIEN) {
          const liest = familie.lesen.some((n) => aufrufe.has(n));
          const schreibt = familie.schreiben.some((n) => aufrufe.has(n));
          if (liest && schreibt) {
            const start = node.getStart(sourceFile);
            const { line } = sourceFile.getLineAndCharacterOfPosition(start);
            funde.push({
              datei: relPath,
              zeile: line + 1,
              funktion: funktionsName(node),
              familie: familie.name,
              hinweis: familie.hinweis,
              spanne: [start, node.getEnd()],
            });
            break;
          }
        }
      }
    }
    ts.forEachChild(node, (kind) => pruefe(kind, jetztImLock));
  };

  ts.forEachChild(sourceFile, (kind) => pruefe(kind, false));

  // Innerste gewinnt: Eine äußere Funktion, die denselben Verstoß nur deshalb
  // trägt, weil er in einer inneren steht, wird nicht zusätzlich gemeldet.
  const umschliesst = (aussen, innen) =>
    aussen.spanne[0] <= innen.spanne[0] &&
    innen.spanne[1] <= aussen.spanne[1] &&
    aussen.spanne !== innen.spanne;

  return funde
    .filter((fund) => !funde.some((innen) => innen.familie === fund.familie && umschliesst(fund, innen)))
    .map(({ spanne: _spanne, ...rest }) => rest);
}
