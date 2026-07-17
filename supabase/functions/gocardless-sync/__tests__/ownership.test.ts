import { describe, it, expect } from "vitest";
import {
  assertAccountBelongsToRequisition,
  assertRequisitionBoundToUser,
  type RequisitionOwnership,
  type SupabaseOwnershipQueryClient,
} from "../ownership";
import { parseJsonBody } from "../http";

/**
 * IDOR-Regressionstest für gocardless-sync: simuliert zwei echte Nutzer und
 * eine bank_connections-Tabelle, die (wie in Postgres per RLS) nur Zeilen des
 * anfragenden Nutzers zurückgibt. get-balances hatte früher keinen eigenen
 * Account-Check, während get-transactions einen hatte — Nutzer B konnte über
 * eine fremde account_id Salden von Nutzer A abrufen. Dieser Test ruft die
 * echten Produktivfunktionen (nicht nachgebaute Kopien) auf, damit ein
 * erneutes Verschwinden des Checks sofort auffällt.
 */

interface FakeBankConnectionRow {
  user_id: string;
  requisition_id?: string;
  reference?: string;
}

function matchesOrFilter(row: FakeBankConnectionRow, filterString: string): boolean {
  return filterString.split(",").some((clause) => {
    const match = /^([a-zA-Z_]+)\.eq\.(.+)$/.exec(clause);
    if (!match) return false;
    const [, column, value] = match;
    return (row as Record<string, string | undefined>)[column] === value;
  });
}

function createFakeSupabaseClient(rows: FakeBankConnectionRow[]): SupabaseOwnershipQueryClient {
  return {
    from(table: string) {
      if (table !== "bank_connections") {
        throw new Error(`Unerwartete Tabelle in Ownership-Check: ${table}`);
      }
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return {
                or(filterString: string) {
                  return {
                    limit(count: number) {
                      const matched = rows
                        .filter((row) => row.user_id === value)
                        .filter((row) => matchesOrFilter(row, filterString));
                      return Promise.resolve({ data: matched.slice(0, count), error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("assertRequisitionBoundToUser (IDOR-Schutz gocardless-sync)", () => {
  const userA = "user-aaaa-besitzer";
  const userB = "user-bbbb-angreifer";

  it("sollte Zugriff erlauben wenn die requisition-reference dem anfragenden Nutzer gehört", async () => {
    const requisition: RequisitionOwnership = { id: "req-1", reference: `${userA}:abc123` };
    const client = createFakeSupabaseClient([]);

    await expect(assertRequisitionBoundToUser(client, requisition, userA)).resolves.toBeUndefined();
  });

  it("sollte Zugriff erlauben wenn der Nutzer über eine verknüpfte bank_connections-Zeile Besitzer ist", async () => {
    const requisition: RequisitionOwnership = { id: "req-legacy", reference: "legacy-reference-ohne-userid" };
    const client = createFakeSupabaseClient([
      { user_id: userA, requisition_id: "req-legacy", reference: "legacy-reference-ohne-userid" },
    ]);

    await expect(assertRequisitionBoundToUser(client, requisition, userA)).resolves.toBeUndefined();
  });

  it("sollte den lookupKey (abweichende requisition_id_or_ref) zusätzlich gegen bank_connections prüfen", async () => {
    const requisition: RequisitionOwnership = { id: "req-real-id", reference: "irrelevante-reference" };
    const client = createFakeSupabaseClient([{ user_id: userA, requisition_id: "legacy-lookup-key" }]);

    await expect(
      assertRequisitionBoundToUser(client, requisition, userA, "legacy-lookup-key"),
    ).resolves.toBeUndefined();
  });

  it("[REGRESSION][SECURITY] sollte Nutzer B verweigern, über die requisition-ID von Nutzer A auf dessen Bankverbindung zuzugreifen", async () => {
    const requisitionOfUserA: RequisitionOwnership = { id: "req-owned-by-a", reference: "legacy-reference-ohne-userid" };
    const client = createFakeSupabaseClient([
      { user_id: userA, requisition_id: "req-owned-by-a", reference: "legacy-reference-ohne-userid" },
    ]);

    await expect(
      assertRequisitionBoundToUser(client, requisitionOfUserA, userB, "req-owned-by-a"),
    ).rejects.toMatchObject({ status: 404, message: "Requisition not found" });
  });

  it("[REGRESSION][SECURITY] sollte ablehnen wenn für die requisition keine Zeile des anfragenden Nutzers existiert", async () => {
    const requisition: RequisitionOwnership = { id: "req-x", reference: "ref-x" };
    // Es existiert eine Zeile — aber nur für Nutzer A, nicht für den Anfragenden (Nutzer B).
    const client = createFakeSupabaseClient([{ user_id: userA, requisition_id: "req-x", reference: "ref-x" }]);

    await expect(assertRequisitionBoundToUser(client, requisition, userB)).rejects.toMatchObject({
      status: 404,
      message: "Requisition not found",
    });
  });

  it("[SECURITY] sollte für fremde Requisitions dieselbe Antwort liefern wie für nicht existierende (kein Existenz-Orakel)", async () => {
    // Nutzer B darf aus der Antwort nicht ableiten können, ob eine geratene
    // requisition-ID existiert: fremd und nicht existent müssen identisch aussehen.
    const foreignRequisition: RequisitionOwnership = { id: "req-owned-by-a", reference: "legacy-ref" };
    const client = createFakeSupabaseClient([{ user_id: userA, requisition_id: "req-owned-by-a" }]);

    const foreignError = await assertRequisitionBoundToUser(client, foreignRequisition, userB).catch((e) => e);
    const notFoundShape = { status: 404, message: "Requisition not found" };

    expect({ status: foreignError.status, message: foreignError.message }).toEqual(notFoundShape);
  });
});

describe("parseJsonBody (gocardless-sync Request-Parsing)", () => {
  it("sollte einen gültigen JSON-Body parsen", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "get-balances", account_id: "acc-1" }),
    });

    await expect(parseJsonBody(req)).resolves.toEqual({ action: "get-balances", account_id: "acc-1" });
  });

  it("[REGRESSION] sollte bei ungültigem JSON mit 400 ablehnen statt mit 500", async () => {
    const req = new Request("http://localhost", { method: "POST", body: "das ist kein json {{{" });

    await expect(parseJsonBody(req)).rejects.toMatchObject({ status: 400 });
  });

  it("[SECURITY] sollte den Request-Body nicht in die Fehlermeldung reflektieren", async () => {
    const attackerBody = "boeser-marker-9812 {{{";
    const req = new Request("http://localhost", { method: "POST", body: attackerBody });

    const error = await parseJsonBody(req).catch((e) => e);

    expect(String(error.message)).not.toContain("boeser-marker-9812");
  });
});

describe("assertAccountBelongsToRequisition (Account-Scoping gocardless-sync)", () => {
  it("sollte eine account_id akzeptieren die zur requisition gehört", () => {
    const requisition: RequisitionOwnership = { id: "req-1", accounts: ["acc-a-1", "acc-a-2"] };

    expect(() => assertAccountBelongsToRequisition(requisition, "acc-a-1")).not.toThrow();
  });

  it("[REGRESSION][SECURITY] sollte eine fremde account_id ablehnen die nicht zur requisition des anfragenden Nutzers gehört", () => {
    // Nutzer B hat eine gültige eigene requisition, versucht aber die
    // account_id von Nutzer A (z.B. erraten oder aus einer alten Response) mitzuschicken.
    const requisitionOfUserB: RequisitionOwnership = { id: "req-b", accounts: ["acc-b-1"] };
    const accountIdOfUserA = "acc-a-1";

    expect(() => assertAccountBelongsToRequisition(requisitionOfUserB, accountIdOfUserA)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("sollte ablehnen wenn die requisition keine accounts hat", () => {
    const requisition: RequisitionOwnership = { id: "req-empty" };

    expect(() => assertAccountBelongsToRequisition(requisition, "acc-irgendwas")).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
