import { describe, expect, it } from "vitest";
import { classifyContractPriority, matchContractDomain } from "@/lib/contract-priority";

describe("contract-priority", () => {
  describe("matchContractDomain", () => {
    it("sollte bekannte Domänen erkennen", () => {
      expect(matchContractDomain("Netflix Abo")).toBe("Streaming");
      expect(matchContractDomain("McFit Mitgliedschaft")).toBe("Fitness");
      expect(matchContractDomain("HUK Kfz Versicherung")).toBe("Versicherung");
      expect(matchContractDomain("Stadtwerke Strom")).toBe("Energie");
    });

    it("sollte Unbekanntes mit null beantworten", () => {
      expect(matchContractDomain("Miete Wohnung")).toBeNull();
      expect(matchContractDomain("")).toBeNull();
    });
  });

  describe("classifyContractPriority", () => {
    it("sollte klar kündbare Abos als 'nice' (zuerst weg) einstufen", () => {
      expect(classifyContractPriority("Spotify Premium")).toBe("nice");
      expect(classifyContractPriority("Clever Fit Studio")).toBe("nice");
    });

    it("sollte komplexe/lebensnotwendige Verträge NICHT als kürzbar anbieten", () => {
      // Versicherung/Energie/Mobilfunk → kein einfacher „kündigen"-Vorschlag.
      expect(classifyContractPriority("Allianz Haftpflichtversicherung")).toBeNull();
      expect(classifyContractPriority("Stadtwerke Gas")).toBeNull();
      expect(classifyContractPriority("Telekom Mobilfunk")).toBeNull();
      expect(classifyContractPriority("Miete")).toBeNull();
    });
  });
});
