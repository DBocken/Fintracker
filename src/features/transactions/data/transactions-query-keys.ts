// Slice-Vollständigkeit (jede Feature-Slice hat ihre eigene Query-Keys-Datei) +
// eine Quelle (kanonisch: finance-query-keys.ts, von ≥2 Slices genutzt).
export { financeKeys as transactionsKeys } from '@/features/shared/data/finance-query-keys';
