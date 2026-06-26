import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
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
    // rAF/performance.now deterministisch stubben statt auf echte Frames zu
    // warten — sonst feuert rAF in headless-CI throttled und der finale Frame
    // (Snap auf exakt das Ziel) kommt gelegentlich nicht im waitFor-Fenster.
    it("sollte am Ende exakt den Zielwert erreichen", () => {
      let now = 1000;
      const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
      const rafSpy = vi
        .spyOn(globalThis, "requestAnimationFrame")
        .mockImplementation((cb: FrameRequestCallback) => {
          now += 10_000; // weit hinter durationMs → p>=1 im ersten Frame
          cb(now);
          return 0;
        });
      try {
        const { result } = renderHook(() => useAnimatedNumber(80, { durationMs: 50 }));
        expect(result.current).toBe(80);
      } finally {
        rafSpy.mockRestore();
        nowSpy.mockRestore();
      }
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
