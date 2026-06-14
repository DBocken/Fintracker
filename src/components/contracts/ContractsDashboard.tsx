import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryForm } from "@/components/settings/CategoryForm";
import { showSuccess, showError } from "@/utils/toast";
import { getTransactions, getCategories, updateCategory, remapCategoryInLocalTransactions } from "@/services/transaction-service";
import type { Transaction, Category } from "@/types";
import { format, parseISO, addMonths, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from "recharts";
import { ContractSuggestionsBanner } from "./ContractSuggestionsBanner";
import type { Cycle, ContractRow } from "./contract-types";

function getCycleFromDays(avgDays: number): Cycle {
  if (avgDays >= 6 && avgDays <= 9) return "Wöchentlich";
  if (avgDays >= 25 && avgDays <= 35) return "Monatlich";
  if (avgDays >= 80 && avgDays <= 110) return "Vierteljährlich";
  if (avgDays >= 160 && avgDays <= 200) return "Halbjährlich";
  if (avgDays >= 330 && avgDays <= 395) return "Jährlich";
  return "Unbekannt";
}

function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// Monatsäquivalent basierend auf erkanntem Zyklus
function monthlyEquivalent(amount: number, cycle: Cycle): number {
  switch (cycle) {
    case "Wöchentlich":
      return amount * 4.3;
    case "Monatlich":
      return amount;
    case "Vierteljährlich":
      return amount / 3;
    case "Halbjährlich":
      return amount / 6;
    case "Jährlich":
      return amount / 12;
    default:
      return amount; // unbekannt → als monatlich behandeln
  }
}

// Jahres-Äquivalent als tatsächliche Summe pro Jahr
function yearlyEquivalent(amount: number, cycle: Cycle): number {
  switch (cycle) {
    case "Wöchentlich":
      return amount * 52;
    case "Monatlich":
      return amount * 12;
    case "Vierteljährlich":
      return amount * 4;
    case "Halbjährlich":
      return amount * 2;
    case "Jährlich":
      return amount;
    default:
      return amount * 12; // unbekannt → konservativ als monatlich annehmen
  }
}

function computeContracts(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
  type: "Ausgabe" | "Einnahme"
): ContractRow[] {
  const isExpense = type === "Ausgabe";
  const filtered = transactions.filter((t) => (isExpense ? t.amount < 0 : t.amount > 0));
  if (!filtered.length) return [];

  // Gruppierung nach Händler-Alias/Payee + Kategorie
  const groups = new Map<string, Transaction[]>();
  filtered.forEach((t) => {
    const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
    const alias = cat?.attributes?.merchant_alias || "";
    const keyBase = (alias || (t.payee || "").toLowerCase().trim());
    const key = `${keyBase}|${t.category_id || "none"}|${type}`;
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  });

  const rows: ContractRow[] = [];

  groups.forEach((list, key) => {
    // Kategorie und explizites Vertrags-Flag vorab bestimmen
    const firstCatId = list[0]?.category_id || null;
    const cat = firstCatId ? categoryMap.get(firstCatId) : undefined;
    const explicit = !!cat?.attributes?.ist_vertrag;

    // Mindestanzahl nur verlangen, wenn nicht explizit als Vertrag markiert
    if (list.length < 3 && !explicit) return;

    // Sortiert nach Datum
    const sorted = [...list].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    // Beträge positiv
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const sortedAmt = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sortedAmt.length / 2);
    const median = sortedAmt.length % 2 === 0 ? (sortedAmt[mid - 1] + sortedAmt[mid]) / 2 : sortedAmt[mid];

    // Streuung
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / amounts.length;
    const stddev = Math.sqrt(variance);

    // Zyklen-Erkennung
    const diffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = parseISO(sorted[i - 1].date);
      const d2 = parseISO(sorted[i].date);
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      diffs.push(diffDays);
    }
    const avgDays = diffs.length ? Math.round(diffs.reduce((s, v) => s + v, 0) / diffs.length) : 0;
    let cycle = getCycleFromDays(avgDays);

    // Wenn explizit als Vertrag markiert und Rhythmus definiert, Zyklus aus Attributen übernehmen
    const attrRhythmus = cat?.attributes?.rhythmus;
    if (explicit && attrRhythmus) {
      cycle =
        attrRhythmus === "weekly" ? "Wöchentlich" :
        attrRhythmus === "monthly" ? "Monatlich" :
        attrRhythmus === "quarterly" ? "Vierteljährlich" :
        attrRhythmus === "yearly" ? "Jährlich" :
        cycle;
    }

    const isLikelyContract = cycle !== "Unbekannt" && stddev <= Math.max(1, median * 0.03);
    if (!isLikelyContract && !explicit) return;

    const last = sorted[sorted.length - 1];
    const lastAmount = Math.abs(last.amount);
    const changeAmount = Math.round((lastAmount - median) * 100) / 100;
    const changed = changeAmount > 0.5;
    const changeSinceLabel = changed ? format(parseISO(last.date), "MMM yyyy") : null;

    const nextDateISO =
      cycle === "Wöchentlich"
        ? addDaysISO(last.date, 7)
        : cycle === "Monatlich"
        ? addDaysISO(last.date, 30)
        : cycle === "Vierteljährlich"
        ? addDaysISO(last.date, 90)
        : cycle === "Halbjährlich"
        ? addDaysISO(last.date, 182)
        : cycle === "Jährlich"
        ? addDaysISO(last.date, 365)
        : null;

    // Vertrag gilt als bestätigt, sobald mind. eine zugehörige Buchung als
    // Vertrag markiert ist (Transaktions-Ebene, gesetzt im Detail-Dialog
    // oder per Bestätigung in der Vorschlagsliste).
    const confirmed = sorted.some((t) => t.is_contract === true);
    const transactionIds = sorted.map((t) => t.id || "").filter(Boolean);

    rows.push({
      key,
      type,
      payee: (cat?.attributes?.merchant_alias || last.payee || "").trim() || "Unbekannt",
      categoryName: cat?.name || "Unkategorisiert",
      categoryId: firstCatId,
      amountTypical: median,
      amountLast: lastAmount,
      cycle,
      lastDateISO: last.date,
      nextDateISO,
      changed,
      changeAmount,
      changeSinceLabel,
      confirmed,
      transactionIds,
    });
  });

  return rows;
}

export function ContractsDashboard() {
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", "contracts"],
    queryFn: () => getTransactions(2000),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#2e7d72');
  const [formIcon, setFormIcon] = useState('🛒');
  const [formFilters, setFormFilters] = useState<string[]>([]);
  const [formAttributes, setFormAttributes] = useState<any>({});

  useEffect(() => {
    if (editingCat) {
      setFormName(editingCat.name || '');
      setFormColor(editingCat.color || '#2e7d72');
      setFormIcon(editingCat.icon || '🛒');
      setFormFilters(editingCat.filters || []);
      setFormAttributes(editingCat.attributes || {});
    }
  }, [editingCat]);

  const updateCategoryMutation = useMutation({
    mutationFn: (payload: any) => updateCategory(payload),
    onSuccess: async (savedCat: Category) => {
      // Wenn eine Standardkategorie (alte ID) zu einer Nutzerkategorie (neue ID) kopiert wurde, remappen wir lokale Transaktionen.
      if (editingCat && savedCat?.id && savedCat.id !== editingCat.id) {
        const changed = await remapCategoryInLocalTransactions(editingCat.id, savedCat.id);
        if (changed > 0) {
          showSuccess(`Kategorie aktualisiert und ${changed} Buchungen neu zugeordnet`);
        } else {
          showSuccess('Kategorie aktualisiert');
        }
      } else {
        showSuccess('Kategorie aktualisiert');
      }

      // Neu laden: Kategorien und Vertrags-Transaktionen
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions", "contracts"] });
      setEditOpen(false);
    },
    onError: () => showError('Fehler beim Aktualisieren'),
  });

  const handleSaveCategory = () => {
    if (!editingCat) return;
    const payload = {
      ...editingCat,
      name: formName,
      color: formColor,
      icon: formIcon,
      filters: formFilters,
      attributes: formAttributes,
    };
    updateCategoryMutation.mutate(payload as any);
  };

  const handleResetCategory = () => {
    if (!editingCat) { setEditOpen(false); return; }
    setFormName(editingCat.name || '');
    setFormColor(editingCat.color || '#2e7d72');
    setFormIcon(editingCat.icon || '🛒');
    setFormFilters(editingCat.filters || []);
    setFormAttributes(editingCat.attributes || {});
  };

  const startEditFromRow = (row: ContractRow) => {
    if (!row.categoryId) return;
    const cat = categoryMap.get(row.categoryId);
    if (!cat) return;
    setEditingCat(cat);
    setEditOpen(true);
  };

  const [onlyChanges, setOnlyChanges] = useState(false);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");

  const contractsExpenses = useMemo(
    () => computeContracts(transactions, categoryMap, "Ausgabe"),
    [transactions, categoryMap]
  );
  const contractsIncome = useMemo(
    () => computeContracts(transactions, categoryMap, "Einnahme"),
    [transactions, categoryMap]
  );

  const contractsAll = useMemo(
    () => [...contractsIncome, ...contractsExpenses].sort((a, b) => (a.changed === b.changed ? a.payee.localeCompare(b.payee) : a.changed ? -1 : 1)),
    [contractsIncome, contractsExpenses]
  );

  // Bestätigte Verträge: nur Buchungen, die als Vertrag markiert sind.
  const confirmedExpenses = useMemo(
    () => contractsExpenses.filter((r) => r.confirmed),
    [contractsExpenses]
  );
  const confirmedIncome = useMemo(
    () => contractsIncome.filter((r) => r.confirmed),
    [contractsIncome]
  );
  const confirmedContracts = useMemo(
    () => contractsAll.filter((r) => r.confirmed),
    [contractsAll]
  );

  const visibleRows = useMemo(
    () => (onlyChanges ? confirmedContracts.filter((r) => r.changed) : confirmedContracts),
    [confirmedContracts, onlyChanges]
  );

  // Summen: Verbindlichkeiten (Ausgaben) und Vertragseinnahmen (Einnahmen),
  // berechnet aus den bestätigten Verträgen.
  const liabilitiesMonthly = useMemo(
    () => Math.round(confirmedExpenses.reduce((sum, r) => sum + monthlyEquivalent(r.amountTypical, r.cycle), 0)),
    [confirmedExpenses]
  );
  const liabilitiesYearly = useMemo(
    () => Math.round(confirmedExpenses.reduce((sum, r) => sum + yearlyEquivalent(r.amountTypical, r.cycle), 0)),
    [confirmedExpenses]
  );

  const incomeMonthly = useMemo(
    () => Math.round(confirmedIncome.reduce((sum, r) => sum + monthlyEquivalent(r.amountTypical, r.cycle), 0)),
    [confirmedIncome]
  );
  const incomeYearly = useMemo(
    () => Math.round(confirmedIncome.reduce((sum, r) => sum + yearlyEquivalent(r.amountTypical, r.cycle), 0)),
    [confirmedIncome]
  );

  const displayedLiabilities = viewMode === "monthly" ? liabilitiesMonthly : liabilitiesYearly;
  const displayedIncome = viewMode === "monthly" ? incomeMonthly : incomeYearly;

  type ChartPoint = { label: string; income: number; expenses: number; net: number };

  const chartData: ChartPoint[] = useMemo(() => {
    const start = startOfMonth(new Date());
    const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
    const data = months.map((m) => ({
      label: format(m, "MMM", { locale: de }),
      income: 0,
      expenses: 0,
      net: 0,
    }));

    const addAmountToMonth = (date: Date, amount: number, isIncome: boolean) => {
      const idx = months.findIndex(
        (m) => m.getFullYear() === date.getFullYear() && m.getMonth() === date.getMonth()
      );
      if (idx >= 0) {
        if (isIncome) data[idx].income += amount;
        else data[idx].expenses -= amount; // Ausgaben als negative Werte für Darstellung unter der Null-Linie
      }
    };

    const processRow = (r: ContractRow) => {
      const amt = r.amountTypical;
      const isIncome = r.type === "Einnahme";

      // Gleichmäßige Verteilung bei monatlich/wöchentlich/unbekannt
      if (r.cycle === "Monatlich" || r.cycle === "Wöchentlich" || r.cycle === "Unbekannt") {
        const monthly = monthlyEquivalent(amt, r.cycle);
        for (let i = 0; i < months.length; i++) {
          if (isIncome) data[i].income += monthly;
          else data[i].expenses -= monthly;
        }
        return;
      }

      // Quartal / Halbjahr / Jahr → nur in Fälligkeitsmonaten einzeichnen
      const stepMonths = r.cycle === "Vierteljährlich" ? 3 : r.cycle === "Halbjährlich" ? 6 : 12;
      if (!r.nextDateISO) {
        // Fallback: gleichmäßige Monatsverteilung
        const monthly = monthlyEquivalent(amt, "Unbekannt");
        for (let i = 0; i < months.length; i++) {
          if (isIncome) data[i].income += monthly;
          else data[i].expenses -= monthly;
        }
        return;
      }

      let due = startOfMonth(parseISO(r.nextDateISO));
      const end = addMonths(start, 12);
      while (due < end) {
        addAmountToMonth(due, amt, isIncome);
        due = addMonths(due, stepMonths);
      }
    };

    confirmedIncome.forEach(processRow);
    confirmedExpenses.forEach(processRow);

    // Saldo je Monat berechnen: Einnahmen + Ausgaben (Ausgaben sind negativ)
    data.forEach((d) => { d.net = d.income + d.expenses; });

    return data;
  }, [confirmedIncome, confirmedExpenses]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welche laufenden Kosten und Einnahmen habe ich?</CardTitle>
          <CardDescription>
            Wiederkehrende Ausgaben und Einnahmen (z. B. Gehalt) als Verträge erkannt. Zeigt Kategorie, Zyklus, typische Beträge und Änderungen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Kennzahlen: gleiche Hintergrundfarbe, Umschalter Monats/Jahresansicht */}
          <div className="mb-4 p-3 rounded-lg border bg-muted">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Summe der Verbindlichkeiten ({viewMode === "monthly" ? "monatlich" : "jährlich"})</p>
                <p className="text-2xl font-bold">
                  {displayedLiabilities.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vertrags-Einnahmen ({viewMode === "monthly" ? "monatlich" : "jährlich"})</p>
                <p className="text-2xl font-bold text-positive">
                  {displayedIncome.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="min-w-[160px]">
                <Select value={viewMode} onValueChange={(val: "monthly" | "yearly") => setViewMode(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Ansicht" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monatsansicht (normiert)</SelectItem>
                    <SelectItem value="yearly">Jahresansicht (tatsächlich)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Monatsansicht zeigt normierte Monatswerte (jährlich/12, quartal/3, halbjährlich/6). Jahresansicht zeigt die tatsächliche Jahreslast. So siehst du frühzeitig, ob z. B. Januar-Spitzen durch dein Gehalt abgedeckt sind oder du Rücklagen einplanen solltest.
            </p>
          </div>

          <div className="w-full h-64 mb-4 rounded-lg border bg-card">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })
                  }
                />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                <Area type="monotone" dataKey="income" name="Einnahmen" stroke="hsl(var(--positive))" fill="hsl(var(--positive))" fillOpacity={0.2} />
                <Area type="monotone" dataKey="expenses" name="Verträge" stroke="hsl(var(--brand))" fill="hsl(var(--brand))" fillOpacity={0.2} />
                <Area type="monotone" dataKey="net" name="Einnahmen − Verträge (Saldo)" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground))" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <ContractSuggestionsBanner rows={contractsAll} />

          <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Bestätigte Verträge ({confirmedContracts.length})
            </h3>
            <div className="flex items-center gap-2">
              <Switch checked={onlyChanges} onCheckedChange={(v) => setOnlyChanges(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Nur Veränderungen zeigen</span>
            </div>
          </div>

          {confirmedContracts.some((r) => r.changed) && (
            <div className="mb-4 p-3 rounded-md bg-warning/15 border border-warning/15">
              <p className="text-sm text-warning">
                Wir haben bei einigen Verträgen steigende Beträge erkannt. Ein Vergleich lohnt sich oft – sichere dir bessere Konditionen mit einem Anbieter-Check.
              </p>
              <p className="text-xs text-warning mt-1">
                Beispiel: Dein Vertrag ist um {confirmedContracts.find(r => r.changed)?.changeAmount.toLocaleString("de-DE")}€ teurer geworden. Prüfe verfügbare Tarife und spare dauerhaft.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Art</TableHead>
                  <TableHead>Vertrag</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Zyklus</TableHead>
                  <TableHead>Typischer Betrag</TableHead>
                  <TableHead>Letzter Betrag</TableHead>
                  <TableHead>Letzte Fälligkeit</TableHead>
                  <TableHead>Nächste Fälligkeit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.key}
                    onClick={() => startEditFromRow(row)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      {row.type === "Einnahme" ? (
                        <Badge variant="secondary">Einnahme</Badge>
                      ) : (
                        <Badge variant="outline">Ausgabe</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.payee}</TableCell>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell>{row.cycle}</TableCell>
                    <TableCell>
                      {row.amountTypical.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.amountLast.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell>{format(parseISO(row.lastDateISO), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {row.nextDateISO ? format(parseISO(row.nextDateISO), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {row.changed ? (
                        <Badge variant="secondary">
                          +{row.changeAmount.toLocaleString("de-DE", { maximumFractionDigits: 0 })}€ seit {row.changeSinceLabel}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Stabil</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {visibleRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Noch keine Verträge bestätigt. Bestätige oben einen Vorschlag oder markiere eine Transaktion als Vertrag.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Kategorie-Einstellungen</DialogTitle>
              </DialogHeader>
              {editingCat && (
                <CategoryForm
                  name={formName}
                  color={formColor}
                  icon={formIcon}
                  filters={formFilters}
                  parentId={editingCat.parent_id ?? null}
                  editingCategory={editingCat}
                  attributes={formAttributes}
                  onNameChange={setFormName}
                  onColorChange={setFormColor}
                  onIconChange={setFormIcon}
                  onAddFilter={(f) => setFormFilters((prev) => [...prev, f])}
                  onRemoveFilter={(f) => setFormFilters((prev) => prev.filter((x) => x !== f))}
                  onAttributesChange={(partial) => setFormAttributes((prev: any) => ({ ...prev, ...partial }))}
                  onSave={handleSaveCategory}
                  onReset={handleResetCategory}
                />
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}