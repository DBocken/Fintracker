import { describe, it, expect } from "vitest";
import {
  getStatusBucket,
  getStatusStage,
  statusLabel,
  statusColorVar,
  statusTextClass,
  statusBgClass,
} from "@/lib/status-bucket";

describe("getStatusBucket", () => {
  it("maps the 5 score ranges to buckets", () => {
    expect(getStatusBucket(0)).toBe("critical");
    expect(getStatusBucket(20)).toBe("critical");
    expect(getStatusBucket(21)).toBe("weak");
    expect(getStatusBucket(40)).toBe("weak");
    expect(getStatusBucket(41)).toBe("mid");
    expect(getStatusBucket(60)).toBe("mid");
    expect(getStatusBucket(61)).toBe("good");
    expect(getStatusBucket(80)).toBe("good");
    expect(getStatusBucket(81)).toBe("excellent");
    expect(getStatusBucket(100)).toBe("excellent");
  });

  it("[Edge] clampt Werte unterhalb 0 auf 'critical' und oberhalb 100 auf 'excellent'", () => {
    expect(getStatusBucket(-50)).toBe("critical");
    expect(getStatusBucket(150)).toBe("excellent");
  });

  it("[REGRESSION] dokumentiert: NaN fällt durch alle Schwellen und landet bei 'excellent' statt eines Fehlers", () => {
    // Jeder `<=`-Vergleich mit NaN ist false, daher fällt die Funktion beim
    // letzten `return "excellent"` durch — ein für eine Bewertungsfunktion
    // überraschendes Ergebnis. Hier bewusst als Ist-Zustand dokumentiert,
    // damit eine künftige Änderung (z.B. NaN wie 0 behandeln) bewusst
    // getroffen wird statt versehentlich zu passieren.
    expect(getStatusBucket(NaN)).toBe("excellent");
  });
});

describe("getStatusStage", () => {
  it("returns a 1-based stage matching the bucket order", () => {
    expect(getStatusStage(0)).toBe(1);
    expect(getStatusStage(30)).toBe(2);
    expect(getStatusStage(50)).toBe(3);
    expect(getStatusStage(70)).toBe(4);
    expect(getStatusStage(100)).toBe(5);
  });
});

describe("status helpers", () => {
  it("returns german labels", () => {
    expect(statusLabel("critical")).toBe("kritisch");
    expect(statusLabel("excellent")).toBe("sehr gut");
  });

  it("returns css var expressions and literal tailwind classes", () => {
    expect(statusColorVar("good")).toBe("hsl(var(--status-good))");
    expect(statusTextClass("mid")).toBe("text-status-mid");
    expect(statusBgClass("weak")).toBe("bg-status-weak");
  });
});
