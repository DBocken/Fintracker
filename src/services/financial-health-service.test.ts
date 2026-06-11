import { describe, it, expect } from "vitest";
import { getHealthLabel } from "./financial-health-service";

describe("getHealthLabel", () => {
  it("ordnet Scores den richtigen Stufen und Tönen zu", () => {
    expect(getHealthLabel(95)).toEqual({ label: "Sehr gesund", tone: "good" });
    expect(getHealthLabel(80)).toEqual({ label: "Sehr gesund", tone: "good" });
    expect(getHealthLabel(60)).toEqual({ label: "Gesund", tone: "ok" });
    expect(getHealthLabel(40)).toEqual({ label: "Achtsam sein", tone: "warn" });
    expect(getHealthLabel(0)).toEqual({ label: "Handlungsbedarf", tone: "bad" });
  });

  it("behandelt die Schwellenwerte als untere Grenze (inklusive)", () => {
    expect(getHealthLabel(79).tone).toBe("ok");
    expect(getHealthLabel(59).tone).toBe("warn");
    expect(getHealthLabel(39).tone).toBe("bad");
  });
});
