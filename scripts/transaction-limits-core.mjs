/**
 * Kernlogik des Wächters gegen stille Buchungs-Kappungen (Audit 2026-09, F2).
 *
 * ## Wogegen er steht
 *
 * `getTransactions(limit)` sortiert absteigend und schneidet ab. Rund 45
 * Aufrufstellen wählten dafür ein Literal — 500, 1000, 2000, 5000, 10000 — und
 * **keine** prüfte, ob es gegriffen hat. Ein Ausschnitt sieht aber aus wie ein
 * Bestand: Der Klassifikator trainiert dann auf 1.000 Buchungen, die
 * Vertragserkennung sieht keinen Jahresvertrag, die Dubletten-Prüfung findet
 * genau die Dublette nicht, wegen der sie läuft, und eine Steuersumme ist
 * schlicht falsch. Nichts davon wird rot; nichts davon fällt auf.
 *
 * ## Was er prüft
 *
 * Ein **numerisches Literal** als erstes Argument von `getTransactions(`.
 * Ersatz ist `getAllTransactions()` für Auswertungen und
 * `getTransactionsPage(limit, offset)` für echte Seiten — dort ist das Limit
 * die Aussage, nicht ein geratener Deckel.
 *
 * ## Reichweite
 *
 * Services, Hooks **und die Oberfläche**. Der Plan des Audits nannte nur
 * `services` und `hooks`; nachgemessen lag die Hälfte der Aufrufer in
 * `components/` und `pages/` — darunter Steuerbericht und EÜR. Ein Wächter,
 * der genau dort nicht hinsieht, wo die Steuersumme entsteht, lässt den
 * teuersten Fall zurückkommen (dieselbe Lehre wie bei `check:money-format`).
 *
 * ## Ohne Ausnahmeliste
 *
 * Wie `check:a11y-names` und `check:store-serialization`: Ein Eintrag hiesse
 * „an dieser Stelle darf die Summe falsch sein".
 */

import ts from 'typescript';

/** Geprüft wird der Produktivcode aller vier Schichten — Tests nicht. */
export function istGeprueft(relPath) {
  if (!/\.tsx?$/.test(relPath)) return false;
  if (relPath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(relPath)) return false;
  return /^src\/(services|hooks|components|pages|features)\//.test(relPath);
}

/** Findet `getTransactions(<Zahl>)` — auch als `foo.getTransactions(2000)`. */
export function findeKappungen(quelltext, relPath = 'datei.ts') {
  const sourceFile = ts.createSourceFile(relPath, quelltext, ts.ScriptTarget.Latest, true);
  const funde = [];

  const besuche = (node) => {
    if (ts.isCallExpression(node)) {
      const ziel = node.expression;
      const name = ts.isIdentifier(ziel)
        ? ziel.text
        : ts.isPropertyAccessExpression(ziel)
          ? ziel.name.text
          : null;

      if (name === 'getTransactions' && node.arguments.length > 0) {
        const erstes = node.arguments[0];
        if (ts.isNumericLiteral(erstes)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          funde.push({ datei: relPath, zeile: line + 1, limit: erstes.text });
        }
      }
    }
    ts.forEachChild(node, besuche);
  };

  ts.forEachChild(sourceFile, besuche);
  return funde;
}
