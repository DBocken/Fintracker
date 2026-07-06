import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import { InfoGroup, InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import type { EtoroPnlResponse } from '@/services/etoro-api-schemas';
import { selectAccountPnl } from '@/services/etoro-history';

interface EtoroDemoAccountCardProps {
  isLoading: boolean;
  error: Error | null;
  pnl: EtoroPnlResponse | undefined;
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';
const signTone = (v: number | undefined): InfoStat['tone'] => (v ?? 0) >= 0 ? 'positive' : 'warning';

/**
 * Kleiner Zusatzblock im Übersicht-Tab für das eToro-Demo-Konto (falls
 * vorhanden). Kein Demo-Konto zu haben ist der Normalfall — anders als bei den
 * übrigen eToro-Sektionen degradiert diese Karte deshalb bewusst still (kein
 * EtoroScopeGate, keine Fehlermeldung): Laden/Fehler/fehlende Daten ⇒ null.
 */
export default function EtoroDemoAccountCard({ isLoading, error, pnl }: EtoroDemoAccountCardProps) {
  const { t } = useI18n();

  if (isLoading || error) return null;

  const { credit, unrealizedPnl } = selectAccountPnl(pnl);
  if (credit == null && unrealizedPnl == null) return null;

  const stats: InfoStat[] = [
    { label: t('trading.etoro.demo.credit'), value: formatCurrency(credit ?? 0, USD) },
    {
      label: t('trading.etoro.demo.unrealizedPnl'),
      value: formatCurrency(unrealizedPnl ?? 0, USD),
      tone: signTone(unrealizedPnl),
    },
  ];

  return (
    <InfoGroup title={t('trading.etoro.demo.title')}>
      <InfoStatStrip items={stats} />
    </InfoGroup>
  );
}
