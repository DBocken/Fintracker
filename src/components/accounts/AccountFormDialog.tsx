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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Account, AccountType } from '../../types';
import { 
  ACCOUNT_TYPE_LABELS, 
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

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  accounts,
  onSave,
  isLoading,
}: AccountFormDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState('EUR');
  const [iban, setIban] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#1d5c54');
  const [icon, setIcon] = useState('🏦');
  const [isBudgetPoolMember, setIsBudgetPoolMember] = useState(true);
  const [statementCloseDay, setStatementCloseDay] = useState<number | null>(null);
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [autopayAccountId, setAutopayAccountId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState('');
  const [manualBalance, setManualBalance] = useState('');

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
      setStatementCloseDay(account.statement_close_day || null);
      setDueDay(account.due_day || null);
      setAutopayAccountId(account.autopay_account_id || '');
      setOpeningBalance(account.opening_balance ? String(account.opening_balance) : '');
      setOpeningBalanceDate(account.opening_balance_date || '');
      setManualBalance(
        account.live_balance_type === 'manual' && account.live_balance_amount != null
          ? String(account.live_balance_amount)
          : ''
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
      setStatementCloseDay(null);
      setDueDay(null);
      setAutopayAccountId('');
      setOpeningBalance('');
      setOpeningBalanceDate('');
      setManualBalance('');
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
    if (manualBalance.trim()) {
      liveBalanceUpdate = {
        live_balance_amount: Number(manualBalance.replace(',', '.')),
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
      statement_close_day: type === 'credit_card' ? statementCloseDay : null,
      due_day: type === 'credit_card' ? dueDay : null,
      autopay_account_id: type === 'credit_card' ? autopayAccountId : null,
      opening_balance: openingBalance.trim() ? Number(openingBalance.replace(',', '.')) : 0,
      opening_balance_date: openingBalance.trim() ? (openingBalanceDate || null) : null,
      ...liveBalanceUpdate,
    });
  };

  const otherAccounts = accounts.filter(a => a.id !== account?.id && a.type === 'checking');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {account ? 'Konto bearbeiten' : 'Neues Konto erstellen'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Sparkasse Girokonto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Kontotyp</Label>
            <Select value={type} onValueChange={(val) => setType(val as AccountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCOUNT_TYPE_ICONS[t]} {ACCOUNT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Währung</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Farbe</Label>
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
                  placeholder="🏦"
                  className="w-16 text-center"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN (optional)</Label>
            <Input
              id="iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="z.B. DE89 3704 0044 0532 0130 00"
            />
            <p className="text-xs text-muted-foreground">
              Wird zum automatischen Erkennen interner Überträge zwischen deinen Konten
              genutzt – z.B. damit eine Umbuchung vom Tagesgeld aufs Girokonto erkannt
              und auf dem nicht synchronisierten Konto mitgebucht wird.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Hauptkonto für Gehalt"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Startsaldo (optional)</Label>
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="z.B. 1234.56"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingBalanceDate">Saldo-Stichtag</Label>
              <Input
                id="openingBalanceDate"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                disabled={!openingBalance.trim()}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Saldo vor der ersten importierten/erfassten Transaktion. Wird zur Summe
            der Transaktionen addiert, damit der berechnete Saldo dem echten
            Kontostand entspricht.
          </p>

          {account && (
            <div className="space-y-2">
              <Label htmlFor="manualBalance">Aktueller Kontostand (manuelle Korrektur)</Label>
              <Input
                id="manualBalance"
                type="number"
                step="0.01"
                value={manualBalance}
                onChange={(e) => setManualBalance(e.target.value)}
                placeholder={
                  account.live_balance_amount != null
                    ? `Aktuell: ${account.live_balance_amount}`
                    : 'z.B. 1234.56'
                }
              />
              <p className="text-xs text-muted-foreground">
                Überschreibt den berechneten/synchronisierten Saldo direkt – z.B. um nach
                einem CSV-Import den echten Kontostand laut Kontoauszug einzutragen.
                {account.gocardless_account_id && ' Wird beim nächsten Bank-Sync wieder überschrieben.'}
                {' '}Feld leeren, um die Korrektur zu entfernen.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Budget-Pool Mitglied</Label>
              <p className="text-xs text-muted-foreground">
                Im gemeinsamen Budget berücksichtigen
              </p>
            </div>
            <Switch
              checked={isBudgetPoolMember}
              onCheckedChange={setIsBudgetPoolMember}
            />
          </div>

          {type === 'credit_card' && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                Kreditkarten-Einstellungen
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statementCloseDay">Abrechnungstag</Label>
                  <Input
                    id="statementCloseDay"
                    type="number"
                    min={1}
                    max={31}
                    value={statementCloseDay || ''}
                    onChange={(e) => setStatementCloseDay(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="z.B. 15"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDay">Fälligkeitstag</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay || ''}
                    onChange={(e) => setDueDay(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="z.B. 1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autopayAccount">Ausgleichskonto</Label>
                <Select
                  value={autopayAccountId || ''}
                  onValueChange={(val) => setAutopayAccountId(val === '__none__' ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Konto für automatischen Ausgleich" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keins</SelectItem>
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
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}