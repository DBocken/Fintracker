import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, SplitSquareHorizontal, ArrowLeftRight, Sparkles, Check, X } from 'lucide-react';
import { safeAudit, redactForAudit } from '@/services/audit-log-service';
import { explainCategorization } from '@/services/transaction-service';
import { getMerchantRules, upsertMerchantRule } from '@/services/merchant-rules-service';
import { normalizeMerchantName } from '@/services/merchant-normalization';
import { showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction, Category, Account, Rhythmus } from '@/types';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { Link } from 'react-router-dom';
import { TransactionSplitPanel } from '@/components/transactions/TransactionSplitPanel';
import { FeatureGate } from '@/components/FeatureGate';
import { Users } from 'lucide-react';
import { findSimilarTransactions, fingerprintReasonLabel } from '@/lib/merchant-fingerprint';
import {
  RHYTHMUS_OPTIONS,
  ausgabenklasseLabel,
  buildContractHint,
  buildDetailCategorySuggestion,
  CONFIDENCE_LEVEL_LABEL,
  currentCategoryValue,
  diffTransactionDraft,
  draftFromTransaction,
  resolveCategorySelection,
  type TransactionDetailDraft,
} from './transaction-details';

interface TransactionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function TransactionDetailsModal({
  open,
  onOpenChange,
  transaction,
  categories,
  accounts,
  allTransactions = [],
  onSave,
  onToggleVisibility,
  onDelete,
  isHidden = false,
  isLoading = false,
}: TransactionDetailsModalProps) {
  const { t } = useI18n();
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Bearbeitbarer Entwurf; wird bei jedem Öffnen aus der Transaktion neu gesetzt.
  const [draft, setDraft] = useState<TransactionDetailDraft | null>(null);
  // Pro Sitzung abgelehnte Kategorie-Vorschläge (nicht erneut zeigen).
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (transaction && open) {
      setDraft(draftFromTransaction(transaction));
      setApplyToSimilar(true);
      setSuggestionDismissed(false);
    }
  }, [transaction, open]);

  // Gelernte Händlerregeln für erklärbare Kategorie-Vorschläge.
  const { data: learnedRules = [] } = useQuery({
    queryKey: ['merchant-rules'],
    queryFn: getMerchantRules,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Gleichartige Buchungen (Familie) für die Sammeländerung bestimmen.
  const similar = useMemo(() => {
    if (!transaction) return { exact: [], probable: [], reason: 'merchant' as const };
    return findSimilarTransactions(transaction, allTransactions);
  }, [transaction, allTransactions]);

  // Erklärbarer Kategorie-Vorschlag (nur bei unsicherer, unkategorisierter Buchung).
  // Vor dem Early-Return, damit die Hook-Reihenfolge stabil bleibt.
  const categorySuggestion = useMemo(() => {
    if (!transaction || !draft) return null;
    const result = explainCategorization(transaction, categories, learnedRules);
    return buildDetailCategorySuggestion(draft, result, categoriesById);
  }, [transaction, categories, learnedRules, draft, categoriesById]);

  // Leichter Hinweis „Wirkt wie ein Vertrag“ – nur wenn noch nicht als Vertrag
  // markiert und das wiederkehrende Muster im Bestand erkennbar ist. Die
  // Bestätigung läuft über die bestehende is_contract-Checkbox (kein Parallelpfad).
  const contractHint = useMemo(() => {
    if (!transaction || !draft) return null;
    return buildContractHint(transaction, draft.is_contract, allTransactions);
  }, [transaction, draft, allTransactions]);

  if (!transaction || !draft) return null;

  const similarIds = similar.exact.map((t) => t.id!).filter(Boolean);
  const similarCount = similarIds.length;

  const account = transaction.account_id ? accountsById.get(transaction.account_id) : null;
  // Ausgabenklasse aus dem Entwurf ableiten, damit sie live auf Kategorie-Wechsel reagiert.
  const ausgabenklasse = resolveAusgabenklasse(
    categoriesById,
    draft.subcategory_id || draft.category_id
  );

  const handleCategoryChange = (selectedId: string) => {
    const { category_id, subcategory_id } = resolveCategorySelection(categoriesById, selectedId);
    setDraft((d) => (d ? { ...d, category_id, subcategory_id } : d));
  };

  // Vorschlag übernehmen: setzt die Kategorie im Entwurf (persistiert beim Speichern).
  const acceptSuggestion = (rememberMerchant: boolean) => {
    if (!categorySuggestion) return;
    const { category_id, subcategory_id } = resolveCategorySelection(
      categoriesById,
      categorySuggestion.categoryId,
    );
    setDraft((d) => (d ? { ...d, category_id, subcategory_id } : d));

    if (rememberMerchant) {
      // Fachliche Mutation zuerst (schreibt selbst Audit), dann UI-Feedback.
      const pattern = normalizeMerchantName(transaction.payee);
      if (pattern) {
        void upsertMerchantRule(pattern, categorySuggestion.categoryId).then(() =>
          showSuccess('Händlerregel gespeichert'),
        );
      }
    }

    // Annahme des Vorschlags als reversiblen Audit-Eintrag festhalten. Die
    // eigentliche Kategorie-Persistenz läuft über den normalen Speichern-Pfad
    // (Draft → onSave); hier wird nur die Nutzerentscheidung dokumentiert.
    if (transaction.id) {
      void safeAudit({
        actor: 'user',
        entityType: 'transaction',
        entityId: transaction.id,
        action: rememberMerchant ? 'accept_category_suggestion_always' : 'accept_category_suggestion',
        title: `Kategorie-Vorschlag übernommen: ${categorySuggestion.categoryLabel}`,
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
      // Manuelle Transfer-Markierung als reversiblen Audit-Eintrag festhalten.
      if ('is_transfer' in patch) {
        void safeAudit({
          actor: 'user',
          entityType: 'transaction',
          entityId: transaction.id,
          action: patch.is_transfer ? 'mark_transfer' : 'unmark_transfer',
          title: patch.is_transfer
            ? 'Als internen Übertrag markiert'
            : 'Transfer-Markierung entfernt',
          redactedBefore: redactForAudit(transaction, ['is_transfer', 'transfer_pair_id']),
          redactedAfter: { is_transfer: patch.is_transfer ?? false },
          reversible: true,
          reversal: { operation: 'update', targetCollection: 'transactions', targetId: transaction.id },
        });
      }
      onSave(transaction.id, patch, {
        applyToSimilar: applyToSimilar && similarCount > 0,
        similarIds,
      });
    } else {
      onOpenChange(false);
    }
  };

  const content = (
    <div className="space-y-4 py-2">
      {/* Stammdaten (read-only) */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Datum</Label>
          <p className="font-medium">{format(parseISO(transaction.date), 'dd. MMMM yyyy', { locale: de })}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Betrag</Label>
          <p className={`font-medium tabular-nums ${transaction.amount < 0 ? 'text-warning' : 'text-positive'}`}>
            {currencyFormatter.format(transaction.amount)}
          </p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Empfänger/Zahler</Label>
          <p className="font-medium">{transaction.payee || 'Unbekannt'}</p>
        </div>
        {transaction.description && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm">{transaction.description}</p>
          </div>
        )}
        {transaction.counterparty_iban && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Empfänger-IBAN</Label>
            <p className="font-medium tabular-nums break-all">{transaction.counterparty_iban}</p>
          </div>
        )}
        {account && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Konto</Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" />
              <span aria-hidden="true">{account.icon}</span>
              <span className="font-medium">{account.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Kategorisierung */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Kategorisierung</h3>

        {/* Erklärbarer Vorschlag – nur bei unsicherer, unkategorisierter Buchung */}
        {categorySuggestion && !suggestionDismissed && (
          <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Vorschlag: {categorySuggestion.categoryLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {CONFIDENCE_LEVEL_LABEL[categorySuggestion.confidenceLevel]}
                  {categorySuggestion.reasons[0] ? ` · ${categorySuggestion.reasons[0]}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isLoading}
                onClick={() => acceptSuggestion(false)}
              >
                <Check className="mr-1 h-4 w-4" aria-hidden="true" /> Übernehmen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => acceptSuggestion(true)}
              >
                Immer für „{transaction.payee || 'diesen Händler'}“
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoading}
                onClick={() => setSuggestionDismissed(true)}
              >
                <X className="mr-1 h-4 w-4" aria-hidden="true" /> Ablehnen
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Kategorie</Label>
          <CategoryTwoStepSelect
            categories={categories}
            value={currentCategoryValue(draft)}
            disabled={isLoading}
            onChange={handleCategoryChange}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">Ausgabenklasse</span>
          <Badge variant={ausgabenklasse ? 'default' : 'secondary'}>{ausgabenklasseLabel(ausgabenklasse)}</Badge>
        </div>
      </div>

      {/* Sammeländerung: auf gleichartige Buchungen anwenden */}
      {similarCount > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="apply-similar"
              checked={applyToSimilar}
              disabled={isLoading}
              onCheckedChange={(checked) => setApplyToSimilar(checked === true)}
            />
            <div className="flex-1">
              <Label htmlFor="apply-similar" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4" aria-hidden="true" />
                Auf ähnliche Transaktionen anwenden
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

      {/* Aufteilung auf mehrere Kategorien (Premium) */}
      <div className="border-t pt-4">
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
                <Link to="/settings" className="underline underline-offset-2">Premium freischalten</Link>
              </p>
            </div>
          }
        >
          <TransactionSplitPanel transaction={transaction} categories={categories} />
        </FeatureGate>
      </div>

      {/* Vertragsinformationen */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Vertrag</h3>

        {/* Hinweis (kein Zwang): wirkt wie ein wiederkehrender Vertrag */}
        {contractHint && (
          <div className="flex items-start gap-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium">Wirkt wie ein Vertrag</p>
              <p className="text-xs text-muted-foreground">
                {contractHint.reason} Markiere die Buchung unten, falls das zutrifft.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-contract"
            checked={draft.is_contract}
            disabled={isLoading}
            onCheckedChange={(checked) =>
              setDraft((d) => (d ? { ...d, is_contract: checked === true } : d))
            }
          />
          <Label htmlFor="is-contract" className="cursor-pointer text-sm font-normal">
            Dies ist ein Vertrag/Abonnement
          </Label>
        </div>

        {draft.is_contract && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-select" className="text-xs text-muted-foreground">
              Zahlungszyklus
            </Label>
            <Select
              value={draft.contract_cycle ?? ''}
              disabled={isLoading}
              onValueChange={(value) =>
                setDraft((d) => (d ? { ...d, contract_cycle: (value as Rhythmus) || null } : d))
              }
            >
              <SelectTrigger id="cycle-select">
                <SelectValue placeholder={t("dashboard.selectCycle")} />
              </SelectTrigger>
              <SelectContent>
                {RHYTHMUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Interner Übertrag */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Interner Übertrag</h3>
        <div className="flex items-start gap-2">
          <Checkbox
            id="is-transfer"
            checked={draft.is_transfer ?? false}
            disabled={isLoading}
            onCheckedChange={(checked) =>
              setDraft((d) => (d ? { ...d, is_transfer: checked === true } : d))
            }
          />
          <div className="flex-1">
            <Label htmlFor="is-transfer" className="flex cursor-pointer items-center gap-1.5 text-sm font-normal">
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              Als internen Übertrag zwischen eigenen Konten markieren
            </Label>
            <p className="text-xs text-muted-foreground">
              Überträge werden aus Ausgaben-/Einnahmen-Analysen ausgeschlossen.
              {transaction.transfer_pair_id
                ? ' Beim Entfernen wird auch die verknüpfte Gegenbuchung gelöst.'
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Aktionen: Sichtbarkeit & Löschen */}
      {(onToggleVisibility || onDelete) && (
        <div className="flex gap-2 border-t pt-4">
          {onToggleVisibility && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isLoading || !transaction.id}
              onClick={() => transaction.id && onToggleVisibility(transaction.id)}
            >
              {isHidden ? (
                <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Einblenden</>
              ) : (
                <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> Ausblenden</>
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
              onClick={() => {
                if (transaction.id) onDelete(transaction.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
        Abbrechen
      </Button>
      <Button onClick={handleSave} disabled={isLoading}>
        Speichern
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaktionsdetails</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="gap-2">{footerButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-lg">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-left">Transaktionsdetails</SheetTitle>
        </SheetHeader>
        {content}
        <SheetFooter className="mt-4 gap-2 border-t pt-4">{footerButtons}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
