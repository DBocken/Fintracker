"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Undo2, Play, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  isProcessing
}: CategoryPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-900 to-blue-800">
        <CardHeader>
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <Eye className="h-6 w-6 text-blue-300" />
            Vorschau & Zuweisung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {category && (
              <div className="p-4 bg-blue-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                    <p className="text-sm text-blue-200">{category.filters.length} Filter aktiv</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => {
                  setShowPreview(true);
                  onPreview();
                }}
                variant="outline"
                className="bg-blue-700 hover:bg-blue-600 text-white border-blue-600"
              >
                <Eye className="h-4 w-4 mr-2" />
                Vorschau
              </Button>
              <Button 
                onClick={onApply}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-500"
              >
                {isProcessing ? (
                  <>
                    <Progress className="h-4 w-4 mr-2" />
                    Anwenden...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Anwenden
                  </>
                )}
              </Button>
            </div>

            {showPreview && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    Betroffene Transaktionen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {affectedTransactions.length > 0 ? (
                    <>
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {affectedTransactions.slice(0, 10).map((transaction) => (
                            <div key={transaction.id} className="p-3 bg-gray-700 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium text-white">{transaction.description}</p>
                                  <p className="text-xs text-gray-400">{transaction.payee}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {transaction.amount}€
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {affectedTransactions.length > 10 && (
                        <p className="text-sm text-gray-400 mt-2">
                          ... und {affectedTransactions.length - 10} weitere
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-300">
                      Keine Transaktionen würden durch diese Kategorie-Regeln verändert.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={onUndo}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Letzte Aktion rückgängig
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}