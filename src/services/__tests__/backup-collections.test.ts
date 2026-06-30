import { describe, it, expect } from "vitest";
import { snapshotLocalCollections, restoreLocalCollections } from "../backup-service";
import { writeLocalFinanceList, readLocalFinanceList } from "../local-finance-store";

describe("backup: vollständige Collections", () => {
  it("sollte übrige Collections snapshotten und nach Datenverlust nicht-destruktiv wiederherstellen", async () => {
    await writeLocalFinanceList("debts", [{ id: "d1", name: "Karte" }]);
    await writeLocalFinanceList("budgets", [{ id: "b1", limit: 100 }]);
    await writeLocalFinanceList("milestones", [{ id: "m1", title: "Notgroschen" }]);

    const snap = await snapshotLocalCollections();
    expect(snap.debts).toHaveLength(1);
    expect(snap.budgets).toHaveLength(1);
    expect(snap.milestones).toHaveLength(1);
    // Typisierte Keys werden NICHT zusätzlich generisch gesichert.
    expect(snap.transactions).toBeUndefined();
    expect(snap.accounts).toBeUndefined();

    // Datenverlust simulieren.
    await writeLocalFinanceList("debts", []);
    await writeLocalFinanceList("budgets", []);
    await writeLocalFinanceList("milestones", []);

    const restored = await restoreLocalCollections(snap);
    expect(restored.debts).toBe(1);
    expect(restored.budgets).toBe(1);
    expect(await readLocalFinanceList("debts")).toEqual([{ id: "d1", name: "Karte" }]);
    expect(await readLocalFinanceList("milestones")).toEqual([{ id: "m1", title: "Notgroschen" }]);
  });

  it("sollte bestehende (nicht-leere) Collections NICHT überschreiben", async () => {
    await writeLocalFinanceList("debts", [{ id: "existing", name: "Aktuell" }]);

    const restored = await restoreLocalCollections({ debts: [{ id: "d1", name: "Backup" }] });

    expect(restored.debts).toBeUndefined(); // übersprungen → kein Datenverlust
    expect(await readLocalFinanceList("debts")).toEqual([{ id: "existing", name: "Aktuell" }]);
  });

  it("[Edge] sollte unbekannte/leere Keys ignorieren", async () => {
    const restored = await restoreLocalCollections({
      nichtExistent: [{ id: "x" }],
      budgets: [],
    } as Record<string, unknown[]>);
    expect(Object.keys(restored)).toHaveLength(0);
  });

  it("[Edge] sollte mit undefined umgehen (Backup vor v1.1)", async () => {
    const restored = await restoreLocalCollections(undefined);
    expect(restored).toEqual({});
  });
});
