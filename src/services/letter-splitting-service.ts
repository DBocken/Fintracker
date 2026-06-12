// Brief-Trennung in Massen-PDFs (Issue #44, Epic #24).
//
// Ein Einzugsscanner-PDF enthält viele Briefe am Stück — die Pipeline muss erkennen,
// wo ein Brief endet und der nächste beginnt. Heuristiken:
// - Neuer Absender/Briefkopf im oberen Seitendrittel
// - Adressfenster-Muster (Empfängerblock) + Datumszeile
// - Neues Aktenzeichen / neue Rechnungsnummer
// - Seitennummerierung („Seite 1 von 2") als Gegenindiz

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface LetterSplit {
  letterIndex: number;
  startPage: number;
  endPage: number;
  pages: PageText[];
  confidence: "certain" | "uncertain";
  reason: string;
}

export interface LetterSplitResult {
  splits: LetterSplit[];
  reviewNeeded: Array<{ between: [number, number]; message: string }>;
}

/**
 * Erkennt potenzielle Seitennummern-Muster wie „Seite 1 von 2" oder „Blatt 2/3".
 * Gegenindiz: Wenn in kurzer Folge mehrere Seiten mit Nummern folgen,
 * gehören sie wahrscheinlich zu demselben Brief.
 */
function extractPageNumber(text: string): { current: number; total: number } | null {
  // Muster: "Seite 1 von 2", "Blatt 1/2", "Seite 1 von 2"
  const match = text.match(
    /(?:seite|blatt|page)\s+(\d+)\s+(?:von|\/|of)\s+(\d+)/i,
  );
  if (!match) return null;
  return { current: parseInt(match[1], 10), total: parseInt(match[2], 10) };
}

/**
 * Bewertet, ob eine Seite wahrscheinlich den Anfang eines neuen Briefs signalisiert.
 * Rückgabe: Konfidenz + Grund.
 */
function detectLetterStart(
  text: string,
  prevText: string | null,
): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (!prevText) {
    score = 1;
    reasons.push("Erste Seite");
    return { confidence: score, reasons };
  }

  // Briefkopf-Heuristik: Großbuchstaben/Unternehmensname in oberen 25 Zeilen
  const lines = text.split("\n").slice(0, 25).join(" ");
  const isHeadline = /\b([A-Z]{2,}[\w\s\-]{5,}|GmbH|AG|SE|KG)\b/.test(lines);
  if (isHeadline && !prevText.slice(0, 500).includes(lines.substring(0, 30))) {
    score += 0.3;
    reasons.push("Neuer Absender/Briefkopf erkannt");
  }

  // Adressfenster: „Sehr geehrte" + Name/Straße → häufig nach Briefkopf
  if (
    /\b(Sehr geehrte|Liebe|Sehr geehrter)\b/i.test(text) &&
    !prevText.includes("Sehr geehrte")
  ) {
    score += 0.25;
    reasons.push("Neues Adressfenster erkannt");
  }

  // Datum-Muster: Neue Datumszeile deutet auf neuen Brief (aber nicht zu oft)
  const dates = text.match(/\d{1,2}[.\s/]\d{1,2}[.\s/]\d{2,4}/g) || [];
  const prevDates = prevText.match(/\d{1,2}[.\s/]\d{1,2}[.\s/]\d{2,4}/g) || [];
  if (
    dates.length > 0 &&
    prevDates.length > 0 &&
    dates[0] !== prevDates[prevDates.length - 1]
  ) {
    score += 0.15;
    reasons.push("Neues Datum erkannt");
  }

  // Aktenzeichen/Rechnungsnummer: Neue Nummer = neuer Brief
  const refPattern = /(?:Aktenzeichen|Rechnungs?nummer)[:\s]+([A-Z0-9\-]+)/gi;
  const prevRefs = new Set<string>();
  let match;
  const prevTextClone = prevText;
  while ((match = refPattern.exec(prevTextClone)) !== null) {
    prevRefs.add(match[1].toUpperCase());
  }

  const textClone = text;
  while ((match = refPattern.exec(textClone)) !== null) {
    if (!prevRefs.has(match[1].toUpperCase())) {
      score += 0.2;
      reasons.push(`Neues Aktenzeichen/Nummer: ${match[1]}`);
      break;
    }
  }

  return { confidence: Math.min(1, score), reasons };
}

/**
 * Gruppiert Seitentexte in Briefe basierend auf Übergangsheuristiken.
 * Unsichere Fälle landen im Review-Array: „Gehören diese 2 Seiten zusammen?"
 * statt „Seite 1 / Seite 2" einzeln zu fragen.
 */
export function splitLettersFromPages(pages: PageText[]): LetterSplitResult {
  if (pages.length === 0) return { splits: [], reviewNeeded: [] };

  const splits: LetterSplit[] = [];
  const reviewNeeded: Array<{ between: [number, number]; message: string }> = [];

  let currentLetterStart = 0;
  let currentLetterConfidence: "certain" | "uncertain" = "certain";

  for (let i = 1; i < pages.length; i++) {
    const prevText = pages[i - 1].text;
    const currText = pages[i].text;

    // Prüfe ob Seite i ein neuer Brief beginnt
    const { confidence, reasons } = detectLetterStart(currText, prevText);

    // Heuristic: Seitennummerierung ist ein Indiz, dass Seiten zusammengehören
    const prevPageNum = extractPageNumber(prevText);
    const currPageNum = extractPageNumber(currText);

    let isNewLetter = false;
    let finalConfidence: "certain" | "uncertain" = "uncertain";

    if (
      prevPageNum &&
      currPageNum &&
      currPageNum.current === prevPageNum.current + 1 &&
      currPageNum.total === prevPageNum.total
    ) {
      // Klare Seitennummerierung: gehören zusammen
      isNewLetter = false;
      finalConfidence = "certain";
    } else if (confidence > 0.5) {
      isNewLetter = true;
      finalConfidence = confidence > 0.75 ? "certain" : "uncertain";
    }

    if (isNewLetter) {
      // Brief endet, neuer beginnt
      splits.push({
        letterIndex: splits.length,
        startPage: currentLetterStart + 1,
        endPage: i,
        pages: pages.slice(currentLetterStart, i),
        confidence: currentLetterConfidence,
        reason: `${splits.length} Brief${splits.length > 1 ? "e" : ""} erkannt`,
      });

      if (finalConfidence === "uncertain") {
        reviewNeeded.push({
          between: [i, i + 1],
          message: `Seite ${i} und ${i + 1}: Gehören diese zusammen oder nicht? ${reasons.join(" | ")}`,
        });
      }

      currentLetterStart = i;
      currentLetterConfidence = finalConfidence;
    }
  }

  // Letzter Brief
  if (currentLetterStart < pages.length) {
    splits.push({
      letterIndex: splits.length,
      startPage: currentLetterStart + 1,
      endPage: pages.length,
      pages: pages.slice(currentLetterStart),
      confidence: currentLetterConfidence,
      reason: `${splits.length} Brief${splits.length > 1 ? "e" : ""} gesamt`,
    });
  }

  return { splits, reviewNeeded };
}

/**
 * Kombiniert die Seiten eines Briefes zurück zu einem kontinuierlichen Text.
 * (Für die Parsing-Pipeline: Jede Split-Gruppe geht dann durch parseLetter.)
 */
export function combineLetterPages(pages: PageText[]): string {
  return pages.map((p) => p.text).join("\n\n");
}
