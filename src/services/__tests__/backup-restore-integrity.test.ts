import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, Category, Transaction } from "../../types";
import { backupService, computeBackupChecksum, type BackupData } from "../backup-service";
import { clearLocalKvStore } from "../idb-kv";
import { localEncryption } from "../local-crypto";
import { readLocalFinanceList } from "../local-finance-store";
import { getAllTransactions, getUserSettings } from "../transaction-service";
import { clearIntegrityReport, getIntegrityReport } from "../data-integrity-report";

vi.mock("../auth-service", () => ({
  getCurrentUserId: vi.fn(async () => "user-1"),
  requireUserId: vi.fn(async () => "user-1"),
}));

/**
 * WP 1.5 (RES-5): Prüfsumme + Item-Validierung beim Restore. Ergänzt
 * `backup-service-restore.test.ts` (Idempotenz/Fremd-Backup) um die neuen
 * Pflichtfälle — bewusst eine eigene Datei, damit ein roter Lauf hier nicht
 * mit den bereits bestehenden, unveränderten Roundtrip-Tests vermischt wird.
 */
describe("backupService.restoreBackup — Prüfsumme & Item-Validierung (WP 1.5, RES-5)", () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
    await clearLocalKvStore();
    clearIntegrityReport();
  });

  const category: Category = {
    id: "cat-integrity-1",
    user_id: "user-1",
    name: "Lebensmittel",
    color: "#111111",
    icon: "shopping-cart",
    filters: [],
    is_default: false,
    parent_id: null,
    attributes: {},
  };

  const account: Account = {
    id: "account-integrity-1",
    user_id: "user-1",
    name: "Giro Integrity",
    type: "checking",
    currency: "EUR",
    description: "",
    color: "#1d5c54",
    icon: "🏦",
    is_budget_pool_member: true,
    is_business: false,
    order_index: 0,
    statement_close_day: null,
    due_day: null,
    autopay_account_id: null,
    gocardless_account_id: null,
    gocardless_requisition_id: null,
    gocardless_institution_id: null,
    gocardless_institution_name: null,
    last_sync_at: null,
    sync_enabled: false,
    bank_connection_id: null,
    opening_balance: 0,
    opening_balance_date: null,
  };

  const transaction: Transaction = {
    id: "tx-integrity-1",
    account_id: account.id,
    category_id: category.id,
    date: "2026-01-15",
    amount: -12.34,
    payee: "REWE",
    description: "Wocheneinkauf",
  } as Transaction;

  async function baseBackup(): Promise<Omit<BackupData, "checksum">> {
    return {
      version: "1.2.0",
      timestamp: "2026-01-18T00:00:00.000Z",
      userId: "user-1",
      data: {
        transactions: [transaction],
        categories: [category],
        accounts: [account],
        settings: await getUserSettings(),
      },
      collections: {
        debts: [{ id: "debt-integrity-1", name: "Privatdarlehen" }],
      },
    };
  }

  async function signedBackup(): Promise<BackupData> {
    const backup = await baseBackup();
    const value = await computeBackupChecksum({ data: backup.data, collections: backup.collections });
    return { ...backup, checksum: { algorithm: "sha256", value } };
  }

  it("[INTEGRITY] sollte eine manipulierte Datei (Prüfsumme passt nicht zum Payload) erkennen und ablehnen", async () => {
    const backup = await signedBackup();
    const tampered: BackupData = {
      ...backup,
      data: { ...backup.data, transactions: [{ ...transaction, amount: -999999 }] },
    };

    await expect(backupService.restoreBackup(tampered)).rejects.toThrow();

    // Nichts geschrieben — die Ablehnung ist alles-oder-nichts für die GANZE Datei.
    expect((await getAllTransactions()).filter((tx) => tx.id === "tx-integrity-1")).toHaveLength(0);
  });

  it("[REGRESSION] sollte ein altes Backup ohne Prüfsumme weiterhin importieren, mit Hinweis", async () => {
    const backup = await baseBackup(); // kein checksum-Feld — Format vor v1.2

    const result = await backupService.restoreBackup(backup as BackupData);

    expect(result.success).toBe(true);
    expect(result.details.transactions).toBe(1);
    expect(result.warnings.some((w) => w.length > 0)).toBe(true);
    expect((await getAllTransactions()).filter((tx) => tx.id === "tx-integrity-1")).toHaveLength(1);
  });

  it("Roundtrip: Export → Import derselben Datei ⇒ Prüfsumme passt, Daten identisch", async () => {
    const backup = await backupService.createBackup();
    // Simuliert das Schreiben/Lesen der Backup-Datei (JSON-Roundtrip).
    const roundtripped = JSON.parse(JSON.stringify(backup)) as BackupData;

    const result = await backupService.restoreBackup(roundtripped);

    expect(result.success).toBe(true);
    expect(result.details.skippedItems).toBe(0);
    // Kein "fehlende Prüfsumme"-Hinweis, weil ein frischer Export IMMER eine
    // Prüfsumme mitbringt — nur ein evtl. Minor-Versionshinweis wäre erlaubt,
    // aber `createBackup()` schreibt exakt BACKUP_VERSION, also auch das nicht.
    expect(result.warnings).toEqual([]);
  });

  it("sollte ein einzelnes ungültiges Item einer Collection überspringen, zählen und melden — Rest wird importiert", async () => {
    const backup = await baseBackup();
    backup.collections = {
      debts: [
        { id: "debt-ok-1", name: "Gültig" },
        { name: "Ohne id — verletzt das Debt-Schema" }, // kaputt: keine id
      ],
    };
    const value = await computeBackupChecksum({ data: backup.data, collections: backup.collections });
    const signed: BackupData = { ...backup, checksum: { algorithm: "sha256", value } };

    const result = await backupService.restoreBackup(signed);

    expect(result.success).toBe(true);
    expect(result.details.skippedItems).toBe(1);
    expect(result.details.collections).toBe(1);
    expect(result.warnings.some((w) => w.length > 0)).toBe(true);
    expect(await readLocalFinanceList("debts")).toEqual([{ id: "debt-ok-1", name: "Gültig" }]);

    // BEWUSST NICHT über `getIntegrityReport()` geprüft: Der Session-Bericht
    // gilt für den LETZTEN Lesevorgang einer Collection. Die Zeile darüber
    // (`readLocalFinanceList("debts")`) ist selbst so ein Lesevorgang — sie
    // liest den jetzt bereinigten Bestand (0 übersprungen, korrekt) und würde
    // jeden zuvor gesetzten Bericht sofort überschreiben. Der Restore-Befund
    // lebt deshalb ausschließlich im Rückgabewert von `restoreBackup`
    // (oben geprüft), nicht im session-weiten „letzter Lesevorgang"-Bericht.
    expect(getIntegrityReport()).toEqual([]);
  });

  it("sollte bei Minor-Versionsdifferenz mit Warnung importieren", async () => {
    const backup = await baseBackup();
    backup.version = "1.0.0"; // gleicher Major (1) wie BACKUP_VERSION (1.2.0), anderer Minor
    const value = await computeBackupChecksum({ data: backup.data, collections: backup.collections });
    const signed: BackupData = { ...backup, checksum: { algorithm: "sha256", value } };

    const result = await backupService.restoreBackup(signed);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.includes("1.0.0"))).toBe(true);
  });

  it("[REGRESSION] sollte bei Major-Versionsdifferenz wie bisher ablehnen", async () => {
    const backup = await baseBackup();
    backup.version = "2.0.0";
    const value = await computeBackupChecksum({ data: backup.data, collections: backup.collections });
    const signed: BackupData = { ...backup, checksum: { algorithm: "sha256", value } };

    await expect(backupService.restoreBackup(signed)).rejects.toThrow();
  });
});
