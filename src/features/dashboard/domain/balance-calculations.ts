// Kanonische Quelle: src/features/shared/domain/balance-calculations.ts (≥2 Slices benötigen diese Logik).
export {
  computeLocalBalances,
  computeAnchoredBalance,
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
  pickBalanceAnchor,
} from '@/features/shared/domain/balance-calculations';
export type { BalanceAnchor, EffectiveBalance } from '@/features/shared/domain/balance-calculations';
