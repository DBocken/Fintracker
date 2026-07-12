import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsWideDesktop } from "../useIsWideDesktop";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const listeners: Set<(e: MediaQueryListEvent) => void> = new Set();
      return {
        matches,
        media: query,
        addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === "change") listeners.add(listener);
        }),
        removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === "change") listeners.delete(listener);
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        // Hilfsfunktion zum Auslösen von Change-Events im Test.
        _triggerChange: (newMatches: boolean) => {
          listeners.forEach((listener) => {
            listener({ matches: newMatches } as MediaQueryListEvent);
          });
        },
      };
    },
  });
}

afterEach(() => {
  // @ts-expect-error – Test-Cleanup.
  delete window.matchMedia;
});

describe("useIsWideDesktop", () => {
  describe("Normal Behavior", () => {
    it("sollte true liefern wenn Breakpoint 1024px erreicht (lg)", () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useIsWideDesktop());
      expect(result.current).toBe(true);
    });

    it("sollte false liefern wenn Breakpoint unter 1024px bleibt", () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useIsWideDesktop());
      expect(result.current).toBe(false);
    });
  });

  describe("Responsive Behavior", () => {
    it("sollte auf Breakpoint-Wechsel von false zu true reagieren", () => {
      let currentMatches = false;
      let changeListener: ((e: MediaQueryListEvent) => void) | null = null;

      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          get matches() {
            return currentMatches;
          },
          media: query,
          addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === "change") changeListener = listener;
          }),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      });

      const { result } = renderHook(() => useIsWideDesktop());
      expect(result.current).toBe(false);

      // Simuliere Resize: 1024px erreicht.
      act(() => {
        currentMatches = true;
        changeListener?.({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current).toBe(true);
    });

    it("sollte auf Breakpoint-Wechsel von true zu false reagieren", () => {
      let currentMatches = true;
      let changeListener: ((e: MediaQueryListEvent) => void) | null = null;

      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          get matches() {
            return currentMatches;
          },
          media: query,
          addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === "change") changeListener = listener;
          }),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      });

      const { result } = renderHook(() => useIsWideDesktop());
      expect(result.current).toBe(true);

      // Simuliere Resize: unter 1024px.
      act(() => {
        currentMatches = false;
        changeListener?.({ matches: false } as MediaQueryListEvent);
      });

      expect(result.current).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne matchMedia (SSR) false liefern und nicht werfen", () => {
      // @ts-expect-error – Test-Simulation: kein matchMedia.
      delete window.matchMedia;

      expect(() => {
        const { result } = renderHook(() => useIsWideDesktop());
        expect(result.current).toBe(false);
      }).not.toThrow();
    });

    // Hinweis: der typeof-window-Guard selbst ist unter react-dom/jsdom nicht
    // renderbar (react-dom braucht window) — der matchMedia-Fall oben deckt
    // denselben Guard-Zweig ab.
  });

  describe("Cleanup", () => {
    it("sollte Event-Listener beim Unmount entfernen", () => {
      const removeListenerSpy = vi.fn();
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: removeListenerSpy,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      });

      const { unmount } = renderHook(() => useIsWideDesktop());
      unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  describe("Regression Protection", () => {
    // Der frühere Initial-State-Test hier war ein Duplikat des Happy-Path-Tests
    // oben ("sollte true liefern wenn Breakpoint 1024px erreicht"): `renderHook`
    // flusht Effects synchron, bevor `result.current` gelesen wird — ein Test,
    // der NUR danach prüft, kann einen kaputten `useState`-Initializer gar
    // nicht von einem korrekten unterscheiden (der `useEffect` würde den
    // Zustand ohnehin im selben Tick nachziehen). Entfernt statt eine
    // Schein-Absicherung zu pflegen.
    it("[REGRESSION] sollte bei mehreren Mount/Unmount-Zyklen korrekt funktionieren", () => {
      mockMatchMedia(true);
      const { unmount } = renderHook(() => useIsWideDesktop());

      expect(renderHook(() => useIsWideDesktop()).result.current).toBe(true);
      unmount();

      // Zweiter Hook-Instanz.
      const hook2 = renderHook(() => useIsWideDesktop());
      expect(hook2.result.current).toBe(true);
      hook2.unmount();
    });
  });
});
