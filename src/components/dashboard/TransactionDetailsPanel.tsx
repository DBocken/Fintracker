import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, SplitSquareHorizontal, ArrowLeftRight, Sparkles, Check, X, Users, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/common/DecimalInput';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { TaxCategorySelect } from '@/components/tax/TaxCategorySelect';
import { getRubricForCategory } from '@/data/tax-catalog';
import { getAllocationsForTransaction } from '@/services/transaction-allocation-service';
import { safeAudit, redactForAudit } from '@/services/audit-log-service';
import { explainCategorization } from '@/lib/categorization';
import { getMerchantRules, upsertMerchantRule } from '@/services/merchant-rules-service';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction, Category, Account, Rhythmus } from '@/types';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { TransactionSplitPanel } from '@/components/transactions/TransactionSplitPanel';
import { HouseholdSplitPanel } from '@/components/transactions/HouseholdSplitPanel';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { FeatureGate } from '@/components/FeatureGate';
import { findSimilarTransactions, fingerprintReasonLabel } from '@/lib/merchant-fingerprint';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import {
  getRhythmusOptions,
  ausgabenklasseLabel,
  buildContractHint,
  buildDetailCategorySuggestion,
  buildDetailTaxDefault,
  getConfidenceLevelLabel,
  currentCategoryValue,
  diffTransactionDraft,
  draftFromTransaction,
  resolveCategorySelection,
  type TransactionDetailDraft,
} from './transaction-details';

export interface TransactionDetailsPanelProps {
  transaction: Transaction | null;
  categories: Category[];
  accounts: Account[];
  /** Gesamtbestand, um gleichartige Buchungen (Familie) zu finden. */
  allTransactions?: Transaction[];
  /**
   * Persistiert das Minimal-Diff der bearbeiteten Felder. `options.applyToSimilar`
   * gibt an, ob die Änderung auf die übrigen Buchungen der Familie übertragen wird.
   */
  onSave: (
    id: string,
    patch: Partial<Transaction>,
    options: { applyToSimilar: boolean; similarIds: string[] },
  ) => void;
  onToggleVisibility?: (id: string) => void;
  onDelete?: (id: string) => void;
  isHidden?: boolean;
  isLoading?: boolean;
  /** Schließen/Deselektieren (Dialog schließen bzw. Inline-Auswahl aufheben). */
  onClose: () => void;
  /** Beschriftung des sekundären Buttons (Dialog: „Abbrechen", Inline: „Schließen"). */
  closeLabel?: string;
  /**
   * `split` legt die Stammdaten (1/3) links und die Bearbeitung (2/3) rechts
   * nebeneinander (breiter Desktop-Dialog); `stacked` (Default) stapelt alles
   * vertikal (Mobil/Sheet).
   */
  layout?: 'stacked' | 'split';
}

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/**
 * Inhalt der Transaktionsdetails ohne Dialog-/Sheet-Rahmen. Wird sowohl vom
 * `TransactionDetailsModal` (Dialog auf Desktop, Sheet auf Mobil) als auch inline
 * als Detail-Spalte der Buchungsseite verwendet – so füllt das Detail auf großen
 * Screens den sonst leeren Raum, statt als Overlay zu erscheinen.
 */
export function TransactionDetailsPanel({
  transaction,
  categories,
  accounts,
  allTransactions = [],
  onSave,
  onToggleVisibility,
  onDelete,
  isHidden = false,
  isLoading = false,
  onClose,
  closeLabel,
  layout = 'stacked',
}: TransactionDetailsPanelProps) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Bearbeitbarer Entwurf; wird bei jedem Wechsel der Transaktion neu gesetzt.
  const [draft, setDraft] = useState<TransactionDetailDraft | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDraft(draftFromTransaction(transaction));
      setApplyToSimilar(true);
      setSuggestionDismissed(false);
    }
  }, [transaction]);

  const {
    data: learnedRules = [],
    isError: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['merchant-rules'],
    queryFn: getMerchantRules,
    enabled: !!transaction,
    staleTime: 5 * 60 * 1000,
  });

  // Gleicher Query-Key wie das TransactionSplitPanel (geteilter Cache; dessen
  // Save/Clear-Mutations invalidieren diesen Hinweis automatisch). Bewusst
  // AUSSERHALB der FeatureGate geladen: Aufteilungen überleben ein Tier-Downgrade,
  // der Steuer-Hinweis muss also auch ohne Premium sichtbar sein.
  const txIdForAllocations = transaction?.id ?? '';
  const {
    data: taxAllocations = [],
    isError: allocationsError,
    refetch: refetchAllocations,
  } = useQuery({
    queryKey: ['allocations', txIdForAllocations],
    queryFn: () => getAllocationsForTransaction(txIdForAllocations),
    enabled: !!txIdForAllocations,
  });

  const hasLoadError = rulesError || allocationsError;
  const retryAll = () => {
    void refetchRules();
    void refetchAllocations();
  };

  const similar = useMemo(() => {
    if (!transaction) return { exact: [], probable: [], reason: 'merchant' as const };
    return findSimilarTransactions(transaction, allTransactions);
  }, [transaction, allTransactions]);

  const categorySuggestion = useMemo(() => {
    if (!transaction || !draft) return null;
    const result = explainCategorization(transaction, categories, learnedRules);
    return buildDetailCategorySuggestion(draft, result, categoriesById);
  }, [transaction, categories, learnedRules, draft, categoriesById]);

  const contractHint = useMemo(() => {
    if (!transaction || !draft) return null;
    return buildContractHint(transaction, draft.is_contract, allTransactions);
  }, [transaction, draft, allTransactions]);

  if (!transaction || !draft) return null;

  if (hasLoadError) {
    return <FinanceErrorState variant="data" onRetry={retryAll} />;
  }

  const similarIds = similar.exact.map((tx) => tx.id!).filter(Boolean);
  const similarCount = similarIds.length;

  const account = transaction.account_id ? accountsById.get(transaction.account_id) : null;
  const ausgabenklasse = resolveAusgabenklasse(categoriesById, draft.subcategory_id || draft.category_id);

  const taxRubric = draft.tax_category_id ? getRubricForCategory(draft.tax_category_id) : undefined;
  const isHandwerkerRubric = taxRubric?.laborCostOnly === true;
  const requiresCashless = taxRubric?.requiresCashlessPayment === true;

  // Steuer-Default der gewählten Kategorie als Vorschlag (nie automatisch).
  const taxDefault = buildDetailTaxDefault(draft, transaction.amount, categoriesById);
  const taxDefaultRubric = taxDefault ? getRubricForCategory(taxDefault.taxCategoryId) : undefined;
  const taxDefaultRubricName = taxDefaultRubric ? t(taxDefaultRubric.nameKey as never, taxDefaultRubric.id) : '';

  const handleCategoryChange = (selectedId: string) => {
    const { category_id, subcategory_id } = resolveCategorySelection(categoriesById, selectedId);
    setDraft((d) => (d ? { ...d, category_id, subcategory_id } : d));
  };

  const acceptSuggestion = (rememberMerchant: boolean) => {
    if (!categorySuggestion) return;
    const { category_id, subcategory_id } = resolveCategorySelection(categoriesById, categorySuggestion.categoryId);
    setDraft((d) => (d ? { ...d, category_id, subcategory_id } : d));

    if (rememberMerchant) {
      const pattern = normalizeMerchantName(transaction.payee);
      if (pattern) {
        void upsertMerchantRule(pattern, categorySuggestion.categoryId).then(() =>
          showSuccess(t('transactionDetails.merchantRuleSaved')),
        );
      }
    }

    if (transaction.id) {
      void safeAudit({
        actor: 'user',
        entityType: 'transaction',
        entityId: transaction.id,
        action: rememberMerchant ? 'accept_category_suggestion_always' : 'accept_category_suggestion',
        title: t('transactionDetails.suggestionAcceptedAudit').replace('{category}', categorySuggestion.categoryLabel),
        redactedBefore: redactForAudit(transaction, ['category_id', 'subcategory_id']),
        redactedAfter: { category_id, subcategory_id },
        reversible: true,
        reversal: { operation: 'update', targetCollection: 'transactions', targetId: transaction.id },
      });
    }
  };

  const handleSave = () => {
    const patch = diffTransactionDraft(transaction, draft);
    if (Object.keys(patch).length > 0 && transaction.id) {
      if ('is_transfer' in patch) {
        void safeAudit({
          actor: 'user',
          entityType: 'transaction',
          entityId: transaction.id,
          action: patch.is_transfer ? 'mark_transfer' : 'unmark_transfer',
          title: patch.is_transfer ? t('transactionDetails.markedAsTransfer') : t('transactionDetails.unmarkedAsTransfer'),
          redactedBefore: redactForAudit(transaction, ['is_transfer', 'transfer_pair_id']),
          redactedAfter: { is_transfer: patch.is_transfer ?? false },
          reversible: true,
          reversal: { operation: 'update', targetCollection: 'transactions', targetId: transaction.id },
        });
      }
      if ('tax_category_id' in patch) {
        void safeAudit({
          actor: 'user',
          entityType: 'transaction',
          entityId: transaction.id,
          action: patch.tax_category_id ? 'mark_tax' : 'unmark_tax',
          title: patch.tax_category_id ? t('transactionDetails.markedAsTax', 'Als steuerrelevant markiert') : t('transactionDetails.unmarkedAsTax', 'Steuer-Markierung entfernt'),
          redactedBefore: redactForAudit(transaction, ['tax_category_id', 'tax_labor_costs', 'tax_note']),
          redactedAfter: { tax_category_id: patch.tax_category_id ?? null },
          reversible: true,
          reversal: { operation: 'update', targetCollection: 'transactions', targetId: transaction.id },
        });
      }
      onSave(transaction.id, patch, { applyToSimilar: applyToSimilar && similarCount > 0, similarIds });
    } else {
      onClose();
    }
  };

  const isSplit = layout === 'split';
  // Split-Layout: die Abschnitte fließen in zwei ausbalancierte Spalten (Masonry
  // über CSS-Columns). So bleibt keine Spalte halbleer, die Gesamthöhe halbiert
  // sich und der Dialog passt meist ohne Scrollbalken. Stacked (Mobil): eine Spalte.
  return (
    // Ein Anker fuer Desktop UND Mobil: Das Panel steckt in beiden Faellen
    // hier drin (Aside bzw. Modal) — ein zweiter Marker waere eine zweite
    // Wahrheit.
    <div data-tour-id="transaction-detail" className="py-2">
      <div
        className={
          isSplit
            ? 'gap-x-8 md:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid'
            : 'space-y-4'
        }
      >
      {/* Stammdaten (read-only) */}
      <div data-tour-id="detail-basics" className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">{t('dashboard.date')}</Label>
          <p className="font-medium">{format(parseISO(transaction.date), 'dd. MMMM yyyy', { locale: de })}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t('dashboard.amount')}</Label>
          <p className={`font-medium tabular-nums ${transaction.amount < 0 ? 'text-warning' : 'text-positive'}`}>
            {money.mask(currencyFormatter.format(transaction.amount))}
          </p>
        </div>
        <div data-tour-id="detail-payee" className="col-span-2">
          <Label className="text-xs text-muted-foreground">{t('transactionDetails.payeeLabel')}</Label>
          <p className="font-medium">{transaction.payee || t('common.unknown')}</p>
        </div>
        {transaction.description && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">{t('dashboard.description')}</Label>
            <p className="text-sm">{transaction.description}</p>
          </div>
        )}
        {transaction.counterparty_iban && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">{t('transactionDetails.counterpartyIbanLabel')}</Label>
            <p className="font-medium tabular-nums break-all">{transaction.counterparty_iban}</p>
          </div>
        )}
        {account && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">{t('dashboard.account')}</Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" />
              <span aria-hidden="true">{account.icon}</span>
              <span className="font-medium">{account.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Kategorisierung */}
      <div data-tour-id="detail-category" className={cn('space-y-2 pt-4', !isSplit && 'border-t')}>
        <h3 className="text-sm font-semibold text-muted-foreground">{t('dashboard.transactionDetailsPanel.categorization')}</h3>

        {categorySuggestion && !suggestionDismissed && (
          <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">Vorschlag: {categorySuggestion.categoryLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {getConfidenceLevelLabel()[categorySuggestion.confidenceLevel]}
                  {categorySuggestion.reasons[0] ? ` · ${categorySuggestion.reasons[0]}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={isLoading} onClick={() => acceptSuggestion(false)}>
                <Check className="mr-1 h-4 w-4" aria-hidden="true" /> Übernehmen
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => acceptSuggestion(true)}>
                {t('transactionDetails.alwaysForMerchant').replace(
                  '{merchant}',
                  transaction.payee || t('transactionDetails.thisMerchantFallback'),
                )}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={isLoading} onClick={() => setSuggestionDismissed(true)}>
                <X className="mr-1 h-4 w-4" aria-hidden="true" /> Ablehnen
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t('dashboard.category')}</Label>
          <CategoryTwoStepSelect
            categories={categories}
            value={currentCategoryValue(draft)}
            disabled={isLoading}
            onChange={handleCategoryChange}
          />
        </div>
        <div data-tour-id="detail-expense-class" className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">{t('transactionFilters.ausgabenklasseLabel')}</span>
          <Badge variant={ausgabenklasse ? 'default' : 'secondary'}>{ausgabenklasseLabel(ausgabenklasse)}</Badge>
        </div>
      </div>

      {/* Sammeländerung */}
      {similarCount > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="apply-similar"
              checked={applyToSimilar}
              disabled={isLoading}
              onCheckedChange={(checked) => setApplyToSimilar(checked === true)}
            />
            <div data-tour-id="detail-apply-similar" className="flex-1">
              <Label htmlFor="apply-similar" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4" aria-hidden="true" />
                {t('transactionDetails.applyToSimilar')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {similarCount} passende Buchung{similarCount === 1 ? '' : 'en'} werden mitgeändert.
                {similar.probable.length > 0 && ` (${similar.probable.length} wahrscheinliche ausgenommen)`}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Warum gruppiert? {fingerprintReasonLabel(similar.reason)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aufteilung (Premium) */}
      <div className={cn('pt-4', !isSplit && 'border-t')}>
        <FeatureGate
          feature="splitTransactions"
          fallback={
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <SplitSquareHorizontal className="h-4 w-4" />
                Buchung aufteilen
                <Badge className="border-none bg-premium text-premium-foreground">Pro</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Buchungen cent-genau auf mehrere Kategorien aufteilen.{' '}
                <Link to="/settings" className="underline underline-offset-2">{t('transactionDetails.unlockPremium')}</Link>
              </p>
            </div>
          }
        >
          <TransactionSplitPanel transaction={transaction} categories={categories} />
        </FeatureGate>

        <FeatureGate feature="familyMode" fallback={null}>
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" aria-hidden="true" /> {t('transactionDetails.shareInHousehold')}
            </div>
            <HouseholdSplitPanel transaction={transaction} />
          </div>
        </FeatureGate>
      </div>

      {/* Vertrag */}
      <div data-tour-id="detail-contract" className={cn('space-y-3 pt-4', !isSplit && 'border-t')}>
        <h3 className="text-sm font-semibold text-muted-foreground">{t('dashboard.transactionDetailsPanel.contractSection')}</h3>

        {contractHint && (
          <div className="flex items-start gap-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('dashboard.transactionDetailsPanel.contractActsLike')}</p>
              <p className="text-xs text-muted-foreground">
                {contractHint.reason} {t('dashboard.transactionDetailsPanel.contractActsLikeHint')}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-contract"
            checked={draft.is_contract}
            disabled={isLoading}
            onCheckedChange={(checked) => setDraft((d) => (d ? { ...d, is_contract: checked === true } : d))}
          />
          <Label htmlFor="is-contract" className="cursor-pointer text-sm font-normal">
            {t('dashboard.transactionDetailsPanel.isContractLabel')}
          </Label>
        </div>

        {draft.is_contract && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-select" className="text-xs text-muted-foreground">{t('transactionDetails.cycleLabel')}</Label>
            <Select
              value={draft.contract_cycle ?? ''}
              disabled={isLoading}
              onValueChange={(value) => setDraft((d) => (d ? { ...d, contract_cycle: (value as Rhythmus) || null } : d))}
            >
              <SelectTrigger id="cycle-select" aria-label={t('transactionDetails.cycleLabel')}>
                <SelectValue placeholder={t('dashboard.selectCycle')} />
              </SelectTrigger>
              <SelectContent>
                {getRhythmusOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Interner Übertrag */}
      <div className={cn('space-y-2 pt-4', !isSplit && 'border-t')}>
        <h3 className="text-sm font-semibold text-muted-foreground">{t('dashboard.transactionDetailsPanel.internalTransfer')}</h3>
        <div className="flex items-start gap-2">
          <Checkbox
            id="is-transfer"
            checked={draft.is_transfer ?? false}
            disabled={isLoading}
            onCheckedChange={(checked) => setDraft((d) => (d ? { ...d, is_transfer: checked === true } : d))}
          />
          <div data-tour-id="detail-transfer" className="flex-1">
            <Label htmlFor="is-transfer" className="flex cursor-pointer items-center gap-1.5 text-sm font-normal">
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              {t('transactionDetails.markAsTransferLabel')}
            </Label>
            <p className="text-xs text-muted-foreground">
              Überträge werden aus Ausgaben-/Einnahmen-Analysen ausgeschlossen.
              {transaction.transfer_pair_id ? t('transactionDetails.transferPairHint') : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Steuer */}
      {!draft.is_transfer && (
        <div className={cn('space-y-3 pt-4', !isSplit && 'border-t')}>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Landmark className="h-4 w-4" aria-hidden="true" /> {t('tax.form.sectionTitle', 'Steuer')}
          </h3>

          {/* EÜR-Exklusion: nur auf Geschäftskonten sichtbar (Regel: privat gewinnt). */}
          {account?.is_business && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="euer-private"
                checked={draft.euer_private ?? false}
                disabled={isLoading}
                onCheckedChange={(checked) => setDraft((d) => (d ? { ...d, euer_private: checked === true } : d))}
              />
              <div className="flex-1">
                <Label htmlFor="euer-private" className="cursor-pointer text-sm font-normal">
                  {t('tax.form.euerPrivateLabel', 'Private Buchung (nicht in die EÜR)')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('tax.form.euerPrivateHint', 'Schließt diese Buchung trotz Geschäftskonto aus der Einnahmenüberschussrechnung aus.')}
                </p>
              </div>
            </div>
          )}

          {taxDefault && (
            <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <p className="flex-1 text-xs text-muted-foreground">
                  {t('tax.suggestReason.categoryDefault', 'Kategorie „{category}" ist als {rubric} voreingestellt')
                    .replace('{category}', taxDefault.categoryName)
                    .replace('{rubric}', taxDefaultRubricName)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={isLoading}
                onClick={() => setDraft((d) => (d ? { ...d, tax_category_id: taxDefault.taxCategoryId } : d))}
              >
                <Check className="mr-1 h-4 w-4" aria-hidden="true" /> {t('tax.form.applySuggestion', 'Übernehmen')}
              </Button>
            </div>
          )}

          <div data-tour-id="detail-tax" className="flex flex-col gap-1.5">
            <Label htmlFor="tax-category-select" className="text-xs text-muted-foreground">
              {t('tax.form.rubricLabel', 'Steuer-Rubrik')}
            </Label>
            <TaxCategorySelect
              id="tax-category-select"
              value={draft.tax_category_id}
              onChange={(taxId) => setDraft((d) => (d ? { ...d, tax_category_id: taxId } : d))}
            />
          </div>

          {transaction.amount > 0 && draft.tax_category_id && (
            <p className="text-xs text-muted-foreground">{t('tax.form.refundHint', 'Positive Beträge werden als Erstattung gewertet und mindern die Rubrik.')}</p>
          )}

          {draft.tax_category_id && taxAllocations.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('tax.form.splitHint', 'Diese Buchung ist aufgeteilt – die Steuer-Markierung bezieht sich auf den Gesamtbetrag.')}
            </p>
          )}

          {isHandwerkerRubric && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax-labor-costs" className="text-xs text-muted-foreground">
                {t('tax.form.laborCostsLabel', 'davon Arbeitskosten (€)')}
              </Label>
              <DecimalInput
                id="tax-labor-costs"
                value={draft.tax_labor_costs ?? null}
                disabled={isLoading}
                onChange={(v) => setDraft((d) => (d ? { ...d, tax_labor_costs: v } : d))}
              />
              <p className="text-xs text-muted-foreground">
                {draft.tax_labor_costs
                  ? t('tax.form.laborCostsHint', 'Nur der Arbeits-/Fahrtkostenanteil ist bei Handwerkerleistungen begünstigt.')
                  : t('tax.form.laborCostsMissing', 'Ohne Arbeitskostenanteil wird keine Ermäßigung berechnet.')}
              </p>
            </div>
          )}

          {draft.tax_category_id && (
            <>
              {requiresCashless && (
                <p className="text-xs text-warning">{t('tax.form.cashlessHint', 'Wichtig: nur unbare Zahlung (Überweisung) wird anerkannt. Rechnung aufbewahren.')}</p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-note" className="text-xs text-muted-foreground">
                  {t('tax.form.noteLabel', 'Steuer-Notiz')}
                </Label>
                <Input
                  id="tax-note"
                  value={draft.tax_note ?? ''}
                  disabled={isLoading}
                  placeholder={t('tax.form.notePlaceholder', 'z. B. Rechnungsnummer, Zahlungsweg')}
                  onChange={(e) => setDraft((d) => (d ? { ...d, tax_note: e.target.value || null } : d))}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Aktionen: Sichtbarkeit & Löschen */}
      {(onToggleVisibility || onDelete) && (
        <div className={cn('flex gap-2 pt-4', !isSplit && 'border-t')}>
          {onToggleVisibility && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              data-tour-id="detail-visibility"
              disabled={isLoading || !transaction.id}
              onClick={() => transaction.id && onToggleVisibility(transaction.id)}
            >
              {isHidden ? (
                <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> {t('dashboard.show')}</>
              ) : (
                <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> {t('dashboard.hide')}</>
              )}
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-warning hover:text-warning"
              disabled={isLoading || !transaction.id}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('transactionDetails.deleteButton')}
            </Button>
          )}
        </div>
      )}
      </div>

      {/* Speichern / Schließen – volle Breite unter beiden Spalten */}
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {/* Der Standardtext kann nicht im Default-Parameter stehen — dort ist
              kein Hook erlaubt. Aufgeloest wird er hier. */}
          {closeLabel ?? t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {t('transactionDetails.saveButton')}
        </Button>
      </div>

      {onDelete && (
        <DeleteConfirmationDialog
          isOpen={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          transactionId={transaction?.id ?? null}
          selectedCount={0}
          onConfirm={() => {
            if (transaction?.id) onDelete(transaction.id);
            setDeleteConfirmOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
