import { describe, it, expect, vi, beforeEach } from "vitest";

// react-hot-toast als Spy: wir prüfen die Aufruf-Optionen, nicht das Rendering.
const successSpy = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: { success: (m: string, o?: unknown) => successSpy(m, o) },
}));

import { showSuccess } from "../toast";

beforeEach(() => successSpy.mockClear());

describe("showSuccess", () => {
  it("sollte die Nachricht mit einem animierten Haken-Icon anzeigen", () => {
    showSuccess("Gespeichert");
    expect(successSpy).toHaveBeenCalledTimes(1);
    const [message, options] = successSpy.mock.calls[0];
    expect(message).toBe("Gespeichert");
    expect((options as { icon?: unknown }).icon).toBeTruthy();
  });
});
