import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LayoutModeProvider, { useLayoutMode } from "@/components/providers/LayoutModeProvider";

// Capacitor-Plattform steuerbar mocken (Default: Web).
const capacitor = vi.hoisted(() => ({ isNative: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => capacitor.isNative },
}));

function setViewport(maxWidthMatches: boolean) {
  // matchMedia so mocken, dass der LayoutMode-Query (max-width: 1023px) das
  // gewünschte Ergebnis liefert.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: maxWidthMatches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function Probe() {
  const { mode } = useLayoutMode();
  return <div data-testid="mode">{mode}</div>;
}

function renderAt(url: string) {
  window.history.replaceState({}, "", url);
  return render(
    <LayoutModeProvider>
      <Probe />
    </LayoutModeProvider>,
  );
}

describe("LayoutModeProvider", () => {
  beforeEach(() => {
    capacitor.isNative = false;
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Viewport-Auflösung", () => {
    it("sollte bei schmalem Viewport (≤1023px) mobile liefern", () => {
      setViewport(true);
      renderAt("/coach");
      expect(screen.getByTestId("mode")).toHaveTextContent("mobile");
    });

    it("sollte bei breitem Viewport (>1023px) desktop liefern", () => {
      setViewport(false);
      renderAt("/coach");
      expect(screen.getByTestId("mode")).toHaveTextContent("desktop");
    });
  });

  describe("Override gewinnt", () => {
    it("sollte ?layout=desktop trotz schmalem Viewport respektieren", () => {
      setViewport(true); // Viewport wäre mobile …
      renderAt("/coach?layout=desktop"); // … Override erzwingt desktop
      expect(screen.getByTestId("mode")).toHaveTextContent("desktop");
    });

    it("sollte ?layout=mobile trotz breitem Viewport respektieren", () => {
      setViewport(false);
      renderAt("/coach?layout=mobile");
      expect(screen.getByTestId("mode")).toHaveTextContent("mobile");
    });
  });

  describe("Capacitor-Plattform", () => {
    it("sollte auf nativer Plattform mobile liefern (auch bei breitem Viewport)", () => {
      setViewport(false);
      capacitor.isNative = true;
      renderAt("/coach");
      expect(screen.getByTestId("mode")).toHaveTextContent("mobile");
    });
  });
});
