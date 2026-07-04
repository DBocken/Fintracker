import { describe, it, expect, beforeEach } from "vitest";
import { localEncryption } from "../local-crypto";
import {
  deleteMerchantRule,
  getMerchantRules,
  upsertMerchantRule,
} from "../merchant-rules-service";
import { getAuditLogEntries } from "../audit-log-service";

describe("merchant-rules-service (gelernte Händler-Zuordnungen)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  describe("Normal Behavior", () => {
    it("sollte eine neue Regel mit getrimmtem Pattern anlegen", async () => {
      await upsertMerchantRule("  REWE Markt  ", "cat-lebensmittel");

      const rules = await getMerchantRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].merchant_pattern).toBe("REWE Markt");
      expect(rules[0].category_id).toBe("cat-lebensmittel");
      expect(rules[0].user_id).toBe("local");
      expect(rules[0].id).toBeTruthy();
      expect(rules[0].created_at).toBeTruthy();
    });

    it("sollte bei gleichem Pattern die bestehende Regel aktualisieren statt zu duplizieren", async () => {
      await upsertMerchantRule("REWE Markt", "cat-alt");
      await upsertMerchantRule("REWE Markt", "cat-neu");

      const rules = await getMerchantRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].category_id).toBe("cat-neu");
    });

    it("sollte beim Anlegen einen reversiblen Audit-Eintrag (create) schreiben", async () => {
      await upsertMerchantRule("Netflix", "cat-abo");

      const [rule] = await getMerchantRules();
      const entries = await getAuditLogEntries({ entityType: "merchant_rule" });
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe("create");
      expect(entries[0].entityId).toBe(rule.id);
      expect(entries[0].reversible).toBe(true);
      expect(entries[0].reversal).toEqual({
        operation: "update",
        targetCollection: "merchantRules",
        targetId: rule.id,
      });
      expect(entries[0].redactedAfter).toMatchObject({
        merchant_pattern: "Netflix",
        category_id: "cat-abo",
      });
    });

    it("sollte beim Aktualisieren einen Audit-Eintrag (update) mit altem Zustand schreiben", async () => {
      await upsertMerchantRule("Netflix", "cat-alt");
      await upsertMerchantRule("Netflix", "cat-neu");

      const entries = await getAuditLogEntries({ entityType: "merchant_rule" });
      const update = entries.find((e) => e.action === "update");
      expect(update).toBeDefined();
      expect(update?.redactedBefore).toMatchObject({ category_id: "cat-alt" });
      expect(update?.redactedAfter).toMatchObject({ category_id: "cat-neu" });
    });

    it("sollte nur die Ziel-Regel löschen und andere behalten", async () => {
      await upsertMerchantRule("REWE", "cat-a");
      await upsertMerchantRule("Netflix", "cat-b");
      const target = (await getMerchantRules()).find((r) => r.merchant_pattern === "REWE")!;

      await deleteMerchantRule(target.id);

      const rules = await getMerchantRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].merchant_pattern).toBe("Netflix");
    });

    it("sollte beim Löschen Reversal-Metadaten (restore) im Audit hinterlegen", async () => {
      await upsertMerchantRule("REWE", "cat-a");
      const [rule] = await getMerchantRules();

      await deleteMerchantRule(rule.id);

      const entries = await getAuditLogEntries({ entityType: "merchant_rule", entityId: rule.id });
      const del = entries.find((e) => e.action === "delete");
      expect(del).toBeDefined();
      expect(del?.title).toContain("REWE");
      expect(del?.reversible).toBe(true);
      expect(del?.reversal).toEqual({
        operation: "restore",
        targetCollection: "merchantRules",
        targetId: rule.id,
      });
      expect(del?.redactedBefore).toMatchObject({ merchant_pattern: "REWE", category_id: "cat-a" });
      expect(del?.redactedAfter).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne gespeicherte Regeln eine leere Liste liefern", async () => {
      expect(await getMerchantRules()).toEqual([]);
    });

    it("sollte bei leerem oder Whitespace-Pattern weder Regel noch Audit-Eintrag anlegen", async () => {
      await upsertMerchantRule("", "cat-x");
      await upsertMerchantRule("   ", "cat-x");

      expect(await getMerchantRules()).toEqual([]);
      expect(await getAuditLogEntries({ entityType: "merchant_rule" })).toEqual([]);
    });

    it("sollte beim Löschen einer unbekannten ID nicht werfen und generisch protokollieren", async () => {
      await expect(deleteMerchantRule("gibt-es-nicht")).resolves.toBeUndefined();

      const entries = await getAuditLogEntries({ entityType: "merchant_rule" });
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Händlerregel gelöscht");
      expect(entries[0].redactedBefore).toBeNull();
    });
  });
});
