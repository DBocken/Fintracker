import { describe, it, expect } from "vitest";
import { buildTankAnimation, BASE_TANK } from "../tank-animation";

interface FillShape {
  ty: string;
  c?: { k: number[] };
}
interface Layer {
  nm?: string;
  shapes?: { it?: FillShape[] }[];
}

function liquidFillColor(anim: Record<string, unknown>): number[] | undefined {
  const layers = anim.layers as Layer[];
  const liquid = layers.find((l) => l.nm === "liquid");
  return liquid?.shapes?.[0]?.it?.find((it) => it.ty === "fl")?.c?.k;
}

describe("tank-animation", () => {
  describe("Normal Behavior", () => {
    it("sollte eine valide Lottie-Struktur mit 0..100 Frames liefern", () => {
      expect(BASE_TANK.fr).toBeGreaterThan(0);
      expect(BASE_TANK.ip).toBe(0);
      expect(BASE_TANK.op).toBe(100);
      expect(Array.isArray(BASE_TANK.layers)).toBe(true);
    });

    it("sollte die Flüssigkeit linear (Tangenten 0→1) animieren, damit Frame = Prozent", () => {
      const layers = BASE_TANK.layers as Layer[];
      const liquid = layers.find((l) => l.nm === "liquid");
      const rect = liquid?.shapes?.[0]?.it?.[0] as unknown as {
        s: { k: Array<{ i?: { x: number[] }; o?: { x: number[] } }> };
      };
      const firstKeyframe = rect.s.k[0];
      expect(firstKeyframe.o?.x).toEqual([0, 0]);
      expect(firstKeyframe.i?.x).toEqual([1, 1]);
    });

    it("sollte die Füllfarbe je Status setzen", () => {
      const tinted = buildTankAnimation([0.9, 0.1, 0.1]);
      expect(liquidFillColor(tinted)).toEqual([0.9, 0.1, 0.1, 1]);
    });
  });

  describe("Edge Cases / Reinheit", () => {
    it("sollte die Basis-Animation nicht mutieren", () => {
      const before = liquidFillColor(BASE_TANK as unknown as Record<string, unknown>);
      buildTankAnimation([0.5, 0.5, 0.5]);
      const after = liquidFillColor(BASE_TANK as unknown as Record<string, unknown>);
      expect(after).toEqual(before);
    });
  });
});
