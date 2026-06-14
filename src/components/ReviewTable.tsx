import { useState, useEffect, useMemo } from 'react';
import { Tag, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { format, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, HierarchicalCategory } from '../types';
import { getHierarchicalCategories, getTransactions, saveTransactions } from '../services/transaction-service';
import { getAccounts } from '../services/account-service';
import { applyDetectedContracts } from '../services/contract-detection-service';

interface ReviewTableProps {
  transactions: Transaction[];
  onConfirm: (importedCount: number, skippedCount: number) => void;
}

/** Toleranz für den Betragsvergleich bei der Duplikat-Erkennung */
const DUPLICATE_AMOUNT_TOLERANCE = 0.005;

export function ReviewTable({ transactions, onConfirm }: ReviewTableProps) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: hierarchicalCategories = [] } = useQuery<HierarchicalCategory[]>({
    queryKey: ['hierarchical-categories'],
    queryFn: getHierarchicalCategories,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Bereits gespeicherte Transaktionen (z.B. aus PSD2-Sync) für die
  // Duplikat-Erkennung beim CSV-Import
  const { data: existingTransactions = [] } = useQuery({
    queryKey: ['transactions', 'all-for-duplicate-check'],
    queryFn: () => getTransactions(10000),
  });

  const getAccountInfo = (accountId: string | null | undefined) => {
    if (!accountId) return null;
    return accounts.find(a => a.id === accountId) || null;
  };

  const importAccount = transactions.length > 0 ? getAccountInfo(transactions[0].account_id) : null;

  const saveMut = useMutation<Transaction[], Error, Transaction[]>({
    mutationFn: saveTransactions,
    onSuccess: async (saved) => {
      try {
        if (saved.length > 0) {
          await applyDetectedContracts();
        }
      } catch (error) {
        console.warn('Contract detection failed after CSV import:', error);
      }
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-chart'] });
      onConfirm(saved.length, rows.length - saved.length);
    },
  });

  useEffect(() => {
    setRows(
      (transactions || []).map((t, i) => ({
        ...t,
        id: t.id || `temp-${i}`,
        category_id: t.category_id || null,
      }))
    );
  }, [transactions]);

  // Mögliche Duplikate erkennen: gleiches Konto, gleiches Datum und nahezu
  // gleicher Betrag wie eine bereits vorhandene Transaktion (z.B. via
  // PSD2-Sync importiert). Über ein Konto+Datum-Index statt einer
  // verschachtelten Schleife, damit das auch bei großen CSVs flott bleibt.
  const duplicateIds = useMemo(() => {
    const byAccountAndDate = new Map<string, Transaction[]>();
    for (const existing of existingTransactions) {
      const key = `${existing.account_id}|${existing.date}`;
      const bucket = byAccountAndDate.get(key);
      if (bucket) bucket.push(existing);
      else byAccountAndDate.set(key, [existing]);
    }

    const ids = new Set<string>();
    for (const row of rows) {
      const bucket = byAccountAndDate.get(`${row.account_id}|${row.date}`);
      const isDuplicate = bucket?.some(
        (existing) => Math.abs((existing.amount || 0) - (row.amount || 0)) < DUPLICATE_AMOUNT_TOLERANCE
      );
      if (isDuplicate) ids.add(row.id || '');
    }
    return ids;
  }, [rows, existingTransactions]);

  // Erkannte Duplikate standardmäßig vom Import ausschließen
  useEffect(() => {
    setExcludedIds(new Set(duplicateIds));
  }, [duplicateIds]);

  const toggleExcluded = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedRows(prev =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map(r => r.id || ''))
    );
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkAssign = () => {
    if (!bulkCategory || selectedRows.size === 0) return;
    setRows(r =>
      r.map(row =>
        selectedRows.has(row.id || '')
          ? { ...row, category_id: bulkCategory }
          : row
      )
    );
    setSelectedRows(new Set());
    setBulkCategory('');
  };

  const handleConfirmAll = () => {
    saveMut.mutate(rows.filter((row) => !excludedIds.has(row.id || '')));
  };

  const flattenCategories = (categories: HierarchicalCategory[], level = 0): any[] => {
    const result: any[] = [];
    
    categories.forEach(category => {
      result.push({
        ...category,
        level,
        displayName: '  '.repeat(level) + category.name
      });
      
      if (category.children) {
        result.push(...flattenCategories(category.children, level + 1));
      }
    });
    
    return result;
  };

  const flatCategories = useMemo(() =>
    flattenCategories(hierarchicalCategories || []),
    [hierarchicalCategories]
  );

  // Auto-Kategorie pro Zeile einmalig vorberechnen, statt bei jedem Render
  // erneut über alle Kategorien/Filter zu iterieren.
  const autoCategoryById = useMemo(() => {
    const map = new Map<string, (typeof flatCategories)[number]>();
    for (const row of rows) {
      const match = flatCategories.find(cat =>
        (cat.filters || []).some((filter: string) =>
          (row.payee || '').toLowerCase().includes(filter.toLowerCase()) ||
          (row.description || '').toLowerCase().includes(filter.toLowerCase()) ||
          (row.original_text || '').toLowerCase().includes(filter.toLowerCase())
        )
      );
      if (match) map.set(row.id || '', match);
    }
    return map;
  }, [rows, flatCategories]);

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  if (!transactions || transactions.length === 0) {
    return (
      <Card className="ui-card">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Keine Transaktionen zum Review vorhanden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ui-card">
      <CardHeader>
        <CardTitle>Transaktionen prüfen</CardTitle>
        {importAccount && (
          <CardDescription className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: importAccount.color }}
            />
            Import für: <strong>{importAccount.icon} {importAccount.name}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {selectedRows.size > 0 && (
          <div className="flex gap-2 mb-4 p-4 bg-brand/15 rounded">
            <Tag className="h-4 w-4" />
            <span>{selectedRows.size} ausgewählt</span>
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {flatCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleBulkAssign} disabled={!bulkCategory}>
              <Check className="h-4 w-4" /> Zuweisen
            </Button>
            <Button variant="outline" onClick={() => setSelectedRows(new Set())}>
              <X className="h-4 w-4" /> Abwählen
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Auto-Kategorie</TableHead>
                <TableHead>Zuweisen</TableHead>
                <TableHead>Duplikat?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row, index) => {
                const date = row.date ? parseISO(row.date) : null;
                const isValidDate = date && isValid(date);

                const autoCategory = autoCategoryById.get(row.id || '');

                return (
                  <TableRow key={row.id || `row-${index}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(row.id || '')}
                        onCheckedChange={() => toggleSelectRow(row.id || '')}
                      />
                    </TableCell>
                    <TableCell>
                      {isValidDate ? format(date!, 'dd.MM.yyyy', { locale: de }) : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {row.description || row.original_text || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {row.payee || '-'}
                    </TableCell>
                    <TableCell className={row.amount < 0 ? 'text-warning' : 'text-positive'}>
                      {Math.abs(row.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell>
                      {autoCategory ? (
                        <Badge variant="outline" className="bg-opacity-20" style={{ backgroundColor: (autoCategory.color || '#000') + '20', color: autoCategory.color || '#000' }}>
                          {(autoCategory.icon || '')} {autoCategory.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.category_id || ''}
                        onValueChange={(val: string) =>
                          setRows(r =>
                            r.map(x =>
                              x.id === row.id ? { ...x, category_id: val } : x
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {flatCategories.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {duplicateIds.has(row.id || '') ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-warning text-warning">
                            Mögliches Duplikat
                          </Badge>
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                            <Checkbox
                              checked={!excludedIds.has(row.id || '')}
                              onCheckedChange={() => toggleExcluded(row.id || '')}
                            />
                            trotzdem importieren
                          </label>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 mt-4">
            <span className="text-sm text-muted-foreground">
              Zeige {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, rows.length)} von {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-4">
          {excludedIds.size > 0 && (
            <p className="text-xs text-muted-foreground">
              {excludedIds.size} als Duplikat erkannt und vom Import ausgeschlossen
            </p>
          )}
          <Button
            onClick={handleConfirmAll}
            disabled={saveMut.isPending || rows.length - excludedIds.size === 0}
            className="btn-premium"
          >
            {saveMut.isPending
              ? 'Speichern...'
              : `Importiere ${rows.length - excludedIds.size} Transaktionen`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}