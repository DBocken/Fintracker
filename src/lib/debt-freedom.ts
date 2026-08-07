/**
 * WP-7.4 — Signature Moment „Schuldenfrei".
 *
 * Die eigentliche Frage dieses Arbeitspakets ist keine gestalterische, sondern
 * eine fachliche: **Woher weiß die App, dass jemand gerade eben schuldenfrei
 * geworden ist?** „Schuldensumme ist null" reicht nicht — das trifft auch auf
 * jeden zu, der nie Schulden erfasst hat, und dem einen Erfolgsmoment
 * hinzuwerfen wäre albern bis verletzend.
 *
 * Es braucht also ein Gedächtnis: Gab es je Schulden? Wurde der Moment schon
 * gefeiert? Genau das steht hier — rein, ohne Speicher und ohne React, damit
 * die Regeln ohne Persistenz prüfbar sind. Wo der Zustand liegt, entscheidet
 * die Aufrufstelle.
 *
 * Bewusst gefeiert wird **einmal je Schuldenfreiheit**, nicht einmal im Leben:
 * Wer Schulden abbaut, neue aufnimmt und sie wieder abbaut, hat das zweite Mal
 * genauso verdient wie das erste.
 */

/** Was sich die App über den Schuldenverlauf merkt. */
export type DebtFreedomMemory = {
  /** Ob je eine Schuld erfasst war. Ohne das ist „schuldenfrei" keine Leistung. */
  everHadDebt: boolean;
  /** Ob der aktuelle schuldenfreie Zustand bereits gefeiert wurde. */
  celebrated: boolean;
};

export const INITIAL_DEBT_FREEDOM_MEMORY: DebtFreedomMemory = {
  everHadDebt: false,
  celebrated: false,
};

export type DebtFreedomResult = {
  /** Ob gerade keine Schulden bestehen UND je welche bestanden. */
  isDebtFree: boolean;
  /** Ob JETZT gefeiert werden soll — genau einmal je Schuldenfreiheit. */
  shouldCelebrate: boolean;
  /** Der fortzuschreibende Zustand. */
  memory: DebtFreedomMemory;
};

/**
 * Wertet die aktuelle Schuldensumme gegen das Gedächtnis aus.
 *
 * `totalDebt` ist der Betrag in der Einheit, in der ihn die Aufrufstelle führt
 * (Cent oder Euro) — die Funktion vergleicht nur gegen null und ist deshalb
 * einheitenfrei. Negative Werte (Überzahlung) gelten als schuldenfrei.
 */
export function evaluateDebtFreedom(
  totalDebt: number,
  memory: DebtFreedomMemory = INITIAL_DEBT_FREEDOM_MEMORY
): DebtFreedomResult {
  // Nicht-endliche Werte kommen aus fehlgeschlagenen Rechnungen. Sie als
  // „null Schulden" zu lesen hiesse, einen Erfolg zu feiern, der aus einem
  // Fehler entsteht.
  if (!Number.isFinite(totalDebt)) {
    return { isDebtFree: false, shouldCelebrate: false, memory };
  }

  if (totalDebt > 0) {
    // Schulden bestehen: merken, dass es sie gab, und die Feier für das
    // nächste Erreichen wieder freigeben.
    return {
      isDebtFree: false,
      shouldCelebrate: false,
      memory: { everHadDebt: true, celebrated: false },
    };
  }

  if (!memory.everHadDebt) {
    // Nie Schulden gehabt — kein Erfolg, nur ein Ausgangszustand.
    return { isDebtFree: false, shouldCelebrate: false, memory };
  }

  return {
    isDebtFree: true,
    shouldCelebrate: !memory.celebrated,
    memory: { everHadDebt: true, celebrated: true },
  };
}
