import { describe, it, expect, beforeEach } from "vitest";
import type { Category, Transaction } from "../../types";
import { localEncryption } from "../local-crypto";
import { restoreLocalCategories, getLocalCategories } from "../local-settings-service";
import { saveTransactions, getTransactions } from "../transaction-service";

/**
 * T1.4 / F-BACKUP-1: Restore ist idempotenter Merge per ID. Ein Restore auf
 * bestehende Daten darf nichts verdoppeln, und Original-IDs müssen erhalten
 * bleiben, damit wiederhergestellte Transaktionen gültige Kategorie-Bezüge haben.
 */
describe("[INTEGRITY] Backup-Restore ist idempotent (T1.4)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("restoreLocalCategories behält Original-IDs und dupliziert bei erneutem Restore nicht", async () => {
    const cats: Category[] = [
      { id: "cat-backup-1", user_id: "u", name: "Sonderkategorie", color: "#111", icon: "🎯", filters: [], is_default: false, parent_id: null, attributes: {} },
    ];

    const first = await restoreLocalCategories(cats);
    expect(first).toBe(1);

    // Zweiter Restore derselben Kategorie fügt nichts hinzu (idempotent).
    const second = await restoreLocalCategories(cats);
    expect(second).toBe(0);

    const stored = await getLocalCategories();
    const restored = stored.filter((c) => c.id === "cat-backup-1");
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe("Sonderkategorie");
  });

  it("saveTransactions behält die Backup-ID und verdoppelt bei erneutem Restore nicht", async () => {
    const tx: Transaction = { id: "tx-backup-1", account_id: "a1", date: "2026-01-15", amount: -12.34, payee: "REWE", description: "" } as Transaction;

    await saveTransactions([tx]);
    // Simuliert ein zweites Restore desselben Backups.
    await saveTransactions([tx]);

    const all = await getTransactions(100);
    const matches = all.filter((t) => t.id === "tx-backup-1");
    expect(matches).toHaveLength(1);
  });
});
