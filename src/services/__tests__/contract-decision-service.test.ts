import { describe, it, expect, beforeEach } from "vitest";
import {
  getContractDecisions,
  getContractDecisionMap,
  upsertContractDecision,
  deleteContractDecision,
} from "../contract-decision-service";
import { writeLocalFinanceList } from "../local-finance-store";

beforeEach(async () => {
  await writeLocalFinanceList("contractDecisions", []);
});

describe("contract-decision-service (local)", () => {
  it("creates a decision keyed by fingerprint", async () => {
    await upsertContractDecision("merchant:netflix|out", { status: "active" });
    const all = await getContractDecisions();
    expect(all).toHaveLength(1);
    expect(all[0].fingerprint).toBe("merchant:netflix|out");
    expect(all[0].status).toBe("active");
  });

  it("updates an existing decision instead of duplicating", async () => {
    await upsertContractDecision("merchant:gym|out", { status: "active" });
    await upsertContractDecision("merchant:gym|out", { status: "rejected", note: "kein Vertrag" });
    const map = await getContractDecisionMap();
    expect(map.size).toBe(1);
    expect(map.get("merchant:gym|out")?.status).toBe("rejected");
    expect(map.get("merchant:gym|out")?.note).toBe("kein Vertrag");
  });

  it("deletes a decision by fingerprint", async () => {
    await upsertContractDecision("merchant:spotify|out", { status: "ended", ended_at: "2024-01-01" });
    await deleteContractDecision("merchant:spotify|out");
    expect(await getContractDecisions()).toHaveLength(0);
  });

  it("ignores empty fingerprints", async () => {
    await upsertContractDecision("  ", { status: "active" });
    expect(await getContractDecisions()).toHaveLength(0);
  });
});
