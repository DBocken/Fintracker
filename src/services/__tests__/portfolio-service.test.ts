import { describe, it, expect } from "vitest";
import {
  createPortfolio,
  createPosition,
  getPositions,
  updatePosition,
  deletePosition,
  updatePositionPrice,
  getPortfolioSummary,
} from "../portfolio-service";

async function seedPortfolio() {
  return createPortfolio({ name: "Test-Depot", currency: "EUR", type: "manual" });
}

describe("portfolio-service: manuelle Positionen (#107)", () => {
  it("sollte eine Position anlegen, lesen und persistieren", async () => {
    const p = await seedPortfolio();
    const pos = await createPosition({
      portfolio_id: p.id,
      symbol: "sap",
      name: "SAP SE",
      quantity: 10,
      entry_price: 120,
      currency: "EUR",
    });
    expect(pos.symbol).toBe("SAP"); // wird groß geschrieben
    expect(pos.quantity).toBe(10);

    const list = await getPositions(p.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(pos.id);
  });

  it("sollte eine Position aktualisieren", async () => {
    const p = await seedPortfolio();
    const pos = await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 150 });
    await updatePosition(pos.id, { quantity: 8 });
    await updatePositionPrice(pos.id, 175);

    const [updated] = await getPositions(p.id);
    expect(updated.quantity).toBe(8);
    expect(updated.last_price).toBe(175);
  });

  it("sollte eine Position löschen", async () => {
    const p = await seedPortfolio();
    const pos = await createPosition({ portfolio_id: p.id, symbol: "MSFT", quantity: 3, entry_price: 300 });
    await deletePosition(pos.id);
    expect(await getPositions(p.id)).toHaveLength(0);
  });

  it("[Edge] sollte Position ohne existierendes Portfolio ablehnen", async () => {
    await expect(createPosition({ portfolio_id: "does-not-exist", symbol: "X" })).rejects.toThrow();
  });
});

describe("getPortfolioSummary — Investiert bei Hebel-Positionen", () => {
  it("sollte ohne invested_amount weiterhin Menge × Einstiegskurs verwenden", async () => {
    const p = await seedPortfolio();
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 10, entry_price: 150 });
    const summary = await getPortfolioSummary(p.id);
    expect(summary.total_cost).toBe(1500);
  });

  it("[REGRESSION] sollte bei Hebel-Positionen invested_amount statt Exposure verwenden", async () => {
    // eToro liefert bei Hebel z.B. units=0.049485, openRate=2020.78 (Exposure
    // ~100$ bei Hebel 1, aber bei Hebel 5 wäre Menge×Kurs 5x zu hoch). amount
    // trägt das tatsächlich investierte Kapital — das muss "Investiert" zeigen.
    const p = await seedPortfolio();
    await createPosition({
      portfolio_id: p.id,
      symbol: "BTC",
      quantity: 0.049485,
      entry_price: 2020.7784,
      metadata: { invested_amount: 100 },
    });
    const summary = await getPortfolioSummary(p.id);
    expect(summary.total_cost).toBe(100);
  });

  it("sollte invested_amount und Exposure-basierte Positionen im selben Portfolio korrekt mischen", async () => {
    const p = await seedPortfolio();
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 10, entry_price: 150 }); // 1500
    await createPosition({
      portfolio_id: p.id,
      symbol: "BTC",
      quantity: 0.049485,
      entry_price: 2020.7784,
      metadata: { invested_amount: 100 },
    }); // 100
    const summary = await getPortfolioSummary(p.id);
    expect(summary.total_cost).toBe(1600);
  });
});
