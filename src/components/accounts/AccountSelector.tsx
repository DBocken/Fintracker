"use client";

import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getAccounts, ACCOUNT_TYPE_LABELS } from '../../services/account-service';

interface AccountSelectorProps {
  value: string | null;
  onChange: (accountId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AccountSelector({
  value,
  onChange,
  placeholder = 'Konto auswählen',
  disabled = false,
  className,
}: AccountSelectorProps) {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Lade Konten..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Keine Konten vorhanden
          </div>
        ) : (
          accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                <span>{account.icon}</span>
                <span>{account.name}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                </Badge>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}