import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClaimImportDialog from "../ClaimImportDialog";
import type { LetterImportResult } from "@/services/letter-import-service";
import type { Claim } from "@/services/claim-service";

vi.mock("@/services/letter-import-service", () => ({
  importLettersFromPdf: vi.fn(),
  importLettersFromImages: vi.fn(),
}));

vi.mock("@/services/claim-service", async () => {
  const actual = await vi.importActual<typeof import("@/services/claim-service")>(
    "@/services/claim-service",
  );
  return { ...actual, confirmClaim: vi.fn() };
});

import { importLettersFromPdf, importLettersFromImages } from "@/services/letter-import-service";
import { confirmClaim } from "@/services/claim-service";

function makeClaim(partial: Partial<Claim> & { id: string }): Claim {
  return {
    user_id: "local",
    creditor: "Nordwind Versand GmbH",
    original_creditor: null,
    current_amount: 49.9,
    hauptforderung: 49.9,
    iban: null,
    verwendungszweck: null,
    aktenzeichen: null,
    rechnungsnummer: "RG-2026-04711",
    kundennummer: null,
    status: "offen",
    timeline: [
      {
        id: "t1",
        doc_type: "rechnung",
        brief_datum: "2026-03-02",
        gesamtbetrag: 49.9,
        mahngebuehren: null,
        verzugszinsen: null,
        sender: "Nordwind Versand GmbH",
        iban: null,
      },
    ],
    debt_id: null,
    created_at: "2026-03-02T00:00:00.000Z",
    updated_at: "2026-03-02T00:00:00.000Z",
    ...partial,
  };
}

function renderDialog(open = true) {
  const queryClient = new QueryClient();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ClaimImportDialog open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange, queryClient };
}

function uploadFile(input: HTMLElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("ClaimImportDialog", () => {
  beforeEach(() => {
    vi.mocked(importLettersFromPdf).mockReset();
    vi.mocked(importLettersFromImages).mockReset();
    vi.mocked(confirmClaim).mockReset();
  });

  it("zeigt den Upload-Schritt mit Hinweistexten", () => {
    renderDialog();

    expect(screen.getByText("Forderungsbriefe scannen")).toBeInTheDocument();
    expect(
      screen.getByText(/PDF oder Fotos hierher ziehen oder auswählen/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Alles passiert auf deinem Gerät/)).toBeInTheDocument();
  });

  it("verarbeitet ein hochgeladenes PDF und zeigt erkannte Forderungen zur Bestätigung", async () => {
    const claim = makeClaim({ id: "claim-1" });
    const result: LetterImportResult = {
      claims: [claim],
      letters: [{} as never],
      letterCount: 1,
      claimCount: 1,
      needsReview: [],
      splitReviewNeeded: [],
      summary: "1 Forderung erfasst.",
    };
    vi.mocked(importLettersFromPdf).mockResolvedValue(result);

    renderDialog();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "briefe.pdf", { type: "application/pdf" });
    uploadFile(input, file);

    await waitFor(() => {
      expect(screen.getByText("1 Forderung erfasst.")).toBeInTheDocument();
    });

    expect(importLettersFromPdf).toHaveBeenCalledTimes(1);
    expect(importLettersFromImages).not.toHaveBeenCalled();
    expect(screen.getByText("Nordwind Versand GmbH")).toBeInTheDocument();
    expect(screen.getByText("Als Schuld übernehmen")).toBeInTheDocument();
  });

  it("übernimmt eine Forderung als Schuld nach Bestätigung", async () => {
    const claim = makeClaim({ id: "claim-1" });
    const confirmedClaim = makeClaim({ id: "claim-1", status: "bestaetigt", debt_id: "debt-1" });
    const result: LetterImportResult = {
      claims: [claim],
      letters: [{} as never],
      letterCount: 1,
      claimCount: 1,
      needsReview: [],
      splitReviewNeeded: [],
      summary: "1 Forderung erfasst.",
    };
    vi.mocked(importLettersFromPdf).mockResolvedValue(result);
    vi.mocked(confirmClaim).mockResolvedValue(confirmedClaim);

    renderDialog();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "briefe.pdf", { type: "application/pdf" });
    uploadFile(input, file);

    await waitFor(() => screen.getByText("Als Schuld übernehmen"));

    await userEvent.click(screen.getByText("Als Schuld übernehmen"));

    await waitFor(() => {
      expect(confirmClaim).toHaveBeenCalledWith("claim-1", expect.anything());
      expect(screen.getByText("Übernommen")).toBeInTheDocument();
    });
  });

  it("zeigt eine Fehlermeldung, wenn keine Briefe erkannt wurden", async () => {
    const result: LetterImportResult = {
      claims: [],
      letters: [],
      letterCount: 0,
      claimCount: 0,
      needsReview: [],
      splitReviewNeeded: [],
      summary: "0 Forderungen erfasst.",
    };
    vi.mocked(importLettersFromPdf).mockResolvedValue(result);

    renderDialog();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "briefe.pdf", { type: "application/pdf" });
    uploadFile(input, file);

    await waitFor(() => {
      expect(screen.getByText(/Keine Forderungen erkannt/)).toBeInTheDocument();
    });
  });

  it("bricht den Import bei einem Fehler ab und springt zurück zum Upload", async () => {
    vi.mocked(importLettersFromPdf).mockRejectedValue(new Error("OCR kaputt"));

    renderDialog();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "briefe.pdf", { type: "application/pdf" });
    uploadFile(input, file);

    await waitFor(() => {
      expect(
        screen.getByText(/PDF oder Fotos hierher ziehen oder auswählen/),
      ).toBeInTheDocument();
    });
  });
});
