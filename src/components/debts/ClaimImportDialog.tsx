import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import {
  importLettersFromImages,
  importLettersFromPdf,
  type LetterImportResult,
} from "@/services/letter-import-service";
import { confirmClaim, type Claim } from "@/services/claim-service";
import { getLetterDocTypeLabels } from "@/services/letter-parser-service";
import { getScanGuidance, type OcrProgress } from "@/services/letter-ocr-service";
import { useI18n } from "@/i18n/useI18n";

interface ClaimImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default function ClaimImportDialog({ open, onOpenChange }: ClaimImportDialogProps) {
  const { t } = useI18n();
  const scanGuidance = getScanGuidance();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<LetterImportResult | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["debts"] });
    queryClient.invalidateQueries({ queryKey: ["claims"] });
  };

  const confirmMutation = useMutation({
    mutationFn: confirmClaim,
    onSuccess: (claim) => {
      invalidate();
      showSuccess(`Schuld „${claim.creditor}“ übernommen`);
      setResult((prev) =>
        prev ? { ...prev, claims: prev.claims.map((c) => (c.id === claim.id ? claim : c)) } : prev,
      );
    },
    onError: (e: Error) => showError(e.message),
  });

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setStep("processing");
    setProgress(null);

    try {
      const onProgress = (p: OcrProgress) => setProgress(p);
      const pdf = files.find((f) => f.type === "application/pdf");

      const grouping = pdf
        ? await importLettersFromPdf(await pdf.arrayBuffer(), { onProgress })
        : await importLettersFromImages(files, { onProgress });

      setResult(grouping);
      setStep("review");

      if (grouping.letters.length === 0) {
        showError(t('debts.claimImport.noLettersDetected'));
      } else {
        showSuccess(grouping.summary);
      }
    } catch (error) {
      console.error("[ClaimImportDialog] OCR-Import fehlgeschlagen:", error);
      showError(t('debts.claimImport.ocrFailed'));
      setStep("upload");
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      void processFiles(acceptedFiles);
    },
    [processFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    disabled: step === "processing",
  });

  const handleClose = () => {
    setStep("upload");
    setProgress(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('debts.claimImport.title')}</DialogTitle>
          <DialogDescription>
            {t('debts.claimImport.description')}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-4 space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg font-medium">{t('debts.claimImport.dragHere')}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">{t('debts.claimImport.selectFiles')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('debts.claimImport.selectFilesHint')}
                  </p>
                </div>
              )}
            </div>
            <Alert>
              <AlertDescription className="space-y-1 text-xs text-muted-foreground">
                <span className="block">{scanGuidance.recommendation}</span>
                <span className="block">{scanGuidance.homeAlternative}</span>
                <span className="block">{scanGuidance.privacy}</span>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">{t('debts.claimImport.processing')}</p>
            {progress && (
              <div className="w-full space-y-1">
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                <p className="text-center text-sm text-muted-foreground">{progress.label}</p>
              </div>
            )}
          </div>
        )}

        {step === "review" && result && (
          <div className="py-4 space-y-4">
            <Alert>
              <AlertDescription>{result.summary}</AlertDescription>
            </Alert>

            {result.claims.length === 0 ? (
              <Alert>
                <AlertDescription>
                  {t('debts.claimImport.noClaims')}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {result.claims.map((claim) => (
                  <ClaimReviewRow
                    key={claim.id}
                    claim={claim}
                    t={t}
                    onConfirm={() => confirmMutation.mutate(claim.id)}
                    isConfirming={confirmMutation.isPending && confirmMutation.variables === claim.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={step === "processing"}>
            {step === "review" ? t('debts.claimImport.done') : t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimReviewRow({
  claim,
  t,
  onConfirm,
  isConfirming,
}: {
  claim: Claim;
  t: (key: string) => string;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const latest = claim.timeline[claim.timeline.length - 1];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <span className="truncate">{claim.creditor}</span>
            {latest && <Badge variant="secondary">{getLetterDocTypeLabels()[latest.doc_type]}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">{eur.format(claim.current_amount)}</div>
        </div>
      </div>
      {claim.debt_id ? (
        <Badge className="shrink-0 bg-positive/20 text-positive">
          <CheckCircle2 className="mr-1 h-3 w-3" /> {t('debts.claimImport.adopted')}
        </Badge>
      ) : (
        <Button size="sm" onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : t('debts.claimImport.adoptButton')}
        </Button>
      )}
    </div>
  );
}
