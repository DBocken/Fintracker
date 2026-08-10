/**
 * In-Memory-Bericht über beim letzten Lesen verworfene Items (WP 1.2,
 * RES-2/DOM-2, Teil A). `readLocalFinanceList` (`local-finance-store.ts`)
 * und `TransactionStorageService.getLocalTransactions`
 * (`transaction-storage-service.ts`) rufen `recordSkipped` je Collection
 * NACH jedem Lesen auf — ein einzelner kaputter Datensatz wird übersprungen,
 * gezählt und hier festgehalten, statt still zu verschwinden oder die ganze
 * Liste zu verwerfen (Vorentschieden #3).
 *
 * Reines In-Memory-Modul, KEINE Persistenz — der Bericht spiegelt nur den
 * letzten Lesevorgang der laufenden Session; er wird bei jedem erneuten
 * Lesen für die betroffene Collection überschrieben, nicht aufsummiert.
 *
 * Die UI dazu (Anzeige, „Backup prüfen") ist NICHT Teil dieses Pakets
 * (Teil B) — dieses Modul liefert nur die Datengrundlage.
 */

export interface IntegrityReportEntry {
  /** Collection-Schlüssel (z. B. `'transactions'`, `'debts'`). */
  key: string;
  /** Anzahl der beim letzten Lesen übersprungenen Items dieser Collection. */
  skipped: number;
}

const skippedByKey = new Map<string, number>();

/**
 * Setzt den Übersprungen-Zähler einer Collection für den LETZTEN Lesevorgang
 * (keine Akkumulation über mehrere Reads hinweg). `count === 0` löscht einen
 * vorherigen Eintrag, damit ein reparierter Bestand nicht dauerhaft als
 * fehlerhaft gemeldet bleibt.
 */
export function recordSkipped(key: string, count: number): void {
  if (count > 0) {
    skippedByKey.set(key, count);
  } else {
    skippedByKey.delete(key);
  }
}

/** Liefert den aktuellen Bericht — nur Collections mit `skipped > 0`. */
export function getIntegrityReport(): IntegrityReportEntry[] {
  return Array.from(skippedByKey.entries()).map(([key, skipped]) => ({ key, skipped }));
}

/** Setzt den gesamten Bericht zurück (z. B. für Tests). */
export function clearIntegrityReport(): void {
  skippedByKey.clear();
}
