import { SimulationPage } from '../components/simulation/SimulationPage';
import { FeatureGate } from "@/components/FeatureGate";

export default function SimulationPageWrapper() {
  return (
    <FeatureGate feature="simulation">
      <SimulationPage />
    </FeatureGate>
  );
}