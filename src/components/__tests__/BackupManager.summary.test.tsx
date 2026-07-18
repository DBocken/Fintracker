import { describe, expect, it } from "vitest";
import { formatRestoreDetailsSummary } from "../BackupManager";

describe("BackupManager Restore-Zusammenfassung", () => {
  it("[INTEGRITY] sollte Merge-Zähler verständlich formatieren", () => {
    const translations: Record<string, string> = {
      "backup.restoreSummary": "Neu ergänzt: {transactions} Transaktionen, {categories} Kategorien, {accounts} Konten und {collections} weitere Einträge.",
    };

    expect(formatRestoreDetailsSummary({
      transactions: 2,
      categories: 1,
      accounts: 0,
      settings: true,
      collections: 3,
    }, (key) => translations[key] ?? key)).toBe("Neu ergänzt: 2 Transaktionen, 1 Kategorien, 0 Konten und 3 weitere Einträge.");
  });
});
