import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { FeatureFlag } from '@/lib/feature-flags';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

/**
 * Schützt eine Route hinter einem lokalen Beta-Flag — reaktiv: Das Umschalten
 * in den Einstellungen greift sofort, ohne Seiten-Reload (vorher las App.tsx
 * das Flag nur einmalig beim Rendern und leitete danach fälschlich weiter).
 */
export default function BetaRoute({ flag, children }: { flag: FeatureFlag; children: ReactNode }) {
  const [enabled] = useFeatureFlag(flag);
  return enabled ? <>{children}</> : <Navigate to="/coach" replace />;
}
