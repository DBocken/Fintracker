import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
  describe("animateOnMount (WP-6.9)", () => {
    it("sollte standardmaessig beim ersten Rendern bei 0 beginnen", () => {
      // Bisheriges Verhalten, auf das Budget-Tank und Health-Score bauen.
      const { result } = renderHook(() => useAnimatedNumber(500));
      expect(result.current).toBe(0);
    });

    it("sollte mit animateOnMount=false sofort den Zielwert zeigen", () => {
      // Fuer Kennzahlen, die nur BEI EINER AENDERUNG zaehlen sollen: der
      // Aufbau ist dort schon anderweitig erzaehlt (die Charts daneben bauen
      // sich ohnehin auf), ein zweiter Zaehler waere Doppelung.
      const { result } = renderHook(() => useAnimatedNumber(500, { animateOnMount: false }));
      expect(result.current).toBe(500);
    });

    it("sollte mit animateOnMount=false bei einer Aenderung trotzdem zaehlen", () => {
      // Gegenprobe: ohne sie waere "false" von "Animation ganz aus" nicht zu
      // unterscheiden — und WP-6.9 haette gar nichts bewirkt.
      let now = 1000;
      const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
      const rafSpy = vi
        .spyOn(globalThis, "requestAnimationFrame")
        .mockImplementation(() => 0);
      try {
        const { result, rerender } = renderHook(
          ({ target }) => useAnimatedNumber(target, { animateOnMount: false }),
          { initialProps: { target: 500 } },
        );
        expect(result.current).toBe(500);

        rerender({ target: 900 });
        // Der Tween laeuft (rAF ist gestubbt und liefert keinen Frame), der
        // Wert steht also noch auf dem Ausgangspunkt statt auf dem Ziel.
        expect(result.current).toBe(500);
        expect(rafSpy).toHaveBeenCalled();
      } finally {
        rafSpy.mockRestore();
        nowSpy.mockRestore();
      }
    });

    it("sollte animateOnMount=false bei reduced-motion nicht widersprechen", () => {
      reduceMock.mockReturnValue(true);
      const { result } = renderHook(() => useAnimatedNumber(500, { animateOnMount: false }));
      expect(result.current).toBe(500);
    });
  });


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

  describe("Zieländerung während laufender Animation", () => {
    it("sollte bei neuem Ziel vom zuletzt sichtbaren Zwischenwert weiterlaufen (kein Reset auf 0)", () => {
      let now = 1000;
      let pendingCb: FrameRequestCallback | null = null;
      const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
      const rafSpy = vi
        .spyOn(globalThis, "requestAnimationFrame")
        .mockImplementation((cb: FrameRequestCallback) => {
          pendingCb = cb;
          return 0;
        });
      try {
        const { result, rerender } = renderHook(
          ({ target }) => useAnimatedNumber(target, { durationMs: 100 }),
          { initialProps: { target: 100 } },
        );

        // Erster Frame: 50 % der Strecke zum ursprünglichen Ziel (100).
        now += 50;
        act(() => pendingCb!(now));
        const midValue = result.current;
        expect(midValue).toBeGreaterThan(0);
        expect(midValue).toBeLessThan(100);

        // Ziel ändert sich, BEVOR die erste Animation fertig ist.
        rerender({ target: 50 });
        // Direkt nach dem Rerender (vor dem ersten neuen Frame) bleibt der
        // zuletzt sichtbare Wert stehen — kein Sprung zurück auf 0.
        expect(result.current).toBe(midValue);

        // Erster Frame der neuen Tween-Phase: bewegt sich nur leicht in
        // Richtung 50, statt von 0 aus neu zu starten.
        now += 1;
        act(() => pendingCb!(now));
        const afterRetarget = result.current;
        expect(afterRetarget).not.toBe(0);
        expect(Math.abs(afterRetarget - midValue)).toBeLessThan(Math.abs(50 - midValue));
      } finally {
        rafSpy.mockRestore();
        nowSpy.mockRestore();
      }
    });
  });

  describe("Cleanup", () => {
    it("sollte requestAnimationFrame beim Unmount abbrechen (cancelAnimationFrame)", () => {
      const rafSpy = vi
        .spyOn(globalThis, "requestAnimationFrame")
        .mockImplementation(() => 42);
      const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
      try {
        const { unmount } = renderHook(() => useAnimatedNumber(80));
        unmount();
        expect(cafSpy).toHaveBeenCalledWith(42);
      } finally {
        rafSpy.mockRestore();
        cafSpy.mockRestore();
      }
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
