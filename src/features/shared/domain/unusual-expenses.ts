/**
 * Ausreißer-Erkennung über Monats-Aggregate — reine Statistik (Ebene 2,
 * AGENTS.md §3), extrahiert aus `services/cloud-mcp-sync-service.ts`, wo sie
 * als Privatfunktion neben dem Snapshot-Format lag. Zwei Nutzer, eine
 * Rechnung: der MCP-Snapshot und der Registereintrag `ausgaben.ungewoehnlich`.
 * Das Snapshot-FORMAT bleibt unangetastet (`cloud-mcp-sync-service.test.ts`
 * ist unverändert grün — der Beweis der verhaltensneutralen Extraktion).
 */

export interface MonatsPunkt {
  /** yyyy-mm */
  monat: string;
  betrag: number;
}

export interface AusreisserFund {
  schluessel: string;
  monat: string;
  betrag: number;
  median: number;
  /** Prozent über dem Median, gerundet. */
  prozent: number;
}

export function median(werte: readonly number[]): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

/**
 * Eine Monatssumme gilt als ungewöhnlich, wenn sie deutlich über dem EIGENEN
 * Median der Serie liegt: > `faktor` × Median UND mindestens `minDelta`
 * absoluter Mehraufwand. Beide Schwellen zusammen, weil jede allein Unsinn
 * meldet — 5 € über einem 3-€-Median sind +166 %, aber kein Befund; 60 € über
 * einem 4.000-€-Median sind viel Geld, aber +1,5 %.
 */
export function findeAusreisser(
  serien: ReadonlyMap<string, readonly MonatsPunkt[]>,
  { minMonate = 3, faktor = 1.5, minDelta = 50 } = {},
): AusreisserFund[] {
  const funde: AusreisserFund[] = [];
  for (const [schluessel, punkte] of serien) {
    if (punkte.length < minMonate) continue; // zu wenig Historie für eine robuste Aussage
    const med = median(punkte.map((p) => p.betrag));
    if (med <= 0) continue;
    for (const p of punkte) {
      if (p.betrag > med * faktor && p.betrag - med >= minDelta) {
        funde.push({
          schluessel,
          monat: p.monat,
          betrag: p.betrag,
          median: med,
          prozent: Math.round(((p.betrag - med) / med) * 100),
        });
      }
    }
  }
  return funde.sort((a, b) => b.betrag - a.betrag);
}
