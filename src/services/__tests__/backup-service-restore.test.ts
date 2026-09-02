import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, Category, Transaction } from "../../types";
import { backupService, type BackupData } from "../backup-service";
import { getAccounts } from "../account-service";
import { clearLocalKvStore } from "../idb-kv";
import { getLocalCategories } from "../local-settings-service";
import { localEncryption } from "../local-crypto";
import { readLocalFinanceList } from "../local-finance-store";
import { getAllTransactions, getUserSettings } from "../transaction-service";

vi.mock("../auth-service", () => ({
  getCurrentUserId: vi.fn(async () => "user-1"),
  requireUserId: vi.fn(async () => "user-1"),
}));

describe("backupService.restoreBackup", () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
    await clearLocalKvStore();
  });

  async function createBackupData(): Promise<BackupData> {
    const category: Category = {
      id: "cat-backup-1",
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
      id: "account-backup-1",
      user_id: "user-1",
      name: "Giro Backup",
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
      id: "tx-backup-1",
      account_id: account.id,
      category_id: category.id,
      date: "2026-01-15",
      amount: -12.34,
      payee: "REWE",
      description: "Wocheneinkauf",
    } as Transaction;

    return {
      version: "1.1.0",
      timestamp: "2026-01-18T00:00:00.000Z",
      userId: "user-1",
      data: {
        transactions: [transaction],
        categories: [category],
        accounts: [account],
        settings: await getUserSettings(),
      },
      collections: {
        debts: [{ id: "debt-backup-1", name: "Privatdarlehen" }],
        budgets: [{ id: "budget-backup-1", name: "Haushalt", limit: 25000 }],
      },
    };
  }

  it("[INTEGRITY] sollte vollständige Backups Ende-zu-Ende idempotent wiederherstellen", async () => {
    const backup = await createBackupData();

    const first = await backupService.restoreBackup(backup);
    const second = await backupService.restoreBackup(backup);

    expect(first.details).toMatchObject({
      transactions: 1,
      categories: 1,
      accounts: 1,
      settings: true,
      collections: 2,
    });
    expect(second.details).toMatchObject({
      transactions: 0,
      categories: 0,
      accounts: 0,
      settings: true,
      collections: 0,
    });

    expect((await getAllTransactions()).filter((tx) => tx.id === "tx-backup-1")).toHaveLength(1);
    expect((await getLocalCategories()).filter((category) => category.id === "cat-backup-1")).toHaveLength(1);
    expect((await getAccounts()).filter((account) => account.id === "account-backup-1")).toHaveLength(1);
    expect(await readLocalFinanceList("debts")).toEqual([{ id: "debt-backup-1", name: "Privatdarlehen" }]);
    expect(await readLocalFinanceList("budgets")).toEqual([{ id: "budget-backup-1", name: "Haushalt", limit: 25000 }]);
  });

  it("[PRIVACY] sollte Fremd-Backups ohne explizite Freigabe unverändert als FOREIGN_BACKUP melden", async () => {
    const backup = { ...(await createBackupData()), userId: "user-2" };

    await expect(backupService.restoreBackup(backup)).rejects.toThrow("FOREIGN_BACKUP");
  });
});
