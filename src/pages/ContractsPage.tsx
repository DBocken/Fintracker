"use client";

import { ContractsDashboard } from "@/components/contracts/ContractsDashboard";
import { FeatureGate } from "@/components/FeatureGate";

export default function ContractsPage() {
  return (
    <FeatureGate feature="bankSync">
      <ContractsDashboard />
    </FeatureGate>
  );
}
