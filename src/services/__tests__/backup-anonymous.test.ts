import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "../../types";
import { backupService } from "../backup-service";
import { clearLocalKvStore } from "../idb-kv";
import { transactionStorage } from "../transaction-storage-service";
import { LOCAL_USER_ID } from "../local-settings-service";
import { localEncryption } from "../local-crypto";
import { getTransactions, saveTransactions } from "../transaction-service";

/**
 * WP 7.3 (TEST-6): Sicherung und Wiederherstellung OHNE Anmeldung — der
 * Normalfall dieser App (local-first, anonym gestartet, AGENTS.md §1).
 *
 * Bis WP 7.3 löste `backup-service` die Nutzer-Kennung über `requireUserId()`
 * auf, das ohne Sitzung wirft. Export, Import und selbst die Bestandsanzeige
 * ("Aktueller Datenbestand") scheiterten damit anonym mit "Nicht angemeldet";
 * im Browser nachgestellt (E2E, WP 7.3) zeigte die Karte den Lesefehler und
 * der Export lieferte keine Datei.
 *
 * Die bestehenden Backup-Tests konnten das nie sehen: Sie mocken
 * `requireUserId` auf eine feste Kennung und beschreiben damit ausschließlich
 * den angemeldeten Fall. Deshalb wird hier bewusst der ECHTE anonyme Zustand
 * nachgestellt — `getCurrentUserId` liefert `null`, wie ohne Sitzung, und
 * `requireUserId` wirft, wie es das echte Modul tut.
 */
vi.mock("../auth-service", () => ({
  getCurrentUserId: vi.fn(async () => null),
  requireUserId: vi.fn(async () => {
    throw new Error("Nicht angemeldet. Bitte zuerst einloggen.");
  }),
}));

function sampleTransaction(): Transaction {
  return {
    id: "tx-anon-1",
    account_id: "acc-anon-1",
    category_id: null,
    date: "2026-01-15",
    amount: -42.5,
    payee: "REWE",
    description: "Wocheneinkauf",
  } as Transaction;
}

describe("Backup ohne Anmeldung (local-first)", () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
    await clearLocalKvStore();
    await transactionStorage.clearLocalCache();
  });

  it("[REGRESSION] sollte anonym ein Backup erstellen statt „Nicht angemeldet\" zu werfen", async () => {
    await saveTransactions([sampleTransaction()]);

    const backup = await backupService.createBackup();

    expect(backup.userId).toBe(LOCAL_USER_ID);
    expect(backup.data.transactions.map((tx) => tx.id)).toContain("tx-anon-1");
  });

  it("[REGRESSION] sollte ein anonym erstelltes Backup anonym wiederherstellen — mit identischen Beträgen", async () => {
    await saveTransactions([sampleTransaction()]);
    const backup = await backupService.createBackup();

    // Datenverlust simulieren: der Speicher ist leer, das Backup ist alles,
    // was noch da ist. Bewusst über `clearLocalCache()` statt roh über
    // `clearLocalKvStore()` — nur der Weg über den Store räumt auch dessen
    // Chunk-Cache; roh geleert bliebe der Bestand im Speicher stehen und die
    // Wiederherstellung würde ihn danach ein zweites Mal anhängen.
    await transactionStorage.clearLocalCache();
    expect(await getTransactions(100)).toHaveLength(0);

    const result = await backupService.restoreBackup(backup);

    expect(result.success).toBe(true);
    expect(result.details.transactions).toBe(1);
    const restored = await getTransactions(100);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe("tx-anon-1");
    expect(restored[0].amount).toBe(-42.5);
    expect(restored[0].payee).toBe("REWE");
  });

  it("[PRIVACY] sollte ein Backup mit fremder Nutzer-Kennung auch anonym als FOREIGN_BACKUP melden", async () => {
    await saveTransactions([sampleTransaction()]);
    const backup = { ...(await backupService.createBackup()), userId: "fremde-konto-kennung" };

    await expect(backupService.restoreBackup(backup)).rejects.toThrow("FOREIGN_BACKUP");
  });
});
