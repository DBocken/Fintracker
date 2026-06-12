import { useGentleMode } from "@/components/providers/GentleModeProvider";

interface GentleAmountFormatOptions {
  showProgress?: boolean;
  hideNegative?: boolean;
}

/**
 * Hook to format amounts according to gentle mode setting.
 * When gentle mode is enabled, shows "***" instead of actual amounts.
 * Optionally shows progress (percentage) instead.
 */
export function useGentleAmount(options: GentleAmountFormatOptions = {}) {
  const { enabled } = useGentleMode();
  const { hideNegative = false } = options;

  return {
    formatAmount: (amount: number, placeholder = "***") => {
      if (!enabled) {
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
        }).format(amount);
      }
      return placeholder;
    },
    formatPercent: (percent: number) => {
      if (!enabled) {
        return `${percent.toFixed(1)}%`;
      }
      return "••%";
    },
    shouldHideAmount: () => enabled,
    shouldHideNegative: () => enabled && hideNegative,
  };
}
