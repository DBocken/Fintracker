import { AccountManager } from "@/components/accounts/AccountManager";
import { CashSection } from "@/components/accounts/CashSection";
import { FeatureGate } from "@/components/FeatureGate";

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <CashSection />
      <FeatureGate feature="bankSync">
        <AccountManager />
      </FeatureGate>
    </div>
  );
}
