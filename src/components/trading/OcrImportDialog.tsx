import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import type { PortfolioPosition, OcrResult } from '@/types';
import { createPosition } from '@/services/portfolio-service';
import {
  extractPositionsFromImage,
  ocrResultToEditablePosition,
} from '@/services/ocr-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileImage,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface OcrImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
}

interface EditablePosition {
  symbol: string;
  name?: string;
  quantity?: string;
  entryPrice?: string;
  currency?: string;
}

export default function OcrImportDialog({
  open,
  onOpenChange,
  portfolioId,
}: OcrImportDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editablePositions, setEditablePositions] = useState<EditablePosition[]>([]);

  // Create mutation for each position
  const createMutation = useMutation({
    mutationFn: async (position: Partial<PortfolioPosition>) => {
      return await createPosition(position);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary', portfolioId] });
    },
  });

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('trading.ocrImportDialog.messages.imageRequired'));
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('trading.ocrImportDialog.messages.fileTooLarge'));
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Start OCR processing
    setStep('processing');

    try {
      const result = await extractPositionsFromImage(file);
      setOcrResult(result);

      // Convert to editable positions
      const positions = result.positions.map(ocrPos => ({
        ...ocrResultToEditablePosition(ocrPos),
        name: ocrPos.symbol.value, // Default name to symbol
      }));

      setEditablePositions(positions);
      setStep('review');

      if (positions.length === 0) {
        toast(t('trading.ocrImportDialog.messages.positionsDetected').replace('{count}', '0'));
      } else {
        toast.success(t('trading.ocrImportDialog.messages.positionsDetected').replace('{count}', String(positions.length)));
      }
    } catch (error) {
      console.error('[OcrImportDialog] OCR failed:', error);
      toast.error(t('trading.ocrImportDialog.messages.ocrFailed'));
      setStep('upload');
    }
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
    },
    maxFiles: 1,
    disabled: step === 'processing',
  });

  // Handle position field update
  const updatePosition = (
    index: number,
    field: keyof EditablePosition,
    value: string
  ) => {
    setEditablePositions(prev =>
      prev.map((pos, i) =>
        i === index ? { ...pos, [field]: value } : pos
      )
    );
  };

  // Remove a position
  const removePosition = (index: number) => {
    setEditablePositions(prev => prev.filter((_, i) => i !== index));
  };

  // Save all positions
  const handleSave = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const pos of editablePositions) {
      // Validation
      if (!pos.symbol.trim()) {
        toast.error(t('trading.ocrImportDialog.messages.symbolRequired'));
        return;
      }

      const quantityNum = pos.quantity ? parseFloat(pos.quantity) : 0;
      const entryPriceNum = pos.entryPrice ? parseFloat(pos.entryPrice) : 0;

      try {
        await createPosition({
          portfolio_id: portfolioId,
          symbol: pos.symbol.trim().toUpperCase(),
          name: pos.name?.trim() || pos.symbol.trim().toUpperCase(),
          quantity: quantityNum,
          entry_price: entryPriceNum,
          currency: pos.currency || 'EUR',
        });
        successCount++;
      } catch (error) {
        console.error('[OcrImportDialog] Failed to create position:', error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(t('trading.ocrImportDialog.messages.successAdd').replace('{count}', String(successCount)));
    }

    if (errorCount > 0) {
      toast.error(t('trading.ocrImportDialog.messages.errorAdd').replace('{count}', String(errorCount)));
    }

    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setPreviewUrl(null);
    setOcrResult(null);
    setEditablePositions([]);
    onOpenChange(false);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-positive">{t('trading.ocrImportDialog.confidenceHigh').replace('{confidence}%', `${confidence}%`)}</Badge>;
    } else if (confidence >= 60) {
      return <Badge className="bg-warning">{t('trading.ocrImportDialog.confidenceMedium').replace('{confidence}%', `${confidence}%`)}</Badge>;
    } else {
      return <Badge className="bg-warning">{t('trading.ocrImportDialog.confidenceLow').replace('{confidence}%', `${confidence}%`)}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('trading.ocrImportDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('trading.ocrImportDialog.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="py-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-muted-foreground/25 hover:border-primary/50'
                }
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg font-medium">{t('trading.ocrImportDialog.uploadDragActive')}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {t('trading.ocrImportDialog.uploadDragInactive')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('trading.ocrImportDialog.uploadFormats')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">{t('trading.ocrImportDialog.processingMessage')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('trading.ocrImportDialog.processingTime')}
            </p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="py-4 space-y-4">
            {/* Preview Image */}
            {previewUrl && (
              <div className="space-y-2">
                <Label>{t('trading.ocrImportDialog.previewLabel')}</Label>
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt={t('trading.ocrImportDialog.previewLabel')}
                    className="w-full h-48 object-contain rounded-lg border bg-muted"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    aria-label={t('trading.ocrImportDialog.removeImageLabel')}
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      setStep('upload');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Overall Confidence */}
            {ocrResult && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('trading.ocrImportDialog.confidenceLabel')
                    .replace('{confidence}%', `${ocrResult.overallConfidence}%`)
                    .replace('{message}', ocrResult.overallConfidence >= 70
                      ? t('trading.ocrImportDialog.confidenceGood')
                      : t('trading.ocrImportDialog.confidenceBad'))}
                </AlertDescription>
              </Alert>
            )}

            {/* Editable Positions */}
            {editablePositions.length > 0 ? (
              <div className="space-y-4">
                <Label>{t('trading.ocrImportDialog.detectedPositions').replace('{count}', String(editablePositions.length))}</Label>
                {editablePositions.map((position, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{t('trading.ocrImportDialog.positionLabel').replace('{index}', String(index + 1))}</span>
                        {ocrResult?.positions[index] && (
                          getConfidenceBadge(ocrResult.positions[index].symbol.confidence)
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePosition(index)}
                        aria-label={t('trading.ocrImportDialog.removePositionLabel').replace('{index}', String(index + 1))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`symbol-${index}`} className="text-xs">
                          {t('trading.ocrImportDialog.symbolLabel')}
                        </Label>
                        <Input
                          id={`symbol-${index}`}
                          value={position.symbol}
                          onChange={(e) => updatePosition(index, 'symbol', e.target.value.toUpperCase())}
                          placeholder={t('trading.ocrImportDialog.symbolPlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`name-${index}`} className="text-xs">
                          {t('trading.ocrImportDialog.nameLabel')}
                        </Label>
                        <Input
                          id={`name-${index}`}
                          value={position.name || ''}
                          onChange={(e) => updatePosition(index, 'name', e.target.value)}
                          placeholder={t('trading.ocrImportDialog.namePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`quantity-${index}`} className="text-xs">
                          {t('trading.ocrImportDialog.quantityLabel')}
                        </Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          step="any"
                          value={position.quantity || ''}
                          onChange={(e) => updatePosition(index, 'quantity', e.target.value)}
                          placeholder={t('trading.ocrImportDialog.quantityPlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`price-${index}`} className="text-xs">
                          {t('trading.ocrImportDialog.priceLabel')}
                        </Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          step="any"
                          value={position.entryPrice || ''}
                          onChange={(e) => updatePosition(index, 'entryPrice', e.target.value)}
                          placeholder={t('trading.ocrImportDialog.pricePlaceholder')}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`currency-${index}`} className="text-xs">
                          {t('trading.ocrImportDialog.currencyLabel')}
                        </Label>
                        <Select
                          value={position.currency || 'EUR'}
                          onValueChange={(value) => updatePosition(index, 'currency', value)}
                        >
                          <SelectTrigger id={`currency-${index}`} aria-label={t('trading.ocrImportDialog.currencyLabel')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">{t('trading.ocrImportDialog.currencyEur')}</SelectItem>
                            <SelectItem value="USD">{t('trading.ocrImportDialog.currencyUsd')}</SelectItem>
                            <SelectItem value="GBP">{t('trading.ocrImportDialog.currencyGbp')}</SelectItem>
                            <SelectItem value="BTC">{t('trading.ocrImportDialog.currencyBtc')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('trading.ocrImportDialog.noPositionsDetected')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            {step === 'upload' ? t('trading.ocrImportDialog.cancelButton') : t('trading.ocrImportDialog.backButton')}
          </Button>
          {step === 'review' && editablePositions.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('trading.ocrImportDialog.savingButton')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('trading.ocrImportDialog.saveButton').replace('{count}', String(editablePositions.length))}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}