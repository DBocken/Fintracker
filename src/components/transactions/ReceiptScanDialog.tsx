import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { showError } from "@/utils/toast";
import { ocrImages } from "@/services/letter-ocr-service";
import { parseReceipt } from "@/services/receipt-parser-service";
import { categorizeTransaction, getCategories } from "@/services/transaction-service";
import { TransactionFormDialog, type TransactionPrefill } from "./TransactionFormDialog";
import type { Transaction } from "@/types";

interface ReceiptScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorausgewähltes Konto für die erzeugte Barausgabe (i. d. R. das Bargeld-Konto). */
  cashAccountId?: string | null;
  onSaved?: () => void;
}

export function ReceiptScanDialog({ open, onOpenChange, cashAccountId, onSaved }: ReceiptScanDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      const [page] = await ocrImages([file]);
      const parsed = parseReceipt(page?.text ?? "");

      // Kategorie-Vorschlag über die bestehende Auto-Kategorisierung.
      let categoryId: string | null = null;
      const merchant = parsed.merchant?.value ?? "";
      if (merchant) {
        try {
          const categories = await getCategories();
          const probe = {
            date: parsed.date?.value ?? new Date().toISOString().split("T")[0],
            amount: -(parsed.total?.value ?? 0),
            payee: merchant,
            description: "",
            original_text: page?.text ?? "",
            auto_mapped: false,
            confirmed: false,
          } as Transaction;
          categoryId = categorizeTransaction(probe, categories);
        } catch {
          categoryId = null;
        }
      }

      setPrefill({
        accountId: cashAccountId ?? null,
        direction: "expense",
        amount: parsed.total?.value,
        date: parsed.date?.value,
        payee: merchant,
        description: "Barbeleg (gescannt)",
        categoryId,
      });
      onOpenChange(false);
      setFormOpen(true);
    } catch (e) {
      showError("Beleg konnte nicht gelesen werden: " + (e as Error).message);
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Beleg scannen</DialogTitle>
            <DialogDescription>
              Fotografiere eine bar bezahlte Rechnung. Wir lesen Betrag, Datum und Händler aus –
              direkt auf deinem Gerät, ohne Upload. Anschließend kannst du alles prüfen und korrigieren.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="flex flex-col items-center gap-3 py-4">
            {processing ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                Beleg wird gelesen …
              </div>
            ) : (
              <>
                <ScanLine className="h-10 w-10 text-muted-foreground" />
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Camera className="mr-1.5 h-4 w-4" />
                  Beleg fotografieren / auswählen
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        prefill={prefill}
        defaultAccountId={cashAccountId}
        title="Barausgabe vom Beleg"
        onSaved={onSaved}
      />
    </>
  );
}
