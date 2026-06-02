"use client";

import { useState } from 'react';
import { Eye, Undo2, Play, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Transaction } from '../../types';

interface CategoryPreviewProps {
  category: any;
  affectedTransactions: Transaction[];
  onPreview: () => void;
  onApply: () => void;
  onUndo: () => void;
  isProcessing: boolean;
}

export function CategoryPreview({
  category,
  affectedTransactions,
  onPreview,
  onApply,
  onUndo,
  isProcessing,
}: CategoryPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Card className="border border-slate-800 bg-slate-950/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-white">
          <Eye className="h-5 w-5 text-emerald-400" />
          Vorschau & Zuweisung
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {category && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{category.icon}</span>
              <div>
                <h3 className="text-base font-semibold text-white">{category.name}</h3>
                <p className="text-sm text-slate-400">{category.filters.length} Filter aktiv</p>
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
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
          >
            <Eye className="mr-2 h-4 w-4" />
            Vorschau
          </Button>

          <Button
            onClick={onApply}
            disabled={isProcessing}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Play className="mr-2 h-4 w-4" />
            {isProcessing ? 'Anwenden...' : 'Anwenden'}
          </Button>
        </div>

        {showPreview && (
          <Card className="border border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Betroffene Transaktionen
              </CardTitle>
            </CardHeader>

            <CardContent>
              {affectedTransactions.length > 0 ? (
                <>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {affectedTransactions.slice(0, 10).map((transaction) => (
                        <div key={transaction.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{transaction.description}</p>
                              <p className="text-xs text-slate-400">{transaction.payee}</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {transaction.amount}€
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {affectedTransactions.length > 10 && (
                    <p className="mt-2 text-sm text-slate-400">
                      ... und {affectedTransactions.length - 10} weitere
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Keine Transaktionen würden durch diese Kategorie-Regeln verändert.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          onClick={onUndo}
          variant="ghost"
          className="w-full text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Letzte Aktion rückgängig
        </Button>
      </CardContent>
    </Card>
  );
}