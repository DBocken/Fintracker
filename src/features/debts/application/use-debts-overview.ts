/**
 * ViewModel der Schulden-Fläche.
 *
 * Bündelt Beschaffen (vier Abfragen), Ändern (fünf Mutationen), Auswahl und
 * die daraus abgeleiteten Kennzahlen. Alles davon stand zuvor in
 * `DebtsPage.tsx` und war damit nur über einen gerenderten Screen prüfbar —
 * die Rechenfehler in der Zusatztilgung (`parseFloat`) und in den Summen
 * konnten deshalb jahrelang unbemerkt bleiben.
 *
 * Die Formatierung bleibt bewusst draußen: `t()`, `useMoneyFormat` und die
 * Euro-Darstellung sind Sache der Darstellung, nicht des Modells. Was hier
 * `t()` benutzt, sind Meldungen an den Nutzer nach einer Mutation und die
 * Anzeige-Labels der Schuldenarten — beides gehört zur Aktion, nicht zum
 * Layout.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";
import { showError, showSuccess } from "@/utils/toast";
import { useDebtFreedom } from "@/hooks/useDebtFreedom";
import type { Debt, Transaction } from "@/types";
import type { DebtTransactionAssignment } from "@/lib/debt-types";
import { totalMinimumPayment, totalOutstandingDebt } from "@/lib/debt-totals";
import { assessDebtCounseling } from "@/lib/debt-counseling";
import { getAllTransactions } from "@/services/transaction-service";
import { getFinancialHealth } from "@/services/financial-health-service";
import {
  assignTransactionToDebt,
  calculatePayoffPlan,
  createDebt,
  deleteDebt,
  getDebtTransactionAssignments,
  getDebtTypeLabels,
  getDebts,
  unassignDebtTransaction,
  updateDebt,
  type PayoffStrategy,
} from "@/services/debt-service";
import { getDebtStrategy, setDebtStrategy } from "@/services/debt-strategy-service";
import {
  parseExtraBudget,
  sumAssignedAmounts,
  summarizeDebtCauses,
} from "../domain/debt-overview";
import {
  DEBT_DEPENDENT_KEYS,
  debtsKeys,
} from "../data/debts-query-keys";

export function useDebtsOverview() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const debtTypeLabels = getDebtTypeLabels();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Debt> | null>(null);
  // Portfolio-Strategie: global, persistiert, gilt für alle Schulden (#54)
  const [strategy, setStrategyState] = useState<PayoffStrategy>(getDebtStrategy);
  const setStrategy = (next: PayoffStrategy) => {
    setStrategyState(next);
    setDebtStrategy(next);
  };
  // Zahl statt Rohtext: Das Feld ist ein `<DecimalInput>`, das bereits eine
  // gelesene Zahl liefert. `parseExtraBudget` bleibt trotzdem davor stehen —
  // es nimmt weiterhin auch Strings entgegen (Altbestand, Tests) und macht aus
  // „nichts eingetragen" eine 0, ohne die es keinen Plan zu rechnen gaebe.
  const [extraBudget, setExtraBudget] = useState<number | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");
  // Mobile-Detailansicht (Audit C-P1/F): Zuordnung/Aktionen pro Schuld im Sheet.
  const [detailDebtId, setDetailDebtId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // WP-9.6: `isError` UND `refetch` — ohne den Fehlerzustand wuerde ein
  // Lesefehler unten als „Noch keine Schulden erfasst" erscheinen, und das ist
  // ausgerechnet hier die unbarmherzigste Verwechslung, die die App anbieten
  // kann.
  const {
    data: debts = [],
    isLoading,
    isError: debtsError,
    refetch: refetchDebts,
  } = useQuery({
    queryKey: debtsKeys.debts,
    queryFn: getDebts,
  });

  const {
    data: transactions = [],
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<Transaction[]>({
    queryKey: debtsKeys.assignableTransactions,
    queryFn: () => getAllTransactions(),
    enabled: debts.length > 0,
  });

  const {
    data: assignments = [],
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery<DebtTransactionAssignment[]>({
    queryKey: debtsKeys.assignments,
    queryFn: getDebtTransactionAssignments,
    enabled: debts.length > 0,
  });

  // Einkommens-/Ausgabenmittel speisen die Überschuldungs-Heuristik (Issue #50).
  const {
    data: health,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: debtsKeys.financialHealth(locale),
    queryFn: getFinancialHealth,
    enabled: debts.length > 0,
  });

  // EIN Fehlerblock fuer die ganze Seite, nicht vier. Alle vier Abfragen
  // speisen dieselbe Aussage („was schuldest du und wie zahlst du es ab") —
  // vier getrennte Meldungen waeren vier Raetsel statt eines Hinweises.
  // Genau daran ist ein Versuch schon gescheitert: Der Test fand zwei Knoepfe
  // „Erneut versuchen" auf einem Screen.
  const hasLoadError = debtsError || transactionsError || assignmentsError || healthError;
  const retryAll = () => {
    void refetchDebts();
    void refetchTransactions();
    void refetchAssignments();
    void refetchHealth();
  };

  const invalidate = () => {
    for (const queryKey of DEBT_DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  };

  const createMutation = useMutation({
    mutationFn: createDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.addSuccess"));
      setDialogOpen(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.updateSuccess"));
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.deleteSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignTransactionToDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.assignSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignDebtTransaction,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.unassignSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const totalDebt = totalOutstandingDebt(debts);

  // WP-7.4: Der Erfolgsmoment erscheint genau einmal je Schuldenfreiheit — und
  // NICHT bei jemandem, der nie Schulden erfasst hat (dort waere er albern bis
  // verletzend). `isLoading` sperrt den Fehlalarm ab, waehrend die Summe noch
  // 0 ist, weil die Daten fehlen.
  const celebrateDebtFreedom = useDebtFreedom(totalDebt, isLoading);

  const totalMin = totalMinimumPayment(debts);
  const extraPayment = parseExtraBudget(extraBudget);

  const payoffPlan = useMemo(
    () => calculatePayoffPlan(debts, totalMin + extraPayment, strategy),
    [debts, totalMin, extraPayment, strategy],
  );

  // Schuldnerberatungs-Empfehlung: schlägt nur an, wenn der Plan auf eine
  // Überschuldung hindeutet (nie aufgehend, > 6 Jahre, Raten > Spielraum).
  const counseling = useMemo(
    () =>
      assessDebtCounseling({
        plan: payoffPlan,
        monthlyRate: totalMin + extraPayment,
        minPayments: totalMin,
        monthlyIncome: health?.monthlyIncome ?? 0,
        monthlyExpenses: health?.monthlyExpenses ?? 0,
      }),
    [payoffPlan, totalMin, extraPayment, health],
  );

  const currentDebtId = selectedDebtId || debts.find((d) => !d.is_paid_off)?.id || debts[0]?.id || "";
  const selectedDebt = debts.find((d) => d.id === currentDebtId) || null;

  const assignmentByTransactionId = useMemo(() => {
    const map = new Map<string, DebtTransactionAssignment>();
    for (const assignment of assignments) {
      map.set(assignment.transaction_id, assignment);
    }
    return map;
  }, [assignments]);

  const assignedToSelectedDebt = useMemo(
    () => assignments.filter((assignment) => assignment.debt_id === currentDebtId),
    [assignments, currentDebtId],
  );

  const debitTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.id && transaction.amount < 0),
    [transactions],
  );

  const totalAssignedToSelectedDebt = sumAssignedAmounts(assignedToSelectedDebt);

  const causes = useMemo(
    () => summarizeDebtCauses(debts, debtTypeLabels),
    [debts, debtTypeLabels],
  );

  const saveDebt = (data: Partial<Debt>) => {
    if (editing?.id) updateMutation.mutate({ ...data, id: editing.id });
    else createMutation.mutate(data);
  };

  const startCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const startEdit = (debt: Partial<Debt>) => {
    setEditing(debt);
    setDialogOpen(true);
  };

  const removeDebt = (id: string) => deleteMutation.mutate(id);

  const togglePaidOff = (debt: Debt) => {
    updateMutation.mutate({
      id: debt.id,
      is_paid_off: !debt.is_paid_off,
      balance: !debt.is_paid_off ? 0 : debt.balance,
    });
  };

  const toggleAssignmentFor = (debtId: string, transaction: Transaction, checked: boolean) => {
    if (!transaction.id || !debtId) return;

    const existing = assignmentByTransactionId.get(transaction.id);
    if (checked) {
      if (existing) return;
      assignMutation.mutate({ debtId, transactionId: transaction.id });
      return;
    }

    if (existing?.debt_id === debtId) {
      unassignMutation.mutate(existing.id);
    }
  };

  const toggleAssignmentForSelected = (transaction: Transaction, checked: boolean) =>
    toggleAssignmentFor(currentDebtId, transaction, checked);

  const openDetail = (debt: Debt) => {
    setDetailDebtId(debt.id);
    setDetailOpen(true);
  };

  const detailDebt = debts.find((d) => d.id === detailDebtId) || null;

  return {
    // Ladezustand
    isLoading,
    hasLoadError,
    retryAll,

    // Daten
    debts,
    debitTransactions,
    debtTypeLabels,

    // Kennzahlen
    totalDebt,
    totalMin,
    payoffPlan,
    counseling,
    causes,
    celebrateDebtFreedom,

    // Strategie und Zusatztilgung
    strategy,
    setStrategy,
    extraBudget,
    setExtraBudget,
    /** Die gelesene Zusatztilgung in Euro — das, womit der Plan wirklich rechnet. */
    extraPayment,

    // Zuordnung
    currentDebtId,
    setSelectedDebtId,
    selectedDebt,
    assignmentByTransactionId,
    assignedToSelectedDebt,
    totalAssignedToSelectedDebt,
    toggleAssignmentFor,
    toggleAssignmentForSelected,
    assignBusy: assignMutation.isPending || unassignMutation.isPending,

    // Formular
    dialogOpen,
    setDialogOpen,
    importDialogOpen,
    setImportDialogOpen,
    editing,
    startCreate,
    startEdit,
    saveDebt,
    removeDebt,
    togglePaidOff,
    saveBusy: createMutation.isPending || updateMutation.isPending,

    // Detail-Sheet
    detailDebt,
    detailOpen,
    setDetailOpen,
    openDetail,
  };
}
