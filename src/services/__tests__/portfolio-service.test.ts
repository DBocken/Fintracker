import { describe, it, expect } from "vitest";
import {
  createPortfolio,
  createPosition,
  getPositions,
  updatePosition,
  deletePosition,
  updatePositionPrice,
  getPortfolioSummary,
  initializeDemoPortfolio,
} from "../portfolio-service";
import { toMinor } from "@/lib/money";

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

  it("[Edge] sollte für ein leeres Portfolio (keine Positionen) alles auf 0 setzen", async () => {
    const p = await seedPortfolio();
    const summary = await getPortfolioSummary(p.id);
    expect(summary).toMatchObject({
      total_value: 0,
      total_cost: 0,
      unrealized_gain_loss: 0,
      unrealized_gain_loss_percent: 0,
      positions_count: 0,
    });
  });

  it("[REGRESSION] sollte bei fehlendem Kurs (last_price nie gesetzt) auf den Einstiegskurs zurückfallen", async () => {
    const p = await seedPortfolio();
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 10, entry_price: 150 });
    const summary = await getPortfolioSummary(p.id);
    // Ohne last_price (undefined) ist der Einstiegskurs die einzig sinnvolle Annäherung.
    expect(summary.total_value).toBe(1500);
  });

  it("[Edge] dokumentiert aktuelles Verhalten bei last_price === 0: fällt auf entry_price zurück statt 0 zu zeigen", async () => {
    const p = await seedPortfolio();
    const pos = await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 10, entry_price: 150 });
    await updatePositionPrice(pos.id, 0);
    const summary = await getPortfolioSummary(p.id);
    // `position.last_price || position.entry_price` behandelt einen echten
    // Kurs von 0 (z.B. wertlose/delistete Position) wie "kein Kurs geladen"
    // und zeigt den Einstiegskurs statt 0 — dieselbe Falsy-Falle existiert
    // konsistent auch in position-metrics.ts und PositionTable.tsx. Dieser
    // Test dokumentiert das aktuelle (fragwürdige) Verhalten bewusst, statt
    // es hier isoliert zu "reparieren" und die drei Stellen auseinanderlaufen
    // zu lassen — eine echte Korrektur müsste alle drei gemeinsam ändern.
    expect(summary.total_value).toBe(1500);
  });
});

/**
 * VE-1 (`docs/architecture/currency-eur-only.md`): Fintracker rechnet nicht um.
 * Eine Position in einer anderen Währung als der Depotwährung darf deshalb NIE
 * in den Gesamtwert einfließen — sie wird sichtbar als „nicht verrechnet"
 * ausgewiesen. Bis WP 7.7 summierte `getPortfolioSummary` USD 1:1 zu EUR.
 */
describe("getPortfolioSummary — Fremdwährung wird nicht verrechnet (VE-1)", () => {
  it("[REGRESSION] sollte eine USD-Position nicht in den EUR-Gesamtwert summieren, sondern ausweisen", async () => {
    const p = await seedPortfolio(); // Depotwährung EUR
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 178.5, currency: "USD" });

    const summary = await getPortfolioSummary(p.id);

    expect(toMinor(summary.total_value)).toBe(toMinor(1000));
    expect(toMinor(summary.total_cost)).toBe(toMinor(1000));
    // Die Position verschwindet nicht — sie wird nur nicht verrechnet.
    expect(summary.positions_count).toBe(2);
    expect(summary.unconverted_positions).toHaveLength(1);
    expect(summary.unconverted_positions[0]).toMatchObject({ symbol: "AAPL", currency: "USD" });
    expect(toMinor(summary.unconverted_positions[0].value)).toBe(toMinor(892.5));
  });

  it("sollte ohne Fremdwährung eine leere Liste liefern", async () => {
    const p = await seedPortfolio();
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });

    const summary = await getPortfolioSummary(p.id);

    expect(toMinor(summary.total_value)).toBe(toMinor(1000));
    expect(summary.unconverted_positions).toEqual([]);
  });

  it("sollte im USD-Depot die USD-Positionen verrechnen und die EUR-Position ausweisen", async () => {
    // Spiegelfall: eToro führt Depots in USD. Innerhalb des Depots ist USD die
    // Rechenwährung — dann ist die EUR-Position die nicht verrechnete.
    const p = await createPortfolio({ name: "eToro", currency: "USD", type: "manual" });
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 178.5, currency: "USD" });
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });

    const summary = await getPortfolioSummary(p.id);

    expect(summary.currency).toBe("USD");
    expect(toMinor(summary.total_value)).toBe(toMinor(892.5));
    expect(summary.unconverted_positions).toHaveLength(1);
    expect(summary.unconverted_positions[0]).toMatchObject({ symbol: "SAP", currency: "EUR" });
  });

  it("sollte den aktuellen Kurs verwenden, wenn eine Fremdwährungsposition bepreist ist", async () => {
    const p = await seedPortfolio();
    const pos = await createPosition({
      portfolio_id: p.id,
      symbol: "MSFT",
      quantity: 8,
      entry_price: 375.2,
      currency: "USD",
    });
    await updatePositionPrice(pos.id, 400);

    const summary = await getPortfolioSummary(p.id);

    expect(toMinor(summary.total_value)).toBe(0);
    expect(toMinor(summary.unconverted_positions[0].value)).toBe(toMinor(3200));
  });

  it("sollte das Demo-Depot ehrlich ausweisen: die zwei USD-Titel zählen nicht mit", async () => {
    // Bewusst beibehalten (WP 7.7): Das Demo-Depot zeigt den Hinweis im
    // Auslieferungszustand, statt die Fremdwährung wegzudefinieren.
    const demo = await initializeDemoPortfolio();
    const summary = await getPortfolioSummary(demo.id);

    // SAP 10×145,50 + VOW3 20×92,80 + World 15×68,40 = 1.455 + 1.856 + 1.026 = 4.337,00 €
    expect(toMinor(summary.total_value)).toBe(toMinor(4337));
    expect(summary.unconverted_positions.map((position) => position.symbol).sort()).toEqual(["AAPL", "MSFT"]);
  });
});
