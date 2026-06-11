import { AccountManager } from "@/components/accounts/AccountManager";
import { FeatureGate } from "@/components/FeatureGate";

export default function AccountsPage() {
  return (
    <FeatureGate feature="bankSync">
      <AccountManager />
    </FeatureGate>
  );
}
