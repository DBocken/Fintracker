import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n/useI18n';
import type { Account, AccountType } from '../../types';
import {
  getAccountTypeLabels,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_COLORS
} from '../../services/account-service';

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accounts: Account[];
  onSave: (data: Partial<Account>) => void;
  isLoading: boolean;
}

const ACCOUNT_TYPES: AccountType[] = ['checking', 'credit_card', 'savings', 'wallet', 'cash', 'other'];

/** Die einzige Währung, in der Fintracker rechnet (VE-1). */
const RECHENWAEHRUNG = 'EUR';

/**
 * Welche Währungen dieser Dialog anbietet — EUR, plus die bereits gespeicherte
 * Währung, falls das bearbeitete Konto eine andere trägt.
 *
 * Neu wählbar ist ausschließlich EUR: Keine Aggregation liest
 * `Account.currency` (`analysis-data.ts`, `budget-logic.ts`, `forecast.ts`
 * kennen das Feld nicht), ein Fremdwährungskonto schickt seine Buchungen also
 * 1:1 als Euro in Einnahmen, Ausgaben, Budgets, Prognose, EÜR und
 * Finanzgesundheit. Was die App nicht verrechnen kann, gehört nicht in die
 * Auswahl (ADR `docs/architecture/currency-eur-only.md`).
 *
 * Die vorhandene Fremdwährung bleibt trotzdem stehen, und zwar aus einem
 * Datenschutzgrund im Wortsinn: Ein Radix-`Select` mit einem Wert ohne
 * passenden `SelectItem` zeigt einen LEEREN Auslöser. Der Nutzer sähe ein
 * scheinbar unausgefülltes Pflichtfeld, wählte EUR — und das Zurücknehmen des
 * Angebots hätte Bestandsdaten stillschweigend umgeschrieben statt sie nur
 * nicht mehr zu vermehren. Der Weg zurück nach EUR bleibt offen, der Weg zu
 * einer NEUEN Fremdwährung ist zu.
 */
function waehrungsOptionen(gespeicherte: string | undefined): string[] {
  return gespeicherte && gespeicherte !== RECHENWAEHRUNG
    ? [RECHENWAEHRUNG, gespeicherte]
    : [RECHENWAEHRUNG];
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  accounts,
  onSave,
  isLoading,
}: AccountFormDialogProps) {
  const { t } = useI18n();
  const accountTypeLabels = getAccountTypeLabels();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState('EUR');
  const [iban, setIban] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1d5c54');
  const [icon, setIcon] = useState('🏦');
  const [isBudgetPoolMember, setIsBudgetPoolMember] = useState(true);
  const [isBusiness, setIsBusiness] = useState(false);
  const [statementCloseDay, setStatementCloseDay] = useState<number | null>(null);
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [autopayAccountId, setAutopayAccountId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [openingBalanceDate, setOpeningBalanceDate] = useState('');
  const [manualBalance, setManualBalance] = useState<number | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setCurrency(account.currency);
      setIban(account.iban || '');
      setDescription(account.description || '');
      setColor(account.color);
      setIcon(account.icon);
      setIsBudgetPoolMember(account.is_budget_pool_member);
      setIsBusiness(account.is_business ?? false);
      setStatementCloseDay(account.statement_close_day || null);
      setDueDay(account.due_day || null);
      setAutopayAccountId(account.autopay_account_id || '');
      setOpeningBalance(account.opening_balance || null);
      setOpeningBalanceDate(account.opening_balance_date || '');
      setManualBalance(
        account.live_balance_type === 'manual' && account.live_balance_amount != null
          ? account.live_balance_amount
          : null
      );
    } else {
      setName('');
      setType('checking');
      setCurrency('EUR');
      setIban('');
      setDescription('');
      setColor(ACCOUNT_TYPE_COLORS.checking);
      setIcon(ACCOUNT_TYPE_ICONS.checking);
      setIsBudgetPoolMember(true);
      setIsBusiness(false);
      setStatementCloseDay(null);
      setDueDay(null);
      setAutopayAccountId('');
      setOpeningBalance(null);
      setOpeningBalanceDate('');
      setManualBalance(null);
    }
  }, [account, open]);

  useEffect(() => {
    if (!account) {
      setColor(ACCOUNT_TYPE_COLORS[type]);
      setIcon(ACCOUNT_TYPE_ICONS[type]);
      setIsBudgetPoolMember(type !== 'savings');
    }
  }, [type, account]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Manuelle Saldo-Korrektur: überschreibt (bzw. löscht) live_balance_*,
    // ohne einen vorhandenen Bank-Sync-Saldo zu berühren, falls nichts
    // eingegeben wurde.
    let liveBalanceUpdate: Partial<Account> = {};
    if (manualBalance !== null) {
      liveBalanceUpdate = {
        live_balance_amount: manualBalance,
        live_balance_currency: currency,
        live_balance_type: 'manual',
        live_balance_updated_at: new Date().toISOString(),
      };
    } else if (account?.live_balance_type === 'manual') {
      liveBalanceUpdate = {
        live_balance_amount: null,
        live_balance_currency: null,
        live_balance_type: null,
        live_balance_updated_at: null,
      };
    }

    onSave({
      name,
      type,
      currency,
      iban: iban.trim() || null,
      description,
      color,
      icon,
      is_budget_pool_member: isBudgetPoolMember,
      is_business: isBusiness,
      statement_close_day: type === 'credit_card' ? statementCloseDay : null,
      due_day: type === 'credit_card' ? dueDay : null,
      autopay_account_id: type === 'credit_card' ? autopayAccountId : null,
      opening_balance: openingBalance ?? 0,
      opening_balance_date: openingBalance !== null ? (openingBalanceDate || null) : null,
      ...liveBalanceUpdate,
    });
  };

  const otherAccounts = accounts.filter(a => a.id !== account?.id && a.type === 'checking');
  // Aus dem KONTO abgeleitet, nicht aus dem Formularzustand: Wer die
  // Fremdwährung testweise auf EUR stellt, soll den Weg zurück haben,
  // solange nicht gespeichert ist.
  const currencyOptions = waehrungsOptionen(account?.currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {account ? t('accounts.formDialog.titleEdit') : t('accounts.formDialog.titleNew')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('accounts.formDialog.nameLabel')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('accounts.formDialog.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t('accounts.formDialog.typeLabel')}</Label>
            <Select value={type} onValueChange={(val) => setType(val as AccountType)}>
              <SelectTrigger aria-label={t('accounts.formDialog.typeLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((accountType) => (
                  <SelectItem key={accountType} value={accountType}>
                    {ACCOUNT_TYPE_ICONS[accountType]} {accountTypeLabels[accountType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">{t('accounts.formDialog.currencyLabel')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger aria-label={t('accounts.formDialog.currencyLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {/* Nur EUR hat einen übersetzten Anzeigetext. Eine
                          gespeicherte Fremdwährung wird als ihr Code gezeigt:
                          Sie stammt aus Importdaten und kann jeder ISO-Code
                          sein — eine Handliste von Beschriftungen würde für
                          alles außerhalb ihrer selbst leer bleiben. */}
                      {code === RECHENWAEHRUNG ? t('accounts.formDialog.currencyEur') : code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">{t('accounts.formDialog.colorLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder={t('accounts.formDialog.iconPlaceholder')}
                  className="w-16 text-center"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {currency !== RECHENWAEHRUNG && (
            <p className="text-xs text-muted-foreground -mt-2">
              {t('accounts.formDialog.currencyForeignHint')}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="iban">{t('accounts.formDialog.ibanLabel')}</Label>
            <Input
              id="iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder={t('accounts.formDialog.ibanPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('accounts.formDialog.ibanHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('accounts.formDialog.descriptionLabel')}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('accounts.formDialog.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">{t('accounts.formDialog.openingBalanceLabel')}</Label>
              <DecimalInput
                id="openingBalance"
                value={openingBalance}
                onChange={setOpeningBalance}
                placeholder={t('accounts.formDialog.openingBalancePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingBalanceDate">{t('accounts.formDialog.balanceDateLabel')}</Label>
              <Input
                id="openingBalanceDate"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                disabled={openingBalance === null}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {t('accounts.formDialog.balanceHint')}
          </p>

          {account && (
            <div className="space-y-2">
              <Label htmlFor="manualBalance">{t('accounts.formDialog.manualBalanceLabel')}</Label>
              <DecimalInput
                id="manualBalance"
                value={manualBalance}
                onChange={setManualBalance}
                placeholder={
                  account.live_balance_amount != null
                    ? t('accounts.formDialog.manualBalanceCurrentPrefix') + account.live_balance_amount
                    : t('accounts.formDialog.manualBalancePlaceholder')
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('accounts.formDialog.manualBalanceHint')}
                {account.gocardless_account_id && t('accounts.formDialog.manualBalanceHintWithSync')}
                {t('accounts.formDialog.manualBalanceClearHint')}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isBudgetPool">{t('accounts.formDialog.budgetPoolLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('accounts.formDialog.budgetPoolHint')}
              </p>
            </div>
            <Switch
              id="isBudgetPool"
              checked={isBudgetPoolMember}
              onCheckedChange={setIsBudgetPoolMember}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isBusiness">{t('accounts.formDialog.businessLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('accounts.formDialog.businessHint')}
              </p>
            </div>
            <Switch
              id="isBusiness"
              checked={isBusiness}
              onCheckedChange={setIsBusiness}
            />
          </div>

          {type === 'credit_card' && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                {t('accounts.formDialog.creditCardSettings')}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statementCloseDay">{t('accounts.formDialog.statementCloseLabel')}</Label>
                  <Input
                    id="statementCloseDay"
                    type="number"
                    min={1}
                    max={31}
                    value={statementCloseDay || ''}
                    onChange={(e) => setStatementCloseDay(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder={t('accounts.formDialog.statementClosePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDay">{t('accounts.formDialog.dueDayLabel')}</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay || ''}
                    onChange={(e) => setDueDay(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder={t('accounts.formDialog.dueDayPlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autopayAccount">{t('accounts.formDialog.autopayAccountLabel')}</Label>
                <Select
                  value={autopayAccountId || ''}
                  onValueChange={(val) => setAutopayAccountId(val === '__none__' ? null : val)}
                >
                  <SelectTrigger aria-label={t('accounts.formDialog.autopayAccountLabel')}>
                    <SelectValue placeholder={t('accounts.formDialog.autopayAccountPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('accounts.formDialog.autopayAccountNone')}</SelectItem>
                    {otherAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.icon} {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('accounts.formDialog.cancelButton')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? t('accounts.formDialog.saveButtonLoading') : t('accounts.formDialog.saveButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}