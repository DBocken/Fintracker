import { useState } from 'react';
import { Eye, Undo2, Play, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction, HierarchicalCategory } from '../../types';

interface CategoryPreviewProps {
  category: HierarchicalCategory | null;
  /** Zeilen zum Zeigen — GEKAPPT. Die Zahlen darunter sind es nicht. */
  affectedTransactions: Transaction[];
  /** Buchungen, die diese Kategorie bekommen. Vollstaendig gezaehlt. */
  anzahlHinzu: number;
  /** Buchungen, die diese Kategorie VERLIEREN. Der Lauf entzieht auch. */
  anzahlEntzug: number;
  /** Buchungen, die der Lauf insgesamt aendert — ueber ALLE Kategorien. */
  anzahlGesamt: number;
  onPreview: () => void;
  onApply: () => void;
  onUndo: () => void;
  isProcessing: boolean;
}

export function CategoryPreview({
  category,
  affectedTransactions,
  anzahlHinzu,
  anzahlEntzug,
  anzahlGesamt,
  onPreview,
  onApply,
  onUndo,
  isProcessing,
}: CategoryPreviewProps) {
  const { t } = useI18n();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <Eye className="h-5 w-5 text-positive" />
          {t('settings.categoryPreview.title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {category && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{category.icon}</span>
              <div>
                <h3 className="text-base font-semibold text-foreground">{category.name}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.categoryPreview.filtersActive').replace('{count}', String(category.filters.length))}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => {
              setShowPreview(true);
              onPreview();
            }}
            variant="outline"
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <Eye className="mr-2 h-4 w-4" />
            {t('settings.categoryPreview.previewButton')}
          </Button>

          <Button
            onClick={onApply}
            disabled={isProcessing}
            className="bg-positive text-positive-foreground hover:bg-positive"
          >
            <Play className="mr-2 h-4 w-4" />
            {isProcessing ? t('settings.categoryPreview.applyingLabel') : t('settings.categoryPreview.applyButton')}
          </Button>
        </div>

        {showPreview && (
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <CheckCircle className="h-4 w-4 text-positive" />
                {t('settings.categoryPreview.affectedTransactionsTitle')}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {affectedTransactions.length > 0 ? (
                <>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {affectedTransactions.slice(0, 10).map((transaction) => (
                        <div key={transaction.id} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">{transaction.payee}</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {transaction.amount}€
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {anzahlHinzu > affectedTransactions.slice(0, 10).length && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('settings.categoryPreview.moreItemsLabel').replace(
                        '{count}',
                        String(anzahlHinzu - affectedTransactions.slice(0, 10).length),
                      )}
                    </p>
                  )}

                  {/* Was der Knopf daneben WIRKLICH tut. Die Liste zeigt nur,
                      was in diese Kategorie wandert; der Lauf entzieht auch
                      Zuordnungen und laeuft ueber alle Kategorien. Beides stand
                      bis hierher nirgends. */}
                  <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
                    {t('settings.categoryPreview.planLine')
                      .replace('{hinzu}', String(anzahlHinzu))
                      .replace('{entzug}', String(anzahlEntzug))
                      .replace('{gesamt}', String(anzahlGesamt))}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('settings.categoryPreview.noTransactionsMessage')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          onClick={onUndo}
          variant="ghost"
          className="w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Undo2 className="mr-2 h-4 w-4" />
          {t('settings.categoryPreview.undoButton')}
        </Button>
      </CardContent>
    </Card>
  );
}