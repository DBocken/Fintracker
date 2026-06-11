import { EnhancedSettings } from '../components/settings/EnhancedSettings';
import { FeatureGate } from "@/components/FeatureGate";

export default function SettingsPage() {
  return (
    <FeatureGate feature="bankSync">
      <EnhancedSettings />
    </FeatureGate>
  );
}