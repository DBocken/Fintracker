import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formatiert einen Satz (0,2 → „20 %") im deutschen Zahlenformat. */
export function formatPercent(rate: number, maxDecimals: number = 1): string {
  return `${(rate * 100).toLocaleString('de-DE', { maximumFractionDigits: maxDecimals })} %`;
}