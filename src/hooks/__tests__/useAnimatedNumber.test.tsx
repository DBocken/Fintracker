import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAnimatedNumber } from "../useAnimatedNumber";

// Reduced-Motion-Status pro Test steuerbar machen.
const reduceMock = vi.fn(() => false);
vi.mock("../useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => {
  reduceMock.mockReturnValue(false);
});

describe("useAnimatedNumber", () => {
  describe("Normal Behavior", () => {
    it("sollte am Ende exakt den Zielwert erreichen", async () => {
      const { result } = renderHook(() => useAnimatedNumber(80, { durationMs: 50 }));
      await waitFor(() => expect(result.current).toBe(80));
    });

    it("sollte unterhalb des Ziels starten (nicht sofort springen)", () => {
      const { result } = renderHook(() => useAnimatedNumber(80));
      expect(result.current).toBeLessThan(80);
    });
  });

  describe("Edge Cases", () => {
    it("sollte bei enabled=false sofort den Zielwert liefern", () => {
      const { result } = renderHook(() => useAnimatedNumber(80, { enabled: false }));
      expect(result.current).toBe(80);
    });

    it("sollte NaN auf 0 abbilden", () => {
      const { result } = renderHook(() => useAnimatedNumber(Number.NaN, { enabled: false }));
      expect(result.current).toBe(0);
    });
  });

  describe("Reduced Motion", () => {
    it("sollte bei prefers-reduced-motion sofort und ohne Animation das Ziel zeigen", () => {
      reduceMock.mockReturnValue(true);
      const { result } = renderHook(() => useAnimatedNumber(80));
      expect(result.current).toBe(80);
    });
  });
});
