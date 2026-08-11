/**
 * Kernlogik des Sanfter-Modus-Wächters (Issue #296).
 *
 * ## Worum es geht
 *
 * Der Sanfte Modus verdeckt Geldbeträge für Menschen mit Vermeidungsverhalten
 * gegenüber ihren Finanzen (`docs/debt-avoidance-recovery.md`). Er ist ein
 * Barrierefreiheits-Versprechen, kein Gimmick: Wer ihn einschaltet, tut das,
 * um nicht mit Zahlen konfrontiert zu werden.
 *
 * Ein einziger unmaskierter Betrag auf derselben Fläche hebt das auf — und
 * genau das passiert, wenn eine Komponente sich ihren eigenen
 * `new Intl.NumberFormat(…, { style: 'currency' })` baut und dessen Ergebnis
 * direkt rendert.
 *
 * ## Warum nicht einfach „kein rohes Intl"
 *
 * Weil das den falschen Befund misst. `TransactionTable.tsx` hat einen rohen
 * Formatierer **und** ist korrekt: sie reicht sein Ergebnis durch
 * `money.mask(…)`. Ein Wächter, der jedes rohe `Intl` anmeckert, hätte hier
 * Fehlalarm — und Fehlalarme schalten Wächter ab, statt sie zu befolgen.
 *
 * Gemeldet wird deshalb der **Aufruf**, nicht die Deklaration: ein
 * `formatierer.format(betrag)`, dessen Ergebnis nicht durch `mask` läuft.
 *
 * Dieselbe Lehre wie bei der halb übersetzten Zeile in `check:i18n` (WP 6.8):
 * Die Datei als Ganzes für erledigt zu halten, weil *irgendwo* darin richtig
 * gearbeitet wird, ist genau der blinde Fleck.
 *
 * ## Importierte Formatierer zählen mit
 *
 * Zwei Module exportieren ihren Währungsformatierer (`liquidity/chart-shared`,
 * `forecast/forecast-shared`), und vier Flächen benutzen ihn. Nur die lokale
 * Deklaration zu prüfen hiesse, ausgerechnet die Bauform auszulassen, die sich
 * am leichtesten ausbreitet — man muss sie nur importieren. Der Läufer sammelt
 * die exportierten Namen in einem ersten Durchgang ein und reicht sie hier
 * herein.
 *
 * ## Was der Wächter NICHT sieht
 *
 * Fertig formatierte Beträge, die als Zeichenkette aus `src/lib/` kommen (etwa
 * `kpi-definitions.ts`, das eine `format`-Funktion je Kennzahl mitbringt). Dort
 * gibt es keinen React-Kontext, also auch nichts zu maskieren — die Pflicht
 * liegt bei der Aufrufstelle, und die erkennt dieser Wächter nicht. Bekannte
 * Grenze, benannt statt stillschweigend übergangen.
 */

import ts from 'typescript';

/** Funktionen, die einen bereits formatierten Betrag verdecken. */
const MASKIERER = ['mask', 'maskAmount'];

/** Nur wo gerendert wird, kann ein Betrag ungeschützt auf dem Schirm landen. */
export function istRenderschicht(relPath) {
  if (!/\.tsx?$/.test(relPath)) return false;
  if (relPath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(relPath)) return false;
  return (
    /^src\/(components|pages)\//.test(relPath) ||
    /^src\/features\/[^/]+\/presentation\//.test(relPath)
  );
}

/** `new Intl.NumberFormat(…, { style: 'currency' })`? */
function istWaehrungsFormatierer(node) {
  if (!ts.isNewExpression(node)) return false;
  const ziel = node.expression;
  const istIntlNumberFormat =
    ts.isPropertyAccessExpression(ziel) &&
    ts.isIdentifier(ziel.expression) &&
    ziel.expression.text === 'Intl' &&
    ziel.name.text === 'NumberFormat';
  if (!istIntlNumberFormat) return false;

  const optionen = node.arguments?.[1];
  if (!optionen || !ts.isObjectLiteralExpression(optionen)) return false;
  return optionen.properties.some(
    (prop) =>
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'style' &&
      ts.isStringLiteralLike(prop.initializer) &&
      prop.initializer.text === 'currency',
  );
}

/** Steht dieser Aufruf direkt in einem `mask(…)`/`maskAmount(…)`? */
function istMaskiert(node) {
  let eltern = node.parent;
  // Ein, zwei Ebenen genügen: `money.mask(fmt.format(x))` und
  // `money.mask(fmt.format(x), 'progress')`. Wer weiter oben maskiert,
  // maskiert nicht mehr diesen Betrag.
  for (let tiefe = 0; tiefe < 3 && eltern; tiefe += 1) {
    if (ts.isCallExpression(eltern)) {
      const ziel = eltern.expression;
      const name = ts.isIdentifier(ziel)
        ? ziel.text
        : ts.isPropertyAccessExpression(ziel)
          ? ziel.name.text
          : null;
      if (name && MASKIERER.includes(name)) return true;
    }
    eltern = eltern.parent;
  }
  return false;
}

/**
 * Sammelt die Namen der aus einem Modul **exportierten** Währungsformatierer.
 *
 * Zwei solche Module gibt es heute (`liquidity/chart-shared.ts`,
 * `forecast/forecast-shared.ts`), und ihre `eur`-Konstante wird von vier
 * Flächen benutzt. Ohne diesen Schritt sähe der Wächter dort gar nichts —
 * er hätte genau die Stellen im blinden Fleck, die sich am leichtesten
 * ausbreiten, weil man sie nur importieren muss.
 */
export function findeExportierteFormatierer(quelltext, relPath = 'datei.ts') {
  const sourceFile = ts.createSourceFile(relPath, quelltext, ts.ScriptTarget.Latest, true);
  const namen = new Set();
  const sammle = (node) => {
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isIdentifier(decl.name) && istWaehrungsFormatierer(decl.initializer)) {
          namen.add(decl.name.text);
        }
      }
    }
    ts.forEachChild(node, sammle);
  };
  ts.forEachChild(sourceFile, sammle);
  return namen;
}

/**
 * Findet gerenderte Geldbeträge, die den Sanften Modus umgehen.
 *
 * Gemeldet wird je `<formatierer>.format(…)`-Aufruf, dessen Formatierer in
 * derselben Datei als Währungs-`Intl` deklariert **oder** aus einem Modul
 * importiert ist, das einen solchen exportiert.
 *
 * @param importierteFormatierer Namen, unter denen diese Datei fremde
 *   Währungsformatierer importiert. Der Läufer ermittelt sie; im Test bleibt
 *   der Parameter leer.
 */
export function findeUnmaskierteBetraege(
  quelltext,
  relPath = 'datei.tsx',
  importierteFormatierer = new Set(),
) {
  const sourceFile = ts.createSourceFile(relPath, quelltext, ts.ScriptTarget.Latest, true);

  // Erster Durchgang: Namen der Währungsformatierer dieser Datei einsammeln.
  const formatierer = new Set(importierteFormatierer);
  const sammle = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      if (istWaehrungsFormatierer(node.initializer)) formatierer.add(node.name.text);
    }
    ts.forEachChild(node, sammle);
  };
  ts.forEachChild(sourceFile, sammle);
  if (formatierer.size === 0) return [];

  // Zweiter Durchgang: die Aufrufe darauf prüfen.
  const funde = [];
  const pruefe = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'format' &&
      ts.isIdentifier(node.expression.expression) &&
      formatierer.has(node.expression.expression.text) &&
      !istMaskiert(node)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      funde.push({
        datei: relPath,
        zeile: line + 1,
        formatierer: node.expression.expression.text,
      });
    }
    ts.forEachChild(node, pruefe);
  };
  ts.forEachChild(sourceFile, pruefe);

  return funde;
}
