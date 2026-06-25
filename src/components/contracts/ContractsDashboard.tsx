import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getTransactions, getCategories } from "@/services/transaction-service";
import { applyDetectedContracts } from "@/services/contract-detection-service";
import {
  getContractDecisionMap,
  CONTRACT_STATUS_LABELS,
  type ContractDecision,
} from "@/services/contract-decision-service";
import { useI18n } from "@/i18n/useI18n";
import type { Transaction, Category } from "@/types";
import { format, parseISO, addMonths, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from "recharts";
import { ContractSuggestionsBanner } from "./ContractSuggestionsBanner";
import { ContractDetailSheet } from "./ContractDetailSheet";
import { FeatureGate } from "@/components/FeatureGate";
import type { ContractRow } from "./contract-types";
import { computeContracts, computeIncomeContracts, monthlyEquivalent, yearlyEquivalent, isActiveForTotals } from "@/lib/contract-derivation";

function euro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function ContractsDashboard() {
  const { t } = useI18n();
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", "contracts"],
    queryFn: () => getTransactions(2000),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: decisions = new Map<string, ContractDecision>() } = useQuery({
    queryKey: ["contract-decisions"],
    queryFn: getContractDecisionMap,
  });

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const queryClient = useQueryClient();

  const rescanMutation = useMutation({
    mutationFn: applyDetectedContracts,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", "contracts"] });
      showSuccess(count > 0 ? `${count} Buchungen als Verträge erkannt` : "Keine neuen Verträge gefunden");
    },
    onError: () => showError("Neueinlesen fehlgeschlagen"),
  });

  // Auto-Scan einmal pro Seitenaufruf, sobald Transaktionen geladen sind.
  const autoScanned = useRef(false);
  useEffect(() => {
    if (autoScanned.current || transactions.length === 0) return;
    autoScanned.current = true;
    rescanMutation.mutate();
  }, [transactions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [onlyChanges, setOnlyChanges] = useState(false);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [showEnded, setShowEnded] = useState(true);
  const [detailRow, setDetailRow] = useState<ContractRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const contractsExpenses = useMemo(
    () => computeContracts(transactions, categoryMap, "Ausgabe", { decisions }),
    [transactions, categoryMap, decisions]
  );
  const contractsIncome = useMemo(
    () => computeIncomeContracts(transactions, categoryMap, { decisions }),
    [transactions, categoryMap, decisions]
  );

  const contractsAll = useMemo(
    () => [...contractsIncome, ...contractsExpenses],
    [contractsIncome, contractsExpenses]
  );

  // Drei Gruppen: Aktiv (zählt) / Kandidat (offen) / Beendet+Archiv (eingeklappt).
  const activeRows = useMemo(() => contractsAll.filter((r) => r.status === "active"), [contractsAll]);
  const candidateRows = useMemo(() => contractsAll.filter((r) => r.status === "candidate"), [contractsAll]);
  const endedRows = useMemo(
    () => contractsAll.filter((r) => ["ended", "rejected", "archived", "paused"].includes(r.status)),
    [contractsAll]
  );

  // Nur für aktuelle Summen geeignete Verträge (aktiv, nicht stale, Zyklus bekannt).
  const totalsExpenses = useMemo(
    () => contractsExpenses.filter(isActiveForTotals),
    [contractsExpenses]
  );
  const totalsIncome = useMemo(() => contractsIncome.filter(isActiveForTotals), [contractsIncome]);

  const liabilitiesMonthly = useMemo(
    () => Math.round(totalsExpenses.reduce((sum, r) => sum + monthlyEquivalent(r.amountTypical, r.cycle), 0)),
    [totalsExpenses]
  );
  const liabilitiesYearly = useMemo(
    () => Math.round(totalsExpenses.reduce((sum, r) => sum + yearlyEquivalent(r.amountTypical, r.cycle), 0)),
    [totalsExpenses]
  );
  const incomeMonthly = useMemo(
    () => Math.round(totalsIncome.reduce((sum, r) => sum + monthlyEquivalent(r.amountTypical, r.cycle), 0)),
    [totalsIncome]
  );
  const incomeYearly = useMemo(
    () => Math.round(totalsIncome.reduce((sum, r) => sum + yearlyEquivalent(r.amountTypical, r.cycle), 0)),
    [totalsIncome]
  );

  const displayedLiabilities = viewMode === "monthly" ? liabilitiesMonthly : liabilitiesYearly;
  const displayedIncome = viewMode === "monthly" ? incomeMonthly : incomeYearly;

  const visibleActive = useMemo(
    () => (onlyChanges ? activeRows.filter((r) => r.changed) : activeRows),
    [activeRows, onlyChanges]
  );

  type ChartPoint = { label: string; income: number; expenses: number; net: number };

  const chartData: ChartPoint[] = useMemo(() => {
    const start = startOfMonth(new Date());
    const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
    const data = months.map((m) => ({ label: format(m, "MMM", { locale: de }), income: 0, expenses: 0, net: 0 }));

    const addAmountToMonth = (date: Date, amount: number, isIncome: boolean) => {
      const idx = months.findIndex((m) => m.getFullYear() === date.getFullYear() && m.getMonth() === date.getMonth());
      if (idx >= 0) {
        if (isIncome) data[idx].income += amount;
        else data[idx].expenses -= amount;
      }
    };

    const processRow = (r: ContractRow) => {
      const amt = r.amountTypical;
      const isIncome = r.type === "Einnahme";

      if (r.cycle === "Monatlich" || r.cycle === "Wöchentlich") {
        const monthly = monthlyEquivalent(amt, r.cycle);
        for (let i = 0; i < months.length; i++) {
          if (isIncome) data[i].income += monthly;
          else data[i].expenses -= monthly;
        }
        return;
      }
      if (!r.nextDateISO || !r.cycleKnown) return; // unbekannten Zyklus nicht raten
      const stepMonths = r.cycle === "Vierteljährlich" ? 3 : r.cycle === "Halbjährlich" ? 6 : 12;
      let due = startOfMonth(parseISO(r.nextDateISO));
      const end = addMonths(start, 12);
      while (due < end) {
        addAmountToMonth(due, amt, isIncome);
        due = addMonths(due, stepMonths);
      }
    };

    totalsIncome.forEach(processRow);
    totalsExpenses.forEach(processRow);
    data.forEach((d) => { d.net = d.income + d.expenses; });
    return data;
  }, [totalsIncome, totalsExpenses]);

  const openDetail = (row: ContractRow) => {
    setDetailRow(row);
    setDetailOpen(true);
  };

  const renderRow = (row: ContractRow) => (
    <TableRow key={row.key} onClick={() => openDetail(row)} className="cursor-pointer hover:bg-muted/50">
      <TableCell>
        {row.type === "Einnahme" ? <Badge variant="secondary">Einnahme</Badge> : <Badge variant="outline">Ausgabe</Badge>}
      </TableCell>
      <TableCell className="font-medium">{row.payee}</TableCell>
      <TableCell>{row.categoryName}</TableCell>
      <TableCell>{row.cycleKnown ? row.cycle : "Zyklus unklar"}</TableCell>
      <TableCell>{euro(row.amountTypical)}</TableCell>
      <TableCell>{euro(row.amountLast)}</TableCell>
      <TableCell>{format(parseISO(row.lastDateISO), "dd.MM.yyyy")}</TableCell>
      <TableCell>{row.nextDateISO ? format(parseISO(row.nextDateISO), "dd.MM.yyyy") : "—"}</TableCell>
      <TableCell>
        {row.stale ? (
          <Badge variant="outline" className="text-warning">evtl. beendet</Badge>
        ) : row.changed ? (
          <Badge variant="secondary">+{row.changeAmount.toLocaleString("de-DE", { maximumFractionDigits: 0 })}€ seit {row.changeSinceLabel}</Badge>
        ) : (
          <Badge variant="outline">Stabil</Badge>
        )}
      </TableCell>
    </TableRow>
  );

  const tableHead = (
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
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welche laufenden Kosten und Einnahmen habe ich?</CardTitle>
          <CardDescription>
            Wiederkehrende Ausgaben und Einnahmen als Verträge erkannt. Nur bestätigte und aktuelle
            Verträge fließen in die Summen ein – beendete oder abgelehnte werden ausgeschlossen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg border bg-muted">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("contracts.liabilitiesSum", "Summe der Verbindlichkeiten")} ({viewMode === "monthly" ? t("contracts.monthlyLabel", "monatlich") : t("contracts.annuallyLabel", "jährlich")})</p>
                <p className="text-2xl font-bold">{euro(displayedLiabilities)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("contracts.incomeSum", "Vertrags-Einnahmen")} ({viewMode === "monthly" ? t("contracts.monthlyLabel", "monatlich") : t("contracts.annuallyLabel", "jährlich")})</p>
                <p className="text-2xl font-bold text-positive">{euro(displayedIncome)}</p>
              </div>
              <div className="min-w-[160px]">
                <Select value={viewMode} onValueChange={(val: "monthly" | "yearly") => setViewMode(val)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Ansicht" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("contracts.monthlyLabel", "monatlich")} (normiert)</SelectItem>
                    <SelectItem value="yearly">{t("contracts.annuallyLabel", "jährlich")} (tatsächlich)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Nur aktive Verträge mit bekanntem Zyklus zählen. Verträge mit unklarem Zyklus oder lange
              ohne Buchung werden nicht hochgerechnet, damit alte Verträge die Fixkosten nicht verfälschen.
            </p>
          </div>

          {/* Historische Entwicklung ist ein Advanced-Bereich (Premium). Die Basis-
              Vertragsliste darunter bleibt für Free zugänglich. */}
          <FeatureGate
            feature="advancedContracts"
            fallback={
              <div className="mb-4 rounded-lg border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Der Verlauf von Verträgen und Einnahmen über die Zeit ist Teil der
                Premium-Vertragsanalyse. Die aktuelle Vertragsliste kannst du frei nutzen.
              </div>
            }
          >
            <div className="w-full h-64 mb-4 rounded-lg border bg-card">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} />
                  <Tooltip formatter={(value: number) => euro(value)} />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Area type="monotone" dataKey="income" name={t("other.importTitle", "Einnahmen")} stroke="hsl(var(--positive))" fill="hsl(var(--positive))" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="expenses" name={t("contracts.contractsLabel", "Verträge")} stroke="hsl(var(--brand))" fill="hsl(var(--brand))" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="net" name={t("contracts.incomesMinusContracts", "Einnahmen − Verträge (Saldo)")} stroke="hsl(var(--foreground))" fill="hsl(var(--foreground))" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </FeatureGate>

          <ContractSuggestionsBanner rows={candidateRows} />

          {/* Aktive Verträge */}
          <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-semibold text-muted-foreground">Aktive Verträge ({activeRows.length})</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={rescanMutation.isPending}
                onClick={() => rescanMutation.mutate()}
              >
                {rescanMutation.isPending ? "Einlesen…" : "Verträge neu einlesen"}
              </Button>
              <div className="flex items-center gap-2">
                <Switch checked={onlyChanges} onCheckedChange={(v) => setOnlyChanges(Boolean(v))} />
                <span className="text-sm text-muted-foreground">Nur Veränderungen zeigen</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              {tableHead}
              <TableBody>
                {visibleActive.map(renderRow)}
                {visibleActive.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Noch keine Verträge aktiv. Bestätige oben einen Kandidaten oder markiere eine Transaktion als Vertrag.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Beendet / Archiv (einklappbar) */}
          {endedRows.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowEnded((v) => !v)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {showEnded ? "▾" : "▸"} {t("contracts.archivedAndEnded", "Beendet & Archiv")} ({endedRows.length})
              </button>
              {showEnded && (
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    {tableHead}
                    <TableBody>
                      {endedRows.map((row) => (
                        <TableRow key={row.key} onClick={() => openDetail(row)} className="cursor-pointer text-muted-foreground hover:bg-muted/50">
                          <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                          <TableCell className="font-medium">{row.payee}</TableCell>
                          <TableCell>{row.categoryName}</TableCell>
                          <TableCell>{row.cycleKnown ? row.cycle : "—"}</TableCell>
                          <TableCell>{euro(row.amountTypical)}</TableCell>
                          <TableCell>{euro(row.amountLast)}</TableCell>
                          <TableCell>{format(parseISO(row.lastDateISO), "dd.MM.yyyy")}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell><Badge variant="outline">{CONTRACT_STATUS_LABELS[row.status]}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <ContractDetailSheet row={detailRow} open={detailOpen} onOpenChange={setDetailOpen} />
        </CardContent>
      </Card>
    </div>
  );
}
