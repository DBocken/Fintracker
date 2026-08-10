import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * WP 5.3 (KOMP-5) — `onValueChange={(v) => set(v as Union)}` stand fast
 * wortgleich 5× in `BudgetFormDialog.tsx` und 2× in `DebtFormDialog.tsx`.
 * Radix' `<Select>` kennt intern nur `string` (das DOM kennt keine
 * TypeScript-Unions) — der Cast ist deshalb nicht wirklich vermeidbar,
 * sondern nur VERLEGBAR: `TypedSelect<T>` zentralisiert ihn auf genau diese
 * eine, hier getestete Stelle, statt ihn an jeder Aufrufstelle zu wiederholen.
 */
export interface TypedSelectOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface TypedSelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly TypedSelectOption<T>[];
  placeholder?: ReactNode;
  /** Pflicht-Name für Screenreader — siehe `pnpm check:a11y-names`. */
  "aria-label": string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function TypedSelect<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  "aria-label": ariaLabel,
  id,
  className,
  disabled,
}: TypedSelectProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
