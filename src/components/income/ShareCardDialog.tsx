import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SegmentedControl from '@/components/common/SegmentedControl';
import { useI18n } from '@/i18n/useI18n';
import { buildShareCardData } from '@/lib/share-card';
import { exportNodeAsPng } from '@/lib/png-export';
import type { IncomeStreamsResult } from '@/lib/income-streams';
import ShareCard, { type ShareCardFormat } from './ShareCard';

// Vorschau-Skalierung der 1080er-Karte (nur CSS-Transform; der Export-Node
// bleibt unskaliert, damit toPng die Originalauflösung rendert).
const PREVIEW_SCALE: Record<ShareCardFormat, number> = { story: 0.18, square: 0.28 };

export default function ShareCardDialog({
  result,
  open,
  onOpenChange,
}: {
  result: IncomeStreamsResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [format, setFormat] = useState<ShareCardFormat>('story');
  const exportRef = useRef<HTMLDivElement>(null);
  const data = buildShareCardData(result);

  const handleExport = async () => {
    if (!exportRef.current) return;
    const fileName = format === 'story' ? 'einkommensmix-story.png' : 'einkommensmix-quadrat.png';
    await exportNodeAsPng(exportRef.current, fileName);
  };

  const scale = PREVIEW_SCALE[format];
  const previewWidth = 1080 * scale;
  const previewHeight = (format === 'story' ? 1920 : 1080) * scale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('income.share.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('income.share.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <SegmentedControl
          options={[
            { value: 'story', label: t('income.share.formatStory') },
            { value: 'square', label: t('income.share.formatSquare') },
          ]}
          value={format}
          onValueChange={(v) => setFormat(v as ShareCardFormat)}
          aria-label={t('income.share.dialogTitle')}
        />

        <div className="flex justify-center">
          <div style={{ width: previewWidth, height: previewHeight, overflow: 'hidden' }}>
            <div ref={exportRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <ShareCard data={data} format={format} />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">{t('income.share.privacyNote')}</p>

        <Button onClick={handleExport} className="w-full">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('income.share.exportButton')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
