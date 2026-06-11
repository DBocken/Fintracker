import { Switch } from '@/components/ui/switch';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

/**
 * Lokale Beta-Schalter. Bewusst standardmäßig aus – betrifft Bereiche, die nicht
 * zum monetarisierten Kern gehören (z. B. das Trading-Modul, Issue #33).
 */
export function BetaFeaturesSettings() {
  const [tradingEnabled, setTradingEnabled] = useFeatureFlag('trading_beta');

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white">Trading (Beta)</div>
          <p className="mt-1 text-sm text-slate-400">
            Experimentelles Depot- und Trading-Modul. Noch nicht Teil des Kernprodukts –
            bei Bedarf hier aktivieren. Die Einstellung gilt nur auf diesem Gerät.
          </p>
        </div>
        <Switch
          checked={tradingEnabled}
          onCheckedChange={setTradingEnabled}
          aria-label="Trading-Beta aktivieren"
        />
      </div>
    </div>
  );
}

export default BetaFeaturesSettings;
