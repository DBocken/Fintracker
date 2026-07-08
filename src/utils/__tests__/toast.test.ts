import { describe, it, expect, vi, beforeEach } from "vitest";

// react-hot-toast als Spy: wir prüfen die Aufruf-Optionen, nicht das Rendering.
const successSpy = vi.fn();
const errorSpy = vi.fn();
const loadingSpy = vi.fn((_m: string) => "toast-id-123");
const dismissSpy = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: {
    success: (m: string, o?: unknown) => successSpy(m, o),
    error: (m: string) => errorSpy(m),
    loading: (m: string) => loadingSpy(m),
    dismiss: (id: string) => dismissSpy(id),
  },
}));

import { showSuccess, showError, showLoading, dismissToast } from "../toast";

beforeEach(() => {
  successSpy.mockClear();
  errorSpy.mockClear();
  loadingSpy.mockClear();
  dismissSpy.mockClear();
});

describe("showSuccess", () => {
  it("sollte die Nachricht mit einem animierten Haken-Icon anzeigen", () => {
    showSuccess("Gespeichert");
    expect(successSpy).toHaveBeenCalledTimes(1);
    const [message, options] = successSpy.mock.calls[0];
    expect(message).toBe("Gespeichert");
    expect((options as { icon?: unknown }).icon).toBeTruthy();
  });
});

describe("showError", () => {
  it("sollte die Nachricht an toast.error weiterleiten", () => {
    showError("Ein Fehler ist aufgetreten");
    expect(errorSpy).toHaveBeenCalledWith("Ein Fehler ist aufgetreten");
  });
});

describe("showLoading / dismissToast", () => {
  it("sollte die Toast-ID von toast.loading zurückgeben und an dismissToast weiterreichen", () => {
    const id = showLoading("Lädt…");
    expect(loadingSpy).toHaveBeenCalledWith("Lädt…");
    expect(id).toBe("toast-id-123");

    dismissToast(id);
    expect(dismissSpy).toHaveBeenCalledWith("toast-id-123");
  });
});
