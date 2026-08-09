/**
 * Fremdwährung im Nettovermögen (VE-1, T1.11 — WP 7.7).
 *
 * `docs/architecture/currency-eur-only.md`: Fintracker rechnet in Euro und
 * kennt keine Kursquelle. Ein Fremdwährungsbestand darf deshalb NIE stumm ins
 * Nettovermögen einfließen — er wird sichtbar als „nicht verrechnet"
 * ausgewiesen. Bis WP 7.7 übernahm `getNetWorthBreakdown` `summary.total_value`
 * unverändert, USD wie EUR.
 */
import { describe, it, expect } from "vitest";
import { toMinor } from "@/lib/money";
import { createPortfolio, createPosition } from "../portfolio-service";
import { getNetWorthBreakdown } from "../net-worth-service";

describe("getNetWorthBreakdown — Fremdwährung fließt nicht ein (VE-1)", () => {
  it("[REGRESSION] sollte die USD-Position nicht ins Nettovermögen übernehmen, sondern getrennt ausweisen", async () => {
    const p = await createPortfolio({ name: "Depot", currency: "EUR", type: "manual" });
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 178.5, currency: "USD" });

    const breakdown = await getNetWorthBreakdown();

    expect(toMinor(breakdown.investments)).toBe(toMinor(1000));
    expect(toMinor(breakdown.netWorth)).toBe(toMinor(1000));
    expect(toMinor(breakdown.portfolioSources[0].value)).toBe(toMinor(1000));
    expect(breakdown.unconvertedInvestments).toHaveLength(1);
    expect(breakdown.unconvertedInvestments[0]).toMatchObject({
      name: "Depot",
      currency: "USD",
      positionsCount: 1,
    });
    expect(toMinor(breakdown.unconvertedInvestments[0].value)).toBe(toMinor(892.5));
  });

  it("[REGRESSION] sollte ein Depot in Fremdwährung vollständig aus dem Vermögen heraushalten", async () => {
    const p = await createPortfolio({ name: "eToro", currency: "USD", type: "manual" });
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 178.5, currency: "USD" });
    await createPosition({ portfolio_id: p.id, symbol: "MSFT", quantity: 8, entry_price: 375.2, currency: "USD" });

    const breakdown = await getNetWorthBreakdown();

    expect(toMinor(breakdown.investments)).toBe(0);
    expect(breakdown.portfolioSources).toEqual([]);
    expect(breakdown.unconvertedInvestments).toHaveLength(1);
    expect(breakdown.unconvertedInvestments[0]).toMatchObject({ currency: "USD", positionsCount: 2 });
    // 5×178,50 + 8×375,20 = 892,50 + 3.001,60
    expect(toMinor(breakdown.unconvertedInvestments[0].value)).toBe(toMinor(3894.1));
  });

  it("sollte eine EUR-Position in einem USD-Depot trotzdem ins Vermögen nehmen", async () => {
    const p = await createPortfolio({ name: "Gemischt", currency: "USD", type: "manual" });
    await createPosition({ portfolio_id: p.id, symbol: "AAPL", quantity: 5, entry_price: 178.5, currency: "USD" });
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });

    const breakdown = await getNetWorthBreakdown();

    expect(toMinor(breakdown.investments)).toBe(toMinor(1000));
    expect(breakdown.portfolioSources[0]).toMatchObject({ name: "Gemischt", positionsCount: 1 });
    expect(breakdown.unconvertedInvestments).toHaveLength(1);
    expect(toMinor(breakdown.unconvertedInvestments[0].value)).toBe(toMinor(892.5));
  });

  it("sollte ohne Fremdwährung nichts auszuweisen haben", async () => {
    const p = await createPortfolio({ name: "Depot", currency: "EUR", type: "manual" });
    await createPosition({ portfolio_id: p.id, symbol: "SAP", quantity: 10, entry_price: 100, currency: "EUR" });

    const breakdown = await getNetWorthBreakdown();

    expect(toMinor(breakdown.investments)).toBe(toMinor(1000));
    expect(breakdown.unconvertedInvestments).toEqual([]);
  });
});
