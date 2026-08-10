/**
 * Kernlogik des Geld-Parsing-Wächters (`docs/coding-guide.md` §6/§8, GOV-1 /
 * WP 2.2).
 *
 * `docs/coding-guide.md` verbietet zwei Dinge, die im Baum trotzdem
 * vorkamen — belegt im Audit (`docs/qualitaet-2026-08/audit.md`, GOV-1):
 *
 * 1. Roh-`parseFloat`/`Number.parseFloat` mit `replace(',', '.')` für einen
 *    getippten Geldbetrag. `AskYourMoney.tsx:52` tat genau das:
 *    `Number.parseFloat(amount.replace(',', '.'))`. Deutsches Format nutzt
 *    den Punkt als TAUSENDERTRENNER — getipptes „1.200" wurde damit zu 1,2.
 *    Der einzige gemeinsame Parser ist `parseGermanNumber`/`parseEuroInput`
 *    (`src/lib/money.ts`); er kennt den Tausenderpunkt, ein Roh-`replace`
 *    kennt ihn nicht.
 * 2. `as unknown as` unter `src/` (außer Tests) — der Doppel-Cast hebelt
 *    TypeScript vollständig aus und prüft zur Laufzeit NICHTS.
 *    `BankCallbackPage.tsx:119` tat das mit `(result.accounts || []) as
 *    unknown as GoCardlessAccount[]` — fremde GoCardless-Bankdaten flossen
 *    damit ungeprüft bis in den React-State, obwohl der Baustein dafür
 *    längst existiert (`parseAtBoundary`/`safeParseAtBoundary`,
 *    `src/lib/schemas/boundary.ts`). Ob eine konkrete Fundstelle eine echte
 *    Datengrenze ist, ist NICHT maschinell entscheidbar — deshalb meldet
 *    dieser Wächter jede Fundstelle und überlässt legitime Typ-Interop-Fälle
 *    der Allowlist (Zahl/Objekt-Konvention, wie bei den Nachbar-Wächtern).
 *
 * Getrennt vom Runner, damit die Logik ohne Dateisystem testbar ist — dieselbe
 * Aufteilung wie bei `decimal-input-core.mjs` und `layers-core.mjs`.
 */

/** Kommentarzeilen zählen nicht — dieselbe Heuristik wie bei den Nachbar-Wächtern. */
const COMMENT_LINE = /^\s*(\/\/|\*|\{\s*\/\*)/;

/**
 * Testdateien sind vom `as unknown as`-Verbot ausgenommen (Mocks/Fixtures
 * dürfen TypeScript aushebeln). Der Runner filtert Testdateien bereits vor
 * dem Aufruf aus — dieselbe Prüfung sitzt zusätzlich HIER, damit die Logik
 * ohne Dateisystem/Runner isoliert testbar bleibt (u. a. für den Fall
 * „`as unknown as` in einer Testdatei").
 */
const TEST_PATH = /(^|\/)__tests__\/|\.(test|spec)\.[tj]sx?$|(^|\/)src\/test-utils\//;

/** `parseFloat(`/`Number.parseFloat(` — Wortgrenze, damit `parseGermanNumber` nicht anschlägt. */
const RAW_PARSE_FLOAT = /(?<![\w.])(?:Number\.)?parseFloat\s*\(/;

/**
 * `.replace(',', '.')` — Komma-Literal zu Punkt-Literal, in beliebiger
 * Anführungszeichen-Form (`'`, `"`, `` ` ``) sowie als Regex-Literal
 * (`.replace(/,/, '.')`). Ein `.replace`, das etwas ANDERES ersetzt (z. B.
 * Tausenderpunkte), matcht hier nicht — das ist genau der Unterschied
 * zwischen dem Verbot und `parseGermanNumber`.
 */
const COMMA_TO_DOT_REPLACE = /\.replace\(\s*(?:(['"`]),\1|\/,\/)\s*,\s*(['"`])\.\2\s*\)/;

/** `as unknown as` — nicht `as const`, nicht ein einfacher `as SomeType`-Cast. */
const AS_UNKNOWN_AS = /\bas\s+unknown\s+as\b/;

/**
 * Findet Roh-`parseFloat`-Komma-Ersetzung und `as unknown as` in einer Datei.
 *
 * @param relPath repo-relativer Pfad (für die Meldung UND die
 *   Testdatei-Erkennung)
 * @param source  Dateiinhalt
 * @returns Liste der Fundstellen mit Zeilennummer und Art des Verstoßes
 */
export function findMoneyParsingViolations(relPath, source) {
  if (TEST_PATH.test(relPath)) return [];

  const funde = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (COMMENT_LINE.test(line)) return;

    if (RAW_PARSE_FLOAT.test(line)) {
      // Fenster von ±2 Zeilen: mehrzeilig umgebrochene Aufrufe bleiben erkennbar.
      const von = Math.max(0, index - 2);
      const bis = Math.min(lines.length, index + 3);
      const umfeld = lines.slice(von, bis).join('\n');
      if (COMMA_TO_DOT_REPLACE.test(umfeld)) {
        funde.push({ file: relPath, line: index + 1, hint: 'parseFloat-Komma-Ersetzung' });
      }
    }

    if (AS_UNKNOWN_AS.test(line)) {
      funde.push({ file: relPath, line: index + 1, hint: 'as unknown as' });
    }
  });

  return funde;
}
